const victory_rules = #include('../victory_rules');
const retirement_rules = #include('../retirement_rules');
const game_rules = #include('../game_rules');

const get_rule_key = (type) => {
	if (type == 'conquest') { return 'allow_conquest_victory'; }
	if (type == 'transcendence') { return 'allow_transcendence_victory'; }
	if (type == 'score') { return ''; }
	return 'allow_economic_victory';
};

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
			(
				e.data.type != 'conquest' && e.data.type != 'transcendence' &&
				e.data.type != 'economic' && e.data.type != 'score'
			)
		) {
			return 'Unsupported victory type';
		}
		if (#typeof(e.data.winner_id) != 'Int' || e.data.winner_id < 0) {
			return 'Victory winner ID is invalid';
		}
		const rule_key = get_rule_key(e.data.type);
		if (rule_key != '' && !game_rules.get(e.game, rule_key)) {
			return 'This victory condition is disabled by the game rules';
		}
		if (#typeof(e.game.is_master) == 'Callable' && !e.game.is_master()) {
			return;
		}
		let winner = null;
		if (e.data.type == 'conquest') {
			const get_diplomatic_winner = #typeof(e.game.get) == 'Callable'
				? e.game.get('f_council_get_supreme_defiance_winner')
				: #undefined;
			if (
				#typeof(get_diplomatic_winner) == 'Callable' &&
				get_diplomatic_winner() != null
			) {
				return 'Supreme Leader defiance must resolve as a diplomatic victory';
			}
			winner = e.game.get_conquest_winner();
		} else if (e.data.type == 'transcendence') {
			winner = victory_rules.get_transcendence_winner(e.game);
		} else if (e.data.type == 'score') {
			if (e.game.get_year() < retirement_rules.get_ending_year(e.game)) {
				return 'Mandatory retirement year has not been reached';
			}
			winner = retirement_rules.get_winner(e.game);
		} else {
			winner = victory_rules.get_economic_winner(e.game);
		}
		if (winner == null || winner.id != e.data.winner_id) {
			return 'Player has not met the ' + e.data.type + ' victory condition';
		}
	},

	apply: (e) => {
		e.game.declare_victory(e.data.type, e.data.winner_id);
		const winner = e.game.get_player(e.data.winner_id);
		let result = ' has cornered the Global Energy Market';
		if (e.data.type == 'conquest') {
			result = ' has won by conquest';
		} else if (e.data.type == 'transcendence') {
			result = ' has achieved transcendence';
		} else if (e.data.type == 'score') {
			result = ' has won with the highest Alpha Centauri Score';
		}
		e.game.message(
			winner.get_faction().name + result + ' in M.Y. ' +
			#to_string(e.game.get_year()) + '.'
		);
	},

	rollback: (e) => {
		// Victory declarations are host-authored and never applied speculatively.
	},

};
