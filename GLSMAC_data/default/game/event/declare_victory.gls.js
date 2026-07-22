return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only the game master can declare victory';
		}
		if (e.game.is_game_over()) {
			return 'Game already has a winner';
		}
		if (#typeof(e.data.type) != 'String' || e.data.type != 'conquest') {
			return 'Unsupported victory type';
		}
		if (#typeof(e.data.winner_id) != 'Int' || e.data.winner_id < 0) {
			return 'Victory winner ID is invalid';
		}
		const winner = e.game.get_conquest_winner();
		if (winner == null || winner.id != e.data.winner_id) {
			return 'Player has not met the conquest victory condition';
		}
	},

	apply: (e) => {
		e.game.declare_victory(e.data.type, e.data.winner_id);
		const winner = e.game.get_player(e.data.winner_id);
		e.game.message(
			winner.get_faction().name + ' has won by conquest in M.Y. ' +
			#to_string(e.game.get_year()) + '.'
		);
	},

	rollback: (e) => {
		// Victory declarations are host-authored and never applied speculatively.
	},

};
