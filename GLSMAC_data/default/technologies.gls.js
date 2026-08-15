const catalog = #include('content/base_technologies');
const game_rules = #include('game/game_rules');
const definitions = catalog.definitions;
const technology_order = catalog.order;
const LABS_ALLOCATION = 0.4;
const STANDARD_MAP_AREA_ROOT = 56;
const MAX_RESEARCH_COST = 99999999;
const DIFFICULTY_LEVELS = {
	Citizen: 0,
	Specialist: 1,
	Talent: 2,
	Librarian: 3,
	Thinker: 4,
	Transcend: 5,
};

const clamp = (value, minimum, maximum) => {
	return #max(minimum, #min(maximum, value));
};

const int_divide = (numerator, denominator) => {
	return #floor(#to_float(numerator) / #to_float(denominator));
};

const integer_square_root = (value) => {
	let root = 0;
	while ((root + 1) * (root + 1) <= value) {
		root++;
	}
	return root;
};

const get_definition = (id) => {
	if (!#is_defined(definitions[id])) {
		return null;
	}
	return definitions[id];
};

const get_available_targets = (known) => {
	let known_ids = {};
	let result = [];
	for (id of known) {
		known_ids[id] = true;
	}
	for (id of technology_order) {
		if (#is_defined(known_ids[id])) {
			continue;
		}
		let available = true;
		for (prerequisite of definitions[id].prerequisites) {
			if (!#is_defined(known_ids[prerequisite])) {
				available = false;
				break;
			}
		}
		if (available) {
			result :+id;
		}
	}
	return result;
};

const get_next_target = (known) => {
	const available = get_available_targets(known);
	return #sizeof(available) == 0 ? '' : available[0];
};

const get_acquired_technology_count = (player, known) => {
	let starting = {};
	if (#typeof(player.get_faction) == 'Callable') {
		const faction = player.get_faction();
		if (
			#is_defined(faction) &&
			#typeof(faction.get_starting_technologies) == 'Callable'
		) {
			for (id of faction.get_starting_technologies()) {
				starting[id] = true;
			}
		}
	}
	let result = 0;
	for (id of known) {
		if (!#is_defined(starting[id])) {
			result++;
		}
	}
	return result;
};

const get_difficulty = (name) => {
	return #is_defined(DIFFICULTY_LEVELS[name])
		? DIFFICULTY_LEVELS[name]
		: DIFFICULTY_LEVELS.Librarian;
};

const get_global_difficulty = (game) => {
	if (#typeof(game.get_settings) != 'Callable') {
		return DIFFICULTY_LEVELS.Librarian;
	}
	const settings = game.get_settings();
	return #typeof(settings) == 'Object' && #typeof(settings.global) == 'Object'
		? get_difficulty(settings.global.difficulty_level)
		: DIFFICULTY_LEVELS.Librarian;
};

const get_map_area_root = (game) => {
	if (#typeof(game.get_tm) != 'Callable') {
		return STANDARD_MAP_AREA_ROOT;
	}
	const tm = game.get_tm();
	if (
		#typeof(tm.get_map_width) != 'Callable' ||
		#typeof(tm.get_map_height) != 'Callable'
	) {
		return STANDARD_MAP_AREA_ROOT;
	}
	const tile_count = int_divide(tm.get_map_width() * tm.get_map_height(), 2);
	return #max(1, integer_square_root(tile_count));
};

const get_research_rating = (game, player) => {
	if (#typeof(game.get) != 'Callable') {
		return 0;
	}
	const resolver = game.get('f_social_get_ratings');
	return #typeof(resolver) == 'Callable' ? resolver(player).research : 0;
};

