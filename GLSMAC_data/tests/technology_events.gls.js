const technologies = #include('../default/technologies');
const initialize_research = #include('../default/game/event/initialize_player_research');
const process_research = #include('../default/game/event/process_player_research');

const ecology = technologies.get_definition('CentauriEcology');
test.assert(ecology.id == 'CentauriEcology');
test.assert(ecology.name == 'Centauri Ecology');
test.assert(ecology.cost == 20);
test.assert(#sizeof(ecology.prerequisites) == 0);
const mobility = technologies.get_definition('DoctrineMobility');
test.assert(mobility.id == 'DoctrineMobility');
test.assert(mobility.name == 'Doctrine: Mobility');
test.assert(mobility.cost == 30);
test.assert(mobility.prerequisites == ['CentauriEcology']);
const information = technologies.get_definition('InformationNetworks');
test.assert(information.id == 'InformationNetworks');
test.assert(information.name == 'Information Networks');
test.assert(information.cost == 40);
test.assert(information.prerequisites == ['DoctrineMobility']);
const physics = technologies.get_definition('AppliedPhysics');
test.assert(physics.name == 'Applied Physics');
test.assert(physics.cost == 50);
test.assert(physics.prerequisites == ['InformationNetworks']);
const industry = technologies.get_definition('IndustrialBase');
test.assert(industry.name == 'Industrial Base');
test.assert(industry.cost == 50);
test.assert(industry.prerequisites == ['AppliedPhysics']);
const social = technologies.get_definition('SocialPsych');
test.assert(social.name == 'Social Psych');
test.assert(social.cost == 40);
test.assert(social.prerequisites == ['CentauriEcology']);
const biogenetics = technologies.get_definition('Biogenetics');
test.assert(biogenetics.name == 'Biogenetics');
test.assert(biogenetics.cost == 30);
test.assert(biogenetics.prerequisites == []);
const planetary_networks = technologies.get_definition('PlanetaryNetworks');
test.assert(planetary_networks.name == 'Planetary Networks');
test.assert(planetary_networks.cost == 50);
test.assert(planetary_networks.prerequisites == ['InformationNetworks']);
const doctrine_loyalty = technologies.get_definition('DoctrineLoyalty');
test.assert(doctrine_loyalty.name == 'Doctrine: Loyalty');
test.assert(doctrine_loyalty.cost == 60);
test.assert(doctrine_loyalty.prerequisites == ['DoctrineMobility', 'SocialPsych']);
test.assert(technologies.get_definition('UnknownTechnology') == null);
test.assert(technologies.get_available_targets([]) == ['CentauriEcology', 'Biogenetics']);
test.assert(technologies.get_available_targets(['CentauriEcology']) == ['DoctrineMobility', 'SocialPsych', 'Biogenetics']);
test.assert(technologies.get_next_target([]) == 'CentauriEcology');
test.assert(technologies.get_next_target(['CentauriEcology']) == 'DoctrineMobility');
test.assert(technologies.get_next_target(['CentauriEcology', 'DoctrineMobility']) == 'InformationNetworks');
test.assert(technologies.get_next_target(['CentauriEcology', 'DoctrineMobility', 'InformationNetworks']) == 'AppliedPhysics');
test.assert(technologies.get_next_target(['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics']) == 'IndustrialBase');
test.assert(technologies.get_next_target(['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase']) == 'SocialPsych');
test.assert(technologies.get_next_target(['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych']) == 'Biogenetics');
test.assert(technologies.get_next_target(['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics']) == 'PlanetaryNetworks');
test.assert(technologies.get_next_target(['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics', 'PlanetaryNetworks']) == 'DoctrineLoyalty');
test.assert(technologies.get_next_target(['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics', 'PlanetaryNetworks', 'DoctrineLoyalty']) == '');

const base = {
	get_intake: () => {
		return {ENERGY: 6};
	},
	get_consumption: () => {
		return {ENERGY: 1};
	},
	get_facilities: () => { return []; },
};
const labs = technologies.get_base_labs(base);
test.assert(labs.allocation == 0.4);
test.assert(labs.value == 2);
test.assert(labs.bonus == 2);
test.assert(labs.total == 4);
const network_base = {
	get_intake: base.get_intake,
	get_consumption: base.get_consumption,
	get_facilities: () => { return [{research_multiplier: 0.5}]; },
};
const network_labs = technologies.get_base_labs(network_base);
test.assert(network_labs.value == 2);
test.assert(network_labs.bonus == 4);
test.assert(network_labs.total == 6);

const make_initial_player = (starting_technologies) => {
	return {
		get_faction: () => {
			return {
				get_starting_technologies: () => {
					return starting_technologies;
				},
			};
		},
	};
};
test.assert(technologies.get_initial_state(make_initial_player([])) == {
	technologies: [],
	target: 'CentauriEcology',
	progress: 0,
});
test.assert(technologies.get_initial_state(make_initial_player(['CentauriEcology'])) == {
	technologies: ['CentauriEcology'],
	target: 'DoctrineMobility',
	progress: 0,
});
test.assert(technologies.get_initial_state(make_initial_player(['CentauriEcology', 'DoctrineMobility'])) == {
	technologies: ['CentauriEcology', 'DoctrineMobility'],
	target: 'InformationNetworks',
	progress: 0,
});
test.assert(technologies.get_initial_state(make_initial_player([
	'CentauriEcology',
	'DoctrineMobility',
	'InformationNetworks',
])) == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks'],
	target: 'AppliedPhysics',
	progress: 0,
});
test.assert(technologies.get_initial_state(make_initial_player([
	'CentauriEcology',
	'DoctrineMobility',
	'InformationNetworks',
	'AppliedPhysics',
	'IndustrialBase',
])) == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase'],
	target: 'SocialPsych',
	progress: 0,
});
test.assert(technologies.get_initial_state(make_initial_player([
	'CentauriEcology',
	'DoctrineMobility',
	'InformationNetworks',
	'AppliedPhysics',
	'IndustrialBase',
	'SocialPsych',
])) == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych'],
	target: 'Biogenetics',
	progress: 0,
});
test.assert(technologies.get_initial_state(make_initial_player([
	'CentauriEcology',
	'DoctrineMobility',
	'InformationNetworks',
	'AppliedPhysics',
	'IndustrialBase',
	'SocialPsych',
	'Biogenetics',
])) == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics'],
	target: 'PlanetaryNetworks',
	progress: 0,
});
test.assert(technologies.get_initial_state(make_initial_player([
	'CentauriEcology',
	'DoctrineMobility',
	'InformationNetworks',
	'AppliedPhysics',
	'IndustrialBase',
	'SocialPsych',
	'Biogenetics',
	'PlanetaryNetworks',
])) == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics', 'PlanetaryNetworks'],
	target: 'DoctrineLoyalty',
	progress: 0,
});
test.assert(technologies.get_initial_state(make_initial_player([
	'CentauriEcology',
	'DoctrineMobility',
	'InformationNetworks',
	'AppliedPhysics',
	'IndustrialBase',
	'SocialPsych',
	'Biogenetics',
	'PlanetaryNetworks',
	'DoctrineLoyalty',
])) == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics', 'PlanetaryNetworks', 'DoctrineLoyalty'],
	target: '',
	progress: 0,
});

