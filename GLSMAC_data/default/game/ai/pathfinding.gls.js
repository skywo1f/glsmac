const MAX_SEARCHED_TILES = 512;

const get_tile_key = (tile) => {
	return #to_string(tile.x) + '_' + #to_string(tile.y);
};

const find_path_step = (tm, unit, destination, can_enter) => {
	const source = unit.get_tile();
	const source_x = source.x;
	const source_y = source.y;
	let visited = {};
	let queue_x = [source_x];
	let queue_y = [source_y];
	let queue_first_x = [0 - 1];
	let queue_first_y = [0 - 1];
	const source_key = get_tile_key(source);
	visited[source_key] = true;

	let index = 0;
	while (index < #sizeof(queue_x) && index < MAX_SEARCHED_TILES) {
		const current = tm.get_tile(queue_x[index], queue_y[index]);
		const first_x = queue_first_x[index];
		const first_y = queue_first_y[index];
		index++;

		for (candidate of current.get_surrounding_tiles()) {
			const key = get_tile_key(candidate);
			if (#is_defined(visited[key]) || !can_enter(candidate)) {
				continue;
			}
			visited[key] = true;
			const candidate_x = candidate.x;
			const candidate_y = candidate.y;
			const candidate_first_x = first_x < 0 ? candidate_x : first_x;
			const candidate_first_y = first_y < 0 ? candidate_y : first_y;
			if (candidate == destination || candidate.is_adjactent_to(destination)) {
				return tm.get_tile(candidate_first_x, candidate_first_y);
			}
			queue_x :+candidate_x;
			queue_y :+candidate_y;
			queue_first_x :+candidate_first_x;
			queue_first_y :+candidate_first_y;
		}
	}
	return null;
};

return {
	find_path_step: find_path_step,
};
