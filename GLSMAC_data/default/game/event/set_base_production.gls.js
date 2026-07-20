return {

	validate: (e) => {
		if (e.caller != e.data.base.get_owner().id) {
			return 'Only base owner can change production';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (!e.data.base.can_produce(e.data.type)) {
			return 'Unit cannot be produced at this base';
		}
	},

	apply: (e) => {
		const old_production = e.data.base.get_production();
		e.data.base.set_production(e.data.type);
		return {
			old_production: old_production,
		};
	},

	rollback: (e) => {
		if (#is_defined(e.applied.old_production)) {
			e.data.base.set_production(e.applied.old_production.id);
		} else {
			e.data.base.clear_production();
		}
	},

};
