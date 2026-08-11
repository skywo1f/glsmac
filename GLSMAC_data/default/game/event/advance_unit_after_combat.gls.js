const base_capture = #include('../base_capture');

return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only the game master can advance a unit after combat';
		}

		const unit = e.data.unit;
		const src_tile = unit.get_tile();
		const dst_tile = e.data.tile;

		if (unit.health <= 0.0) {
			return 'Dead unit cannot advance after combat';
		}
		if (src_tile == dst_tile) {
			return 'Unit is already on the post-combat destination tile';
		}
		if (e.data.animations_id <= 0) {
			return 'Post-combat animation sequence ID is invalid';
		}
		if (!src_tile.is_adjactent_to(dst_tile)) {
			return 'Post-combat destination tile is not adjacent';
		}
		if (unit.is_land && dst_tile.is_water) {
			return 'Land unit cannot advance into a water tile';
		}
		if (unit.is_water && dst_tile.is_land && dst_tile.get_base() == null) {
			return 'Water unit cannot advance into a land tile without a base';
		}
		for (other of dst_tile.get_units()) {
			if (other.owner != unit.owner && other.health > 0.0) {
				return 'Post-combat destination still contains a foreign unit';
			}
		}
	},

	apply: (e) => {
		const unit = e.data.unit;
		const base = e.data.tile.get_base();
		const applied = {
			orig_tile: unit.get_tile(),
			base: base,
			orig_base_owner: base == null ? null : base.get_owner(),
			base_capture: null,
			rehomed_units: [],
		};
		e.game.am.stop_animations(e.data.animations_id);
		unit.move_to_tile(e.data.tile, () => {});
		if (
			base != null && applied.orig_base_owner.id != unit.owner &&
			(
				#typeof(unit.get_owner) != 'Callable' ||
				unit.get_owner().type != 'native'
			)
		) {
			applied.base_capture = base_capture.capture_base(e.game, base, unit.get_owner());
			applied.rehomed_units = applied.base_capture.rehomed_units;
		}
		return applied;
	},

	rollback: (e) => {
		const unit = e.data.unit;
		if (unit.get_tile() != e.applied.orig_tile) {
			unit.move_to_tile(e.applied.orig_tile, () => {});
		}
		if (e.applied.base_capture != null) {
			base_capture.restore_base(e.applied.base, e.applied.base_capture);
		}
	},

};
