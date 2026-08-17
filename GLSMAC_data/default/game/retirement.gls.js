const rules = #include('retirement_rules');

return (game) => {
	game.on('start', (e) => {
		let declaration_pending = false;
		game.set('f_retirement_get_ending_year', () => {
			return rules.get_ending_year(game);
		});
		game.set('f_retirement_get_winner', () => {
			return rules.get_winner(game);
		});
		game.on('turn', (event) => {
			if (!game.is_master() || game.is_game_over() || declaration_pending) {
				return;
			}
			const ending_year = rules.get_ending_year(game);
			const year = game.get_year();
			if (year == ending_year - 20) {
				game.message(
					'Mandatory retirement is approaching in M.Y. ' +
					#to_string(ending_year) + '.'
				);
			}
			if (year < ending_year) {
				return;
			}
			const winner = rules.get_winner(game);
			if (winner == null) {
				return;
			}
			declaration_pending = true;
			game.event('declare_victory', {
				type: 'score',
				winner_id: winner.id,
			});
		});
	});
};
