const STANDARD_MORALE = 2;
const MAX_ENERGY_CREDITS = 1000000000;

const operations = {
	infiltrate: {name: 'Infiltrate Datalinks', target: 'base', chance: 85, cost: false},
	steal_technology: {name: 'Procure Research Data', target: 'base', chance: 70, cost: false},
	sabotage: {name: 'Activate Sabotage Virus', target: 'base', chance: 65, cost: false},
	drain_energy: {name: 'Drain Energy Reserves', target: 'base', chance: 75, cost: false},
	incite_drone_riots: {name: 'Incite Drone Riots', target: 'base', chance: 60, cost: false},
	assassinate_researchers: {
		name: 'Assassinate Prominent Researchers', target: 'base', chance: 50, cost: false,
	},
	genetic_plague: {
		name: 'Introduce Genetic Plague (Atrocity)', target: 'base', chance: 40, cost: false,
	},
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

const can_incite_drone_riots = (base) => {
	for (pop of base.get_pops()) {
		if (pop.get_type() != 'DRONE') {
			return true;
		}
	}
	return false;
};

const can_sabotage = (base) => {
	if (base.get_accumulated_minerals() > 0) {
		return true;
	}
	for (facility of base.get_facilities()) {
		if (!facility.is_project && facility.id != 'Headquarters') {
			return true;
		}
	}
	return false;
};

const get_assassination_research_loss = (player) => {
	const research = player.get_research_state();
	return research.target == '' || research.progress <= 0
		? 0
		: #max(1, #ceil(#to_float(research.progress) * 0.25));
};

const get_plague_population_loss = (base) => {
	const size = base.get_size();
	if (size <= 1) {
		return 0;
	}
	let protection = 0;
	if (base.has_facility('ResearchHospital')) { protection += 1; }
	if (base.has_facility('Nanohospital')) { protection += 1; }
	return #min(size - 1, #max(1, #ceil(#to_float(size) / 2.0) - protection));
};

const get_defending_probe = (game, target_player, base) => {
	let defender = null;
	for (unit of game.get_um().get_units()) {
		if (
			unit.owner != target_player.id || unit.get_tile() != base.get_tile() ||
			!is_probe(unit) || unit.health <= 0.0 ||
			(#is_defined(unit.transport_id) && unit.transport_id > 0)
		) {
			continue;
		}
		if (
			defender == null || unit.morale > defender.morale ||
			(unit.morale == defender.morale && unit.id < defender.id)
		) {
			defender = unit;
		}
	}
	return defender;
};

const get_success_chance = (game, probe, target_player, operation, target) => {
	const definition = operations[operation];
	if (!#is_defined(definition)) {
		return 0;
	}
	const defending_probe = definition.target == 'base' && #typeof(target) == 'Object'
		? get_defending_probe(game, target_player, target)
		: null;
	if (definition.cost && defending_probe == null) {
		return 100;
	}
	const morale_bonus = (probe.morale - STANDARD_MORALE) * 5;
	let defender_penalty = get_effective_rating(game, target_player) * 10;
	if (defending_probe != null) {
		defender_penalty += 20 + (defending_probe.morale - STANDARD_MORALE) * 5;
	}
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

const get_intelligence_source = (game, actor, target_player) => {
	if (actor.id == target_player.id) {
		return '';
	}
	if (
		#typeof(actor.has_infiltrated) == 'Callable' &&
		actor.has_infiltrated(target_player)
	) {
		return 'infiltrated_datalinks';
	}
	const has_intelligence = game.get('f_council_has_intelligence');
	return #typeof(has_intelligence) == 'Callable' &&
		has_intelligence(actor, target_player)
		? 'planetary_governor'
		: '';
};

const get_social_choice_names = (game, player) => {
	const choices = player.get_social_engineering();
	const get_categories = game.get('f_social_get_categories');
	if (#typeof(get_categories) != 'Callable') {
		return [
			choices.politics,
			choices.economics,
			choices.values,
			choices.future_society,
		];
	}
	let names = [];
	for (category of get_categories()) {
		const selected_id = choices[category.id];
		let selected_name = selected_id;
		for (choice of category.choices) {
			if (choice.id == selected_id) {
				selected_name = choice.name;
				break;
			}
		}
		names :+selected_name;
	}
	return names;
};

const get_intelligence_report = (game, actor, target_player) => {
	const source = get_intelligence_source(game, actor, target_player);
	if (source == '') {
		return null;
	}

	let base_count = 0;
	let population = 0;
	let facility_count = 0;
	let project_count = 0;
	let headquarters_name = '';
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id != target_player.id) {
			continue;
		}
		base_count++;
		population += base.get_size();
		for (facility of base.get_facilities()) {
			if (facility.is_project) {
				project_count++;
			} else {
				facility_count++;
			}
			if (facility.id == 'Headquarters') {
				headquarters_name = base.name;
			}
		}
	}

	let unit_count = 0;
	let combat_count = 0;
	let probe_count = 0;
	let colony_pod_count = 0;
	let former_count = 0;
	let land_count = 0;
	let sea_count = 0;
	let air_count = 0;
	for (unit of game.get_um().get_units(true)) {
		if (unit.owner != target_player.id || unit.health <= 0.0) {
			continue;
		}
		const def = unit.get_def();
		unit_count++;
		if (def.offense > 0) { combat_count++; }
		if (def.weapon == 'ProbeTeam') { probe_count++; }
		if (def.can_found_base) { colony_pod_count++; }
		if (def.can_terraform) { former_count++; }
		if (#is_defined(unit.is_air) && unit.is_air) {
			air_count++;
		} else if (#is_defined(unit.is_water) && unit.is_water) {
			sea_count++;
		} else {
			land_count++;
		}
	}
	const units = {
		total: unit_count,
		combat: combat_count,
		probes: probe_count,
		colony_pods: colony_pod_count,
		formers: former_count,
		land: land_count,
		sea: sea_count,
		air: air_count,
	};

	const research = target_player.get_research_state();
	const get_technology = game.get('f_technology_get_definition');
	const target = research.target == '' || #typeof(get_technology) != 'Callable'
		? null
		: get_technology(research.target);
	return {
		source: source,
		relation: actor.get_diplomatic_relation(target_player),
		energy_credits: target_player.get_energy_credits(),
		research: {
			target_id: research.target,
			target_name: target == null ? research.target : target.name,
			progress: research.progress,
			cost: target == null ? 0 : target.cost,
			known_technologies: #sizeof(research.technologies),
		},
		social_choices: get_social_choice_names(game, target_player),
		bases: {
			count: base_count,
			population: population,
			facilities: facility_count,
			projects: project_count,
			headquarters: headquarters_name,
		},
		units: units,
	};
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
		game.set('f_probe_can_incite_drone_riots', can_incite_drone_riots);
		game.set('f_probe_can_sabotage', can_sabotage);
		game.set('f_probe_get_assassination_research_loss', get_assassination_research_loss);
		game.set('f_probe_get_plague_population_loss', get_plague_population_loss);
		game.set('f_probe_get_defending_probe', (target_player, base) => {
			return get_defending_probe(game, target_player, base);
		});
		game.set('f_probe_get_success_chance', (probe, target_player, operation, target) => {
			return get_success_chance(game, probe, target_player, operation, target);
		});
		game.set('f_probe_get_unknown_technologies', get_unknown_technologies);
		game.set('f_probe_get_intelligence_source', (actor, target_player) => {
			return get_intelligence_source(game, actor, target_player);
		});
		game.set('f_probe_get_intelligence_report', (actor, target_player) => {
			return get_intelligence_report(game, actor, target_player);
		});
		game.set('f_probe_max_energy_credits', () => { return MAX_ENERGY_CREDITS; });
	});
};
