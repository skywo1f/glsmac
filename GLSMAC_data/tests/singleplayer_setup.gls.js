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
};
const i = {
	glsmac: {
		game: game,
		add_single_player: (faction_id) => {
			test.assert(#sizeof(players) == 0);
			players :+{id: 0};
			selected_faction = #is_defined(faction_id) ? faction_id : 'RANDOM';
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
test.assert(#sizeof(players) == 0);
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
let load_menu_opened = 0;
const quick_settings = {
	local: {game_mode: ''},
	global: {difficulty_level: 'Transcend'},
};
const quick_glsmac = {
	game: {},
	deinit: () => {},
	init: () => {},
	add_single_player: (faction_id) => {
		quick_players++;
		quick_faction = faction_id;
	},
	add_ai_player: () => { quick_ai++; },
	start_game: () => { quick_started++; },
	exit: () => {},
};
main({
	glsmac: quick_glsmac,
	settings: quick_settings,
	randomize_map: () => { randomized++; },
	sliding: {show: (data) => { quick_menu = data; }},
	popup: {error: (message) => {}},
	steps: {load_game: (i) => { load_menu_opened++; }},
});
quick_menu.entries[1][1]();
test.assert(randomized == 1);
test.assert(quick_players == 1);
test.assert(quick_faction == 'GAIANS');
test.assert(quick_ai == 6);
test.assert(quick_started == 1);

quick_menu.entries[3][1]();
test.assert(load_menu_opened == 1);

const load_game = #include('../default/ui/parts/mainmenu/steps/load_game');
let load_menu = null;
let quicksave_exists = false;
let loaded_slot = -1;
let load_init_count = 0;
let load_deinit_count = 0;
let save_slots = [false, false, false, false, false, false];
let popup_errors = [];
const load_i = {
	glsmac: {
		has_quicksave: () => { return quicksave_exists; },
		has_save_game: (slot) => { return save_slots[slot]; },
		init: () => { load_init_count++; },
		deinit: () => { load_deinit_count++; },
		load_game: (slot) => {
			loaded_slot = #is_defined(slot) ? slot : 0;
		},
	},
	settings: {local: {game_mode: ''}},
	sliding: {show: (data) => { load_menu = data; }},
	popup: {error: (message) => { popup_errors :+message; }},
};

load_game(load_i);
test.assert(load_menu.title == 'Load Game');
test.assert(#sizeof(load_menu.entries) == 6);
test.assert(load_menu.entries[0][0] == 'Quicksave (Empty)');
test.assert(load_menu.entries[1][0] == 'Save Slot 1 (Empty)');
load_menu.entries[0][1]();
load_menu.entries[1][1]();
test.assert(#sizeof(popup_errors) == 2);
test.assert(popup_errors[0] == 'No quicksave exists yet.');
test.assert(popup_errors[1] == 'Save slot 1 is empty.');
test.assert(load_init_count == 0);

quicksave_exists = true;
save_slots[1] = true;
load_game(load_i);
test.assert(load_menu.entries[0][0] == 'Quicksave');
test.assert(load_menu.entries[1][0] == 'Save Slot 1');
load_menu.entries[0][1]();
test.assert(loaded_slot == 0);
load_menu.entries[1][1]();
test.assert(loaded_slot == 1);
test.assert(load_init_count == 2);
test.assert(load_deinit_count == 0);
test.assert(load_i.settings.local.game_mode == 'single');

const save_menu_def = #include('../default/ui/parts/game/menu/left_menu_game');
let save_menu_entries = null;
let saved_slots = [];
let save_menu_closed = 0;
let save_messages = [];
const save_menu = save_menu_def.init({
	create: (entries) => {
		save_menu_entries = entries;
		return {};
	},
	glsmac: {
		save_game: (slot) => {
			saved_slots :+(#is_defined(slot) ? slot : 0);
		},
	},
	game: {message: (message) => { save_messages :+message; }},
	menu: {close_all: () => { save_menu_closed++; }},
	maybe_quit: (exit_game) => {},
	modules: {popup: {show: (popup) => {}}},
});
test.assert(save_menu != null);
test.assert(#sizeof(save_menu_entries) == 11);
test.assert(save_menu_entries[0].label == 'Quick Save');
test.assert(save_menu_entries[1].label == 'Save Slot 1');
test.assert(save_menu_entries[5].label == 'Save Slot 5');
for (index of [0, 1, 2, 3, 4, 5]) {
	save_menu_entries[index].open();
}
test.assert(#sizeof(saved_slots) == 6);
for (slot of [0, 1, 2, 3, 4, 5]) {
	test.assert(saved_slots[slot] == slot);
}
test.assert(save_menu_closed == 6);
test.assert(#sizeof(save_messages) == 0);
