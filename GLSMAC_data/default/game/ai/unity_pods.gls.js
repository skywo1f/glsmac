const pathfinding = #include('./pathfinding');

const MAX_EXPLORATION_DISTANCE = 24;

const choose_destination = (game, unit, can_enter) => {
	if (unit.is_air || unit.is_immovable || unit.get_def().weapon == 'AlienArtifact') {
		return null;
	}
	const player = game.get_player(unit.owner);
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
		MAX_EXPLORATION_DISTANCE
	);
};

return {
	max_exploration_distance: MAX_EXPLORATION_DISTANCE,
	choose_destination: choose_destination,
};
