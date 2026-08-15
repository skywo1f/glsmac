const popup = #include('../default/ui/parts/game/popup/planetary_council');

let buttons = [];
let game_events = [];
let game_callbacks = {};
let closed = false;

const make_button = (properties) => {
	let handlers = {};
	let button = null;
	button = {
		text: properties.text,
		visible: true,
		on: (name, callback) => { handlers[name] = callback; },
		show: () => { button.visible = true; },
		hide: () => { button.visible = false; },
		click: () => { return handlers.click({}); },
	};
	buttons :+button;
	return button;
};
const body = {
	text: (properties) => { return {text: properties.text}; },
	button: (properties) => { return make_button(properties); },
};

const player = {
	id: 4,
	get_council_state: () => {
		return {proposal: '', vote_id: -2, supreme_response: 0};
	},
};
let session = {candidate_a_id: 4, candidate_b_id: 7};
const functions = {
	f_council_get_session: () => { return session; },
	f_council_validate_call: (caller, proposal) => { return #undefined; },
	f_council_validate_vote: (caller, vote_id) => { return #undefined; },
	f_council_has_global_trade_pact: () => { return false; },
	f_council_is_un_charter_repealed: () => { return false; },
};
const game = {
	get: (name) => { return functions[name]; },
	get_player: () => { return player; },
	event: (name, payload) => {
		game_events :+{
			name: name,
			player_id: #is_defined(payload.player) ? payload.player.id : -1,
			proposal: #is_defined(payload.proposal) ? payload.proposal : '',
			vote_id: #is_defined(payload.vote_id) ? payload.vote_id : -99,
			defy: #is_defined(payload.defy) ? payload.defy : false,
		};
	},
	on: (name, callback) => { game_callbacks[name] = callback; },
};
const modules = {
	popup: {
		is_shown: () => { return true; },
		show: (name) => {},
	},
};

game.event('direct_test', {player: player});
test.assert(game_events[0].player_id == player.id);
game_events = [];

popup.init({
	game: game,
	modules: modules,
	create: (title, width, height, build) => {
		build(body, (value) => { closed = true; });
		return {};
	},
});
popup.refresh = () => {};
popup.on_show();

test.assert(#sizeof(buttons) == 13);
test.assert(buttons[5].text == 'Convene Governor Election');
functions.f_council_validate_call = (caller, proposal) => {
	return 'stale local call validation';
};
test.assert(buttons[5].click());
test.assert(#sizeof(game_events) == 1);
test.assert(game_events[0].name == 'call_planetary_council');
test.assert(game_events[0].player_id == player.id);
test.assert(game_events[0].proposal == 'governor');

functions.f_council_validate_vote = (caller, vote_id) => {
	return 'stale local vote validation';
};
test.assert(buttons[0].click());
test.assert(#sizeof(game_events) == 2);
test.assert(game_events[1].name == 'cast_council_vote');
test.assert(game_events[1].vote_id == 4);

test.assert(buttons[2].click());
test.assert(#sizeof(game_events) == 3);
test.assert(game_events[2].name == 'cast_council_vote');
test.assert(game_events[2].vote_id == -1);

test.assert(buttons[7].click());
test.assert(game_events[3].name == 'call_planetary_council');
test.assert(game_events[3].proposal == 'trade_pact');

test.assert(buttons[9].click());
test.assert(game_events[4].name == 'call_planetary_council');
test.assert(game_events[4].proposal == 'repeal_un_charter');

test.assert(buttons[3].text == 'Accede to Supreme Leader');
test.assert(buttons[3].click());
test.assert(game_events[5].name == 'respond_supreme_leader');
test.assert(!game_events[5].defy);

test.assert(buttons[4].text == 'Defy the Council');
test.assert(buttons[4].click());
test.assert(game_events[6].name == 'respond_supreme_leader');
test.assert(game_events[6].defy);

test.assert(buttons[12].text == 'Close');
test.assert(buttons[12].click());
test.assert(closed);
