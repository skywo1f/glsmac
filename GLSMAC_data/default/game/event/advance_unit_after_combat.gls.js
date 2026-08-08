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
		if (unit.is_water && dst_tile.is_land) {
			return 'Water unit cannot advance into a land tile';
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
			rehomed_units: [],
		};
		e.game.am.stop_animations(e.data.animations_id);
		unit.move_to_tile(e.data.tile, () => {});
		if (base != null && applied.orig_base_owner.id != unit.owner) {
			applied.rehomed_units = base_capture.rehome_units(
				e.game,
				base,
				applied.orig_base_owner.id
			);
			base.set_owner(unit.get_owner());
		}
		return applied;
	},

	rollback: (e) => {
		const unit = e.data.unit;
		if (unit.get_tile() != e.applied.orig_tile) {
			unit.move_to_tile(e.applied.orig_tile, () => {});
		}
		if (
			e.applied.base != null &&
			e.applied.base.get_owner().id != e.applied.orig_base_owner.id
		) {
			e.applied.base.set_owner(e.applied.orig_base_owner);
		}
		base_capture.restore_units(e.applied.rehomed_units);
	},

};
