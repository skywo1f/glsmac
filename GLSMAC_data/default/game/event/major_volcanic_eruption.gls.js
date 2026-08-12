const entity_snapshots = #include('../entity_snapshots');
const ERUPTION_RADIUS = 4;
const ELIGIBILITY_DISTANCE = 5;
const MINIMUM_YEAR = 2175;
const MINIMUM_BASES = 8;
const DUST_CLOUD_YEARS = 10;

const get_tiles_with_distance = (tm, center, radius) => {
	let result = [];
	for (tile of get_all_tiles(tm)) {
		const tile_distance = tm.get_distance(center, tile);
		if (tile_distance <= radius) {
			result :+{tile: tile, distance: tile_distance};
		}
	}
	return result;
};

const get_all_tiles = (tm) => {
	let result = [];
	for (let y = 0; y < tm.get_map_height(); y++) {
		for (let x = y % 2; x < tm.get_map_width(); x += 2) {
			result :+tm.get_tile(x, y);
		}
	}
	return result;
};

const find_mount_planet_center = (tm) => {
	let result = null;
	for (tile of get_all_tiles(tm)) {
		if (
			#is_defined(tile.landmarks) && tile.landmarks.mount_planet &&
			(
				result == null || tile.elevation > result.elevation ||
				(tile.elevation == result.elevation && tile.y < result.y) ||
				(tile.elevation == result.elevation && tile.y == result.y && tile.x < result.x)
			)
		) {
			result = tile;
		}
	}
	return result;
};

const get_owner_base_count = (game, owner_id) => {
	let result = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == owner_id) {
			result++;
		}
	}
	return result;
};

const is_active_base = (game, target_id) => {
	for (base of game.get_bm().get_bases()) {
		if (base.id == target_id) {
			return true;
		}
	}
	return false;
};

const find_base = (game, base_id) => {
	for (base of game.get_bm().get_bases()) {
		if (base.id == base_id) {
			return base;
		}
	}
	return null;
};

const get_target_size = (size, distance) => {
	if (distance <= 1) {
		return 0;
	}
	if (distance == 2) {
		return #ceil(#to_float(size) / 4.0);
	}
	if (distance == 3) {
		return #ceil(#to_float(size) / 2.0);
	}
	return #floor(#to_float(3 * (size + 1)) / 4.0);
};

return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only the host can resolve a major volcanic eruption';
		}
		if (
			#typeof(e.data.base) != 'Object' ||
			!is_active_base(e.game, e.data.base.id)
		) {
			return 'Major volcanic eruption requires an active base';
		}
		if (e.game.get_year() < MINIMUM_YEAR) {
			return 'Major volcanic eruptions cannot occur before Mission Year 2175';
		}
		const base = e.data.base;
		const owner = base.get_owner();
		if (base.get_size() <= 3 || get_owner_base_count(e.game, owner.id) < MINIMUM_BASES) {
			return 'Selected faction or base is not eligible for a major volcanic eruption';
		}
		const mount_planet = find_mount_planet_center(e.game.get_tm());
		if (
			mount_planet == null ||
			e.game.get_tm().get_distance(base.get_tile(), mount_planet) > ELIGIBILITY_DISTANCE ||
			!owner.has_explored(mount_planet)
		) {
			return 'Selected faction has not discovered nearby Mount Planet';
		}
		for (info of get_tiles_with_distance(
			e.game.get_tm(),
			base.get_tile(),
			ERUPTION_RADIUS
		)) {
			if (info.tile.is_locked()) {
				return 'Major volcanic eruption area contains locked tiles';
			}
		}
	},

	resolve: (e) => {
		return {};
	},

	apply: (e) => {
		const center = e.data.base.get_tile();
		const selected_base_id = e.data.base.id;
		const selected_base_name = '' + e.data.base.name;
		const affected = get_tiles_with_distance(
			e.game.get_tm(),
			center,
			ERUPTION_RADIUS
		);
		const previous_dust = e.game.get_tm().get_climate_state().dust_cloud_duration;
		let applied = {
			terrain_snapshot: e.game.get_tm().apply_major_eruption(center),
			bases: [],
			killed_units: [],
			damaged_units: [],
			rehomed_units: [],
			previous_dust: #is_defined(previous_dust) ? previous_dust : 0,
		};
		let seen_units = {};
		for (info of affected) {
			for (unit of info.tile.get_units(true)) {
				const key = 'u' + #to_string(unit.id);
				if (#is_defined(seen_units[key])) {
					continue;
				}
				seen_units[key] = true;
				if (
					#is_defined(info.tile.landmarks) &&
					info.tile.landmarks.mount_planet
				) {
					applied.killed_units :+entity_snapshots.snapshot_unit(unit);
				} else {
					applied.damaged_units :+{id: unit.id, health: unit.health + 0.0};
					unit.health = unit.health / 2.0;
				}
			}
		}
		entity_snapshots.despawn_unit_snapshots(e.game, applied.killed_units);

		let destroyed_bases = [];
		let destroyed_entities = [];
		for (info of affected) {
			const base = info.tile.get_base();
			if (base == null) {
				continue;
			}
			const old_size = base.get_size();
			const target_size = get_target_size(old_size, info.distance);
			const base_result = {
				id: base.id,
				name: base.name,
				owner_id: base.get_owner().id,
				snapshot: e.game.get_bm().snapshot_base(base),
				casualties: old_size - target_size,
				destroyed: target_size == 0,
			};
			applied.bases :+base_result;
			while (base.get_size() > target_size) {
				const pops = base.get_pops();
				base.destroy_pop(pops[#sizeof(pops) - 1]);
			}
			if (base_result.destroyed) {
				destroyed_bases :+base_result;
				destroyed_entities :+base;
			}
		}
		applied.rehomed_units = entity_snapshots.rehome_surviving_units(
			e.game,
			destroyed_bases,
			0
		);
		for (destroyed_entity of destroyed_entities) {
			e.game.get_bm().despawn_base(destroyed_entity);
		}

		e.game.get_tm().set_dust_cloud_duration(DUST_CLOUD_YEARS);
		e.game.message(
			'Mount Planet has erupted, devastating ' + selected_base_name +
			' and surrounding territory.'
		);
		e.game.message(
			'A global dust cloud will reduce energy production for 10 years.'
		);
		e.game.trigger('major_volcanic_eruption', {
			base_id: selected_base_id,
			tile: center,
			duration: DUST_CLOUD_YEARS,
		});
		return applied;
	},

	rollback: (e) => {
		e.game.get_tm().restore_terrain(e.applied.terrain_snapshot);
		for (snapshot of e.applied.bases) {
			const active = find_base(e.game, snapshot.id);
			if (active != null) {
				e.game.get_bm().despawn_base(active);
			}
			e.game.get_bm().restore_base(snapshot.snapshot);
		}
		entity_snapshots.spawn_unit_snapshots(e.game, e.applied.killed_units);
		for (snapshot of e.applied.damaged_units) {
			if (e.game.get_um().has_unit(snapshot.id)) {
				const unit = e.game.get_um().get_unit(snapshot.id);
				unit.health = snapshot.health;
			}
		}
		entity_snapshots.restore_rehomed_units(e.game, e.applied.rehomed_units);
		e.game.get_tm().set_dust_cloud_duration(e.applied.previous_dust);
	},

};
