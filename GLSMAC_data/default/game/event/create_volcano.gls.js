const tile_key = (tile) => {
	return #to_string(tile.x) + ':' + #to_string(tile.y);
};

const get_tiles_in_radius = (center, radius) => {
	let result = [center];
	let frontier = [center];
	let seen = {};
	const center_key = tile_key(center);
	seen[center_key] = true;
	for (let distance = 0; distance < radius; distance++) {
		let next = [];
		for (tile of frontier) {
			for (nearby of tile.get_surrounding_tiles()) {
				const key = tile_key(nearby);
				if (!#is_defined(seen[key])) {
					seen[key] = true;
					result :+nearby;
					next :+nearby;
				}
			}
		}
		frontier = next;
	}
	return result;
};

const has_landmark = (tile) => {
	for (id in tile.landmarks) {
		if (tile.landmarks[id]) {
			return true;
		}
	}
	return false;
};

return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only the host can create a volcano';
		}
		const center = e.data.tile;
		if (#typeof(center) != 'Object' || !center.is_water) {
			return 'A new volcano must erupt at sea';
		}
		for (tile of get_tiles_in_radius(center, 3)) {
			if (tile.is_locked()) {
				return 'New volcano area contains locked terrain';
			}
			if (tile.get_base() != null || #sizeof(tile.get_units(true)) > 0) {
				return 'New volcano area must not contain bases or units';
			}
		}
		for (tile of get_tiles_in_radius(center, 1)) {
			if (has_landmark(tile)) {
				return 'New volcano area must not overlap a named landmark';
			}
		}
	},

	resolve: (e) => { return {}; },

	apply: (e) => {
		const terrain_snapshot = e.game.tm.apply_volcano(e.data.tile);
		e.game.message('Seismic activity has raised a new volcano from the sea.');
		e.game.trigger('volcano_created', {tile: e.data.tile});
		return {terrain_snapshot: terrain_snapshot};
	},

	rollback: (e) => {
		e.game.tm.restore_terrain(e.applied.terrain_snapshot);
	},

};
