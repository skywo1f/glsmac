const rules = #include('../council_rules');
const game_rules = #include('../game_rules');

return {
	validate: (e) => {
		if (!game_rules.get(e.game, 'allow_diplomatic_victory')) {
			return 'Diplomatic victory is disabled by the game rules';
		}
		if (e.caller != 0) {
			return 'Only the game master can resolve Supreme Leader defiance';
		}
		if (e.game.is_game_over()) {
			return 'Game already has a winner';
		}
		if (rules.get_supreme_defiance_winner(e.game) == null) {
			return 'Defiant factions still survive';
		}
	},

	apply: (e) => {
		const winner = rules.get_supreme_defiance_winner(e.game);
		e.game.declare_victory('diplomatic', winner.id);
		e.game.message(
			winner.name + ' has defeated every defiant faction and secured rule as Supreme Leader.'
		);
		return {terminal: true};
	},

	rollback: (e) => {},
};
