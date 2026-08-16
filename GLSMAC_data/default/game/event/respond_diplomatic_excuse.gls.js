const message_rules = #include('../message_rules');

return {

	validate: (e) => {
		const error = e.game.get('f_diplomacy_validate_pair')(e.data.player, e.data.target);
		if (#is_defined(error)) {
			return error;
		}
		if (e.caller != 0 && e.data.player.id != e.caller) {
			return 'Players may only answer their own diplomatic excuses';
		}
		if (e.game.is_turn_complete(e.data.player.id)) {
			return 'Player has already completed this turn';
		}
		if (#typeof(e.data.use_excuse) != 'Bool') {
			return 'Diplomatic excuse response must be a boolean';
		}
		if (!e.game.get('f_diplomacy_has_active_excuse')(e.data.player, e.data.target)) {
			return 'No current diplomatic excuse exists against this faction';
		}
		if (!e.data.use_excuse) {
			return;
		}
		const get_forced_relation = e.game.get('f_council_get_forced_relation');
		if (
			#typeof(get_forced_relation) == 'Callable' &&
			get_forced_relation(e.data.player, e.data.target) == 'pact'
		) {
			return 'Factions loyal to the Supreme Leader cannot renounce their pact';
		}
		if (e.data.player.get_diplomatic_relation(e.data.target) == 'vendetta') {
			return 'Players are already at vendetta';
		}
	},

	apply: (e) => {
		const player = e.data.player;
		const target = e.data.target;
		const snapshot = e.game.get('f_diplomacy_snapshot_pair')(player, target);
		player.set_diplomatic_excuse_turn(target, 0 - 1);
		if (e.data.use_excuse) {
			const previous_relation = snapshot.player_relation;
			const relation = previous_relation == 'pact' || previous_relation == 'treaty'
				? 'neutral' : 'vendetta';
			e.game.get('f_diplomacy_set_bilateral_relation')(
				player,
				target,
				relation,
				true
			);
			e.game.get('f_diplomacy_clear_offers')(player, target);
			e.game.trigger('diplomacy_updated', {
				player: player,
				target: target,
				relation: relation,
			});
			message_rules.to_players(e.game, [player, target],
				previous_relation == 'pact' || previous_relation == 'treaty'
				? player.name + ' used an exposed framing attempt to renounce the ' +
					previous_relation + ' with ' + target.name + '.'
				: player.name + ' used an exposed framing attempt to declare vendetta on ' +
					target.name + '.');
		} else {
			message_rules.to_players(
				e.game,
				[player, target],
				player.name + ' overlooked ' + target.name + '\'s framing attempt.'
			);
		}
		e.game.trigger('diplomatic_excuse_updated', {
			player: player,
			target: target,
			expiry_turn: 0 - 1,
			used: e.data.use_excuse,
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
		e.game.trigger('diplomatic_excuse_updated', {
			player: e.data.player,
			target: e.data.target,
			expiry_turn: e.applied.player_excuse_turn,
			used: false,
		});
	},

};