const calculate_research_cost = (game, player, known) => {
	const technologies = #is_defined(known)
		? known
		: player.get_research_state().technologies;
	const acquired = get_acquired_technology_count(player, technologies);
	let maximum_acquired = acquired;
	if (#typeof(game.get_players) == 'Callable') {
		for (candidate of game.get_players()) {
			if (
				candidate.id != player.id &&
				#typeof(candidate.get_research_state) == 'Callable'
			) {
				maximum_acquired = #max(
					maximum_acquired,
					get_acquired_technology_count(
						candidate,
						candidate.get_research_state().technologies
					)
				);
			}
		}
	}

	const player_technology_rating = #max(2, acquired * 2);
	const half_player_technology = int_divide(player_technology_rating, 2);
	const half_maximum_technology = maximum_acquired;
	const is_human = !#is_defined(player.type) || player.type == 'human';
	const difficulty = is_human
		? get_difficulty(player.difficulty_level)
		: get_global_difficulty(game);
	const adjusted_difficulty = difficulty < 3 ? difficulty + 1 : difficulty;
	const reduction_difficulty = is_human ? 3 : get_global_difficulty(game);
	let factor = is_human
		? 4 * adjusted_difficulty + 8
		: 29 - 3 * adjusted_difficulty;
	factor = clamp(
		factor,
		12 - half_player_technology,
		12 + half_player_technology
	);
	const stagnation = game_rules.get(game, 'tech_stagnation');
	const turn = #typeof(game.get_turn) == 'Callable' ? game.get_turn() : 0;
	let turn_penalty = half_player_technology - int_divide(
		turn,
		stagnation ? 12 : 8
	);
	turn_penalty = clamp(
		turn_penalty,
		0,
		int_divide(factor * (stagnation ? 3 : 2), 2)
	);
	const adjusted_factor = turn_penalty + factor;
	let reduction = int_divide(
		half_maximum_technology - reduction_difficulty -
			half_player_technology + 7,
		8 - reduction_difficulty
	);
	reduction = clamp(
		reduction,
		0,
		int_divide(reduction_difficulty * adjusted_factor, 10) + 1
	);
	const research_rating = clamp(get_research_rating(game, player), 0 - 1, 1);
	const technology_multiplier = #max(1, half_player_technology - research_rating);
	let cost = (adjusted_factor - reduction) * technology_multiplier;
	cost = int_divide(cost * get_map_area_root(game), STANDARD_MAP_AREA_ROOT);
	if (stagnation) {
		cost += int_divide(cost, 2);
	}
	return clamp(cost, 1, MAX_RESEARCH_COST);
};

const get_state_cost = (game, player, known, target, previous) => {
	if (target == '') {
		return 0;
	}
	if (
		#is_defined(previous) && target == previous.target &&
		#is_defined(previous.cost) && previous.cost > 0
	) {
		return previous.cost;
	}
	const calculated = calculate_research_cost(game, player, known);
	return #is_defined(previous) && target == previous.target && previous.progress >= calculated
		? #min(MAX_RESEARCH_COST, previous.progress + 1)
		: calculated;
};

const get_research_cost = (game, player) => {
	const state = player.get_research_state();
	return get_state_cost(game, player, state.technologies, state.target, state);
};

const get_total_commerce_bonus = () => {
	let result = 0;
	for (id of technology_order) {
		result += definitions[id].commerce_bonus;
	}
	return result;
};

const get_initial_state = (player, choose_target, calculate_cost) => {
	let known = [];
	for (id of player.get_faction().get_starting_technologies()) {
		if (get_definition(id) == null) {
			throw Error('Unknown starting technology: ' + id);
		}
		known :+id;
	}
	const target = #is_defined(choose_target) ? choose_target(known) : get_next_target(known);
	return {
		technologies: known,
		target: target,
		progress: 0,
		cost: target == ''
			? 0
			: (#is_defined(calculate_cost)
				? calculate_cost(known)
				: get_definition(target).cost),
	};
};

const get_network_backbone_research_bonus = (base, game) => {
	if (!#is_defined(game) || !base.has_facility('TheNetworkBackbone')) {
		return 0;
	}
	let result = 0;
	const commerce_resolver = game.get('f_economy_get_base_commerce');
	if (#is_defined(commerce_resolver)) {
		result += commerce_resolver(game, base).total;
	}
	for (candidate of game.get_bm().get_bases()) {
		if (candidate.has_facility('NetworkNode')) {
			result++;
		}
	}
	return result;
};

const get_base_labs_value = (base, game, energy, consumption) => {
	const base_consumption = #is_defined(consumption)
		? consumption
		: base.get_consumption();
	const energy_resolver = #is_defined(game)
		? game.get('f_economy_get_base_energy')
		: #undefined;
	let net_energy = 0;
	if (#is_defined(energy)) {
		net_energy = energy.net;
	} else if (#is_defined(energy_resolver)) {
		net_energy = energy_resolver(base).net;
	} else {
		net_energy = base.get_intake().ENERGY;
	}
	const energy_surplus = #max(net_energy - base_consumption.ENERGY, 0);
	return #round(#to_float(energy_surplus) * LABS_ALLOCATION);
};

