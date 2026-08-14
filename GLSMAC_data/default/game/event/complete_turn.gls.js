const turn_rules = #include('../turn_rules');

return {

	validate: (e) => {
		if (
			#is_defined(e.data.turn_id) &&
			(#typeof(e.data.turn_id) != 'Int' || e.data.turn_id != e.game.get_turn())
		) {
			return 'Turn completion request is stale';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return;
		}
		if (turn_rules.has_pending_owned_animation(e.game, e.caller)) {
			return 'Player has a unit animation still in progress';
		}
	},

	apply: (e) => {
		if (e.game.is_turn_complete(e.caller)) {
			return {changed: false};
		}
		e.game.complete_turn(e.caller);
		if (e.game.is_master()) {
			let everybody_completed_turn = true;
			if (#typeof(e.game.get_native_player) == 'Callable') {
				const native = e.game.get_native_player();
				if (native != null && !e.game.is_turn_complete(native.id)) {
					everybody_completed_turn = false;
				}
			}
			for (player of e.game.get_players()) {
				if (!e.game.is_turn_complete(player.id)) {
					everybody_completed_turn = false;
					break;
				}
			}
			if (everybody_completed_turn) {
				e.game.event('advance_turn', {
					turn_id: e.game.get_turn() + 1
				});
			}
		}
		return {changed: true};
	},

	rollback: (e) => {
		if (e.applied.changed) {
			e.game.uncomplete_turn(e.caller);
		}
	},

};
