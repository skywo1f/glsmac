const catalog = #include('content/base_technologies');
const definitions = catalog.definitions;
const technology_order = catalog.order;

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

const get_initial_state = (player, choose_target) => {
	let known = [];
	for (id of player.get_faction().get_starting_technologies()) {
		if (get_definition(id) == null) {
			throw Error('Unknown starting technology: ' + id);
		}
		known :+id;
	}
	return {
		technologies: known,
		target: #is_defined(choose_target) ? choose_target(known) : get_next_target(known),
		progress: 0,
	};
};

const get_base_labs = (base, game) => {
	const allocation = 0.4;
	const base_bonus = 2;
	const intake = base.get_intake();
	const consumption = base.get_consumption();
	const energy_surplus = #max(intake.ENERGY - consumption.ENERGY, 0);
	const allocated = #round(#to_float(energy_surplus) * allocation);
	let research_multiplier = 0.0;
	let fixed_facility_bonus = 0;
	const resolver = #is_defined(game) ? game.get('f_base_get_effective_facilities') : #undefined;
	const facilities = #is_defined(resolver) ? resolver(base) : base.get_facilities();
	for (facility of facilities) {
		research_multiplier += facility.research_multiplier;
		fixed_facility_bonus += #is_defined(facility.research_bonus) ? facility.research_bonus : 0;
	}
	if (#is_defined(game) && base.has_facility('NetworkNode')) {
		const get_project_effects = game.get('f_project_get_effects');
		if (#is_defined(get_project_effects)) {
			fixed_facility_bonus += get_project_effects(base).network_node_research_bonus;
		}
	}
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
		allocation: allocation,
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
	return labs;
};

return {
	definitions: definitions,
	order: technology_order,
	get_definition: get_definition,
	get_available_targets: get_available_targets,
	get_next_target: get_next_target,
	get_initial_state: get_initial_state,
	get_base_labs: get_base_labs,
	get_player_labs: get_player_labs,

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
			game.set('f_technology_get_base_labs', (base) => { return get_base_labs(base, game); });
			game.set('f_technology_get_next_target', choose_next_target);
			game.set('f_technology_get_player_labs', get_player_labs);

			if (game.is_master()) {
				for (player of game.get_players()) {
					game.event('initialize_player_research', {
						player: player,
						state: get_initial_state(player, (known) => {
							return choose_next_target(known, player);
						}),
					});
				}
			}

			game.on('turn', (e) => {
				if (!game.is_master()) {
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
