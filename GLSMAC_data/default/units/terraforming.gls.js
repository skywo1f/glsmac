const unit_abilities = #include('../game/unit_abilities');

const orders = {
	road: {
		name: 'Road',
		turns: 1,
		required_technology: '',
		changes: {road: true},
	},
	mag_tube: {
		name: 'Mag Tube',
		turns: 3,
		required_technology: 'MonopoleMagnets',
		changes: {mag_tube: true},
	},
	forest: {
		name: 'Forest',
		turns: 4,
		required_technology: '',
		changes: {
			forest: true,
			farm: false,
			soil_enricher: false,
			mine: false,
			solar: false,
			condenser: false,
			mirror: false,
			borehole: false,
		},
	},
	farm: {
		name: 'Farm',
		sea_name: 'Kelp Farm',
		turns: 4,
		required_technology: '',
		changes: {forest: false, borehole: false, farm: true},
	},
	soil_enricher: {
		name: 'Soil Enricher',
		turns: 8,
		required_technology: 'AdvancedEcologicalEngineering',
		changes: {soil_enricher: true},
	},
	mine: {
		name: 'Mine',
		sea_name: 'Mining Platform',
		turns: 8,
		required_technology: '',
		changes: {forest: false, solar: false, mirror: false, borehole: false, mine: true},
	},
	solar: {
		name: 'Solar Collector',
		sea_name: 'Tidal Harness',
		turns: 4,
		required_technology: '',
		changes: {forest: false, mine: false, mirror: false, borehole: false, solar: true},
	},
	condenser: {
		name: 'Condenser',
		turns: 12,
		required_technology: 'EcologicalEngineering',
		weather_paradigm_unlock: true,
		changes: {forest: false, borehole: false, condenser: true},
	},
	mirror: {
		name: 'Echelon Mirror',
		turns: 12,
		required_technology: 'EcologicalEngineering',
		changes: {forest: false, mine: false, solar: false, borehole: false, mirror: true},
	},
	borehole: {
		name: 'Thermal Borehole',
		turns: 24,
		required_technology: 'EcologicalEngineering',
		weather_paradigm_unlock: true,
		changes: {
			forest: false,
			farm: false,
			soil_enricher: false,
			mine: false,
			solar: false,
			condenser: false,
			mirror: false,
			borehole: true,
		},
	},
	aquifer: {
		name: 'Aquifer',
		turns: 18,
		required_technology: 'EcologicalEngineering',
		feature_changes: {river: true},
	},
	raise_land: {
		name: 'Raise Land',
		sea_name: 'Raise Sea Floor',
		turns: 12,
		required_technology: 'EnvironmentalEconomics',
		weather_paradigm_unlock: true,
		elevation_delta: 1000,
	},
	lower_land: {
		name: 'Lower Land',
		sea_name: 'Lower Sea Floor',
		turns: 12,
		required_technology: 'EnvironmentalEconomics',
		weather_paradigm_unlock: true,
		elevation_delta: -1000,
	},
	level_terrain: {
		name: 'Level Terrain',
		turns: 8,
		required_technology: '',
		rockiness_delta: -1,
	},
	sensor: {
		name: 'Sensor Array',
		turns: 4,
		required_technology: '',
		changes: {sensor: true},
	},
	bunker: {
		name: 'Bunker',
		turns: 5,
		required_technology: 'AdvancedMilitaryAlgorithms',
		changes: {bunker: true},
	},
	airbase: {
		name: 'Airbase',
		turns: 10,
		required_technology: 'DoctrineAirPower',
		changes: {airbase: true},
	},
	remove_fungus: {
		name: 'Remove Fungus',
		sea_name: 'Remove Sea Fungus',
		turns: 6,
		required_technology: '',
		feature_changes: {xenofungus: false},
	},
	plant_fungus: {
		name: 'Plant Fungus',
		sea_name: 'Plant Sea Fungus',
		turns: 6,
		required_technology: 'EcologicalEngineering',
		changes: {
			forest: false,
			farm: false,
			soil_enricher: false,
			mine: false,
			solar: false,
			condenser: false,
			mirror: false,
			borehole: false,
		},
		feature_changes: {xenofungus: true},
	},
};

