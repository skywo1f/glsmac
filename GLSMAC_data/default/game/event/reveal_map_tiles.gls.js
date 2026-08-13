return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only the game master can reveal map tiles';
		}
		if (
			#typeof(e.data.player) != 'Object' ||
			#typeof(e.data.player.has_explored) != 'Callable' ||
			#typeof(e.data.player.set_explored) != 'Callable' ||
			#typeof(e.data.tiles) != 'Array' ||
			#sizeof(e.data.tiles) == 0 || #sizeof(e.data.tiles) > 16200
		) {
			return 'Map reveal data is invalid';
		}
		let seen = {};
		for (tile of e.data.tiles) {
			if (
				#typeof(tile) != 'Object' ||
				#typeof(tile.x) != 'Int' || #typeof(tile.y) != 'Int'
			) {
				return 'Map reveal contains an invalid tile';
			}
			const key = #to_string(tile.x) + '_' + #to_string(tile.y);
			if (#is_defined(seen[key])) {
				return 'Map reveal contains a duplicate tile';
			}
			seen[key] = true;
		}
	},

	apply: (e) => {
		return e.game.get('f_exploration_apply_reveal')(e.data.player, e.data.tiles);
	},

	rollback: (e) => {
		e.game.get('f_exploration_rollback_reveal')(e.applied);
	},

};
