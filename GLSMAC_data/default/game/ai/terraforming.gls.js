const WORKED_TILE_BONUS = 2000;

const get_order = (tile, prioritize_nutrients) => {
	if (
		tile.get_base() != null ||
		tile.is_water ||
		tile.features.monolith ||
		tile.features.xenofungus
	) {
		return null;
	}
	if (!tile.terraforming.forest && !tile.terraforming.farm) {
		if (prioritize_nutrients && tile.moisture > 0 && tile.rockiness < 3) {
			return 'farm';
		}
		return tile.moisture <= 1 || tile.rockiness >= 2 ? 'forest' : 'farm';
	}
	if (!tile.terraforming.road) {
		return 'road';
	}
	if (tile.terraforming.farm && !tile.terraforming.mine && !tile.terraforming.solar) {
		return 'solar';
	}
	return null;
};

const get_target_score = (tile, player, pending_growth, distance, is_worked) => {
	const resources = tile.get_resources(player);
	let score = resources.NUTRIENTS * 30 + resources.MINERALS * 20 + resources.ENERGY * 10;
	if (pending_growth <= 0) {
		score += 10000 + resources.NUTRIENTS * 100;
	}
	if (#is_defined(is_worked) && is_worked) {
		score += WORKED_TILE_BONUS;
	}
	return score - distance * 100;
};

return {
	get_order: get_order,
	get_target_score: get_target_score,
};
