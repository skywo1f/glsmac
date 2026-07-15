const ready_or_not = #include('../default/game/event/ready_or_not');

let is_ready = true;
let set_ready_calls = 0;

const player = {
	is_ready: () => {
		return is_ready;
	},
	set_ready: (value) => {
		is_ready = value;
		set_ready_calls++;
	},
};

const game = {
	get_player: (id) => {
		return player;
	},
};

let event = {
	caller: 1,
	game: game,
	data: {
		ready: true,
	},
};

event.applied = ready_or_not.apply(event);
test.assert(event.applied.was_ready == true);
test.assert(is_ready == true);
test.assert(set_ready_calls == 0);

is_ready = false;
ready_or_not.rollback(event);
test.assert(is_ready == true);
test.assert(set_ready_calls == 1);

is_ready = false;
set_ready_calls = 0;
event = {
	caller: 1,
	game: game,
	data: {
		ready: true,
	},
};

event.applied = ready_or_not.apply(event);
test.assert(event.applied.was_ready == false);
test.assert(is_ready == true);
test.assert(set_ready_calls == 1);

ready_or_not.rollback(event);
test.assert(is_ready == false);
test.assert(set_ready_calls == 2);
