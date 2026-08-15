const technologies = #include('../default/technologies');
const technology_acquisition = #include('../default/game/technology_acquisition');
const initialize_research = #include('../default/game/event/initialize_player_research');
const process_research = #include('../default/game/event/process_player_research');

const biogenetics = technologies.get_definition('Biogenetics');
test.assert(biogenetics == {
	id: 'Biogenetics',
	name: 'Biogenetics',
	cost: 30,
	free_technology_for_first_discoverer: false,
	probe_morale_bonus: 0,
	commerce_bonus: 0,
	reveals_map: false,
	allows_genetic_warfare: false,
	genetic_warfare_defense_bonus: 1,
	fungus_energy_bonus: 0,
	fungus_mineral_bonus: 0,
	fungus_nutrient_bonus: 0,
	prerequisites: [],
});
test.assert(
	technologies.get_definition('SecretsHumanBrain').free_technology_for_first_discoverer
);
test.assert(technologies.get_definition('PolymorphicSoftware').probe_morale_bonus == 1);
test.assert(technologies.get_definition('IndustrialEconomics').commerce_bonus == 1);
test.assert(technologies.get_definition('SecretsOfAlphaCentauri').reveals_map);
test.assert(technologies.get_definition('RetroviralEngineering').allows_genetic_warfare);
test.assert(
	technologies.get_definition('RetroviralEngineering').genetic_warfare_defense_bonus == 1
);
test.assert(technologies.get_definition('TemporalMechanics').fungus_energy_bonus == 1);
test.assert(
	technologies.get_definition('ThresholdOfTranscendence').fungus_mineral_bonus == 1
);
test.assert(technologies.get_definition('CentauriPsi').fungus_nutrient_bonus == 1);

