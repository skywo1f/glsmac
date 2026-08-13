const MAX_BASE_DISTANCE = 8;
const COASTAL_CLAIM_DISTANCE = 2;

const tile_key = (tile) => {
	return #to_string(tile.x) + '_' + #to_string(tile.y);
};

const choose_claim = (current, base, distance) => {
	if (
		current == null || distance < current.distance ||
		(distance == current.distance && base.id < current.base.id)
	) {
		return {base: base, distance: distance};
	}
	return current;
};

const get_connected_claim = (tile) => {
	let frontier = [tile];
	let visited = {};
	const start_key = tile_key(tile);
	visited[start_key] = true;
	let distance = 0;
	let result = null;
	while (
		distance <= MAX_BASE_DISTANCE && result == null &&
		#sizeof(frontier) > 0
	) {
		for (current of frontier) {
			const base = current.get_base();
			if (base != null) {
				result = choose_claim(result, base, distance);
			}
		}
		if (result == null && distance < MAX_BASE_DISTANCE) {
			let next = [];
			for (current of frontier) {
				for (nearby of current.get_surrounding_tiles()) {
					const key = tile_key(nearby);
					if (
						nearby.is_water == tile.is_water &&
						!#is_defined(visited[key])
					) {
						visited[key] = true;
						next :+nearby;
					}
				}
			}
			frontier = next;
		}
		distance++;
	}
	return result;
};

const get_coastal_claim = (game, tile) => {
	if (!tile.is_water) {
		return null;
	}
	let result = null;
	for (base of game.get_bm().get_bases()) {
		const base_tile = base.get_tile();
		if (base_tile.is_water) {
			continue;
		}
		const distance = game.get_tm().get_distance(tile, base_tile);
		if (distance > COASTAL_CLAIM_DISTANCE) {
			continue;
		}
		result = choose_claim(result, base, distance);
	}
	return result;
};

const get_claiming_base = (game, tile) => {
	const connected = get_connected_claim(tile);
	const coastal = get_coastal_claim(game, tile);
	if (connected == null) {
		return coastal == null ? null : coastal.base;
	}
	if (coastal == null) {
		return connected.base;
	}
	return choose_claim(connected, coastal.base, coastal.distance).base;
};

const get_manifold_nexus_tile = (game) => {
	if (#typeof(game.get_tm) != 'Callable') {
		return null;
	}
	const tm = game.get_tm();
	let result = null;
	let result_neighbours = 0 - 1;
	for (let y = 0; y < tm.get_map_height(); y++) {
		for (let x = y % 2; x < tm.get_map_width(); x += 2) {
			const tile = tm.get_tile(x, y);
			if (
				tile == null || !#is_defined(tile.landmarks) ||
				!tile.landmarks.manifold_nexus
			) {
				continue;
			}
			let neighbours = 0;
			for (nearby of tile.get_surrounding_tiles()) {
				if (
					#is_defined(nearby.landmarks) &&
					nearby.landmarks.manifold_nexus
				) {
					neighbours++;
				}
			}
			if (result == null || neighbours > result_neighbours) {
				result = tile;
				result_neighbours = neighbours;
			}
		}
	}
	return result;
};

return (game) => {
	game.on('start', (e) => {
		const get_base = (tile) => { return get_claiming_base(game, tile); };
		const get_owner = (tile) => {
			const base = get_base(tile);
			return base == null ? null : base.get_owner();
		};
		game.set('f_territory_get_base', get_base);
		game.set('f_territory_get_owner', get_owner);
		game.set('f_territory_is_friendly', (player, tile) => {
			const owner = get_owner(tile);
			return owner != null && owner.id == player.id;
		});
		const manifold_nexus_tile = get_manifold_nexus_tile(game);
		game.set('f_territory_has_manifold_nexus', (player) => {
			if (
				manifold_nexus_tile == null ||
				#typeof(player.has_explored) != 'Callable' ||
				!player.has_explored(manifold_nexus_tile)
			) {
				return false;
			}
			const owner = get_owner(manifold_nexus_tile);
			return owner != null && owner.id == player.id;
		});
		game.set('f_territory_get_max_distance', () => { return MAX_BASE_DISTANCE; });
	});
};
