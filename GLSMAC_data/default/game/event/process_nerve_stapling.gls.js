const TURNS_KEY = 'nerve_stapling_turns';

const snapshot_pop_types = (base) => {
	let result = [];
	for (pop of base.get_pops()) {
		result :+{pop: pop, type: pop.get_type()};
	}
	return result;
};

return {
	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master is allowed to process nerve stapling';
		}
		if (e.game.get('f_nerve_stapling_get_turns')(e.data.base) <= 0) {
			return 'Base has no nerve-stapling duration to process';
		}
	},

	apply: (e) => {
		const base = e.data.base;
		const previous = e.game.get('f_nerve_stapling_get_turns')(base);
		const applied = {
			turns: previous,
			pop_types: snapshot_pop_types(base),
		};
		const updated = previous - 1;
		if (updated > 0) {
			base.set(TURNS_KEY, updated);
		} else {
			base.unset(TURNS_KEY);
		}
		const psych = e.game.get('f_economy_get_base_psych')(e.game, base);
		e.game.get('f_base_process_psych')(e.game, base, psych);
		e.game.trigger('update_base', {base: base});
		return applied;
	},

	rollback: (e) => {
		const base = e.data.base;
		base.set(TURNS_KEY, e.applied.turns);
		for (snapshot of e.applied.pop_types) {
			snapshot.pop.set_type(snapshot.type);
		}
		e.game.trigger('update_base', {base: base});
	},
};
