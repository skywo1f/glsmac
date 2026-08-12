const unit_abilities = #include('unit_abilities');

const SENSOR_RANGE = 2;

const get_sight_radius = (unit_or_def) => {
	return unit_abilities.has(unit_or_def, 'DeepRadar') ? 2 : 1;
};

const is_concealed = (unit_or_def) => {
	return is_ability_concealed(unit_or_def) || is_fungus_concealed(unit_or_def);
};

const is_ability_concealed = (unit_or_def) => {
	return unit_abilities.has(unit_or_def, 'CloakingDevice') ||
		unit_abilities.has(unit_or_def, 'DeepPressureHull');
};

const is_fungus_concealed = (unit) => {
	if (!#is_defined(unit.get_tile)) {
		return false;
	}
	const tile = unit.get_tile();
	return (
		(#is_defined(unit.is_land) && unit.is_land) ||
		(#is_defined(unit.is_water) && unit.is_water)
	) && #is_defined(tile.features) &&
		#is_defined(tile.features.xenofungus) && tile.features.xenofungus;
};

const get_tiles_in_radius = (center, radius) => {
	let result = [center];
	let frontier = [center];
	let seen = {};
	seen[#to_string(center.x) + '_' + #to_string(center.y)] = true;
	for (let distance = 0; distance < radius; distance++) {
		let next = [];
		for (tile of frontier) {
			for (candidate of tile.get_surrounding_tiles()) {
				const key = #to_string(candidate.x) + '_' + #to_string(candidate.y);
				if (#is_defined(seen[key])) {
					continue;
				}
				seen[key] = true;
				result :+candidate;
				next :+candidate;
			}
		}
		frontier = next;
	}
	return result;
};

const has_friendly_sensor = (game, player_id, target_tile) => {
	if (
		!#is_defined(game) || !#is_defined(game.get) || target_tile == null ||
		!#is_defined(target_tile.get_surrounding_tiles)
	) {
		return false;
	}
	const get_owner = game.get('f_territory_get_owner');
	if (!#is_defined(get_owner)) {
		return false;
	}
	for (tile of get_tiles_in_radius(target_tile, SENSOR_RANGE)) {
		if (
			#is_defined(tile.terraforming) && #is_defined(tile.terraforming.sensor) &&
			tile.terraforming.sensor
		) {
			const owner = get_owner(tile);
			if (owner != null && owner.id == player_id) {
				return true;
			}
		}
	}
	return false;
};

const has_friendly_deep_radar = (game, player_id, target_tile) => {
	if (
		!#is_defined(game) || #typeof(game.get_um) != 'Callable' ||
		target_tile == null
	) {
		return false;
	}
	for (unit of game.get_um().get_units()) {
		if (
			unit.owner != player_id ||
			(#is_defined(unit.is_embarked) && unit.is_embarked) ||
			!unit_abilities.has(unit, 'DeepRadar')
		) {
			continue;
		}
		const observer_tile = unit.get_tile();
		if (
			observer_tile == target_tile ||
			(
				#typeof(observer_tile.is_adjactent_to) == 'Callable' &&
				observer_tile.is_adjactent_to(target_tile)
			)
		) {
			return true;
		}
	}
	return false;
};

const is_detected = (game, player_id, target) => {
	if (target.owner == player_id || !is_concealed(target)) {
		return true;
	}
	if (has_friendly_sensor(game, player_id, target.get_tile())) {
		return true;
	}
	return !is_ability_concealed(target) && is_fungus_concealed(target) &&
		has_friendly_deep_radar(game, player_id, target.get_tile());
};

const can_target = (game, player_id, attacker, target) => {
	if (is_detected(game, player_id, target)) {
		return true;
	}
	if (attacker == null) {
		return false;
	}
	const attacker_def = attacker.get_def();
	const is_artillery = unit_abilities.has(attacker_def, 'HeavyArtillery') ||
		attacker_def.id == 'SporeLauncher';
	return !is_artillery && attacker.get_tile().is_adjactent_to(target.get_tile());
};

return {
	sensor_range: SENSOR_RANGE,
	get_sight_radius: get_sight_radius,
	is_concealed: is_concealed,
	is_ability_concealed: is_ability_concealed,
	is_fungus_concealed: is_fungus_concealed,
	get_tiles_in_radius: get_tiles_in_radius,
	has_friendly_sensor: has_friendly_sensor,
	has_friendly_deep_radar: has_friendly_deep_radar,
	is_detected: is_detected,
	can_target: can_target,
};
