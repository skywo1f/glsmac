const movement_rules = #include('./movement_rules');

const get_unit_manager = (game) => {
	return #typeof(game.get_um) == 'Callable' ? game.get_um() : game.um;
};

const get_base_manager = (game) => {
	return #typeof(game.get_bm) == 'Callable' ? game.get_bm() : game.bm;
};

const get_tile_manager = (game) => {
	return #typeof(game.get_tm) == 'Callable' ? game.get_tm() : game.tm;
};

const get_territory_owner = (game, tile) => {
	const resolver = game.get('f_territory_get_owner');
	return #typeof(resolver) == 'Callable' ? resolver(tile) : null;
};

const is_root_unit = (unit) => {
	return !#is_defined(unit.transport_id) || unit.transport_id == 0;
};

const get_intruding_unit_ids = (game, territory_owner, unit_owner) => {
	let result = [];
	for (unit of get_unit_manager(game).get_units()) {
		if (
			unit.owner != unit_owner.id || !is_root_unit(unit) ||
			(#is_defined(unit.health) && unit.health <= 0.0)
		) {
			continue;
		}
		const owner = get_territory_owner(game, unit.get_tile());
		if (owner != null && owner.id == territory_owner.id) {
			result :+(unit.id + 0);
		}
	}
	return result;
};

const is_preferred_base = (unit, base) => {
	const tile = base.get_tile();
	if (#is_defined(unit.is_land) && unit.is_land) {
		if (!#is_defined(tile.is_water)) {
			return true;
		}
		return !tile.is_water;
	}
	return true;
};

const get_return_base = (game, unit) => {
	const tm = get_tile_manager(game);
	let best = null;
	let best_preferred = false;
	let best_distance = 0;
	for (base of get_base_manager(game).get_bases()) {
		if (base.get_owner().id != unit.owner) {
			continue;
		}
		const preferred = is_preferred_base(unit, base);
		const distance = tm.get_distance(unit.get_tile(), base.get_tile());
		let select = best == null;
		if (!select) {
			if (preferred && !best_preferred) {
				select = true;
			}
		}
		if (!select) {
			if (preferred == best_preferred && distance < best_distance) {
				select = true;
			}
		}
		if (!select) {
			if (
				preferred == best_preferred && distance == best_distance &&
				base.id < best.id
			) {
				select = true;
			}
		}
		if (select) {
			best = base;
			best_preferred = preferred;
			best_distance = distance;
		}
	}
	return best;
};

const get_error = (game, territory_owner, unit_owner) => {
	if (territory_owner.get_diplomatic_relation(unit_owner) != 'treaty') {
		return 'Withdrawal can only be demanded from a Treaty partner';
	}
	const unit_ids = get_intruding_unit_ids(game, territory_owner, unit_owner);
	if (#sizeof(unit_ids) == 0) {
		return 'This faction has no units in your territory';
	}
	for (base of get_base_manager(game).get_bases()) {
		if (base.get_owner().id == unit_owner.id) {
			return;
		}
	}
	return 'This faction has no base to receive its units';
};

const apply = (game, territory_owner, unit_owner) => {
	const um = get_unit_manager(game);
	let result = [];
	for (unit_id of get_intruding_unit_ids(game, territory_owner, unit_owner)) {
		if (!um.has_unit(unit_id)) {
			continue;
		}
		const unit = um.get_unit(unit_id);
		const source = unit.get_tile();
		const destination = get_return_base(game, unit);
		if (destination == null) {
			throw Error('Withdrawal destination disappeared while applying repatriation');
		}
		result :+{
			id: unit.id + 0,
			tile_x: source.x + 0,
			tile_y: source.y + 0,
			movement: unit.movement + 0.0,
			moved_this_turn: unit.moved_this_turn == true,
			order: #is_defined(unit.order) ? '' + unit.order : 'none',
			terraforming: #is_defined(unit.terraforming) ? '' + unit.terraforming : 'none',
			terraforming_turns_remaining: #is_defined(unit.terraforming_turns_remaining)
				? unit.terraforming_turns_remaining + 0 : 0,
			convoy_resource: #is_defined(unit.convoy_resource)
				? '' + unit.convoy_resource : 'none',
			move_target: movement_rules.get_move_target_snapshot(unit),
		};
		movement_rules.clear_move_target(unit);
		if (#typeof(unit.set_order) == 'Callable') {
			unit.set_order('none');
		}
		if (#typeof(unit.set_terraforming_order) == 'Callable') {
			unit.set_terraforming_order('none', 0);
		}
		if (#typeof(unit.set_convoy_resource) == 'Callable') {
			unit.set_convoy_resource('none');
		}
		unit.teleport_to_tile(destination.get_tile());
	}
	return result;
};

const rollback = (game, snapshots) => {
	const um = get_unit_manager(game);
	const tm = get_tile_manager(game);
	for (let i = #sizeof(snapshots) - 1; i >= 0; i--) {
		const snapshot = snapshots[i];
		if (!um.has_unit(snapshot.id)) {
			continue;
		}
		const unit = um.get_unit(snapshot.id);
		unit.teleport_to_tile(tm.get_tile(snapshot.tile_x, snapshot.tile_y));
		unit.movement = snapshot.movement;
		unit.moved_this_turn = snapshot.moved_this_turn;
		if (#typeof(unit.set_order) == 'Callable') {
			unit.set_order(snapshot.order);
		}
		if (#typeof(unit.set_terraforming_order) == 'Callable') {
			unit.set_terraforming_order(
				snapshot.terraforming,
				snapshot.terraforming_turns_remaining
			);
		}
		if (#typeof(unit.set_convoy_resource) == 'Callable') {
			unit.set_convoy_resource(snapshot.convoy_resource);
		}
		movement_rules.restore_move_target(unit, tm, snapshot.move_target);
	}
};

return {
	get_intruding_unit_ids: get_intruding_unit_ids,
	get_return_base: get_return_base,
	get_error: get_error,
	apply: apply,
	rollback: rollback,
};
