const rules = #include('../base_governor_rules');

const snapshot = (base, key) => {
	return {
		present: base.has(key),
		value: base.has(key) ? base.get(key) : #undefined,
	};
};

const restore = (base, key, state) => {
	if (state.present) {
		base.set(key, state.value);
	} else {
		base.unset(key);
	}
};

return {

	validate: (e) => {
		if (e.caller != e.data.base.get_owner().id) {
			return 'Only base owner can configure its governor';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (#typeof(e.data.enabled) != 'Bool') {
			return 'Governor state must be a boolean';
		}
		if (#typeof(e.data.priority) != 'String' || !rules.is_priority(e.data.priority)) {
			return 'Governor priority is invalid';
		}
	},

	apply: (e) => {
		const base = e.data.base;
		const old_state = {
			enabled: snapshot(base, rules.enabled_key),
			priority: snapshot(base, rules.priority_key),
		};
		base.set(rules.enabled_key, e.data.enabled);
		base.set(rules.priority_key, e.data.priority);
		e.game.trigger('update_base', {base: base});
		e.game.trigger('base_governor_changed', {
			base: base,
			enabled: e.data.enabled,
			priority: e.data.priority,
		});
		return old_state;
	},

	rollback: (e) => {
		const base = e.data.base;
		restore(base, rules.enabled_key, e.applied.enabled);
		restore(base, rules.priority_key, e.applied.priority);
		e.game.trigger('update_base', {base: base});
	},

};
