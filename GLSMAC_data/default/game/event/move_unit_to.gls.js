const pathfinding = #include('../ai/pathfinding');
const movement_rules = #include('../movement_rules');
const combat_rules = #include('../combat_rules');
const unit_order_rules = #include('../unit_order_rules');

const get_attack_target = (unit, tile) => {
	let result = null;
	for (other of tile.get_units()) {
		if (
			other.owner != unit.owner && other.health > 0.0 &&
			combat_rules.can_attack_target(unit, other) &&
			(result == null || other.id < result.id)
		) {
			result = other;
		}
	}
	return result;
};

const can_enter = (unit, source, candidate, destination) => {
	if (candidate.is_locked()) {
		return false;
	}
	if (unit.is_land && candidate.is_water) {
		return false;
	}
	if (unit.is_water && candidate.is_land && candidate.get_base() == null) {
		return false;
	}
	let has_foreign_unit = false;
	for (other of candidate.get_units()) {
		if (other.owner != unit.owner) {
			has_foreign_unit = true;
		}
	}
	if (
		has_foreign_unit &&
		(candidate != destination || get_attack_target(unit, candidate) == null)
	) {
		return false;
	}
	return !movement_rules.is_zoc_move_blocked(unit, source, candidate);
};

return {
	unit_visibility: 'private',

	validate: (e) => {
		const order_error = unit_order_rules.get_unavailable_reason(e.data.unit);
		if (order_error != null) {
			return order_error;
		}
		if (e.data.unit.owner != e.caller) {
			return 'Unit can only be ordered by its owner';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (e.data.unit.health <= 0.0) {
			return 'Dead unit cannot receive a go-to order';
		}
		if (e.data.unit.is_immovable) {
			return 'Immobile unit cannot receive a go-to order';
		}
		if (e.data.unit.terraforming != 'none') {
			return 'Cancel the unit\'s terraforming order before moving';
		}
		if (e.data.unit.movement <= 0.0) {
			return 'Unit is out of moves';
		}
	},

	apply: (e) => {
		if (!e.game.is_master()) {
			return;
		}
		const unit = e.data.unit;
		const destination = e.data.tile;
		const previous_target = movement_rules.get_move_target_snapshot(unit);
		if (#typeof(unit.set_move_target) == 'Callable') {
			unit.set_move_target(destination);
		}
		if (unit.get_tile() == destination) {
			movement_rules.clear_move_target(unit);
			return {
				steps: 0,
				attacked: false,
				previous_target: previous_target,
			};
		}
		const step = pathfinding.find_path_step_exact(
			e.game.get_tm(),
			unit,
			destination,
			(path_source, candidate) => {
				return can_enter(unit, path_source, candidate, destination);
			}
		);
		if (step == null) {
			movement_rules.clear_move_target(unit);
			return {
				steps: 0,
				attacked: false,
				previous_target: previous_target,
			};
		}
		const attack_target = step == destination
			? get_attack_target(unit, destination)
			: null;
		if (attack_target != null) {
			movement_rules.clear_move_target(unit);
			e.game.event_for(e.caller, 'attack_unit', {
				attacker: unit,
				defender: attack_target,
			});
			return {
				steps: 0,
				attacked: true,
				previous_target: previous_target,
			};
		}
		e.game.event_for(e.caller, 'move_unit', {
			unit: unit,
			tile: step,
			preserve_move_target: true,
		});
		return {
			steps: 1,
			attacked: false,
			previous_target: previous_target,
		};
	},

	rollback: (e) => {
		// Child move events own their rollback state.
		movement_rules.restore_move_target(
			e.data.unit,
			e.game.get_tm(),
			e.applied.previous_target
		);
	},
};
