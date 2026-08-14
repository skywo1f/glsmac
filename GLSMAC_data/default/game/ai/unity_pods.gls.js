const pathfinding = #include('./pathfinding');

const MAX_EXPLORATION_DISTANCE = 24;

const get_known_pods = (player) => {
	if (#typeof(player.get_explored_tiles) != 'Callable') {
		return null;
	}
	let result = [];
	for (tile of player.get_explored_tiles()) {
		if (tile.features.unity_pod) {
			result :+tile;
		}
	}
	return result;
};

const choose_destination = (game, unit, can_enter, known_pods) => {
	if (unit.is_air || unit.is_immovable || unit.get_def().weapon == 'AlienArtifact') {
		return null;
	}
	const player = game.get_player(unit.owner);
	const pods = #is_defined(known_pods) ? known_pods : get_known_pods(player);
	let expected_target_count = #undefined;
	if (pods != null) {
		expected_target_count = 0;
		for (tile of pods) {
			if (
				(#is_defined(unit.is_land) && unit.is_land && tile.is_water) ||
				(
					#is_defined(unit.is_water) && unit.is_water && tile.is_land &&
					tile.get_base() == null
				)
			) {
				continue;
			}
			expected_target_count++;
		}
		if (expected_target_count == 0) {
			return null;
		}
	}
	return pathfinding.find_best_reachable(
		game.get_tm(),
		unit,
		(source, candidate) => {
			return player.has_explored(candidate) && can_enter(source, candidate);
		},
		(candidate, distance) => {
			if (!player.has_explored(candidate) || !candidate.features.unity_pod) {
				return null;
			}
			return 100000 - distance * 100;
		},
		MAX_EXPLORATION_DISTANCE,
		expected_target_count,
		true
	);
};

return {
	max_exploration_distance: MAX_EXPLORATION_DISTANCE,
	get_known_pods: get_known_pods,
	choose_destination: choose_destination,
};
