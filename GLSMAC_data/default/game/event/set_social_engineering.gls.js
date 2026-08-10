const refresh_player_psych = (game, player) => {
	const get_psych = game.get('f_economy_get_base_psych');
	const process_psych = game.get('f_base_process_psych');
	if (!#is_defined(get_psych) || !#is_defined(process_psych)) {
		return;
	}
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			process_psych(game, base, get_psych(game, base));
		}
	}
};

return {

	validate: (e) => {
		if (
			#typeof(e.data.player) != 'Object' ||
			#typeof(e.data.player.get_social_engineering) != 'Callable' ||
			#typeof(e.data.player.set_social_engineering) != 'Callable'
		) {
			return 'Social engineering requires a player';
		}
		if (e.caller != 0 && e.data.player.id != e.caller) {
			return 'Players may only change their own social engineering choices';
		}
		if (e.game.is_turn_complete(e.data.player.id)) {
			return 'Player has already completed this turn';
		}
		return e.game.get('f_social_validate_choices')(e.data.player, e.data.choices);
	},

	apply: (e) => {
		const previous = e.data.player.get_social_engineering();
		e.data.player.set_social_engineering(e.data.choices);
		refresh_player_psych(e.game, e.data.player);
		e.game.trigger('social_engineering_updated', {
			player: e.data.player,
		});
		return previous;
	},

	rollback: (e) => {
		e.data.player.set_social_engineering(e.applied);
		refresh_player_psych(e.game, e.data.player);
		e.game.trigger('social_engineering_updated', {
			player: e.data.player,
		});
	},

};
