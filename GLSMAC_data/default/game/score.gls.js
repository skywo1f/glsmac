const rules = #include('score_rules');

return (game) => {
	game.on('start', (e) => {
		game.set('f_score_get_breakdown', (player) => {
			return rules.get_breakdown(game, player);
		});
	});
};
