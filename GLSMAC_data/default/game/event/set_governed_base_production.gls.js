const governor_rules = #include('../base_governor_rules');

const get_queue_specs = (base) => {
	let result = [];
	for (production of base.get_production_queue()) {
		result :+{
			kind: production.production_kind,
			id: production.id,
		};
	}
	return result;
};

return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master can apply governed base production';
		}
		const owner = e.data.base.get_owner();
		if (!governor_rules.is_enabled(e.data.base)) {
			return 'Base governor is not enabled';
		}
		if (e.game.is_turn_complete(owner.id)) {
			return 'Base owner has already completed this turn';
		}
		if (#typeof(e.data.kind) != 'String' || #typeof(e.data.id) != 'String') {
			return 'Production kind and item ID must be strings';
		}
		if (!e.data.base.can_set_production(e.data.kind, e.data.id)) {
			return 'Item cannot be produced at this base';
		}
	},

	apply: (e) => {
		const old_queue = get_queue_specs(e.data.base);
		e.data.base.set_production(e.data.kind, e.data.id);
		e.game.trigger('base_governor_production_selected', {
			base: e.data.base,
			kind: e.data.kind,
			id: e.data.id,
		});
		return {old_queue: old_queue};
	},

	rollback: (e) => {
		e.data.base.set_production_queue(e.applied.old_queue);
	},

};
