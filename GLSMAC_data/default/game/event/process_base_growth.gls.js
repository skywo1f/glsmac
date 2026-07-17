return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master is allowed to process base growth';
		}
	},

	apply: (e) => {
		e.game.get('f_base_process_growth')(e.game, e.data.base);
	},

	rollback: (e) => {
		// Base growth events are host-authored and never applied speculatively.
	},

};
