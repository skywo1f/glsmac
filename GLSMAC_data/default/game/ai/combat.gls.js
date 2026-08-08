const RETREAT_HEALTH = 0.5;
const RECOVERED_HEALTH = 0.8;
const THREAT_DISTANCE = 2;
const MAX_GARRISON = 3;

const find_nearest_friendly_base = (tm, player_id, tile, bases) => {
	let nearest = null;
	let nearest_distance = 100000;
	for (base of bases) {
		if (base.get_owner().id != player_id) {
			continue;
		}
		const base_tile = base.get_tile();
		const distance = tm.get_distance(tile, base_tile);
		if (
			nearest == null ||
			distance < nearest_distance ||
			(
				distance == nearest_distance &&
				(
					base_tile.y < nearest.get_tile().y ||
					(base_tile.y == nearest.get_tile().y && base_tile.x < nearest.get_tile().x)
				)
			)
		) {
			nearest = base;
			nearest_distance = distance;
		}
	}
	return nearest;
};

const get_repair_destination = (tm, unit, player_id, bases) => {
	const tile = unit.get_tile();
	const current_base = tile.get_base();
	if (current_base != null && current_base.get_owner().id == player_id) {
		return unit.health < RECOVERED_HEALTH ? current_base : null;
	}
	if (unit.health >= RETREAT_HEALTH) {
		return null;
	}
	return find_nearest_friendly_base(tm, player_id, tile, bases);
};

const get_required_garrison = (tm, base, player_id, units) => {
	let result = 1;
	for (unit of units) {
		if (
			unit.owner != player_id &&
			unit.get_def().offense > 0 &&
			tm.get_distance(base.get_tile(), unit.get_tile()) <= THREAT_DISTANCE
		) {
			result++;
			if (result >= MAX_GARRISON) {
				break;
			}
		}
	}
	return result;
};

return {
	find_nearest_friendly_base: find_nearest_friendly_base,
	get_repair_destination: get_repair_destination,
	get_required_garrison: get_required_garrison,
};