const clone_state = (state) => {
	let known = [];
	for (id of state.technologies) {
		known :+id;
	}
	return {
		technologies: known,
		target: state.target,
		progress: state.progress,
	};
};

let research_state = {
	technologies: [],
	target: '',
	progress: 0,
};
const player = {
	id: 1,
	name: 'Researcher',
	get_research_state: () => {
		return clone_state(research_state);
	},
	set_research_state: (state) => {
		research_state = clone_state(state);
	},
};
let triggers = [];
let messages = [];
const game = {
	trigger: (name, data) => {
		triggers :+name;
		test.assert(data.player == player);
	},
	message: (text) => {
		messages :+text;
	},
	get: (key) => {
		if (key == 'f_technology_get_next_target') {
			return technologies.get_next_target;
		}
		if (key == 'f_technology_get_definition') {
			return technologies.get_definition;
		}
		throw Error('Unknown game value: ' + key);
	},
};

let event = {
	caller: 0,
	game: game,
	data: {
		player: player,
		state: {
			technologies: [],
			target: 'CentauriEcology',
			progress: 0,
		},
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

research_state = {
	technologies: [],
	target: 'CentauriEcology',
	progress: 3,
};
event = {
	caller: 0,
	game: game,
	data: {
		player: player,
		technology: ecology,
		labs: 4,
	},
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
event.data.technology = {
	id: 'CentauriEcology',
	name: 'Centauri Ecology',
	cost: '20',
};
test.assert(#is_defined(process_research.validate(event)));
event.data.technology = ecology;
research_state.progress = ecology.cost;
test.assert(#is_defined(process_research.validate(event)));
research_state.progress = 3;
event.data.labs = 4;

event.applied = process_research.apply(event);
test.assert(!event.applied.completed);
test.assert(research_state == {
	technologies: [],
	target: 'CentauriEcology',
	progress: 7,
});
test.assert(messages == []);
process_research.rollback(event);
test.assert(research_state == {
	technologies: [],
	target: 'CentauriEcology',
	progress: 3,
});

research_state.progress = 7;
event.data.labs = 20;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(event.applied.completed_count == 1);
test.assert(research_state == {
	technologies: ['CentauriEcology'],
	target: 'DoctrineMobility',
	progress: 7,
});
test.assert(messages == ['Researcher has discovered Centauri Ecology.']);
process_research.rollback(event);
test.assert(research_state == {
	technologies: [],
	target: 'CentauriEcology',
	progress: 7,
});

research_state = {
	technologies: [],
	target: 'CentauriEcology',
	progress: 19,
};
event.data.technology = ecology;
event.data.labs = 55;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(event.applied.completed_count == 2);
test.assert(research_state == {
	technologies: ['CentauriEcology', 'DoctrineMobility'],
	target: 'InformationNetworks',
	progress: 24,
});
test.assert(messages == [
	'Researcher has discovered Centauri Ecology.',
	'Researcher has discovered Centauri Ecology.',
	'Researcher has discovered Doctrine: Mobility.',
]);
process_research.rollback(event);
test.assert(research_state == {
	technologies: [],
	target: 'CentauriEcology',
	progress: 19,
});

research_state = {
	technologies: ['CentauriEcology'],
	target: 'DoctrineMobility',
	progress: 29,
};
event.data.technology = mobility;
event.data.labs = 1;
test.assert(!#is_defined(process_research.validate(event)));
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(research_state == {
	technologies: ['CentauriEcology', 'DoctrineMobility'],
	target: 'InformationNetworks',
	progress: 0,
});
test.assert(messages == [
	'Researcher has discovered Centauri Ecology.',
	'Researcher has discovered Centauri Ecology.',
	'Researcher has discovered Doctrine: Mobility.',
	'Researcher has discovered Doctrine: Mobility.',
]);
process_research.rollback(event);
test.assert(research_state == {
	technologies: ['CentauriEcology'],
	target: 'DoctrineMobility',
	progress: 29,
});

research_state = {
	technologies: ['CentauriEcology', 'DoctrineMobility'],
	target: 'InformationNetworks',
	progress: 39,
};
event.data.technology = information;
event.data.labs = 1;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(research_state == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks'],
	target: 'AppliedPhysics',
	progress: 0,
});
test.assert(messages == [
	'Researcher has discovered Centauri Ecology.',
	'Researcher has discovered Centauri Ecology.',
	'Researcher has discovered Doctrine: Mobility.',
	'Researcher has discovered Doctrine: Mobility.',
	'Researcher has discovered Information Networks.',
]);
process_research.rollback(event);
test.assert(research_state == {
	technologies: ['CentauriEcology', 'DoctrineMobility'],
	target: 'InformationNetworks',
	progress: 39,
});

research_state = {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks'],
	target: 'AppliedPhysics',
	progress: 49,
};
event.data.technology = physics;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(research_state == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics'],
	target: 'IndustrialBase',
	progress: 0,
});
process_research.rollback(event);
test.assert(research_state.target == 'AppliedPhysics');

research_state = {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics'],
	target: 'IndustrialBase',
	progress: 49,
};
event.data.technology = industry;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(research_state == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase'],
	target: 'SocialPsych',
	progress: 0,
});
process_research.rollback(event);
test.assert(research_state.target == 'IndustrialBase');

research_state = {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase'],
	target: 'SocialPsych',
	progress: 39,
};
event.data.technology = social;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(research_state == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych'],
	target: 'Biogenetics',
	progress: 0,
});
process_research.rollback(event);
test.assert(research_state.target == 'SocialPsych');

research_state = {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych'],
	target: 'Biogenetics',
	progress: 29,
};
event.data.technology = biogenetics;
event.data.labs = 1;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(research_state == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics'],
	target: 'PlanetaryNetworks',
	progress: 0,
});
process_research.rollback(event);
test.assert(research_state.target == 'Biogenetics');

research_state = {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics'],
	target: 'PlanetaryNetworks',
	progress: 49,
};
event.data.technology = planetary_networks;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(research_state == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics', 'PlanetaryNetworks'],
	target: 'DoctrineLoyalty',
	progress: 0,
});
process_research.rollback(event);
test.assert(research_state.target == 'PlanetaryNetworks');

research_state = {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics', 'PlanetaryNetworks'],
	target: 'DoctrineLoyalty',
	progress: 59,
};
event.data.technology = doctrine_loyalty;
event.applied = process_research.apply(event);
test.assert(event.applied.completed);
test.assert(research_state == {
	technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics', 'PlanetaryNetworks', 'DoctrineLoyalty'],
	target: '',
	progress: 0,
});
process_research.rollback(event);
test.assert(research_state.target == 'DoctrineLoyalty');

event.data.technology = {
	id: 'WrongTarget',
	name: 'Wrong Target',
	cost: 20,
};
test.assert(#is_defined(process_research.validate(event)));
