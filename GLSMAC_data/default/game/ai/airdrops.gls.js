const rules = #include('../airdrop_rules');

const choose_destination = (game, player, unit, target_tile) => {
	if (
		target_tile == null ||
		#is_defined(rules.get_source_error(game, unit, player.id))
	) {
		return null;
	}
	const tm = game.get_tm();
	const current_distance = tm.get_distance(unit.get_tile(), target_tile);
	const interceptors = rules.get_interceptors(game, player.id);
	let best = null;
	let best_distance = current_distance;
	for (let y = 0; y < tm.get_map_height(); y++) {
		for (let x = 0; x < tm.get_map_width(); x++) {
			if (x % 2 != y % 2) {
				continue;
			}
			const tile = tm.get_tile(x, y);
			if (#is_defined(rules.get_drop_error(
				game,
				unit,
				player.id,
				tile,
				interceptors
			))) {
				continue;
			}
			const distance = tm.get_distance(tile, target_tile);
			if (
				distance < best_distance ||
				(
					distance == best_distance && best != null &&
					(tile.y < best.y || (tile.y == best.y && tile.x < best.x))
				)
			) {
				best = tile;
				best_distance = distance;
			}
		}
	}
	return best;
};

const try_drop = (game, player, unit, target_tile) => {
	const destination = choose_destination(game, player, unit, target_tile);
	if (destination == null) {
		return false;
	}
	game.event_as(player.id, 'airdrop_unit', {
		unit: unit,
		destination: destination,
	});
	return true;
};

return {
	choose_destination: choose_destination,
	try_drop: try_drop,
};
