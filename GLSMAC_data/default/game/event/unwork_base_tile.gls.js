return {

	validate: (e) => {
		if (e.caller != e.data.base.get_owner().id) {
			return 'Only base owner can control base pops';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		const work_pop = e.data.tile.get('working_pop');
		if (!#is_defined(work_pop)) {
			return 'Tile is not being worked';
		}
		if (!e.data.base.is_tile_worked(e.data.tile)) {
			return 'Tile is not worked by this base';
		}
		if (work_pop.get_base() != e.data.base) {
			return 'Tile population does not belong to this base';
		}
	},

	apply: (e) => {
		const pop = e.data.tile.get('working_pop');
		e.game.get('f_base_pop_unwork_tile')(e.data.base, pop, 'DOCTOR');
		return {
			pop: pop,
		};
	},

	rollback: (e) => {
		e.game.get('f_base_pop_work_tile')(e.data.base, e.applied.pop, e.data.tile);
	},

};
