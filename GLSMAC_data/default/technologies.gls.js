const definitions = {
	CentauriEcology: {
		id: 'CentauriEcology',
		name: 'Centauri Ecology',
		// v0.4 uses a fixed milestone cost until the full SMAC research model is implemented.
		cost: 20,
		prerequisites: [],
	},
	DoctrineMobility: {
		id: 'DoctrineMobility',
		name: 'Doctrine: Mobility',
		cost: 30,
		prerequisites: ['CentauriEcology'],
	},
	InformationNetworks: {
		id: 'InformationNetworks',
		name: 'Information Networks',
		cost: 40,
		prerequisites: ['DoctrineMobility'],
	},
	AppliedPhysics: {
		id: 'AppliedPhysics',
		name: 'Applied Physics',
		cost: 50,
		prerequisites: ['InformationNetworks'],
	},
	IndustrialBase: {
		id: 'IndustrialBase',
		name: 'Industrial Base',
		cost: 50,
		prerequisites: ['AppliedPhysics'],
	},
	SocialPsych: {
		id: 'SocialPsych',
		name: 'Social Psych',
		cost: 40,
		prerequisites: ['CentauriEcology'],
	},
};

const technology_order = [
	'CentauriEcology',
	'DoctrineMobility',
	'InformationNetworks',
	'AppliedPhysics',
	'IndustrialBase',
	'SocialPsych',
];

const get_definition = (id) => {
	if (!#is_defined(definitions[id])) {
		return null;
	}
	return definitions[id];
};

const get_next_target = (known) => {
	let known_ids = {};
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
			return id;
		}
	}
	return '';
};

const get_initial_state = (player) => {
	let known = [];
	for (id of player.get_faction().get_starting_technologies()) {
		if (get_definition(id) == null) {
			throw Error('Unknown starting technology: ' + id);
		}
		known :+id;
	}
	return {
		technologies: known,
		target: get_next_target(known),
		progress: 0,
	};
};

const get_base_labs = (base) => {
	const allocation = 0.4;
	const base_bonus = 2;
	const intake = base.get_intake();
	const consumption = base.get_consumption();
	const energy_surplus = #max(intake.ENERGY - consumption.ENERGY, 0);
	const allocated = #round(#to_float(energy_surplus) * allocation);
	let research_multiplier = 0.0;
	for (facility of base.get_facilities()) {
		research_multiplier += facility.research_multiplier;
	}
	const facility_bonus = #ceil(#to_float(allocated + base_bonus) * research_multiplier);
	return {
		allocation: allocation,
		value: allocated,
		bonus: base_bonus + facility_bonus,
		total: allocated + base_bonus + facility_bonus,
	};
};

const get_player_labs = (game, player) => {
	let labs = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			labs += get_base_labs(base).total;
		}
	}
	return labs;
};

return {
	definitions: definitions,
	get_definition: get_definition,
	get_next_target: get_next_target,
	get_initial_state: get_initial_state,
	get_base_labs: get_base_labs,
	get_player_labs: get_player_labs,

	configure: (game) => {
		game.on('start', (e) => {
			game.set('f_technology_get_definition', get_definition);
			game.set('f_technology_get_next_target', get_next_target);
			game.set('f_technology_get_base_labs', get_base_labs);
			game.set('f_technology_get_player_labs', get_player_labs);

			if (game.is_master()) {
				for (player of game.get_players()) {
					game.event('initialize_player_research', {
						player: player,
						state: get_initial_state(player),
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
