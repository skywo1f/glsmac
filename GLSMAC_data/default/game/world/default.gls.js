/*
	normal game start
 */

const faction_rules = #include('../faction_rules');

return (game) => {

	// variables
	const players = game.get_players();
	const players_count = #sizeof(players);
	const tm = game.get_tm();
	const map_width = tm.get_map_width();
	const map_height = tm.get_map_height();
	const optimal_base_distance = #max((map_width + map_height) / 2 / players_count, 2);
	let tiles_with_bases = [];
	let land_tiles = [];
	let water_tiles = [];
	for (let y = 0; y < map_height; y++) {
		for (let x = y % 2; x < map_width; x += 2) {
			const tile = tm.get_tile(x, y);
			if (tile.is_water) {
				water_tiles :+tile;
			} else {
				land_tiles :+tile;
			}
		}
	}

	// functions
	const get_good_starting_base_location = (is_naval_faction) => {
		const domain_tiles = is_naval_faction ? water_tiles : land_tiles;
		let selected_tile = null;
		for (let min_distance = optimal_base_distance; min_distance >= 1; min_distance--) {
			let candidates = [];
			for (tile of domain_tiles) {
				let is_ok = true;
				for (other of tiles_with_bases) {
					const is_occupied = tile.x == other.x && tile.y == other.y;
					if (is_occupied || tm.get_distance(tile, other) < min_distance) {
						is_ok = false;
						break;
					}
				}
				if (is_ok) {
					candidates :+tile;
				}
			}
			if (#sizeof(candidates) > 0) {
				const candidate_index = game.random.get_int(0, #sizeof(candidates) - 1);
				selected_tile = candidates[candidate_index];
				break;
			}
		}
		if (selected_tile != null) {
			return selected_tile;
		}
		throw Error(
			'Failed to find an unoccupied ' + (is_naval_faction ? 'water' : 'land') +
			' tile for a starting base (domain tiles: ' + #to_string(#sizeof(domain_tiles)) +
			', bases already placed: ' + #to_string(#sizeof(tiles_with_bases)) +
			', desired distance: ' + #to_string(optimal_base_distance) + ')'
		);
	};

	// initialize each player in game
	for (player of players) {

		const faction = player.get_faction();

		const is_native = #is_defined(faction.is_native) && faction.is_native;
		if (!is_native) {
			game.event('process_player_economy', {
				player: player,
				energy_credits: faction_rules.get_starting_energy(player),
			});
		}

		const tile = get_good_starting_base_location(faction.is_naval);

		// spawn headquarters base
		game.event('spawn_base', {
			owner: player,
			tile: tile,
			headquarters: true,
			initial_population: true,
		});
		tiles_with_bases :+tile;

		// Spartans replace the standard patrol with their original fast scout rover.
		game.event('spawn_unit', {
			owner: player,
			tile: tile,
			type: faction_rules.get_starting_unit(player),
			health: 1.0,
			morale: 1,
			home_base_at_tile: true,
		});

	}

};
