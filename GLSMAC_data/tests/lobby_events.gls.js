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

const game_settings = #include('../default/game/event/game_settings');

let player_ready = [true, false];
const players = [
	{
		id: 0,
		is_ready: () => {
			return player_ready[0];
		},
		set_ready: (value) => {
			player_ready[0] = value;
		},
	},
	{
		id: 1,
		is_ready: () => {
			return player_ready[1];
		},
		set_ready: (value) => {
			player_ready[1] = value;
		},
	},
];
const settings = {
	global: {
		map: {
			size_x: 40,
			size_y: 20,
		},
	},
};
let triggered_settings = null;
const settings_game = {
	get_settings: () => {
		return settings;
	},
	get_players: () => {
		return players;
	},
	get_player: (id) => {
		return players[id];
	},
	trigger: (name, data) => {
		test.assert(name == 'game_settings');
		triggered_settings = data.settings;
	},
};
const settings_event = {
	caller: 0,
	game: settings_game,
	data: {
		changes: [
			['planet_size', '64x32'],
		],
	},
};

settings_event.applied = game_settings.apply(settings_event);
test.assert(settings.global.map.size_x == 64);
test.assert(settings.global.map.size_y == 32);
test.assert(player_ready[0] == false);
test.assert(player_ready[1] == false);
test.assert(triggered_settings[0][0] == 'planet_size');

game_settings.rollback(settings_event);
test.assert(settings.global.map.size_x == 40);
test.assert(settings.global.map.size_y == 20);
test.assert(player_ready[0] == true);
test.assert(player_ready[1] == false);
