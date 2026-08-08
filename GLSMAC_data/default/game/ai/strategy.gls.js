const TILES_PER_BASE = 24;
const TURNS_PER_EXPANSION = 6;

const get_desired_base_count = (turn, map_width, map_height, player_count) => {
	const competitors = #max(player_count, 1);
	const map_capacity = #max(
		1,
		#floor(
			#to_float(map_width * map_height) /
			#to_float(competitors * TILES_PER_BASE)
		)
	);
	const expansion_tempo = 1 + #floor(
		#to_float(#max(turn - 1, 0)) /
		#to_float(TURNS_PER_EXPANSION)
	);
	return #min(map_capacity, expansion_tempo);
};

return {
	get_desired_base_count: get_desired_base_count,
};
