const is_supported_difficulty = (game, difficulty) => {
	for (available of game.get_settings().global.rules.difficulty_levels) {
		if (available == difficulty) {
			return true;
		}
	}
	return false;
};

return {

	validate: (e) => {
		if (e.game.is_started()) {
			return 'Game has already started';
		}
		if (e.game.get_player(e.caller).is_ready()) {
			return 'Player must become unready before changing difficulty';
		}
		if (#typeof(e.data.difficulty) != 'String') {
			return 'Difficulty level must be identified by name';
		}
		if (!is_supported_difficulty(e.game, e.data.difficulty)) {
			return 'Unknown difficulty level: ' + e.data.difficulty;
		}
	},

	apply: (e) => {
		const player = e.game.get_player(e.caller);
		const previous = player.difficulty_level;
		player.set_difficulty_level(e.data.difficulty);
		e.game.trigger('player_update', {player: player});
		return {difficulty: previous};
	},

	rollback: (e) => {
		const player = e.game.get_player(e.caller);
		player.set_difficulty_level(e.applied.difficulty);
		e.game.trigger('player_update', {player: player});
	},

};
