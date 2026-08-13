const get_base_manager = (game) => {
	return #typeof(game.get_bm) == 'Callable' ? game.get_bm() : game.bm;
};

const get_unit_manager = (game) => {
	return #typeof(game.get_um) == 'Callable' ? game.get_um() : game.um;
};

const get_tile_manager = (game) => {
	return #typeof(game.get_tm) == 'Callable' ? game.get_tm() : game.tm;
};

const is_probe = (unit) => {
	return #typeof(unit) == 'Object' && #typeof(unit.get_def) == 'Callable' &&
		unit.get_def().weapon == 'ProbeTeam';
};

const is_coastal = (tile) => {
	if (tile.is_water) {
		return true;
	}
	if (#typeof(tile.get_surrounding_tiles) != 'Callable') {
		return false;
	}
	for (nearby of tile.get_surrounding_tiles()) {
		if (nearby.is_water) {
			return true;
		}
	}
	return false;
};

const can_return_to = (probe, base) => {
	const tile = base.get_tile();
	if (#is_defined(probe.is_water) && probe.is_water) {
		return is_coastal(tile);
	}
	return !tile.is_water;
};

const get_return_base = (game, probe) => {
	let best = null;
	let best_distance = 0;
	for (base of get_base_manager(game).get_bases()) {
		if (base.get_owner().id != probe.owner || !can_return_to(probe, base)) {
			continue;
		}
		const distance = get_tile_manager(game).get_distance(
			probe.get_tile(),
			base.get_tile()
		);
		if (
			best == null || distance < best_distance ||
			(distance == best_distance && base.id < best.id)
		) {
			best = base;
			best_distance = distance;
		}
	}
	return best;
};

const get_territory_owner = (game, tile) => {
	if (#typeof(game.get) != 'Callable') {
		return null;
	}
	const resolver = game.get('f_territory_get_owner');
	return #is_defined(resolver) ? resolver(tile) : null;
};

const get_player = (game, unit) => {
	if (#typeof(unit.get_owner) == 'Callable') {
		return unit.get_owner();
	}
	return #typeof(game.get_player) == 'Callable'
		? game.get_player(unit.owner) : null;
};

const get_interception = (game, interceptor, defender) => {
	if (
		!#is_defined(game) || !#is_defined(interceptor) || !#is_defined(defender) ||
		interceptor.owner == defender.owner || interceptor.get_def().offense <= 0 ||
		!is_probe(defender) ||
		(#is_defined(defender.transport_id) && defender.transport_id > 0)
	) {
		return null;
	}
	const tile = defender.get_tile();
	if (!interceptor.get_tile().is_adjactent_to(tile)) {
		return null;
	}
	let foreign_units = [];
	for (unit of tile.get_units()) {
		if (unit.owner != interceptor.owner && unit.health > 0.0) {
			foreign_units :+unit;
		}
	}
	if (#sizeof(foreign_units) != 1 || foreign_units[0].id != defender.id) {
		return null;
	}
	const interceptor_owner = get_player(game, interceptor);
	const probe_owner = get_player(game, defender);
	if (
		interceptor_owner == null || probe_owner == null ||
		#typeof(interceptor_owner.get_diplomatic_relation) != 'Callable'
	) {
		return null;
	}
	const relation = interceptor_owner.get_diplomatic_relation(probe_owner);
	if (relation != 'neutral' && relation != 'treaty') {
		return null;
	}
	const territory_owner = get_territory_owner(game, tile);
	if (territory_owner == null || territory_owner.id != interceptor_owner.id) {
		return null;
	}
	const return_base = get_return_base(game, defender);
	return return_base == null ? null : {
		probe: defender,
		probe_owner: probe_owner,
		interceptor_owner: interceptor_owner,
		return_base: return_base,
	};
};

const resolve = (game, interceptor, defender) => {
	const interception = get_interception(game, interceptor, defender);
	return interception == null ? null : {
		probe: interception.probe,
		probe_id: interception.probe.id,
		return_base: interception.return_base,
		return_base_id: interception.return_base.id,
	};
};

const apply = (game, interceptor, resolved) => {
	const probe = resolved.probe;
	const return_base = resolved.return_base;
	if (return_base == null) {
		throw Error('Probe interception return base no longer exists');
	}
	const result = {
		probe_id: probe.id,
		tile: probe.get_tile(),
		movement: probe.movement + 0.0,
		moved_this_turn: probe.moved_this_turn == true,
	};
	probe.teleport_to_tile(return_base.get_tile());
	const interceptor_owner = get_player(game, interceptor);
	const probe_owner = get_player(game, probe);
	game.trigger('probe_interrogated', {
		player: interceptor_owner,
		target: probe_owner,
		unit: probe,
		base: return_base,
	});
	game.message(
		interceptor_owner.name + ' interrogated and repatriated a ' +
		probe_owner.name + ' Probe Team to ' + return_base.name + '.'
	);
	return result;
};

const rollback = (game, applied) => {
	const um = get_unit_manager(game);
	if (!um.has_unit(applied.probe_id)) {
		return;
	}
	const probe = um.get_unit(applied.probe_id);
	probe.teleport_to_tile(applied.tile);
	probe.movement = applied.movement;
	probe.moved_this_turn = applied.moved_this_turn;
};

return {
	get_interception: get_interception,
	resolve: resolve,
	apply: apply,
	rollback: rollback,
};
