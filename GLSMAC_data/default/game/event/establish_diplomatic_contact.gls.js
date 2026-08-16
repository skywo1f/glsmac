const messages = #include('../message_rules');

return {

	validate: (e) => {
		const error = e.game.get('f_diplomacy_validate_players')(e.data.player, e.data.target);
		if (#is_defined(error)) {
			return error;
		}
		if (e.caller != 0) {
			return 'Diplomatic contact must be established by the host';
		}
	},

	apply: (e) => {
		const player = e.data.player;
		const target = e.data.target;
		const snapshot = {
			player_contact: player.has_contact(target),
			target_contact: target.has_contact(player),
		};
		player.set_contact(target, true);
		target.set_contact(player, true);
		if (!snapshot.player_contact || !snapshot.target_contact) {
			e.game.trigger('diplomatic_contact_established', {
				player: player,
				target: target,
			});
			messages.to_players(
				e.game,
				[player, target],
				player.name + ' established contact with ' + target.name + '.'
			);
		}
		return snapshot;
	},

	rollback: (e) => {
		e.data.player.set_contact(e.data.target, e.applied.player_contact);
		e.data.target.set_contact(e.data.player, e.applied.target_contact);
		e.game.trigger('diplomatic_contact_updated', {
			player: e.data.player,
			target: e.data.target,
		});
	},

};
