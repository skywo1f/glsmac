return {

	validate: (e) => {
		const error = e.game.get('f_diplomacy_validate_pair')(e.data.player, e.data.target);
		if (#is_defined(error)) {
			return error;
		}
		if (e.caller != 0 && e.data.player.id != e.caller) {
			return 'Players may only declare their own vendettas';
		}
		if (e.game.is_turn_complete(e.data.player.id)) {
			return 'Player has already completed this turn';
		}
		const get_forced_relation = e.game.get('f_council_get_forced_relation');
		if (
			#typeof(get_forced_relation) == 'Callable' &&
			get_forced_relation(e.data.player, e.data.target) == 'pact'
		) {
			return 'Factions loyal to the Supreme Leader cannot declare vendetta on each other';
		}
		if (e.data.player.get_diplomatic_relation(e.data.target) == 'vendetta') {
			return 'Players are already at vendetta';
		}
	},

	apply: (e) => {
		const snapshot = e.game.get('f_diplomacy_snapshot_pair')(e.data.player, e.data.target);
		const justified = e.game.get('f_diplomacy_has_active_excuse')(
			e.data.player,
			e.data.target
		);
		e.game.get('f_diplomacy_set_bilateral_relation')(
			e.data.player,
			e.data.target,
			'vendetta',
			justified
		);
		e.game.get('f_diplomacy_clear_offers')(e.data.player, e.data.target);
		if (justified) {
			e.game.trigger('diplomatic_excuse_updated', {
				player: e.data.player,
				target: e.data.target,
				expiry_turn: 0 - 1,
				used: true,
			});
		}
		e.game.trigger('diplomacy_updated', {
			player: e.data.player,
			target: e.data.target,
			relation: 'vendetta',
		});
		return snapshot;
	},

	rollback: (e) => {
		e.game.get('f_diplomacy_restore_pair')(e.data.player, e.data.target, e.applied);
		e.game.trigger('diplomacy_updated', {
			player: e.data.player,
			target: e.data.target,
			relation: e.applied.player_relation,
		});
		if (e.applied.player_excuse_turn >= 0) {
			e.game.trigger('diplomatic_excuse_updated', {
				player: e.data.player,
				target: e.data.target,
				expiry_turn: e.applied.player_excuse_turn,
				used: false,
			});
		}
	},

};
