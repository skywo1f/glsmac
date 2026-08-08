const MIN_BASE_DISTANCE = 3;
const IDEAL_BASE_DISTANCE = 4;

const get_resource_value = (resources) => {
	return resources.NUTRIENTS * 4 + resources.MINERALS * 3 + resources.ENERGY * 2;
};

const get_nearest_base_distance = (tm, tile, bases) => {
	let result = 100000;
	for (base of bases) {
		result = #min(result, tm.get_distance(tile, base.get_tile()));
	}
	return result;
};

const is_valid_site = (tm, tile, owner_id, bases) => {
	if (tile.is_locked() || tile.is_water || tile.get_base() != null) {
		return false;
	}
	if (get_nearest_base_distance(tm, tile, bases) < MIN_BASE_DISTANCE) {
		return false;
	}
	for (unit of tile.get_units()) {
		if (unit.owner != owner_id) {
			return false;
		}
	}
	return true;
};

const get_site_score = (tm, tile, player, bases) => {
	if (!is_valid_site(tm, tile, player.id, bases)) {
		return null;
	}
	const distance = get_nearest_base_distance(tm, tile, bases);
	let score = #min(distance, IDEAL_BASE_DISTANCE) * 100;
	score += get_resource_value(tile.get_resources(player)) * 4;
	for (nearby of tile.get_surrounding_tiles()) {
		score += get_resource_value(nearby.get_resources(player));
	}
	return score;
};

const get_travel_score = (tm, tile, player, bases) => {
	const distance = get_nearest_base_distance(tm, tile, bases);
	return #min(distance, IDEAL_BASE_DISTANCE) * 100 + get_resource_value(tile.get_resources(player));
};

return {
	get_nearest_base_distance: get_nearest_base_distance,
	is_valid_site: is_valid_site,
	get_site_score: get_site_score,
	get_travel_score: get_travel_score,
};
