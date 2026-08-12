const MAX_ENERGY_CREDITS = 1000000000;
const RESEARCH_DATA_STOLEN_KEY = 'probe_research_data_stolen';
const ENERGY_RESERVES_DRAINED_KEY = 'probe_energy_reserves_drained';
const GENETIC_PLAGUE_KEY = 'probe_genetic_plague_introduced';
const FRAMEABLE_OPERATIONS = {
	steal_technology: true,
	sabotage: true,
	drain_energy: true,
	incite_drone_riots: true,
	assassinate_researchers: true,
};
const PROBE_MORALE_TECHNOLOGIES = [
	'PolymorphicSoftware',
	'PreSentientAlgorithms',
	'DigitalSentience',
	'SelfAwareMachines',
	'MindMachineInterface',
];
const GENETIC_DEFENSE_TECHNOLOGIES = [
	'Biogenetics',
	'GeneSplicing',
	'BioEngineering',
	'Biomachinery',
	'MatterEditation',
	'RetroviralEngineering',
];

const operations = {
	infiltrate: {name: 'Infiltrate Datalinks', target: 'base', difficulty: 0, cost: false},
	steal_technology: {name: 'Procure Research Data', target: 'base', difficulty: 0, cost: false},
	sabotage: {name: 'Activate Sabotage Virus', target: 'base', difficulty: 0, cost: false},
	drain_energy: {name: 'Drain Energy Reserves', target: 'base', difficulty: 0, cost: false},
	incite_drone_riots: {name: 'Incite Drone Riots', target: 'base', difficulty: 0, cost: false},
	assassinate_researchers: {
		name: 'Assassinate Prominent Researchers', target: 'base', difficulty: 1, cost: false,
	},
	genetic_plague: {
		name: 'Introduce Genetic Plague (Atrocity)', target: 'base', difficulty: 0, cost: false,
	},
	subvert_unit: {name: 'Subvert Unit', target: 'unit', difficulty: 0, cost: true},
	mind_control_base: {name: 'Mind Control Base', target: 'base', difficulty: 0, cost: true},
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

const get_rating_cost_multiplier = (rating) => {
	if (rating <= 0 - 2) { return 0.5; }
	if (rating == 0 - 1) { return 0.75; }
	if (rating == 1) { return 1.5; }
	if (rating == 2) { return 2.0; }
	if (rating >= 3) { return null; }
	return 1.0;
};

const apply_rating_cost = (cost, rating) => {
	if (rating <= 0 - 2) { return #floor(#to_float(cost) / 2.0); }
	if (rating == 0 - 1) { return cost - #floor(#to_float(cost) / 4.0); }
	if (rating == 1) { return cost + #floor(#to_float(cost) / 2.0); }
	if (rating == 2) { return cost * 2; }
	if (rating >= 3) { return null; }
	return cost;
};

const get_cost_multiplier = (game, player) => {
	return get_rating_cost_multiplier(get_effective_rating(game, player));
};

const has_ability = (def, id) => {
	if (!#is_defined(def.abilities)) {
		return false;
	}
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
	const rating = get_effective_rating(game, target_player);
	if (get_rating_cost_multiplier(rating) == null) {
		return null;
	}
	let distance = get_headquarters_distance(game, target_player, target.get_tile());
	if (#is_defined(target.home_base_id) && target.home_base_id > 0) {
		for (base of game.get_bm().get_bases()) {
			if (
				base.id == target.home_base_id &&
				base.get_owner().id == target_player.id &&
				base.has_facility('PunishmentSphere')
			) {
				distance = #floor(#to_float(distance) / 2.0);
				break;
			}
		}
	}
	const def = target.get_def();
	let cost = #max(1, #floor(#to_float(def.mineral_cost) / 10.0)) *
		#floor(#to_float(target_player.energy_credits + 800) / #to_float(distance + 2));
	cost = apply_rating_cost(cost, rating);
	if (has_ability(def, 'PolymorphicEncryption')) {
		cost *= 2;
	}
	if (!def.can_found_base && !def.can_terraform) {
		cost = #floor(#to_float(cost) / 2.0);
	}
	return cost;
};

const get_subversion_error = (probe, target) => {
	if (
		#typeof(target) != 'Object' || #typeof(target.get_def) != 'Callable' ||
		target.health <= 0.0 ||
		(#is_defined(target.transport_id) && target.transport_id > 0)
	) {
		return 'Probe subversion target must be an active, unembarked unit';
	}
	if (#is_defined(target.get_cargo) && #sizeof(target.get_cargo()) > 0) {
		return 'A transport carrying units cannot be subverted';
	}
	if (#is_defined(target.get_def().is_native) && target.get_def().is_native) {
		return 'Native life cannot be subverted by Probe Teams';
	}
	const tile = target.get_tile();
	if (#typeof(tile.get_units) == 'Callable') {
		let active_units = 0;
		for (unit of tile.get_units()) {
			if (unit.health > 0.0) {
				active_units++;
			}
		}
		if (active_units > 1) {
			return 'A unit in a stack cannot be individually subverted';
		}
	}
	if (
		#is_defined(target.is_air) && target.is_air &&
		!has_ability(probe.get_def(), 'AirSuperiority')
	) {
		return 'Air Superiority is required to subvert an air unit';
	}
	return '';
};

const get_base_garrison_value = (game, base) => {
	let combat_units = 0;
	let encrypted_units = 0;
	for (unit of game.get_um().get_units()) {
		if (unit.owner == base.get_owner().id && unit.get_tile() == base.get_tile()) {
			const def = unit.get_def();
			if (#is_defined(def.offense) && def.offense > 0) {
				combat_units++;
				if (has_ability(def, 'PolymorphicEncryption')) {
					encrypted_units++;
				}
			}
		}
	}
	return combat_units * (encrypted_units + 1);
};

const get_mind_control_cost = (game, actor, base) => {
	const target_player = base.get_owner();
	let rating = get_effective_rating(game, target_player);
	if (base.has_facility('GenejackFactory')) {
		rating--;
	}
	if (get_rating_cost_multiplier(rating) == null || base.has_facility('Headquarters')) {
		return null;
	}
	let distance = get_headquarters_distance(game, target_player, base.get_tile());
	if (base.has_facility('GenejackFactory')) {
		distance *= 2;
	}
	if (base.has_facility('ChildrenSCreche')) {
		distance = #floor(#to_float(distance) / 2.0);
	}
	if (base.has_facility('PunishmentSphere')) {
		distance = #floor(#to_float(distance) / 2.0);
	}
	const population_value = base.get_size();
	const garrison_value = get_base_garrison_value(game, base);
	let cost = (population_value + garrison_value) * #floor(
		#to_float(target_player.energy_credits + 1200) / #to_float(distance + 4)
	);
	cost = apply_rating_cost(cost, rating);
	const relation = actor.get_diplomatic_relation(target_player);
	if (relation == 'pact') {
		cost *= 2;
	}
	return cost;
};

const get_energy_drain_limit = (game, base) => {
	const target_player = base.get_owner();
	let population = 0;
	for (candidate of game.get_bm().get_bases()) {
		if (candidate.get_owner().id == target_player.id) {
			population += candidate.get_size();
		}
	}
	return #max(0, #floor(
		#to_float(target_player.energy_credits * base.get_size()) /
		#to_float(#max(1, population + 1))
	));
};

const can_incite_drone_riots = (base) => {
	for (pop of base.get_pops()) {
		if (pop.get_type() != 'DRONE') {
			return true;
		}
	}
	return false;
};

const get_sabotage_facilities = (base) => {
	let result = [];
	const base_tile = base.get_tile();
	for (facility of base.get_facilities()) {
		if (
			!facility.is_project && facility.id != 'Headquarters' &&
			!(
				facility.id == 'PressureDome' &&
				#is_defined(base_tile.is_water) && base_tile.is_water
			)
		) {
			result :+facility.id;
		}
	}
	return result;
};

const can_sabotage = (base) => {
	if (base.get_accumulated_minerals() > 0) {
		return true;
	}
	return #sizeof(get_sabotage_facilities(base)) > 0;
};

const get_assassination_research_loss = (player, random) => {
	const research = player.get_research_state();
	if (research.target == '' || research.progress <= 0) {
		return 0;
	}
	return !#is_defined(random) || research.progress == 1
		? research.progress
		: random.get_int(0, research.progress - 1);
};

const get_plague_population_loss = (base) => {
	const size = base.get_size();
	if (size <= 1) {
		return 0;
	}
	const player = base.get_owner();
	let known_defenses = 0;
	if (#typeof(player.has_technology) == 'Callable') {
		for (technology_id of GENETIC_DEFENSE_TECHNOLOGIES) {
			if (player.has_technology(technology_id)) {
				known_defenses++;
			}
		}
	}
	known_defenses = #max(1, #min(#sizeof(GENETIC_DEFENSE_TECHNOLOGIES), known_defenses));
	let loss = #floor(
		#to_float(size * (#sizeof(GENETIC_DEFENSE_TECHNOLOGIES) - known_defenses)) /
		#to_float(#sizeof(GENETIC_DEFENSE_TECHNOLOGIES))
	);
	if (
		#typeof(base.has) == 'Callable' && base.has(GENETIC_PLAGUE_KEY) &&
		base.get(GENETIC_PLAGUE_KEY) == true
	) {
		loss = #floor(#to_float(loss) / 2.0);
	}
	if (base.has_facility('ResearchHospital')) {
		loss = #floor(#to_float(loss) / 2.0);
	}
	if (base.has_facility('Nanohospital')) {
		loss = #floor(#to_float(loss) / 2.0);
	}
	return #min(size - 1, loss + 1);
};

const get_plague_unit_damage = (game, base, random) => {
	let result = [];
	for (unit of game.get_um().get_units()) {
		if (unit.get_tile() != base.get_tile() || unit.health <= 0.0) {
			continue;
		}
		const health = #max(1, #ceil(unit.health * 1000.0));
		const spread = #floor(#to_float(health + 1) / 2.0);
		let damage = #floor(#to_float(health) / 2.0) +
			(spread <= 0 ? 0 : random.get_int(0, spread - 1));
		if (base.has_facility('ResearchHospital')) {
			damage = #floor(#to_float(damage) / 2.0);
		}
		if (base.has_facility('Nanohospital')) {
			damage = #floor(#to_float(damage) / 2.0);
		}
		if (
			#typeof(base.has) == 'Callable' && base.has(GENETIC_PLAGUE_KEY) &&
			base.get(GENETIC_PLAGUE_KEY) == true
		) {
			damage = #floor(#to_float(damage) / 2.0);
		}
		result :+{
			unit_id: unit.id,
			health: #to_float(#max(1, health - damage)) / 1000.0,
		};
	}
	return result;
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

const get_probe_morale = (game, probe) => {
	let morale = #max(2, probe.morale);
	if (#is_defined(probe.owner)) {
		const player = game.get_player(probe.owner);
		morale += #max(0, get_rating(game, player));
		if (has_project(game, player, 'TheTelepathicMatrix')) {
			morale += 2;
		}
		if (#typeof(player.has_technology) == 'Callable') {
			for (technology_id of PROBE_MORALE_TECHNOLOGIES) {
				if (player.has_technology(technology_id)) {
					morale++;
				}
			}
		}
	}
	return #max(2, #min(6, morale));
};

const get_probe_defense = (game, target_player) => {
	return #max(0 - 2, #min(0, get_rating(game, target_player)));
};

const is_frameable_operation = (operation) => {
	return #is_defined(FRAMEABLE_OPERATIONS[operation]);
};

const get_frame_candidates = (game, actor, target_player, operation) => {
	if (
		!is_frameable_operation(operation) ||
		!#is_defined(target_player.type) || target_player.type != 'ai'
	) {
		return [];
	}
	let candidates = [];
	for (candidate of game.get_players()) {
		if (
			candidate.id != actor.id && candidate.id != target_player.id &&
			(!#is_defined(candidate.type) || candidate.type != 'native') &&
			actor.has_contact(candidate)
		) {
			candidates :+candidate;
		}
	}
	return candidates;
};

const get_operation_difficulty = (operation, target, options) => {
	const definition = operations[operation];
	if (!#is_defined(definition)) {
		return null;
	}
	let difficulty = definition.difficulty;
	if (
		operation == 'steal_technology' && #is_defined(options) &&
		#is_defined(options.target_technology_id) && options.target_technology_id != ''
	) {
		difficulty++;
	}
	if (
		operation == 'steal_technology' && #typeof(target) == 'Object' &&
		#typeof(target.has) == 'Callable' && target.has(RESEARCH_DATA_STOLEN_KEY) &&
		target.get(RESEARCH_DATA_STOLEN_KEY) == true
	) {
		difficulty++;
	}
	if (
		operation == 'drain_energy' && #typeof(target) == 'Object' &&
		#typeof(target.has) == 'Callable' && target.has(ENERGY_RESERVES_DRAINED_KEY) &&
		target.get(ENERGY_RESERVES_DRAINED_KEY) == true
	) {
		difficulty++;
	}
	if (
		operation == 'sabotage' && #is_defined(options) &&
		#is_defined(options.sabotage_target_id) && options.sabotage_target_id != ''
	) {
		difficulty = 1;
		if (
			#typeof(target) == 'Object' &&
			(
				target.has_facility('Headquarters') ||
				options.sabotage_target_id == 'PerimeterDefense' ||
				options.sabotage_target_id == 'TachyonField'
			)
		) {
			difficulty = 2;
		}
	}
	if (
		definition.cost && #is_defined(options) &&
		#is_defined(options.untraceable) && options.untraceable == true
	) {
		difficulty++;
	}
	if (
		is_frameable_operation(operation) && #is_defined(options) &&
		#is_defined(options.frame_player_id) && options.frame_player_id >= 0
	) {
		difficulty++;
	}
	return difficulty;
};

const get_success_chance = (game, probe, target_player, operation, target, options) => {
	const difficulty = get_operation_difficulty(operation, target, options);
	if (difficulty == null) {
		return 0;
	}
	const morale = get_probe_morale(game, probe);
	const defense = get_probe_defense(game, target_player);
	const attempts = #max(1, #floor(#to_float(morale) / 2.0) - defense + 1);
	let chance = #max(0, #min(100, 100 - #floor(
		#to_float(difficulty * 100) / #to_float(attempts)
	)));
	const definition = operations[operation];
	const defending_probe = definition.target == 'base' && #typeof(target) == 'Object'
		? get_defending_probe(game, target_player, target)
		: null;
	if (defending_probe != null) {
		const defender_morale = get_probe_morale(game, defending_probe);
		const interception_chance = #max(5, #min(
			95,
			65 + (morale - defender_morale) * 5
		));
		chance = #min(chance, interception_chance);
	}
	return chance;
};