const order_ids = [
	'road',
	'mag_tube',
	'forest',
	'farm',
	'soil_enricher',
	'mine',
	'solar',
	'condenser',
	'mirror',
	'borehole',
	'aquifer',
	'raise_land',
	'lower_land',
	'level_terrain',
	'sensor',
	'bunker',
	'airbase',
	'remove_fungus',
	'plant_fungus',
];

const sea_order_ids = {
	farm: true,
	mine: true,
	solar: true,
	remove_fungus: true,
	plant_fungus: true,
	raise_land: true,
	lower_land: true,
};

const DIFFICULTY_LEVELS = {
	Citizen: 0,
	Specialist: 1,
	Talent: 2,
	Librarian: 3,
	Thinker: 4,
	Transcend: 5,
};

const AQUIFER_RIVER_MAX_LENGTH = 16;

const is_fungus_order = (type) => {
	return type == 'remove_fungus' || type == 'plant_fungus';
};

const is_elevation_order = (type) => {
	return type == 'raise_land' || type == 'lower_land';
};

const get_modified_rate = (tile, unit, type, listed_rate) => {
	let rate = listed_rate;
	if (type == 'solar') {
		rate += #floor(#to_float(rate * #max(0, tile.rockiness - 1)) / 2.0);
	} else if (type == 'road' || type == 'mag_tube') {
		if (tile.features.river) {
			rate += 1;
		}
		if (tile.features.xenofungus) {
			rate += 2;
		}
		rate += tile.terraforming.forest ? 2 : #max(0, tile.rockiness - 1);
	} else if (type == 'remove_fungus' && unit_abilities.has(unit, 'FungicideTanks')) {
		rate = #max(1, #floor(#to_float(rate) / 2.0));
	}

	const player = unit.get_owner();
	const difficulty = #is_defined(DIFFICULTY_LEVELS[player.difficulty_level])
		? DIFFICULTY_LEVELS[player.difficulty_level]
		: DIFFICULTY_LEVELS.Transcend;
	if (player.type == 'ai' && difficulty > DIFFICULTY_LEVELS.Librarian && rate > 3) {
		rate -= 1;
	}
	return rate;
};

const get_completion_turns = (tile, unit, type, project_effects) => {
	const order = get_order(type);
	if (order == null) {
		return 0;
	}
	const rate = get_modified_rate(tile, unit, type, order.turns);
	const contribution = get_contribution(unit, type, project_effects);
	return #max(1, #ceil(#to_float(rate * 2) / #to_float(contribution)));
};

const get_contribution = (unit, type, project_effects) => {
	let contribution = unit_abilities.has(unit, 'SuperFormer') ? 4 : 2;
	let multiplier = type == 'remove_fungus'
		? 1.0
		: (
			#is_defined(project_effects.terraforming_rate_multiplier)
				? project_effects.terraforming_rate_multiplier
				: 1.0
		);
	if (is_fungus_order(type)) {
		multiplier *= #is_defined(project_effects.fungus_terraforming_rate_multiplier)
			? project_effects.fungus_terraforming_rate_multiplier
			: 1.0;
	}
	contribution = #floor(#to_float(contribution) * multiplier);
	return #max(1, contribution);
};

const has_order_helper = (tile, unit, type) => {
	if (!#is_defined(tile.get_units)) {
		return false;
	}
	for (helper of tile.get_units()) {
		if (
			helper.id != unit.id && helper.owner == unit.owner &&
			helper.terraforming == type
		) {
			return true;
		}
	}
	return false;
};

