const configure_conquest = #include('../default/game/conquest');

let callbacks = {};
let declarations = [];
let game_over = false;
let is_master = true;
let turn = 1;
let allow_conquest_victory = true;
let winner = null;
let diplomatic_winner = null;
const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, callback) => { callbacks[name] = callback; },
	is_master: () => { return is_master; },
	is_game_over: () => { return game_over; },
	get_turn: () => { return turn; },
	get_settings: () => { return {global: {rules: {
		allow_conquest_victory: allow_conquest_victory,
	}}}; },
	get: (name) => {
		return name == 'f_council_get_supreme_defiance_winner'
			? () => { return diplomatic_winner; }
			: #undefined;
	},
	get_conquest_winner: () => { return winner; },
	get_um: () => { return {on: (name, callback) => { callbacks['um_' + name] = callback; }}; },
	get_bm: () => { return {on: (name, callback) => { callbacks['bm_' + name] = callback; }}; },
	event: (name, data) => { declarations :+{name: name, data: data}; },
};

configure_conquest(game);
callbacks.start({});
test.assert(#typeof(callbacks.f_check_conquest_victory) == 'Callable');

winner = {id: 2};
turn = 0;
callbacks.diplomacy_updated({});
test.assert(declarations == []);
turn = 4;
allow_conquest_victory = false;
callbacks.diplomacy_updated({});
test.assert(declarations == []);
allow_conquest_victory = true;
diplomatic_winner = winner;
callbacks.diplomacy_updated({});
test.assert(declarations == []);
diplomatic_winner = null;
callbacks.diplomacy_updated({});
test.assert(declarations == [{
	name: 'declare_victory',
	data: {type: 'conquest', winner_id: 2},
}]);
callbacks.turn({});
test.assert(#sizeof(declarations) == 1);
