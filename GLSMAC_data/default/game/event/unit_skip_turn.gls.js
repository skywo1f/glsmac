const movement_rules = #include('../movement_rules');

return {
	unit_visibility: 'private',

	validate: (e) => {
		const unit = e.data.unit;
		if (unit.owner != e.caller) {
			return 'Unit can only be moved by it\'s owner';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (unit.health <= 0.0) {
			return 'Dead unit cannot skip its turn';
		}
		if (unit.get_tile().is_locked()) {
			return 'Unit tile is locked';
		}
		if (unit.terraforming != 'none') {
			return 'Cancel the unit\'s terraforming order before skipping';
		}
		if (unit.movement <= 0.0) {
			return 'Unit is out of moves';
		}
	},

	apply: (e) => {
		const unit = e.data.unit;

		const result = {
			original_movement: unit.movement + 0.0,
			move_target: movement_rules.get_move_target_snapshot(unit),
		};

		movement_rules.clear_move_target(unit);
		unit.movement = 0.0;

		return result;
	},

	rollback: (e) => {
		const unit = e.data.unit;
		unit.movement = e.applied.original_movement;
		movement_rules.restore_move_target(unit, e.game, e.applied.move_target);
	},

};