const get_base_labs = (base, game, energy, consumption, effective_facilities) => {
	const base_bonus = 2;
	const allocated = get_base_labs_value(base, game, energy, consumption);
	let research_multiplier = 0.0;
	let fixed_facility_bonus = 0;
	const resolver = #is_defined(game) ? game.get('f_base_get_effective_facilities') : #undefined;
	let facilities = effective_facilities;
	if (!#is_defined(facilities)) {
		facilities = #is_defined(resolver) ? resolver(base) : base.get_facilities();
	}
	for (facility of facilities) {
		research_multiplier += facility.research_multiplier;
		fixed_facility_bonus += #is_defined(facility.research_bonus) ? facility.research_bonus : 0;
	}
	const specialist_resolver = #is_defined(game)
		? game.get('f_base_get_specialist_yields')
		: #undefined;
	if (#typeof(specialist_resolver) == 'Callable') {
		fixed_facility_bonus += specialist_resolver(base).labs;
	}
	fixed_facility_bonus += get_network_backbone_research_bonus(base, game);
	const facility_bonus = #ceil(
		#to_float(allocated + base_bonus + fixed_facility_bonus) * research_multiplier
	);
	const pre_social_total = allocated + base_bonus + fixed_facility_bonus + facility_bonus;
	const social_resolver = #is_defined(game)
		? game.get('f_social_get_research_multiplier')
		: #undefined;
	const total = #is_defined(social_resolver)
		? #max(0, #round(#to_float(pre_social_total) * social_resolver(base.get_owner())))
		: pre_social_total;
	return {
		allocation: LABS_ALLOCATION,
		value: allocated,
		bonus: total - allocated,
		total: total,
	};
};

const get_player_labs = (game, player) => {
	let labs = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			labs += get_base_labs(base, game).total;
		}
	}
	return apply_research_rate(game, labs);
};

const apply_research_rate = (game, labs) => {
	return labs;
};

return {
	definitions: definitions,
	order: technology_order,
	get_definition: get_definition,
	get_available_targets: get_available_targets,
	get_next_target: get_next_target,
	get_acquired_technology_count: get_acquired_technology_count,
	calculate_research_cost: calculate_research_cost,
	get_state_cost: get_state_cost,
	get_research_cost: get_research_cost,
	get_total_commerce_bonus: get_total_commerce_bonus,
	get_initial_state: get_initial_state,
	get_base_labs_value: get_base_labs_value,
	get_base_labs: get_base_labs,
	get_player_labs: get_player_labs,
	apply_research_rate: apply_research_rate,

	configure: (game) => {
		game.on('start', (e) => {
			const choose_next_target = (known, player) => {
				const available = get_available_targets(known);
				if (#sizeof(available) == 0) {
					return '';
				}
				if (#is_defined(player) && player.type == 'ai') {
					let available_ids = {};
					for (candidate_id of available) {
						available_ids[candidate_id] = true;
					}
					const selected = game.get('f_ai_choose_research_target')(player, available);
					if (#is_defined(available_ids[selected])) {
						return selected;
					}
					throw Error('AI selected unavailable research target: ' + selected);
				}
				return available[0];
			};
			game.set('f_technology_get_definition', get_definition);
			game.set('f_technology_get_available_targets', get_available_targets);
			game.set('f_technology_get_order', () => { return technology_order; });
			game.set('f_technology_get_total_commerce_bonus', get_total_commerce_bonus);
			game.set('f_technology_calculate_research_cost', (player, known) => {
				return calculate_research_cost(game, player, known);
			});
			game.set('f_technology_get_state_cost', (player, known, target, previous) => {
				return get_state_cost(game, player, known, target, previous);
			});
			game.set('f_technology_get_research_cost', (player) => {
				return get_research_cost(game, player);
			});
			game.set('f_technology_get_base_labs_value', (base, energy, consumption) => {
				return get_base_labs_value(base, game, energy, consumption);
			});
			game.set(
				'f_technology_get_base_labs',
				(base, energy, consumption, facilities) => {
					return get_base_labs(base, game, energy, consumption, facilities);
				}
			);
			game.set('f_technology_get_next_target', choose_next_target);
			game.set('f_technology_get_player_labs', get_player_labs);

			if (game.is_master()) {
				for (player of game.get_players()) {
					game.event('initialize_player_research', {
						player: player,
						state: get_initial_state(
							player,
							(known) => { return choose_next_target(known, player); },
							(known) => { return calculate_research_cost(game, player, known); }
						),
					});
				}
			}

			game.on('turn', (e) => {
				if ((#is_defined(e.initial) && e.initial) || !game.is_master()) {
					return;
				}
				for (player of game.get_players()) {
					const state = player.get_research_state();
					if (state.target == '') {
						continue;
					}
					const technology = get_definition(state.target);
					if (technology == null) {
						throw Error('Unknown research target: ' + state.target);
					}
					game.event('process_player_research', {
						player: player,
						technology: technology,
						labs: get_player_labs(game, player),
					});
				}
			});
		});
	},
};
