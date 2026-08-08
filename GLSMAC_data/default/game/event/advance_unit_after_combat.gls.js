const get_rehome_base = (game, unit, owner_id, lost_base) => {
	let best = null;
	let best_distance = 0;
	for (candidate of game.bm.get_bases()) {
		if (candidate.id == lost_base.id || candidate.get_owner().id != owner_id) {
			continue;
		}
		const distance = game.tm.get_distance(unit.get_tile(), candidate.get_tile());
		if (
			best == null ||
			distance < best_distance ||
			(distance == best_distance && candidate.id < best.id)
		) {
			best = candidate;
			best_distance = distance;
		}
	}
	return best;
};

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
			for (supported_unit of e.game.um.get_units()) {
				if (
					supported_unit.owner != applied.orig_base_owner.id ||
					supported_unit.home_base_id != base.id
				) {
					continue;
				}
				applied.rehomed_units :+{
					unit: supported_unit,
					home_base_id: supported_unit.home_base_id,
				};
				const destination = get_rehome_base(
					e.game,
					supported_unit,
					applied.orig_base_owner.id,
					base
				);
				supported_unit.set_home_base_id(destination == null ? 0 : destination.id);
			}
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
		for (snapshot of e.applied.rehomed_units) {
			snapshot.unit.set_home_base_id(snapshot.home_base_id);
		}
	},

};
