const victory_rules = #include('../victory_rules');

return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only the game master can declare victory';
		}
		if (e.game.is_game_over()) {
			return 'Game already has a winner';
		}
		if (
			#typeof(e.data.type) != 'String' ||
			(e.data.type != 'conquest' && e.data.type != 'transcendence')
		) {
			return 'Unsupported victory type';
		}
		if (#typeof(e.data.winner_id) != 'Int' || e.data.winner_id < 0) {
			return 'Victory winner ID is invalid';
		}
		const winner = e.data.type == 'conquest'
			? e.game.get_conquest_winner()
			: victory_rules.get_transcendence_winner(e.game);
		if (winner == null || winner.id != e.data.winner_id) {
			return 'Player has not met the ' + e.data.type + ' victory condition';
		}
	},

	apply: (e) => {
		e.game.declare_victory(e.data.type, e.data.winner_id);
		const winner = e.game.get_player(e.data.winner_id);
		const result = e.data.type == 'conquest'
			? ' has won by conquest'
			: ' has achieved transcendence';
		e.game.message(
			winner.get_faction().name + result + ' in M.Y. ' +
			#to_string(e.game.get_year()) + '.'
		);
	},

	rollback: (e) => {
		// Victory declarations are host-authored and never applied speculatively.
	},

};
