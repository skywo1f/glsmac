const visibility_rules = #include('visibility_rules');

const tile_key = (tile) => {
	return #to_string(tile.x) + '_' + #to_string(tile.y);
};

const get_tiles_in_radius = (center, radius) => {
	let tiles = [center];
	let frontier = [center];
	let seen = {};
	const center_key = tile_key(center);
	seen[center_key] = true;
	for (let distance = 0; distance < radius; distance++) {
		let next = [];
		for (tile of frontier) {
			for (candidate of tile.get_surrounding_tiles()) {
				const key = tile_key(candidate);
				if (#is_defined(seen[key])) {
					continue;
				}
				seen[key] = true;
				tiles :+candidate;
				next :+candidate;
			}
		}
		frontier = next;
	}
	return tiles;
};

const get_unexplored_tiles = (player, tiles) => {
	let result = [];
	let seen = {};
	for (tile of tiles) {
		const key = tile_key(tile);
		if (!#is_defined(seen[key]) && !player.has_explored(tile)) {
			seen[key] = true;
			result :+tile;
		}
	}
	return result;
};

const apply_reveal_one = (game, player, tiles) => {
	const revealed = get_unexplored_tiles(player, tiles);
	for (tile of revealed) {
		player.set_explored(tile, true);
	}
	if (#sizeof(revealed) > 0) {
		game.trigger('map_visibility_updated', {player: player, tiles: revealed});
	}
	return {player: player, tiles: revealed};
};

const is_bilateral_pact = (player, other) => {
	return (
		#typeof(player.get_diplomatic_relation) == 'Callable' &&
		#typeof(other.get_diplomatic_relation) == 'Callable' &&
		player.get_diplomatic_relation(other) == 'pact' &&
		other.get_diplomatic_relation(player) == 'pact'
	);
};

const apply_reveal = (game, player, tiles) => {
	const snapshot = apply_reveal_one(game, player, tiles);
	snapshot.shared = [];
	if (#typeof(game.get_players) == 'Callable') {
		for (other of game.get_players()) {
			if (other.id != player.id && is_bilateral_pact(player, other)) {
				const shared = apply_reveal_one(game, other, tiles);
				if (#sizeof(shared.tiles) > 0) {
					snapshot.shared :+shared;
				}
			}
		}
	}
	return snapshot;
};

const rollback_reveal_one = (game, snapshot) => {
	for (let i = #sizeof(snapshot.tiles) - 1; i >= 0; i--) {
		snapshot.player.set_explored(snapshot.tiles[i], false);
	}
	if (#sizeof(snapshot.tiles) > 0) {
		game.trigger('map_visibility_updated', {
			player: snapshot.player,
			tiles: snapshot.tiles,
		});
	}
};

const rollback_reveal = (game, snapshot) => {
	if (#is_defined(snapshot.shared)) {
		for (let i = #sizeof(snapshot.shared) - 1; i >= 0; i--) {
			rollback_reveal_one(game, snapshot.shared[i]);
		}
	}
	rollback_reveal_one(game, snapshot);
};

const count_shareable_tiles = (sender, recipient) => {
	let count = 0;
	for (tile of sender.get_explored_tiles()) {
		if (!recipient.has_explored(tile)) {
			count++;
		}
	}
	return count;
};

const apply_map_share = (game, sender, recipient) => {
	return apply_reveal(game, recipient, sender.get_explored_tiles());
};

const queue_reveal = (game, player, tiles) => {
	if (
		#typeof(game.is_master) != 'Callable' || !game.is_master() ||
		player == null
	) {
		return;
	}
	const unexplored = get_unexplored_tiles(player, tiles);
	if (#sizeof(unexplored) > 0) {
		game.event('reveal_map_tiles', {player: player, tiles: unexplored});
	}
};

const queue_at_tile = (game, player, tile, unit) => {
	if (tile != null) {
		const radius = #is_defined(unit) ? visibility_rules.get_sight_radius(unit) : 1;
		queue_reveal(game, player, get_tiles_in_radius(tile, radius));
	}
};

const queue_at_base = (game, base) => {
	let tiles = [base.get_tile()];
	for (tile of base.get_workable_tiles()) {
		tiles :+tile;
	}
	queue_reveal(game, base.get_owner(), tiles);
};

const queue_sensor_at_tile = (game, tile) => {
	if (
		tile == null || #typeof(tile.terraforming) != 'Object' ||
		!#is_defined(tile.terraforming.sensor) || !tile.terraforming.sensor
	) {
		return;
	}
	const get_owner = game.get('f_territory_get_owner');
	if (!#is_defined(get_owner)) {
		return;
	}
	const owner = get_owner(tile);
	if (owner != null) {
		queue_reveal(game, owner, get_tiles_in_radius(tile, 2));
	}
};

const scan_entities = (game) => {
	if (#typeof(game.is_master) != 'Callable' || !game.is_master()) {
		return;
	}
	if (#typeof(game.get_um) == 'Callable') {
		for (unit of game.get_um().get_units()) {
			queue_at_tile(game, game.get_player(unit.owner), unit.get_tile(), unit);
		}
	}
	if (#typeof(game.get_bm) == 'Callable') {
		for (base of game.get_bm().get_bases()) {
			queue_at_base(game, base);
		}
	}
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_exploration_get_tiles_in_radius', get_tiles_in_radius);
		game.set('f_exploration_get_unexplored_tiles', get_unexplored_tiles);
		game.set('f_exploration_apply_reveal', (player, tiles) => {
			return apply_reveal(game, player, tiles);
		});
		game.set('f_exploration_rollback_reveal', (snapshot) => {
			return rollback_reveal(game, snapshot);
		});
		game.set('f_exploration_count_shareable_tiles', count_shareable_tiles);
		game.set('f_exploration_apply_map_share', (sender, recipient) => {
			return apply_map_share(game, sender, recipient);
		});
		game.set('f_exploration_queue_reveal', (player, tiles) => {
			return queue_reveal(game, player, tiles);
		});
		game.set('f_exploration_queue_at_tile', (player, tile, unit) => {
			return queue_at_tile(game, player, tile, unit);
		});
		game.set('f_exploration_queue_sensor_at_tile', (tile) => {
			return queue_sensor_at_tile(game, tile);
		});
		game.on('terraforming_completed', (event) => {
			if (#is_defined(event.type) && event.type == 'sensor') {
				queue_sensor_at_tile(game, event.tile);
			}
		});
		scan_entities(game);
		game.on('turn', (e) => { scan_entities(game); });
	});
};
