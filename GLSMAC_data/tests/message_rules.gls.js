const messages = #include('../default/game/message_rules');

const player = {id: 1};
let scoped = [];
let global = [];
const game = {
	get: (name) => {
		if (name == 'f_message_to_players') {
			return (text, targets) => {
				scoped :+{name: name, targets: targets, text: text};
			};
		}
		if (name == 'f_message_to_player' || name == 'f_message_to_contacts') {
			return (target, text) => { scoped :+{name: name, target: target, text: text}; };
		}
		return #undefined;
	},
	message: (text) => { global :+text; },
};

messages.to_players(game, [player], 'involved');
messages.to_player(game, player, 'private');
messages.to_contacts(game, player, 'known');
test.assert(scoped == [
	{name: 'f_message_to_players', targets: [player], text: 'involved'},
	{name: 'f_message_to_player', target: player, text: 'private'},
	{name: 'f_message_to_contacts', target: player, text: 'known'},
]);
test.assert(global == []);

const fallback_game = {message: (text) => { global :+text; }};
messages.to_players(fallback_game, [player], 'fallback group');
messages.to_player(fallback_game, player, 'fallback');
test.assert(global == ['fallback group', 'fallback']);

messages.to_player({}, player, 'optional');
test.assert(global == ['fallback group', 'fallback']);
