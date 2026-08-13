const rules = #include('../council_rules');

return {
	validate: (e) => {
		if (
			#typeof(e.data.player) != 'Object' ||
			#typeof(e.data.player.get_council_state) != 'Callable'
		) {
			return 'Supreme Leader response requires a player';
		}
		if (e.caller != 0 && e.data.player.id != e.caller) {
			return 'Players may only answer the Supreme Leader for their own faction';
		}
		if (#typeof(e.data.defy) != 'Bool') {
			return 'Supreme Leader response must accede or defy';
		}
		return rules.validate_supreme_response(e.game, e.data.player);
	},

	apply: (e) => {
		const previous = e.data.player.get_council_state();
		const updated = #clone(previous);
		updated.supreme_response = e.data.defy
			? rules.supreme_response_defy
			: rules.supreme_response_accede;
		e.data.player.set_council_state(updated);
		e.game.trigger('council_updated', {
			player: e.data.player,
			supreme_response: updated.supreme_response,
		});
		return previous;
	},

	rollback: (e) => {
		e.data.player.set_council_state(e.applied);
		e.game.trigger('council_updated', {player: e.data.player});
	},
};
