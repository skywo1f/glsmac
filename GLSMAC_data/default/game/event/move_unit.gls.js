const movement_rules = #include('../movement_rules');
const base_capture = #include('../base_capture');

const get_movement_cost = (unit, src_tile, dst_tile) => {
	const is_native = unit.get_def().is_native;

	if (
		dst_tile.is_land &&
		(
			(src_tile.features.river && dst_tile.features.river) ||
			(src_tile.terraforming.road && dst_tile.terraforming.road)
		)
	) {
		return 1.0 / 3.0;
	}

	if (dst_tile.features.xenofungus) {
		if (is_native) {
			if (dst_tile.is_water) {
				return 1.0;
			} else {
				return 1.0 / 3.0;
			}
		}
		return 3.0;
	}
	return 1.0;
};

const get_movement_aftercost = (unit, src_tile, dst_tile) => {
	const is_native = unit.get_def().is_native;
	if (
		dst_tile.is_land &&
		(
			(src_tile.features.river && dst_tile.features.river) ||
			(src_tile.terraforming.road && dst_tile.terraforming.road)
		)
	) {
		return 0.0;
	}
	if (is_native && dst_tile.features.xenofungus) {
		return 0.0;
	}
	const has_forest = #is_defined(dst_tile.terraforming.forest) && dst_tile.terraforming.forest;
	if (dst_tile.is_land && (dst_tile.rockiness >= 3 || has_forest)) {
		return 1.0;
	}
	return 0.0;
};

return {

	validate: (e) => {

		if (e.data.unit.owner != e.caller) {
			return 'Unit can only be moved by it\'s owner';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}

		const src_tile = e.data.unit.get_tile();
		const dst_tile = e.data.tile;

		if (src_tile == dst_tile) {
			return 'Source tile is same as destination tile';
		}

		if (src_tile.is_locked()) {
			return 'Source tile is locked';
		}
		if (dst_tile.is_locked()) {
			return 'Destination tile is locked';
		}

		if (e.data.unit.is_immovable) {
			return 'Unit is immovable';
		}
		if (e.data.unit.terraforming != 'none') {
			return 'Cancel the unit\'s terraforming order before moving';
		}
		if (e.data.unit.movement <= 0.0) {
			return 'Unit is out of moves';
		}
		if (src_tile == dst_tile) {
			return 'Destination tile is same as source tile';
		}
		if (!src_tile.is_adjactent_to(dst_tile)) {
			return 'Destination tile is not adjactent to source tile';
		}
		if (e.data.unit.is_land && dst_tile.is_water) {
			return 'Land units can\'t move to water tile';
		}
		if (e.data.unit.is_water && dst_tile.is_land) {
			return 'Water units can\'t move to land tile';
		}

		let any_foreign_units_in_tile = false;
		for (unit of dst_tile.get_units()) {
			if (unit.owner != e.data.unit.owner) {
				any_foreign_units_in_tile = true;
				break;
			}
		}
		if (any_foreign_units_in_tile) {
			return 'Destination tile contains foreign units (combat not implemented yet)';
		}
		if (movement_rules.is_zoc_move_blocked(e.data.unit, src_tile, dst_tile)) {
			return 'Unit cannot move directly between enemy zones of control';
		}
	},

	resolve: (e) => {

		const movement = e.data.unit.movement;

		const src_tile = e.data.unit.get_tile();
		const dst_tile = e.data.tile;

		let movement_cost = get_movement_cost(e.data.unit, src_tile, dst_tile);

		return {
			is_movement_successful:
				(movement >= movement_cost) // unit has enough moves
				||
				(e.game.random.get_float(0.0, movement_cost) < movement) // unit doesn't have enough moves but was lucky
		};
	},

	apply: (e) => {

		const unit = e.data.unit;
		const src_tile = unit.get_tile();
		const dst_tile = e.data.tile;
		const dst_base = #is_defined(dst_tile.get_base) ? dst_tile.get_base() : null;

		const movement = unit.movement;

		const result = {
			orig: {
				tile: src_tile,
				movement: movement,
				moved_this_turn: unit.moved_this_turn,
				base_owner: dst_base == null ? null : dst_base.get_owner(),
			},
			movement_started: e.resolved.is_movement_successful,
			rehomed_units: [],
		};

		let movement_cost = get_movement_cost(unit, src_tile, dst_tile) + get_movement_aftercost(unit, src_tile, dst_tile);

		const finish_movement = () => {
			// reduce remaining movement points (even if failed)
			if (movement >= movement_cost) {
				unit.movement = movement - movement_cost;
			} else {
				unit.movement = 0.0;
			}
			unit.moved_this_turn = true;
		};

		if (e.resolved.is_movement_successful) {
			unit.move_to_tile(dst_tile, () => {});
			if (dst_base != null && dst_base.get_owner().id != unit.owner) {
				result.rehomed_units = base_capture.rehome_units(
					e.game,
					dst_base,
					result.orig.base_owner.id
				);
				dst_base.set_owner(unit.get_owner());
			}
			finish_movement();
		} else {
			// No native move is started on a failed roll, so update state synchronously.
			if (movement >= movement_cost) {
				unit.movement = movement - movement_cost;
			} else {
				unit.movement = 0.0;
			}
			unit.moved_this_turn = true;
		}

		return result;
	},

	rollback: (e) => {

		const unit = e.data.unit;
		const orig = e.applied.orig;
		if (e.applied.movement_started) {
			unit.move_to_tile(orig.tile, () => {});
		}
		const captured_base = #is_defined(e.data.tile.get_base) ? e.data.tile.get_base() : null;
		if (captured_base != null && orig.base_owner != null && captured_base.get_owner().id != orig.base_owner.id) {
			captured_base.set_owner(orig.base_owner);
		}
		base_capture.restore_units(e.applied.rehomed_units);
		unit.movement = orig.movement;
		unit.moved_this_turn = orig.moved_this_turn;
	},

};