const get_survival_chance = (game, probe, target_player, operation, target, options) => {
	const difficulty = get_operation_difficulty(operation, target, options);
	if (difficulty == null) {
		return 0;
	}
	if (operation == 'subvert_unit') {
		return 100;
	}
	const morale = get_probe_morale(game, probe);
	const defense = get_probe_defense(game, target_player);
	return #max(0, #min(100, 100 - #floor(
		#to_float((difficulty + 1) * 100) /
		#to_float(#max(1, morale - defense))
	)));
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

const get_map_data_count = (game, actor, target_player) => {
	const resolver = game.get('f_exploration_count_shareable_tiles');
	return #typeof(resolver) == 'Callable' ? resolver(target_player, actor) : 0;
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
		game.set('f_probe_get_subversion_error', get_subversion_error);
		game.set('f_probe_get_mind_control_cost', (actor, base) => {
			return get_mind_control_cost(game, actor, base);
		});
		game.set('f_probe_get_energy_drain_limit', (base) => {
			return get_energy_drain_limit(game, base);
		});
		game.set('f_probe_can_incite_drone_riots', can_incite_drone_riots);
		game.set('f_probe_can_sabotage', can_sabotage);
		game.set('f_probe_get_sabotage_facilities', get_sabotage_facilities);
		game.set('f_probe_get_assassination_research_loss', get_assassination_research_loss);
		game.set('f_probe_get_plague_population_loss', get_plague_population_loss);
		game.set('f_probe_get_plague_unit_damage', (base, random) => {
			return get_plague_unit_damage(game, base, random);
		});
		game.set('f_probe_get_defending_probe', (target_player, base) => {
			return get_defending_probe(game, target_player, base);
		});
		game.set('f_probe_get_success_chance', (probe, target_player, operation, target, options) => {
			return get_success_chance(game, probe, target_player, operation, target, options);
		});
		game.set('f_probe_get_survival_chance', (probe, target_player, operation, target, options) => {
			return get_survival_chance(game, probe, target_player, operation, target, options);
		});
		game.set('f_probe_get_operation_difficulty', get_operation_difficulty);
		game.set('f_probe_is_frameable_operation', is_frameable_operation);
		game.set('f_probe_get_frame_candidates', (actor, target_player, operation) => {
			return get_frame_candidates(game, actor, target_player, operation);
		});
		game.set('f_probe_get_morale', (probe) => { return get_probe_morale(game, probe); });
		game.set('f_probe_get_unknown_technologies', get_unknown_technologies);
		game.set('f_probe_get_map_data_count', (actor, target_player) => {
			return get_map_data_count(game, actor, target_player);
		});
		game.set('f_probe_get_intelligence_source', (actor, target_player) => {
			return get_intelligence_source(game, actor, target_player);
		});
		game.set('f_probe_get_intelligence_report', (actor, target_player) => {
			return get_intelligence_report(game, actor, target_player);
		});
		game.set('f_probe_max_energy_credits', () => { return MAX_ENERGY_CREDITS; });
	});
};
