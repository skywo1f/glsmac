return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master is allowed to refresh base psych';
		}
		if (#typeof(e.data.psych) != 'Int' || e.data.psych < 0) {
			return 'Base psych must be a non-negative whole number';
		}
	},

	apply: (e) => {
		const base = e.data.base;
		if (base.get_owner().type == 'ai') {
			const stable_workers = e.game.get('f_base_get_stable_worker_count')(base, e.data.psych);
			e.game.get('f_base_rebalance_workers')(base, stable_workers);
		}
		e.game.get('f_base_process_psych')(e.game, base, e.data.psych);
	},

	rollback: (e) => {
		// Host-authored base turn events are never applied speculatively.
	},

};
