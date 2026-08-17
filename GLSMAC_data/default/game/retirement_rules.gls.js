const score_rules = #include('score_rules');

const LOW_DIFFICULTIES = {
	Citizen: true,
	Specialist: true,
	Talent: true,
};

const get_ending_year = (game) => {
	const settings = game.get_settings();
	const difficulty =
		#typeof(settings) == 'Object' && #typeof(settings.global) == 'Object'
			? settings.global.difficulty_level : 'Librarian';
	return #is_defined(LOW_DIFFICULTIES[difficulty]) ? 2600 : 2500;
};

const get_winner = (game) => {
	let winner = null;
	let highest_score = 0 - 1;
	for (player of game.get_players()) {
		const faction = player.get_faction();
		if (#is_defined(faction.is_native) && faction.is_native) {
			continue;
		}
		const score = score_rules.get_breakdown(game, player).total;
		if (
			winner == null || score > highest_score ||
			(score == highest_score && player.id < winner.id)
		) {
			winner = player;
			highest_score = score;
		}
	}
	return winner;
};

return {
	get_ending_year: get_ending_year,
	get_winner: get_winner,
};
