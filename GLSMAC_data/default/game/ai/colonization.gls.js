const MIN_BASE_DISTANCE = 3;
const IDEAL_BASE_DISTANCE = 4;
const TRAVEL_DISTANCE_PENALTY = 25;

const get_resource_value = (resources) => {
	return resources.NUTRIENTS * 4 + resources.MINERALS * 3 + resources.ENERGY * 2;
};

const get_tile_resource_value = (tile, player, resource_values) => {
	if (!#is_defined(resource_values)) {
		return get_resource_value(tile.get_resources(player));
	}
	const key = #to_string(tile.x) + '_' + #to_string(tile.y);
	if (!#is_defined(resource_values[key])) {
		resource_values[key] = get_resource_value(tile.get_resources(player));
	}
	return resource_values[key];
};

const get_nearest_base_distance = (tm, tile, bases) => {
	let result = 100000;
	for (base of bases) {
		result = #min(result, tm.get_distance(tile, base.get_tile()));
	}
	return result;
};

const has_friendly_defender = (tile, owner_id) => {
	for (unit of tile.get_units()) {
		if (unit.owner == owner_id && unit.get_def().offense > 0) {
			return true;
		}
	}
	return false;
};

const is_safe_transit_tile = (tile, owner_id) => {
	if (has_friendly_defender(tile, owner_id)) {
		return true;
	}
	for (nearby of tile.get_surrounding_tiles()) {
		const base = nearby.get_base();
		if (base != null && base.get_owner().id != owner_id) {
			return false;
		}
		for (unit of nearby.get_units()) {
			if (
				unit.owner != owner_id &&
				(
					(#is_defined(unit.is_land) && unit.is_land) ||
					(#is_defined(unit.is_air) && unit.is_air)
				)
			) {
				return false;
			}
		}
	}
	return true;
};

const get_site_distance = (tm, tile, owner_id, bases, is_water) => {
	const target_is_water = #is_defined(is_water) ? is_water : false;
	if (
		tile.is_locked() || tile.is_water != target_is_water ||
		tile.get_base() != null
	) {
		return null;
	}
	for (unit of tile.get_units()) {
		if (unit.owner != owner_id) {
			return null;
		}
	}
	const distance = get_nearest_base_distance(tm, tile, bases);
	return distance < MIN_BASE_DISTANCE ? null : distance;
};

const is_valid_site = (tm, tile, owner_id, bases, is_water) => {
	return get_site_distance(tm, tile, owner_id, bases, is_water) != null;
};

const get_site_score = (tm, tile, player, bases, is_water, resource_values) => {
	const distance = get_site_distance(tm, tile, player.id, bases, is_water);
	if (distance == null) {
		return null;
	}
	let score = #min(distance, IDEAL_BASE_DISTANCE) * 100;
	score += get_tile_resource_value(tile, player, resource_values) * 4;
	for (nearby of tile.get_surrounding_tiles()) {
		score += get_tile_resource_value(nearby, player, resource_values);
	}
	return score;
};

const get_destination_score = (
	tm,
	tile,
	player,
	bases,
	travel_distance,
	is_water,
	resource_values
) => {
	const site_score = get_site_score(
		tm,
		tile,
		player,
		bases,
		is_water,
		resource_values
	);
	return site_score == null ? null : site_score - travel_distance * TRAVEL_DISTANCE_PENALTY;
};

return {
	get_nearest_base_distance: get_nearest_base_distance,
	is_safe_transit_tile: is_safe_transit_tile,
	is_valid_site: is_valid_site,
	get_site_score: get_site_score,
	get_destination_score: get_destination_score,
};
