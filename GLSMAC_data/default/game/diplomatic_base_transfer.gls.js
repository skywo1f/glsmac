const base_capture = #include('./base_capture');
const project_acquisition = #include('./project_acquisition');

const get_base_manager = (game) => {
	return #typeof(game.get_bm) == 'Callable' ? game.get_bm() : game.bm;
};

const get_unit_manager = (game) => {
	return #typeof(game.get_um) == 'Callable' ? game.get_um() : game.um;
};

const find_base = (game, base_id) => {
	if (#typeof(base_id) != 'Int' || base_id < 0) {
		return null;
	}
	for (base of get_base_manager(game).get_bases()) {
		if (base.id == base_id) {
			return base;
		}
	}
	return null;
};

const get_player_base_count = (game, player) => {
	let count = 0;
	for (base of get_base_manager(game).get_bases()) {
		if (base.get_owner().id == player.id) {
			count++;
		}
	}
	return count;
};

const validate_transfer = (game, base_id, sender, recipient, label) => {
	if (base_id < 0) {
		return;
	}
	const base = find_base(game, base_id);
	if (base == null) {
		return 'The ' + label + ' base does not exist';
	}
	if (base.get_owner().id != sender.id) {
		return 'The ' + label + ' base is not controlled by its sender';
	}
	if (get_player_base_count(game, sender) <= 1) {
		return 'A faction cannot cede its last base';
	}
	if (base.has_facility('Headquarters')) {
		return 'A faction cannot cede its Headquarters';
	}
	if (recipient.id == sender.id) {
		return 'A faction cannot cede a base to itself';
	}
};

const get_base_trade_value = (game, base) => {
	if (base == null) {
		return 0;
	}
	let value = #max(1, base.get_size()) * 50;
	for (facility of base.get_facilities()) {
		const cost = #is_defined(facility.mineral_cost) ? facility.mineral_cost : 0;
		value += facility.is_project
			? #max(100, cost * 2)
			: #ceil(#to_float(cost) / 2.0);
	}
	const unit_manager = get_unit_manager(game);
	if (unit_manager != null) {
		for (unit of unit_manager.get_units()) {
			if (
				unit.owner != base.get_owner().id ||
				(unit.home_base_id != base.id && unit.get_tile() != base.get_tile())
			) {
				continue;
			}
			const definition = unit.get_def();
			if (#is_defined(definition.mineral_cost)) {
				value += #ceil(#to_float(definition.mineral_cost) / 2.0);
			}
		}
	}
	return #max(25, #ceil(#to_float(value) / 25.0) * 25);
};

const get_queue_specs = (base) => {
	let result = [];
	for (production of base.get_production_queue()) {
		result :+{
			kind: production.production_kind,
			id: production.id,
		};
	}
	return result;
};

const trigger_updates = (game, base, old_owner, new_owner) => {
	game.trigger('base_transferred', {
		base: base,
		old_owner: old_owner,
		new_owner: new_owner,
	});
	game.trigger('economy_updated', {player: old_owner});
	game.trigger('economy_updated', {player: new_owner});
};

const transfer_base = (game, base, new_owner) => {
	const old_owner = base.get_owner();
	const old_queue = get_queue_specs(base);
	const rehomed_units = base_capture.rehome_units(game, base, old_owner.id);
	base.set_owner(new_owner);
	const empath_guild_infiltration = base.has_facility('TheEmpathGuild')
		? project_acquisition.apply_empath_guild(game, base)
		: #undefined;
	if (base.has_facility('ThePlanetaryDatalinks')) {
		const queue_datalinks = game.get('f_project_queue_planetary_datalinks');
		if (#typeof(queue_datalinks) == 'Callable') {
			queue_datalinks();
		}
	}
	let valid_queue = [];
	for (production of old_queue) {
		if (base.can_produce(production.kind, production.id)) {
			valid_queue :+production;
		}
	}
	base.set_production_queue(valid_queue);
	trigger_updates(game, base, old_owner, new_owner);
	return {
		base: base,
		old_owner: old_owner,
		new_owner: new_owner,
		old_queue: old_queue,
		rehomed_units: rehomed_units,
		empath_guild_infiltration: empath_guild_infiltration,
	};
};

const restore_transfer = (game, snapshot) => {
	if (#is_defined(snapshot.empath_guild_infiltration)) {
		project_acquisition.rollback_empath_guild(snapshot.empath_guild_infiltration);
	}
	snapshot.base.set_owner(snapshot.old_owner);
	snapshot.base.set_production_queue(snapshot.old_queue);
	base_capture.restore_units(snapshot.rehomed_units);
	if (snapshot.base.has_facility('ThePlanetaryDatalinks')) {
		const queue_datalinks = game.get('f_project_queue_planetary_datalinks');
		if (#typeof(queue_datalinks) == 'Callable') {
			queue_datalinks();
		}
	}
	trigger_updates(game, snapshot.base, snapshot.new_owner, snapshot.old_owner);
};

return {
	find_base: find_base,
	get_player_base_count: get_player_base_count,
	validate_transfer: validate_transfer,
	get_base_trade_value: get_base_trade_value,
	transfer_base: transfer_base,
	restore_transfer: restore_transfer,
};