const get_flagged_technologies = (field) => {
	let result = [];
	for (id of technologies.order) {
		const definition = technologies.get_definition(id);
		const value = definition[field];
		if (
			(#typeof(value) == 'Bool' && value) ||
			(#typeof(value) == 'Int' && value > 0)
		) {
			result :+id;
		}
	}
	return result;
};
test.assert(get_flagged_technologies('free_technology_for_first_discoverer') == [
	'SecretsHumanBrain',
	'SecretsOfAlphaCentauri',
	'SecretsOfCreation',
]);
test.assert(get_flagged_technologies('probe_morale_bonus') == [
	'PolymorphicSoftware',
	'PreSentientAlgorithms',
	'DigitalSentience',
	'SelfAwareMachines',
	'MindMachineInterface',
]);
test.assert(get_flagged_technologies('commerce_bonus') == [
	'IndustrialEconomics',
	'IndustrialAutomation',
	'EnvironmentalEconomics',
	'PlanetaryEconomics',
	'IndustrialNanorobotics',
	'SentientEconometrics',
]);
test.assert(get_flagged_technologies('reveals_map') == ['SecretsOfAlphaCentauri']);
test.assert(get_flagged_technologies('allows_genetic_warfare') == [
	'RetroviralEngineering',
]);
test.assert(get_flagged_technologies('genetic_warfare_defense_bonus') == [
	'Biogenetics',
	'GeneSplicing',
	'BioEngineering',
	'Biomachinery',
	'MatterEditation',
	'RetroviralEngineering',
]);
test.assert(get_flagged_technologies('fungus_energy_bonus') == [
	'TemporalMechanics',
	'CentauriMeditation',
	'SecretsOfAlphaCentauri',
]);
test.assert(get_flagged_technologies('fungus_mineral_bonus') == [
	'ThresholdOfTranscendence',
	'MatterTransmission',
	'CentauriGenetics',
]);
test.assert(get_flagged_technologies('fungus_nutrient_bonus') == [
	'CentauriEcology',
	'CentauriPsi',
]);
test.assert(technologies.get_definition('CentauriEcology').prerequisites == []);
test.assert(technologies.get_definition('DoctrineMobility').prerequisites == []);
test.assert(technologies.get_definition('InformationNetworks').prerequisites == []);
test.assert(technologies.get_definition('AppliedPhysics').prerequisites == []);
test.assert(technologies.get_definition('IndustrialBase').prerequisites == []);
test.assert(technologies.get_definition('SocialPsych').prerequisites == []);
test.assert(technologies.get_definition('PlanetaryNetworks').prerequisites == ['InformationNetworks']);
test.assert(technologies.get_definition('DoctrineLoyalty').prerequisites == ['DoctrineMobility', 'SocialPsych']);
test.assert(technologies.get_definition('IndustrialEconomics').prerequisites == ['IndustrialBase']);
test.assert(technologies.get_definition('SecretsHumanBrain').prerequisites == ['SocialPsych', 'Biogenetics']);
test.assert(technologies.get_definition('TranscendentThought').prerequisites == ['ThresholdOfTranscendence', 'ControlledSingularity']);
test.assert(technologies.get_definition('UnknownTechnology') == null);

const root_technologies = [
	'Biogenetics',
	'IndustrialBase',
	'InformationNetworks',
	'AppliedPhysics',
	'SocialPsych',
	'DoctrineMobility',
	'CentauriEcology',
];
test.assert(technologies.get_available_targets([]) == root_technologies);
test.assert(technologies.get_next_target([]) == 'Biogenetics');
test.assert(technologies.get_next_target(root_technologies[0::5]) == 'CentauriEcology');
test.assert(technologies.get_available_targets(root_technologies) == [
	'NonlinearMathematics',
	'HighEnergyChemistry',
	'PolymorphicSoftware',
	'PlanetaryNetworks',
	'DoctrineFlexibility',
	'DoctrineLoyalty',
	'EthicalCalculus',
	'IndustrialEconomics',
	'SecretsHumanBrain',
]);

let every_technology = [];
for (id of technologies.order) {
	every_technology :+id;
}
test.assert(#sizeof(every_technology) == 77);
test.assert(technologies.get_available_targets(every_technology) == []);
test.assert(technologies.get_next_target(every_technology) == '');

const base = {
	get_intake: () => { return {ENERGY: 6}; },
	get_consumption: () => { return {ENERGY: 1}; },
	get_facilities: () => { return []; },
	has_facility: (id) => { return false; },
};
const labs = technologies.get_base_labs(base);
test.assert(labs == {allocation: 0.4, value: 2, bonus: 2, total: 4});

const inefficient_labs = technologies.get_base_labs(base, {
	get: (key) => {
		return key == 'f_economy_get_base_energy'
			? (base) => { return {net: 3}; }
			: #undefined;
	},
});
test.assert(inefficient_labs == {allocation: 0.4, value: 1, bonus: 2, total: 3});

const network_backbone_game = {
	get: (key) => {
		if (key == 'f_base_get_effective_facilities') {
			return (base) => { return base.get_facilities(); };
		}
		if (key == 'f_economy_get_base_commerce') {
			return (game, base) => { return {total: 3, partners: []}; };
		}
		return #undefined;
	},
	get_bm: () => { return {get_bases: () => { return [
		{has_facility: (id) => { return id == 'NetworkNode'; }},
		{has_facility: (id) => { return false; }},
		{has_facility: (id) => { return id == 'NetworkNode'; }},
	]; }}; },
};
const network_backbone_base = {
	get_intake: base.get_intake,
	get_consumption: base.get_consumption,
	get_facilities: () => { return []; },
	has_facility: (id) => { return id == 'TheNetworkBackbone'; },
};
test.assert(
	technologies.get_base_labs(network_backbone_base, network_backbone_game)
	== {allocation: 0.4, value: 2, bonus: 7, total: 9}
);
const ordinary_network_node_base = {
	get_intake: base.get_intake,
	get_consumption: base.get_consumption,
	get_facilities: () => { return []; },
	has_facility: (id) => { return id == 'NetworkNode'; },
};
test.assert(
	technologies.get_base_labs(ordinary_network_node_base, network_backbone_game)
	== {allocation: 0.4, value: 2, bonus: 2, total: 4}
);

const network_labs = technologies.get_base_labs({
	get_intake: base.get_intake,
	get_consumption: base.get_consumption,
	get_facilities: () => { return [{research_multiplier: 0.5, research_bonus: 0}]; },
});
test.assert(network_labs == {allocation: 0.4, value: 2, bonus: 4, total: 6});

const biology_labs = technologies.get_base_labs({
	get_intake: base.get_intake,
	get_consumption: base.get_consumption,
	get_facilities: () => { return [{research_multiplier: 0.0, research_bonus: 2}]; },
});
test.assert(biology_labs == {allocation: 0.4, value: 2, bonus: 4, total: 6});

const combined_labs = technologies.get_base_labs({
	get_intake: base.get_intake,
	get_consumption: base.get_consumption,
	get_facilities: () => { return [
		{research_multiplier: 0.5, research_bonus: 0},
		{research_multiplier: 0.0, research_bonus: 2},
	]; },
});
test.assert(combined_labs == {allocation: 0.4, value: 2, bonus: 7, total: 9});

const punished_labs = technologies.get_base_labs({
	get_intake: base.get_intake,
	get_consumption: base.get_consumption,
	get_facilities: () => { return [{research_multiplier: 0.0 - 0.5, research_bonus: 0}]; },
});
test.assert(punished_labs == {allocation: 0.4, value: 2, bonus: 0, total: 2});

const make_initial_player = (starting_technologies) => {
	return {
		get_faction: () => {
			return {
				get_starting_technologies: () => { return starting_technologies; },
			};
		},
	};
};
test.assert(technologies.get_initial_state(make_initial_player([])) == {
	technologies: [],
	target: 'Biogenetics',
	progress: 0,
});
test.assert(technologies.get_initial_state(make_initial_player(['Biogenetics'])) == {
	technologies: ['Biogenetics'],
	target: 'IndustrialBase',
	progress: 0,
});
test.assert(technologies.get_initial_state(make_initial_player(every_technology)) == {
	technologies: every_technology,
	target: '',
	progress: 0,
});

const clone_state = (state) => {
	let known = [];
	for (id of state.technologies) {
		known :+id;
	}
	return {technologies: known, target: state.target, progress: state.progress};
};

let research_state = {technologies: [], target: '', progress: 0};
const player = {
	id: 1,
	name: 'Researcher',
	get_research_state: () => { return clone_state(research_state); },
	set_research_state: (state) => { research_state = clone_state(state); },
	has_technology: (id) => {
		for (known of research_state.technologies) {
			if (known == id) { return true; }
		}
		return false;
	},
};
let rival_technologies = [];
const rival = {
	id: 2,
	has_technology: (id) => {
		for (known of rival_technologies) {
			if (known == id) { return true; }
		}
		return false;
	},
};
let triggers = [];
let messages = [];
let datalinks_queues = 0;
let map_reveals = 0;
let map_rollbacks = 0;
const map_tiles = [{x: 0, y: 0}, {x: 2, y: 0}];
const game = {
	get_players: () => { return [player, rival]; },
	trigger: (name, data) => {
		triggers :+name;
		test.assert(data.player == player);
	},
	message: (text) => { messages :+text; },
	get: (key) => {
		if (key == 'f_message_to_contacts') {
			return (player, text) => { messages :+text; };
		}
		if (key == 'f_technology_get_next_target') {
			return technologies.get_next_target;
		}
		if (key == 'f_technology_get_definition') {
			return technologies.get_definition;
		}
		if (key == 'f_project_queue_planetary_datalinks') {
			return () => { datalinks_queues++; };
		}
		if (key == 'f_exploration_get_all_tiles') {
			return () => { return map_tiles; };
		}
		if (key == 'f_exploration_apply_reveal') {
			return (target, tiles) => {
				test.assert(target == player && tiles == map_tiles);
				map_reveals++;
				return {player: target, tiles: tiles};
			};
		}
		if (key == 'f_exploration_rollback_reveal') {
			return (snapshot) => {
				test.assert(snapshot.player == player && snapshot.tiles == map_tiles);
				map_rollbacks++;
			};
		}
		throw Error('Unknown game value: ' + key);
	},
};

let event = {
	caller: 0,
	game: game,
	data: {
		player: player,
		state: {technologies: [], target: 'Biogenetics', progress: 0},
	},
};
test.assert(!#is_defined(initialize_research.validate(event)));
event.caller = 1;
test.assert(#is_defined(initialize_research.validate(event)));
event.caller = 0;
event.applied = initialize_research.apply(event);
test.assert(research_state == event.data.state);
test.assert(triggers == ['research_updated']);
initialize_research.rollback(event);
test.assert(research_state == {technologies: [], target: '', progress: 0});
test.assert(triggers == ['research_updated', 'research_updated']);

research_state = {technologies: [], target: 'Biogenetics', progress: 3};
event = {
	caller: 0,
	game: game,
	data: {player: player, technology: biogenetics, labs: 4},
};
test.assert(!#is_defined(process_research.validate(event)));
event.caller = 1;
test.assert(#is_defined(process_research.validate(event)));
event.caller = 0;
event.data.labs = 0 - 1;
test.assert(#is_defined(process_research.validate(event)));
event.data.labs = 4;
event.data.technology = null;
test.assert(#is_defined(process_research.validate(event)));
event.data.technology = {id: 'Biogenetics', name: 'Biogenetics', cost: '30'};
test.assert(#is_defined(process_research.validate(event)));
event.data.technology = biogenetics;
research_state.progress = biogenetics.cost;
test.assert(#is_defined(process_research.validate(event)));
research_state.progress = 3;

event.applied = process_research.apply(event);
test.assert(!event.applied.completed);
test.assert(datalinks_queues == 0);
test.assert(research_state == {technologies: [], target: 'Biogenetics', progress: 7});
test.assert(messages == []);
process_research.rollback(event);
test.assert(research_state == {technologies: [], target: 'Biogenetics', progress: 3});

research_state.progress = 29;
event.data.labs = 1;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(event.applied.completed_count == 1);
test.assert(datalinks_queues == 1);
test.assert(research_state == {
	technologies: ['Biogenetics'],
	target: 'IndustrialBase',
	progress: 0,
});
test.assert(messages == ['Researcher has discovered Biogenetics.']);
process_research.rollback(event);
test.assert(research_state == {technologies: [], target: 'Biogenetics', progress: 29});

messages = [];
research_state = {technologies: [], target: 'Biogenetics', progress: 29};
event.data.labs = 51;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(event.applied.completed_count == 2);
test.assert(datalinks_queues == 2);
test.assert(research_state == {
	technologies: ['Biogenetics', 'IndustrialBase'],
	target: 'InformationNetworks',
	progress: 0,
});
test.assert(messages == [
	'Researcher has discovered Biogenetics.',
	'Researcher has discovered Industrial Base.',
]);
process_research.rollback(event);
test.assert(research_state == {technologies: [], target: 'Biogenetics', progress: 29});

event.data.technology = {id: 'WrongTarget', name: 'Wrong Target', cost: 20};
test.assert(#is_defined(process_research.validate(event)));

const secrets = technologies.get_definition('SecretsOfAlphaCentauri');
rival_technologies = [];
messages = [];
triggers = [];
datalinks_queues = 0;
map_reveals = 0;
map_rollbacks = 0;
research_state = {
	technologies: [],
	target: secrets.id,
	progress: secrets.cost - 1,
};
event = {
	caller: 0,
	game: game,
	data: {player: player, technology: secrets, labs: 1},
};
event.applied = process_research.apply(event);
test.assert(event.applied.completed_count == 1);
test.assert(event.applied.bonus_technologies.completed_count == 1);
test.assert(event.applied.bonus_technologies.completed_ids == ['Biogenetics']);
test.assert(research_state == {
	technologies: ['SecretsOfAlphaCentauri', 'Biogenetics'],
	target: 'IndustrialBase',
	progress: 0,
});
test.assert(map_reveals == 1 && map_rollbacks == 0);
test.assert(datalinks_queues == 2);
test.assert(messages == [
	'Researcher has discovered Secrets of Alpha Centauri.',
	'Researcher has gained Biogenetics as the first discoverer.',
]);
process_research.rollback(event);
test.assert(research_state == {
	technologies: [],
	target: 'SecretsOfAlphaCentauri',
	progress: secrets.cost - 1,
});
test.assert(map_reveals == 1 && map_rollbacks == 1);

rival_technologies = ['SecretsOfAlphaCentauri'];
messages = [];
datalinks_queues = 0;
map_reveals = 0;
map_rollbacks = 0;
research_state = {
	technologies: [],
	target: secrets.id,
	progress: secrets.cost - 1,
};
event.applied = process_research.apply(event);
test.assert(!#is_defined(event.applied.bonus_technologies));
test.assert(research_state == {
	technologies: ['SecretsOfAlphaCentauri'],
	target: 'Biogenetics',
	progress: 0,
});
test.assert(map_reveals == 1 && datalinks_queues == 1);
test.assert(messages == ['Researcher has discovered Secrets of Alpha Centauri.']);
process_research.rollback(event);
test.assert(map_reveals == 1 && map_rollbacks == 1);

rival_technologies = [];
datalinks_queues = 0;
map_reveals = 0;
map_rollbacks = 0;
research_state = {
	technologies: [],
	target: secrets.id,
	progress: 7,
};
const free_acquisition = technology_acquisition.apply(game, player, 1);
test.assert(free_acquisition.completed_ids == ['SecretsOfAlphaCentauri', 'Biogenetics']);
test.assert(research_state == {
	technologies: ['SecretsOfAlphaCentauri', 'Biogenetics'],
	target: 'IndustrialBase',
	progress: 7,
});
test.assert(map_reveals == 1 && datalinks_queues == 1);
technology_acquisition.rollback(game, free_acquisition);
test.assert(research_state == {
	technologies: [],
	target: 'SecretsOfAlphaCentauri',
	progress: 7,
});
test.assert(map_reveals == 1 && map_rollbacks == 1);
