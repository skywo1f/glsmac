const complete_turn = #include('../default/game/event/complete_turn');
const uncomplete_turn = #include('../default/game/event/uncomplete_turn');
const advance_turn = #include('../default/game/event/advance_turn');
const unit_skip_turn = #include('../default/game/event/unit_skip_turn');

let completed = [false, false];
let emitted_events = [];
let completed_calls = [];
let uncompleted_calls = [];
let advanced_turns = [];
let current_turn = 4;
let is_master = true;

const players = [
	{id: 0},
	{id: 1},
];
const game = {
	is_turn_complete: (id) => {
		return completed[id];
	},
	complete_turn: (id) => {
		completed[id] = true;
		completed_calls :+id;
	},
	uncomplete_turn: (id) => {
		completed[id] = false;
		uncompleted_calls :+id;
	},
	is_master: () => {
		return is_master;
	},
	get_players: () => {
		return players;
	},
	get_turn: () => {
		return current_turn;
	},
	event: (name, data) => {
		emitted_events :+{
			name: name,
			data: data,
		};
	},
	advance_turn: (turn_id) => {
		current_turn = turn_id;
		advanced_turns :+turn_id;
	},
};

let event = {
	caller: 1,
	game: game,
	data: {},
};

test.assert(!#is_defined(complete_turn.validate(event)));
complete_turn.apply(event);
test.assert(completed == [false, true]);
test.assert(completed_calls == [1]);
test.assert(emitted_events == []);

complete_turn.rollback(event);
test.assert(completed == [false, false]);
test.assert(uncompleted_calls == [1]);

completed[0] = true;
complete_turn.apply(event);
test.assert(completed == [true, true]);
test.assert(#sizeof(emitted_events) == 1);
test.assert(emitted_events[0].name == 'advance_turn');
test.assert(emitted_events[0].data.turn_id == 5);
test.assert(#is_defined(complete_turn.validate(event)));

test.assert(!#is_defined(uncomplete_turn.validate(event)));
uncomplete_turn.apply(event);
test.assert(completed == [true, false]);
test.assert(#is_defined(uncomplete_turn.validate(event)));
uncomplete_turn.rollback(event);
test.assert(completed == [true, true]);

let advance_event = {
	caller: 1,
	game: game,
	data: {
		turn_id: 5,
	},
};
test.assert(#is_defined(advance_turn.validate(advance_event)));

advance_event.caller = 0;
completed[1] = false;
test.assert(#is_defined(advance_turn.validate(advance_event)));

completed[1] = true;
test.assert(!#is_defined(advance_turn.validate(advance_event)));
advance_turn.apply(advance_event);
test.assert(current_turn == 5);
test.assert(advanced_turns == [5]);
advance_turn.rollback(advance_event);
test.assert(current_turn == 5);

advance_event.data.turn_id = 1;
completed = [false, false];
test.assert(!#is_defined(advance_turn.validate(advance_event)));

let movement = 0.75;
const unit = {
	owner: 1,
	movement: movement,
	get_tile: () => {
		return {
			is_locked: () => {
				return false;
			},
		};
	},
};
const skip_event = {
	caller: 1,
	data: {
		unit: unit,
	},
};
test.assert(!#is_defined(unit_skip_turn.validate(skip_event)));
skip_event.applied = unit_skip_turn.apply(skip_event);
test.assert(skip_event.applied.original_movement == 0.75);
unit_skip_turn.rollback(skip_event);