const get_joined_completion_turns = (tile, unit, type, project_effects) => {
	const solo_turns = get_completion_turns(tile, unit, type, project_effects);
	let helper_contribution = 0;
	let existing_turns = solo_turns;
	if (#is_defined(tile.get_units)) {
		for (helper of tile.get_units()) {
			if (
				helper.id != unit.id && helper.owner == unit.owner &&
				helper.terraforming == type
			) {
				existing_turns = #min(existing_turns, helper.terraforming_turns_remaining);
				helper_contribution += get_contribution(helper, type, project_effects);
			}
		}
	}
	if (helper_contribution == 0) {
		return solo_turns;
	}
	const joined_contribution = helper_contribution + get_contribution(
		unit,
		type,
		project_effects
	);
	return #max(1, #ceil(
		#to_float(existing_turns * helper_contribution) / #to_float(joined_contribution)
	));
};

const get_elevation_change_cost = (game, tile, player) => {
	const sea_level = #is_defined(tile.sea_level) ? tile.sea_level : 0;
	const relative_level = #floor(#to_float(tile.elevation - sea_level) / 1000.0);
	const altitude_distance = relative_level < 0 ? 0 - relative_level : relative_level;
	const altitude_factor = altitude_distance + 2;
	let cost = altitude_factor * altitude_factor * (tile.features.xenofungus ? 6 : 2);
	if (tile.is_water) {
		let air_power_discovered = false;
		for (candidate of game.get_players()) {
			if (candidate.has_technology('DoctrineAirPower')) {
				air_power_discovered = true;
				break;
			}
		}
		cost *= air_power_discovered ? 2 : 4;
	}

	const tm = game.get_tm();
	let own_base = null;
	let own_distance = 101;
	let enemy_base = null;
	let enemy_distance = 101;
	for (base of game.get_bm().get_bases()) {
		const distance = tm.get_distance(tile, base.get_tile());
		if (base.owner == player.id) {
			if (distance < own_distance) {
				own_base = base;
				own_distance = distance;
			}
		} else if (distance < enemy_distance) {
			enemy_base = base;
			enemy_distance = distance;
		}
	}
	if (own_base != null) {
		cost *= #min(100, #max(1, own_distance));
		if (
			enemy_base != null &&
			player.get_diplomatic_relation(game.get_player(enemy_base.owner)) != 'pact'
		) {
			const enemy_value = #floor(
				#to_float((enemy_base.get_size() + 2) * own_distance) / 3.0
			);
			const own_value = #floor(
				#to_float((own_base.get_size() + 2) * enemy_distance) / 3.0
			);
			if (own_value > 0 && enemy_value > own_value) {
				cost = #floor(#to_float(cost * enemy_value) / #to_float(own_value));
			}
		}
	}
	return #min(30000, #max(1, #floor(#to_float(cost) / 2.0)));
};

const get_order = (type) => {
	if (!#is_defined(orders[type])) {
		return null;
	}
	return orders[type];
};

const get_order_name = (type, is_water) => {
	const order = get_order(type);
	if (order == null) {
		return '';
	}
	return is_water && #is_defined(order.sea_name) ? order.sea_name : order.name;
};

const has_technology = (player, technology_id) => {
	return technology_id == '' || (
		#is_defined(player) &&
		#is_defined(player.has_technology) &&
		player.has_technology(technology_id)
	);
};

const is_volcano_center = (tile) => {
	if (!#is_defined(tile.features.volcano) || !tile.features.volcano) {
		return false;
	}
	for (nearby of tile.get_surrounding_tiles()) {
		if (
			#is_defined(nearby.features.volcano) && nearby.features.volcano &&
			nearby.elevation > tile.elevation
		) {
			return false;
		}
	}
	return true;
};

