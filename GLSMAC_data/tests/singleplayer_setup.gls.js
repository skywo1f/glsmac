const select_faction = #include('../default/ui/parts/mainmenu/steps/select_faction');

const players = [];
const factions = [
	{id: 'GAIANS', name: 'Gaians'},
	{id: 'HIVE', name: 'Hive'},
];
let menu = null;
let selected_faction = null;
let ai_added = 0;
let game_started = 0;

const game = {
	get_players: () => { return players; },
	get_fm: () => {
		return {list: () => { return factions; }};
	},
	event: (name, data) => {
		test.assert(name == 'select_faction');
		selected_faction = data.faction;
	},
};
const i = {
	glsmac: {
		game: game,
		add_single_player: () => {
			test.assert(#sizeof(players) == 0);
			players :+{id: 0};
		},
		add_ai_player: () => {
			test.assert(#is_defined(selected_faction));
			ai_added++;
		},
		start_game: () => {
			test.assert(ai_added == 6);
			game_started++;
		},
	},
	sliding: {
		show: (data) => { menu = data; },
	},
};

select_faction(i);
test.assert(#sizeof(players) == 1);
test.assert(menu.title == 'Select a faction');
test.assert(#sizeof(menu.entries) == 3);
test.assert(menu.entries[0][0] == 'Random');
test.assert(menu.entries[1][0] == 'Gaians');
test.assert(menu.entries[2][0] == 'Hive');

menu.entries[2][1]();
test.assert(selected_faction == 'HIVE');
test.assert(ai_added == 6);
test.assert(game_started == 1);

menu.entries[1][1]();
test.assert(ai_added == 6);
test.assert(game_started == 1);

const main = #include('../default/ui/parts/mainmenu/steps/main');
let quick_menu = null;
let quick_players = 0;
let quick_ai = 0;
let quick_faction = null;
let quick_started = 0;
let randomized = 0;
let quicksave_exists = false;
let quicksave_loaded = 0;
let popup_errors = [];
const quick_settings = {
	local: {game_mode: ''},
	global: {difficulty_level: 'Transcend'},
};
const quick_glsmac = {
	game: {
		event: (name, data) => {
			test.assert(name == 'select_faction');
			quick_faction = data.faction;
		},
	},
	deinit: () => {},
	init: () => {},
	add_single_player: () => { quick_players++; },
	add_ai_player: () => { quick_ai++; },
	start_game: () => { quick_started++; },
	has_quicksave: () => { return quicksave_exists; },
	load_game: () => { quicksave_loaded++; },
	exit: () => {},
};
main({
	glsmac: quick_glsmac,
	settings: quick_settings,
	randomize_map: () => { randomized++; },
	sliding: {show: (data) => { quick_menu = data; }},
	popup: {error: (message) => { popup_errors :+message; }},
	steps: {},
});
quick_menu.entries[1][1]();
test.assert(randomized == 1);
test.assert(quick_players == 1);
test.assert(quick_faction == 'GAIANS');
test.assert(quick_ai == 6);
test.assert(quick_started == 1);

quick_menu.entries[3][1]();
test.assert(#sizeof(popup_errors) == 1);
test.assert(popup_errors[0] == 'No quicksave exists yet.');
test.assert(quicksave_loaded == 0);

quicksave_exists = true;
quick_menu.entries[3][1]();
test.assert(quicksave_loaded == 1);
