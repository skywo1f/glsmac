const rules = #include('../default/game/retirement_rules');
const configure_retirement = #include('../default/game/retirement');
const declare_victory = #include('../default/game/event/declare_victory');

const make_player = (id, name, technologies, is_native) => {
	return {
		id: id,
		get_faction: () => {
			return {id: name, name: name, is_native: is_native};
		},
		get_research_state: () => { return {technologies: technologies}; },
		get_transcendent_thoughts: () => { return 0; },
		get_submissive_to_id: () => { return 0 - 1; },
	};
};

const first = make_player(1, 'First Faction', ['Biogenetics'], false);
const leader = make_player(
	2, 'Leading Faction', ['Biogenetics', 'IndustrialBase'], false
);
const planet = make_player(
	3, 'Planet', ['Biogenetics', 'IndustrialBase', 'AppliedPhysics'], true
);
const players = [first, leader, planet];
let difficulty = 'Librarian';
let year = 2479;
let game_over = false;
let declaration = null;
let queued = [];
let messages = [];
let callbacks = {};
let values = {};

const game = {
	get_settings: () => { return {global: {difficulty_level: difficulty, rules: {}}}; },
	get_players: () => { return players; },
	get_player: (id) => {
		for (player of players) {
			if (player.id == id) { return player; }
		}
		return null;
	},
	get_bm: () => {
		return {
			get_bases: () => { return []; },
			get_project_base: (id) => { return null; },
		};
	},
	get_um: () => { return {get_units: (include_hidden) => { return []; }}; },
	get_victory_state: () => {
		return game_over
			? {type: declaration.type, winner: declaration.winner_id, turn: year - 2100}
			: {type: '', winner: 0 - 1, turn: 0};
	},
	get_conquest_winner: () => { return null; },
	get_turn: () => { return year - 2100; },
	get_year: () => { return year; },
	is_master: () => { return true; },
	is_game_over: () => { return game_over; },
	get: (name) => {
		return #is_defined(values[name]) ? values[name] : #undefined;
	},
	set: (name, value) => { values[name] = value; },
	on: (name, callback) => { callbacks[name] = callback; },
	event: (name, data) => { queued :+{name: name, data: data}; },
	message: (text) => { messages :+text; },
	declare_victory: (type, winner_id) => {
		declaration = {type: type, winner_id: winner_id};
		game_over = true;
	},
};

test.assert(rules.get_ending_year(game) == 2500);
difficulty = 'Citizen';
test.assert(rules.get_ending_year(game) == 2600);
difficulty = 'Librarian';
test.assert(rules.get_winner(game).id == leader.id);

configure_retirement(game);
callbacks.start({});
test.assert(#typeof(values.f_retirement_get_ending_year) == 'Callable');
test.assert(values.f_retirement_get_ending_year() == 2500);
test.assert(values.f_retirement_get_winner().id == leader.id);

callbacks.turn({initial: false});
test.assert(#sizeof(messages) == 0);
year = 2480;
callbacks.turn({initial: false});
test.assert(
	messages == ['Mandatory retirement is approaching in M.Y. 2500.']
);
test.assert(#sizeof(queued) == 0);
year = 2500;
callbacks.turn({initial: false});
test.assert(#sizeof(queued) == 1);
test.assert(queued[0] == {
	name: 'declare_victory',
	data: {type: 'score', winner_id: leader.id},
});

const event = {
	caller: 0,
	game: game,
	data: queued[0].data,
};
year = 2499;
test.assert(
	declare_victory.validate(event) ==
	'Mandatory retirement year has not been reached'
);
year = 2500;
test.assert(!#is_defined(declare_victory.validate(event)));
event.data.winner_id = first.id;
test.assert(#is_defined(declare_victory.validate(event)));
event.data.winner_id = leader.id;
declare_victory.apply(event);
test.assert(game_over);
test.assert(declaration == {type: 'score', winner_id: leader.id});
test.assert(
	messages[1] ==
	'Leading Faction has won with the highest Alpha Centauri Score in M.Y. 2500.'
);
