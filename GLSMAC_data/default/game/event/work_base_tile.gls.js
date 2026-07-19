return {

	validate: (e) => {
		if (e.caller != e.data.base.get_owner().id) {
			return 'Only base owner can control base pops';
		}
		if (e.data.pop.get_base() != e.data.base) {
			return 'Population does not belong to this base';
		}
		let is_workable = false;
		for (tile of e.data.base.get_workable_tiles()) {
			if (tile == e.data.tile) {
				is_workable = true;
				break;
			}
		}
		if (!is_workable) {
			return 'Tile is outside this base\'s workable radius';
		}
		if (e.data.tile.has('working_pop')) {
			return 'Tile is already being worked';
		}
	},

	apply: (e) => {
		const old_tile = e.data.pop.get('worked_tile');
		const old_type = e.data.pop.get_type();
		e.game.get('f_base_pop_work_tile')(e.data.base, e.data.pop, e.data.tile);
		return {
			old_tile: old_tile,
			old_type: old_type,
		};
	},

	rollback: (e) => {
		e.game.get('f_base_pop_unwork_tile')(
			e.data.base,
			e.data.pop,
			e.applied.old_type
		);
		if (#is_defined(e.applied.old_tile)) {
			e.game.get('f_base_pop_work_tile')(
				e.data.base,
				e.data.pop,
				e.applied.old_tile
			);
		}
	},

};
