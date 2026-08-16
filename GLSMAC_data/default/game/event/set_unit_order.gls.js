const movement_rules = #include('../movement_rules');

const get_unit = (e) => {
	if (#is_defined(e.data.unit) && e.data.unit != null) {
		return e.data.unit;
	}
	if (
		#is_defined(e.resolved) && #is_defined(e.resolved.unit) &&
		e.resolved.unit != null
	) {
		return e.resolved.unit;
	}
	if (
		#is_defined(e.data.unit_id) && #typeof(e.data.unit_id) == 'Int' &&
		e.game.get_um().has_unit(e.data.unit_id)
	) {
		return e.game.get_um().get_unit(e.data.unit_id);
	}
	return null;
};

return {
	unit_visibility: 'private',

	validate: (e) => {
		const unit = get_unit(e);
		if (unit == null) {
			return 'Unit no longer exists';
		}
		if (#typeof(e.data.order) != 'String') {
			return 'Unit order must be identified by name';
		}
		if (e.data.order != 'none' && e.data.order != 'hold') {
			return 'Unknown unit order';
		}
		if (unit.owner != e.caller) {
			return 'Unit can only be ordered by its owner';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (unit.health <= 0.0) {
			return 'Dead unit cannot receive orders';
		}
		if (unit.transport_id != 0) {
			return 'Embarked unit cannot receive independent orders';
		}
		if (unit.terraforming != 'none') {
			return 'Cancel the unit\'s terraforming order first';
		}
		if (unit.convoy_resource != 'none') {
			return 'Cancel the unit\'s convoy order first';
		}
		if (e.data.order == 'hold' && unit.movement <= 0.0) {
			return 'Unit is out of moves';
		}
	},

	resolve: (e) => {
		return {
			order: '' + e.data.order,
			unit: get_unit(e),
		};
	},

	apply: (e) => {
		const unit = get_unit(e);
		if (unit == null) {
			throw Error('Unit disappeared while applying its order');
		}
		const previous = {
			order: '' + unit.order,
			move_target: movement_rules.get_move_target_snapshot(unit),
		};
		if (e.resolved.order != 'none') {
			movement_rules.clear_move_target(unit);
		}
		unit.set_order(e.resolved.order);
		return previous;
	},

	rollback: (e) => {
		const unit = get_unit(e);
		if (unit == null) {
			return;
		}
		unit.set_order(e.applied.order);
		movement_rules.restore_move_target(unit, e.game, e.applied.move_target);
	},
};