const get_unavailable_reason = (tile, player, type, project_effects) => {
	const order = get_order(type);
	if (order == null) {
		return 'Unknown terraforming order';
	}
	if (tile.is_water && !#is_defined(sea_order_ids[type])) {
		return 'This improvement cannot be built at sea';
	}
	if (tile.get_base() != null) {
		return 'This improvement cannot be built at a base';
	}
	if (tile.features.monolith) {
		return 'Monoliths cannot be terraformed';
	}
	if (is_volcano_center(tile)) {
		return 'The center of a volcano cannot be terraformed';
	}
	if (
		#is_defined(tile.features.volcano) && tile.features.volcano &&
		(type == 'farm' || type == 'forest')
	) {
		return 'This improvement cannot be built in a volcanic area';
	}
	const has_weather_paradigm = #is_defined(project_effects) &&
		#is_defined(project_effects.advanced_terraforming) &&
		project_effects.advanced_terraforming;
	if (
		!has_technology(player, order.required_technology) &&
		(
			!#is_defined(order.weather_paradigm_unlock) ||
			!order.weather_paradigm_unlock || !has_weather_paradigm
		)
	) {
		return 'Required technology has not been discovered';
	}
	if (type == 'plant_fungus' && tile.features.xenofungus) {
		return 'This square already contains xenofungus';
	}
	if (tile.features.xenofungus) {
		if (type == 'remove_fungus') {
			return null;
		}
		if (type != 'road' || !has_technology(player, 'CentauriEmpathy')) {
			return 'Xenofungus must be removed before building this improvement';
		}
	} else if (type == 'remove_fungus') {
		return 'This square has no xenofungus to remove';
	}
	if (
		type != 'remove_fungus' && type != 'plant_fungus' &&
		#is_defined(tile.terraforming[type]) && tile.terraforming[type]
	) {
		return 'Tile already has this improvement';
	}
	if (
		!tile.is_water &&
		(type == 'farm' || type == 'soil_enricher') && tile.rockiness == 3
	) {
		return 'Farms cannot be built in rocky squares';
	}
	if (type == 'soil_enricher' && !tile.terraforming.farm) {
		return 'A Soil Enricher requires a Farm';
	}
	if (type == 'mag_tube' && !tile.terraforming.road) {
		return 'A Mag Tube requires a Road';
	}
	if (type == 'borehole') {
		for (nearby of tile.get_surrounding_tiles()) {
			if (nearby.terraforming.borehole) {
				return 'Thermal Boreholes cannot be built in adjacent squares';
			}
			if (
				#is_defined(nearby.is_water) && !nearby.is_water &&
				#is_defined(nearby.elevation) && nearby.elevation < tile.elevation
			) {
				return 'Thermal Boreholes cannot be built on slopes';
			}
		}
	}
	if (type == 'aquifer') {
		if (tile.features.river) {
			return 'This square already contains a river';
		}
		if (tile.terraforming.borehole) {
			return 'Aquifers cannot be drilled through Thermal Boreholes';
		}
		for (nearby of tile.get_surrounding_tiles()) {
			if (nearby.features.river) {
				return 'Aquifers cannot be drilled adjacent to rivers';
			}
		}
	}
	if (type == 'level_terrain' && tile.rockiness <= 1) {
		return 'This square is already flat';
	}
	if (#is_defined(order.elevation_delta)) {
		const error = tile.get_elevation_change_error(order.elevation_delta);
		if (error != '') {
			return error;
		}
	}
	return null;
};

