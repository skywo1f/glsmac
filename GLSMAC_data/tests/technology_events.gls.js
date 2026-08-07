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
test.assert(technologies.get_definition('UnknownTechnology') == null);
test.assert(technologies.get_next_target([]) == 'CentauriEcology');
test.assert(technologies.get_next_target(['CentauriEcology']) == 'DoctrineMobility');
test.assert(technologies.get_next_target(['CentauriEcology', 'DoctrineMobility']) == '');

const base = {
	get_intake: () => {
		return {ENERGY: 6};
	},
	get_consumption: () => {
		return {ENERGY: 1};
	},
};
const labs = technologies.get_base_labs(base);
test.assert(labs.allocation == 0.4);
test.assert(labs.value == 2);
test.assert(labs.bonus == 2);
test.assert(labs.total == 4);

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
		test.assert(key == 'f_technology_get_next_target');
		return technologies.get_next_target;
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
test.assert(research_state == {
	technologies: ['CentauriEcology'],
	target: 'DoctrineMobility',
	progress: 0,
});
test.assert(messages == ['Researcher has discovered Centauri Ecology.']);
process_research.rollback(event);
test.assert(research_state == {
	technologies: [],
	target: 'CentauriEcology',
	progress: 7,
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
	target: '',
	progress: 0,
});
test.assert(messages == [
	'Researcher has discovered Centauri Ecology.',
	'Researcher has discovered Doctrine: Mobility.',
]);
process_research.rollback(event);
test.assert(research_state == {
	technologies: ['CentauriEcology'],
	target: 'DoctrineMobility',
	progress: 29,
});

event.data.technology = {
	id: 'WrongTarget',
	name: 'Wrong Target',
	cost: 20,
};
test.assert(#is_defined(process_research.validate(event)));
