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
		e.game.trigger('social_engineering_updated', {
			player: e.data.player,
		});
		return previous;
	},

	rollback: (e) => {
		e.data.player.set_social_engineering(e.applied);
		e.game.trigger('social_engineering_updated', {
			player: e.data.player,
		});
	},

};
