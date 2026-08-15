const event_def = #include('../default/game/event/set_research_target');

let state = {
	technologies: ['Biogenetics'],
	target: 'IndustrialBase',
	progress: 7,
};
const clone_state = () => {
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
const player = {
	id: 1,
	get_research_state: clone_state,
	set_research_state: (next) => { state = next; },
};
let triggers = 0;
const game = {
	is_turn_complete: (id) => { return false; },
	get: (key) => {
		test.assert(key == 'f_technology_get_available_targets');
		return (known) => { return ['IndustrialBase', 'CentauriEcology']; };
	},
	trigger: (name, data) => {
		test.assert(name == 'research_updated');
		test.assert(data.player == player);
		triggers++;
	},
};
let event = {
	caller: 1,
	game: game,
	data: {player: player, target: 'CentauriEcology'},
};

test.assert(!#is_defined(event_def.validate(event)));
event.applied = event_def.apply(event);
test.assert(state == {
	technologies: ['Biogenetics'],
	target: 'CentauriEcology',
	progress: 7,
});
test.assert(triggers == 1);
event_def.rollback(event);
test.assert(state == {
	technologies: ['Biogenetics'],
	target: 'IndustrialBase',
	progress: 7,
});
test.assert(triggers == 2);

event.data.target = 'Unavailable';
test.assert(#is_defined(event_def.validate(event)));
event.data.target = '';
test.assert(#is_defined(event_def.validate(event)));
event.data.target = 'CentauriEcology';
event.caller = 2;
test.assert(#is_defined(event_def.validate(event)));
