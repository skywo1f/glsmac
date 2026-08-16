const victory_popup = #include('../default/ui/parts/game/popup/victory');

let victory_state = {type: 'conquest', winner: 0, turn: 12};
const players = [
	{id: 0, name: 'Local Commander', get_faction: () => { return {name: 'Spartan Federation'}; }},
	{id: 1, name: 'Lady Deirdre Skye', get_faction: () => { return {name: 'Gaia\'s Stepdaughters'}; }},
];
let callbacks = {};
let shown_popup = '';
let closed = 0;
let buttons = [];
let local_shares_victory = false;

const make_button = (properties) => {
	let handlers = {};
	const button = {
		text: properties.text,
		on: (name, callback) => { handlers[name] = callback; },
		click: () => { return handlers.click({}); },
	};
	buttons :+button;
	return button;
};
const body = {
	text: (properties) => { return {text: properties.text}; },
	button: (properties) => { return make_button(properties); },
};
const game = {
	get_victory_state: () => { return victory_state; },
	get_player: (id) => { return #is_defined(id) ? players[id] : players[0]; },
	get: (name) => {
		return name == 'f_score_get_breakdown'
			? (player) => { return {
				total: player.id == 0 ? 321 : 123,
				is_victory_winner: player.id == 0 && local_shares_victory,
			}; }
			: #undefined;
	},
	on: (name, callback) => { callbacks[name] = callback; },
};

victory_popup.init({
	game: game,
	glsmac: {reset: () => {}},
	modules: {
		popup: {
			show: (name) => {
				shown_popup = name;
				victory_popup.on_show();
			},
		},
	},
	create: (title, width, height, build) => {
		test.assert(title == 'GAME COMPLETE');
		test.assert(width == 520);
		test.assert(height == 168);
		build(body, (result) => { closed++; });
		return {};
	},
});

victory_popup.on_show();
test.assert(victory_popup.status_text.text == 'You have won the game.');
test.assert(victory_popup.detail_text.text == 'Conquest Victory in M.Y. 2112.');
test.assert(victory_popup.score_text.text == 'Alpha Centauri Score: 321');
test.assert(#sizeof(buttons) == 2);
test.assert(buttons[0].text == 'Continue Viewing Planet');
test.assert(buttons[1].text == 'Return to Main Menu');
test.assert(buttons[0].click());
test.assert(closed == 1);

victory_state = {type: 'economic', winner: 1, turn: 42};
callbacks.victory_declared({type: 'economic', winner: players[1], turn: 42});
test.assert(shown_popup == 'victory');
test.assert(victory_popup.status_text.text == 'Gaia\'s Stepdaughters has won the game.');
test.assert(victory_popup.detail_text.text == 'Economic Victory in M.Y. 2142.');
test.assert(victory_popup.score_text.text == 'Alpha Centauri Score: 321');
local_shares_victory = true;
victory_popup.refresh();
test.assert(victory_popup.status_text.text == 'You share in the victory.');

victory_state = {type: 'transcendence', winner: 0, turn: 130};
victory_popup.refresh();
test.assert(victory_popup.detail_text.text == 'Transcendence Victory in M.Y. 2230.');
victory_state = {type: 'diplomatic', winner: 0, turn: 99};
victory_popup.refresh();
test.assert(victory_popup.detail_text.text == 'Diplomatic Victory in M.Y. 2199.');
victory_state = {type: '', winner: -1, turn: 0};
victory_popup.refresh();
test.assert(victory_popup.status_text.text == 'No faction has won the game.');
test.assert(victory_popup.detail_text.text == '');
test.assert(victory_popup.score_text.text == '');
