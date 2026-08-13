return {

	validate: (e) => {
		const player = e.data.player;
		const target = e.data.target;
		const error = e.game.get('f_diplomacy_validate_pair')(player, target);
		if (#is_defined(error)) { return error; }
		if (e.caller != 0 && player.id != e.caller) {
			return 'Factions may only offer their own surrender';
		}
		if (e.game.is_turn_complete(player.id)) {
			return 'Player has already completed this turn';
		}
		if (player.type != 'ai') {
			return 'Only an AI faction may offer surrender';
		}
		if (player.type == 'native' || target.type == 'native') {
			return 'Native life cannot participate in surrender';
		}
		const direction_error = e.game.get('f_diplomacy_validate_surrender_direction')(
			player,
			target
		);
		if (#is_defined(direction_error)) { return direction_error; }
		if (player.get_diplomatic_relation(target) != 'vendetta') {
			return 'A faction may only surrender to a vendetta opponent';
		}
		if (player.get_submissive_to_id() >= 0) {
			return 'Faction has already submitted to another leader';
		}
		if (target.get_submissive_to_id() >= 0) {
			return 'A submissive faction cannot receive a surrender';
		}
		if (player.get_surrender_offer_to_id() >= 0) {
			return 'Faction already has a surrender offer pending';
		}
	},

	apply: (e) => {
		const snapshot = e.game.get('f_diplomacy_snapshot_pair')(e.data.player, e.data.target);
		e.game.get('f_diplomacy_clear_offers')(e.data.player, e.data.target);
		e.data.player.set_surrender_offer_to_id(e.data.target.id);
		e.game.trigger('diplomatic_surrender_offered', {
			player: e.data.player,
			target: e.data.target,
		});
		return snapshot;
	},

	rollback: (e) => {
		e.game.get('f_diplomacy_restore_pair')(e.data.player, e.data.target, e.applied);
		e.game.trigger('diplomatic_surrender_updated', {
			player: e.data.player,
			target: e.data.target,
		});
	},

};
