const pathfinding = #include('../ai/pathfinding');
const movement_rules = #include('../movement_rules');

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
	for (other of candidate.get_units()) {
		if (other.owner != unit.owner) {
			return false;
		}
	}
	return !movement_rules.is_zoc_move_blocked(unit, source, candidate);
};

return {
	unit_visibility: 'private',

	validate: (e) => {
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
		let steps = 0;
		while (
			unit.get_tile() != destination && unit.movement > 0.0 &&
			steps < 128
		) {
			const source = unit.get_tile();
			const step = pathfinding.find_path_step_exact(
				e.game.get_tm(),
				unit,
				destination,
				(path_source, candidate) => {
					return can_enter(unit, path_source, candidate, destination);
				}
			);
			if (step == null) {
				break;
			}
			e.game.event_as(e.caller, 'move_unit', {unit: unit, tile: step});
			steps++;
			if (unit.get_tile() == source) {
				break;
			}
		}
		return {steps: steps};
	},

	rollback: (e) => {
		// Child move events own their rollback state.
	},
};
