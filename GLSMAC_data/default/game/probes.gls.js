const STANDARD_MORALE = 2;
const MAX_ENERGY_CREDITS = 1000000000;

const operations = {
	infiltrate: {name: 'Infiltrate Datalinks', target: 'base', chance: 85, cost: false},
	steal_technology: {name: 'Procure Research Data', target: 'base', chance: 70, cost: false},
	sabotage: {name: 'Activate Sabotage Virus', target: 'base', chance: 65, cost: false},
	drain_energy: {name: 'Drain Energy Reserves', target: 'base', chance: 75, cost: false},
	subvert_unit: {name: 'Subvert Unit', target: 'unit', chance: 100, cost: true},
	mind_control_base: {name: 'Mind Control Base', target: 'base', chance: 100, cost: true},
};

const is_probe = (unit) => {
	return #typeof(unit) == 'Object' && #typeof(unit.get_def) == 'Callable' &&
		unit.get_def().weapon == 'ProbeTeam';
};

const get_rating = (game, player) => {
	const resolver = game.get('f_social_get_ratings');
	return #is_defined(resolver) ? resolver(player).probe : 0;
};

const has_project = (game, player, project_id) => {
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id != player.id) {
			continue;
		}
		for (facility of base.get_facilities()) {
			if (facility.id == project_id && facility.is_project) {
				return true;
			}
		}
	}
	return false;
};

const get_effective_rating = (game, player) => {
	return #min(
		3,
		get_rating(game, player) +
			(has_project(game, player, 'TheTelepathicMatrix') ? 2 : 0)
	);
};

const get_cost_multiplier = (game, player) => {
	const rating = get_effective_rating(game, player);
	if (rating <= 0 - 2) { return 0.5; }
	if (rating == 0 - 1) { return 0.75; }
	if (rating == 1) { return 1.5; }
	if (rating == 2) { return 2.0; }
	if (rating >= 3) { return null; }
	return 1.0;
};

const has_ability = (def, id) => {
	for (ability of def.abilities) {
		if (ability == id) {
			return true;
		}
	}
	return false;
};

const get_headquarters = (game, player) => {
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id && base.has_facility('Headquarters')) {
			return base;
		}
	}
	return null;
};

const get_headquarters_distance = (game, player, tile) => {
	const headquarters = get_headquarters(game, player);
	return headquarters == null
		? 12
		: game.get_tm().get_distance(headquarters.get_tile(), tile);
};

const get_subversion_cost = (game, actor, target) => {
	const target_player = game.get_player(target.owner);
	const multiplier = get_cost_multiplier(game, target_player);
	if (multiplier == null) {
		return null;
	}
	const distance = get_headquarters_distance(game, target_player, target.get_tile());
	const def = target.get_def();
	let cost = #to_float(def.mineral_cost) *
		#to_float(target_player.energy_credits + 80) /
		#to_float((distance + 2) * 10);
	if (!def.can_found_base && !def.can_terraform) {
		cost *= 0.5;
	}
	if (has_ability(def, 'PolymorphicEncryption')) {
		cost *= 2.0;
	}
	return #max(10, #ceil(cost * multiplier));
};

const get_base_garrison_value = (game, base) => {
	let value = 0;
	for (unit of game.get_um().get_units()) {
		if (unit.owner == base.get_owner().id && unit.get_tile() == base.get_tile()) {
			value += #max(unit.get_def().mineral_cost, 10);
		}
	}
	return value;
};

const get_mind_control_cost = (game, actor, base) => {
	const target_player = base.get_owner();
	const multiplier = get_cost_multiplier(game, target_player);
	if (multiplier == null || base.has_facility('Headquarters')) {
		return null;
	}
	const distance = get_headquarters_distance(game, target_player, base.get_tile());
	const population_value = base.get_size() * 10;
	const garrison_value = get_base_garrison_value(game, base);
	let cost = #to_float(#max(population_value + garrison_value, 20)) *
		#to_float(target_player.energy_credits + 120) /
		#to_float((distance + 4) * 10);
	if (base.has_facility('GenejackFactory')) {
		cost *= 0.5;
	}
	if (base.has_facility('ChildrenSCreche')) {
		cost *= 2.0;
	}
	if (base.has_facility('PunishmentSphere')) {
		cost *= 2.0;
	}
	const relation = actor.get_diplomatic_relation(target_player);
	if (relation == 'treaty' || relation == 'pact') {
		cost *= 2.0;
	}
	return #max(20, #ceil(cost * multiplier));
};

const get_success_chance = (game, probe, target_player, operation) => {
	const definition = operations[operation];
	if (!#is_defined(definition)) {
		return 0;
	}
	if (definition.cost) {
		return 100;
	}
	const morale_bonus = (probe.morale - STANDARD_MORALE) * 5;
	const defender_penalty = get_effective_rating(game, target_player) * 10;
	return #max(5, #min(95, definition.chance + morale_bonus - defender_penalty));
};

const get_unknown_technologies = (actor, target_player) => {
	let actor_known = {};
	for (id of actor.get_research_state().technologies) {
		actor_known[id] = true;
	}
	let result = [];
	for (id of target_player.get_research_state().technologies) {
		if (!#is_defined(actor_known[id])) {
			result :+id;
		}
	}
	return result;
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_probe_get_operations', () => { return operations; });
		game.set('f_probe_is_unit', is_probe);
		game.set('f_probe_has_project', (player, id) => { return has_project(game, player, id); });
		game.set('f_probe_get_effective_rating', (player) => { return get_effective_rating(game, player); });
		game.set('f_probe_get_cost_multiplier', (player) => { return get_cost_multiplier(game, player); });
		game.set('f_probe_get_subversion_cost', (actor, target) => {
			return get_subversion_cost(game, actor, target);
		});
		game.set('f_probe_get_mind_control_cost', (actor, base) => {
			return get_mind_control_cost(game, actor, base);
		});
		game.set('f_probe_get_success_chance', (probe, target, operation) => {
			return get_success_chance(game, probe, target, operation);
		});
		game.set('f_probe_get_unknown_technologies', get_unknown_technologies);
		game.set('f_probe_max_energy_credits', () => { return MAX_ENERGY_CREDITS; });
	});
};
