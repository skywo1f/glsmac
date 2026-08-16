const fallback = (game, text) => {
	if (#typeof(game.message) == 'Callable') {
		game.message(text);
	}
};

const send = (game, resolver_name, player, text) => {
	const resolver = #typeof(game.get) == 'Callable'
		? game.get(resolver_name)
		: #undefined;
	if (#typeof(resolver) == 'Callable') {
		resolver(player, text);
	} else {
		fallback(game, text);
	}
};

return {
	to_players: (game, players, text) => {
		const resolver = #typeof(game.get) == 'Callable'
			? game.get('f_message_to_players')
			: #undefined;
		if (#typeof(resolver) == 'Callable') {
			resolver(text, players);
		} else {
			fallback(game, text);
		}
	},
	to_player: (game, player, text) => {
		send(game, 'f_message_to_player', player, text);
	},
	to_contacts: (game, player, text) => {
		send(game, 'f_message_to_contacts', player, text);
	},
};
