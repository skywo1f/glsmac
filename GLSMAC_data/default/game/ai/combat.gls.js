const RETREAT_HEALTH = 0.5;
const RECOVERED_HEALTH = 0.8;
const THREAT_DISTANCE = 2;
const MAX_GARRISON = 3;
const ASSAULT_DEFENSE_WEIGHT = 2.0;
const ASSAULT_SUPPORT_DISTANCE = 3;
const ASSAULT_SUPPORT_WEIGHT = 0.5;
const ASSAULT_BASE_SIZE_WEIGHT = 0.25;
const combat_rules = #include('../combat_rules');

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

const get_attack_score = (attacker, defender) => {
	const powers = combat_rules.get_attack_powers(attacker, defender);
	const total = powers.attack + powers.defence;
	return total > 0.0 ? powers.attack / total : 0.0;
};

const choose_attack_target = (attacker, player_id, tiles) => {
	let best = null;
	let best_score = 0.0;
	const attacker_is_artillery = combat_rules.is_artillery(attacker.get_def());
	for (tile of tiles) {
		if (
			!attacker_is_artillery &&
			((attacker.is_land && tile.is_water) || (attacker.is_water && tile.is_land))
		) {
			continue;
		}
		for (unit of tile.get_units()) {
			if (unit.owner == player_id || unit.health <= 0.0) {
				continue;
			}
			const score = get_attack_score(attacker, unit);
			if (
				best == null ||
				score > best_score ||
				(
					score == best_score &&
					(
						tile.y < best.get_tile().y ||
						(tile.y == best.get_tile().y && tile.x < best.get_tile().x) ||
						(
							tile.y == best.get_tile().y &&
							tile.x == best.get_tile().x &&
							unit.id < best.id
						)
					)
				)
			) {
				best = unit;
				best_score = score;
			}
		}
	}
	return best;
};

const get_assault_score = (tm, attacker, base, player_id, units) => {
	const base_tile = base.get_tile();
	if (
		base.get_owner().id == player_id ||
		(attacker.is_land && base_tile.is_water) ||
		(attacker.is_water && base_tile.is_land)
	) {
		return null;
	}
	let defense = 0.0;
	let support = 0.0;
	for (unit of units) {
		const def = unit.get_def();
		if (unit.owner != player_id && unit.get_tile() == base_tile) {
			defense += combat_rules.get_attack_powers(attacker, unit).defence;
		} else if (
			unit.owner == player_id &&
			def.offense > 0 &&
			unit.health >= RETREAT_HEALTH &&
			tm.get_distance(unit.get_tile(), base_tile) <= ASSAULT_SUPPORT_DISTANCE
		) {
			support += #to_float(def.offense) * combat_rules.get_morale_multiplier(unit) * unit.health;
		}
	}
	return (
		0.0 - #to_float(tm.get_distance(attacker.get_tile(), base_tile)) -
		defense * ASSAULT_DEFENSE_WEIGHT +
		support * ASSAULT_SUPPORT_WEIGHT +
		#to_float(base.get_size()) * ASSAULT_BASE_SIZE_WEIGHT
	);
};

const choose_assault_target = (tm, attacker, player_id, bases, units) => {
	let best = null;
	let best_score = 0.0;
	for (base of bases) {
		const score = get_assault_score(tm, attacker, base, player_id, units);
		if (score == null) {
			continue;
		}
		const tile = base.get_tile();
		if (
			best == null ||
			score > best_score ||
			(
				score == best_score &&
				(tile.y < best.get_tile().y || (tile.y == best.get_tile().y && tile.x < best.get_tile().x))
			)
		) {
			best = base;
			best_score = score;
		}
	}
	return best;
};

return {
	find_nearest_friendly_base: find_nearest_friendly_base,
	get_repair_destination: get_repair_destination,
	get_required_garrison: get_required_garrison,
	get_attack_score: get_attack_score,
	choose_attack_target: choose_attack_target,
	get_assault_score: get_assault_score,
	choose_assault_target: choose_assault_target,
};