const get_elevation_domain_states = (tile) => {
	let states = [{x: tile.x, y: tile.y, prior_domain: tile.is_water ? 'water' : 'land'}];
	let seen = {};
	seen['t' + #to_string(tile.x) + '_' + #to_string(tile.y)] = true;
	for (nearby of tile.get_surrounding_tiles()) {
		const key = 't' + #to_string(nearby.x) + '_' + #to_string(nearby.y);
		if (!#is_defined(seen[key])) {
			seen[key] = true;
			states :+{
				x: nearby.x,
				y: nearby.y,
				prior_domain: nearby.is_water ? 'water' : 'land',
			};
		}
	}
	return states;
};

const get_tile_key = (tile) => {
	return 't' + #to_string(tile.x) + '_' + #to_string(tile.y);
};

const create_aquifer_river = (source) => {
	let current = source;
	let seen = {};
	let result = [];
	let length = 0;
	while (length < AQUIFER_RIVER_MAX_LENGTH) {
		const current_key = get_tile_key(current);
		if (#is_defined(seen[current_key]) || current.is_water) {
			break;
		}
		seen[current_key] = true;
		if (current.features.river) {
			break;
		}
		current.update_features({river: true});
		result :+current;
		length++;

		let next = null;
		let joins_water_or_river = false;
		for (candidate of current.get_surrounding_tiles()) {
			const candidate_key = get_tile_key(candidate);
			if (#is_defined(seen[candidate_key])) {
				continue;
			}
			if (candidate.is_water || candidate.features.river) {
				joins_water_or_river = true;
				break;
			}
			if (
				next == null || candidate.elevation < next.elevation ||
				(
					candidate.elevation == next.elevation &&
					(
						candidate.y < next.y ||
						(candidate.y == next.y && candidate.x < next.x)
					)
				)
			) {
				next = candidate;
			}
		}
		if (joins_water_or_river || next == null) {
			break;
		}
		current = next;
	}
	return result;
};

const get_domain_losses = (game, domain_states) => {
	let units = [];
	let seen = {};
	let lost = {};
	for (state of domain_states) {
		const tile = game.get_tm().get_tile(state.x, state.y);
		if (
			(state.prior_domain == 'water' && tile.is_water) ||
			(state.prior_domain == 'land' && !tile.is_water)
		) {
			continue;
		}
		for (candidate of tile.get_units(true)) {
			const key = 'u' + #to_string(candidate.id);
			if (!#is_defined(seen[key])) {
				seen[key] = true;
				units :+candidate;
			}
			if (
				candidate.transport_id == 0 && (
					(candidate.is_land && tile.is_water) ||
					(candidate.is_water && !tile.is_water)
				)
			) {
				lost[key] = true;
			}
		}
	}

	let added = true;
	while (added) {
		added = false;
		for (candidate of units) {
			const key = 'u' + #to_string(candidate.id);
			const transport_key = 'u' + #to_string(candidate.transport_id);
			if (
				candidate.transport_id != 0 && !#is_defined(lost[key]) &&
				#is_defined(lost[transport_key])
			) {
				lost[key] = true;
				added = true;
			}
		}
	}

	let result = [];
	for (candidate of units) {
		if (#is_defined(lost['u' + #to_string(candidate.id)])) {
			result :+candidate;
		}
	}
	return result;
};

const despawn_domain_losses = (game, units) => {
	if (#sizeof(units) == 0) {
		return;
	}
	const um = game.get_um();
	let owner_counts = {};
	let owner_ids = {};
	let cargo_units = [];
	let top_level_units = [];
	for (unit of units) {
		const key = 'p' + #to_string(unit.owner);
		owner_counts[key] = #is_defined(owner_counts[key]) ? owner_counts[key] + 1 : 1;
		owner_ids[key] = #to_int(#to_string(unit.owner));
		if (unit.transport_id != 0) {
			cargo_units :+unit;
		} else {
			top_level_units :+unit;
		}
	}
	for (unit of cargo_units) {
		if (um.has_unit(unit.id)) {
			um.despawn_unit(unit);
		}
	}
	for (let i = #sizeof(top_level_units) - 1; i >= 0; i--) {
		if (um.has_unit(top_level_units[i].id)) {
			um.despawn_unit(top_level_units[i]);
		}
	}
	const message_to_player = #is_defined(game.get)
		? game.get('f_message_to_player')
		: #undefined;
	if (#is_defined(message_to_player)) {
		for (key in owner_counts) {
			const count = owner_counts[key];
			message_to_player(
				game.get_player(owner_ids[key]),
				#to_string(count) + (count == 1 ? ' unit was' : ' units were') +
					' lost to a terraformed coastline.'
			);
		}
	}
};

const get_order_group = (unit) => {
	let result = [unit];
	const tile = unit.get_tile();
	if (!#is_defined(tile.get_units)) {
		return result;
	}
	for (candidate of tile.get_units(true)) {
		if (
			candidate.id != unit.id && candidate.owner == unit.owner &&
			candidate.terraforming == unit.terraforming
		) {
			result :+candidate;
		}
	}
	return result;
};

const advance_order_result = (unit, game) => {
	const type = unit.terraforming;
	const order = get_order(type);
	if (order == null) {
		throw Error('Unknown terraforming order: ' + type);
	}
	const order_group = get_order_group(unit);
	let leader_id = unit.id;
	for (helper of order_group) {
		leader_id = #min(leader_id, helper.id);
	}
	if (unit.id != leader_id) {
		unit.movement = 0.0;
		return {in_progress: true, completed: false, unit_survived: true};
	}
	if (unit.terraforming_turns_remaining > 1) {
		const turns_remaining = unit.terraforming_turns_remaining - 1;
		for (helper of order_group) {
			helper.set_terraforming_order(type, turns_remaining);
		}
		unit.movement = 0.0;
		return {in_progress: true, completed: false, unit_survived: true};
	}

	const tile = unit.get_tile();
	let domain_states = [];
	if (#is_defined(order.elevation_delta)) {
		const error = tile.get_elevation_change_error(order.elevation_delta);
		if (error != '') {
			for (helper of order_group) {
				helper.set_terraforming_order('none', 0);
			}
			const message_to_player = #is_defined(game) && #is_defined(game.get)
				? game.get('f_message_to_player')
				: #undefined;
			if (#is_defined(message_to_player)) {
				message_to_player(unit.get_owner(), get_order_name(type, tile.is_water) + ' was cancelled: ' + error);
			}
			return {in_progress: false, completed: false, unit_survived: true};
		}
		if (#is_defined(game)) {
			domain_states = get_elevation_domain_states(tile);
		}
	}
	for (helper of order_group) {
		helper.set_terraforming_order('none', 0);
	}
	if (#is_defined(order.changes)) {
		tile.update_terraforming(order.changes);
	}
	if (type == 'aquifer') {
		create_aquifer_river(tile);
	} else if (#is_defined(order.feature_changes)) {
		tile.update_features(order.feature_changes);
	}
	if (#is_defined(order.rockiness_delta)) {
		tile.set_rockiness(tile.rockiness + order.rockiness_delta);
	}
	if (#is_defined(order.elevation_delta)) {
		tile.apply_elevation_change(order.elevation_delta);
	}
	let unit_survived = true;
	if (#is_defined(game) && #sizeof(domain_states) > 0) {
		const unit_key = 'u' + #to_string(unit.id);
		const losses = get_domain_losses(game, domain_states);
		for (loss of losses) {
			if ('u' + #to_string(loss.id) == unit_key) {
				unit_survived = false;
				break;
			}
		}
		despawn_domain_losses(game, losses);
	}
	return {in_progress: false, completed: true, unit_survived: unit_survived};
};

const advance_order = (unit, game) => {
	return advance_order_result(unit, game).in_progress;
};

return {
	orders: orders,
	order_ids: order_ids,
	get_order: get_order,
	get_order_name: get_order_name,
	get_contribution: get_contribution,
	get_completion_turns: get_completion_turns,
	get_joined_completion_turns: get_joined_completion_turns,
	has_order_helper: has_order_helper,
	is_elevation_order: is_elevation_order,
	get_elevation_change_cost: get_elevation_change_cost,
	get_unavailable_reason: get_unavailable_reason,
	create_aquifer_river: create_aquifer_river,
	advance_order_result: advance_order_result,
	advance_order: advance_order,
};
