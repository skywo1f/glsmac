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
		advanced: true,
		changes: {forest: false, borehole: false, condenser: true},
	},
	mirror: {
		name: 'Echelon Mirror',
		turns: 12,
		required_technology: 'EcologicalEngineering',
		advanced: true,
		changes: {forest: false, mine: false, solar: false, borehole: false, mirror: true},
	},
	borehole: {
		name: 'Thermal Borehole',
		turns: 24,
		required_technology: 'EcologicalEngineering',
		advanced: true,
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
		advanced: true,
		feature_changes: {river: true},
	},
	raise_land: {
		name: 'Raise Land',
		sea_name: 'Raise Sea Floor',
		turns: 12,
		required_technology: 'EnvironmentalEconomics',
		advanced: true,
		elevation_delta: 1000,
	},
	lower_land: {
		name: 'Lower Land',
		sea_name: 'Lower Sea Floor',
		turns: 12,
		required_technology: 'EnvironmentalEconomics',
		advanced: true,
		elevation_delta: -1000,
	},
	level_terrain: {
		name: 'Level Terrain',
		turns: 8,
		required_technology: '',
		advanced: true,
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
	const has_advanced_terraforming = #is_defined(project_effects) &&
		#is_defined(project_effects.advanced_terraforming) &&
		project_effects.advanced_terraforming;
	if (
		!has_technology(player, order.required_technology) &&
		(!#is_defined(order.advanced) || !order.advanced || !has_advanced_terraforming)
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

const advance_order = (unit) => {
	const type = unit.terraforming;
	const order = get_order(type);
	if (order == null) {
		throw Error('Unknown terraforming order: ' + type);
	}
	if (unit.terraforming_turns_remaining > 1) {
		unit.set_terraforming_order(type, unit.terraforming_turns_remaining - 1);
		unit.movement = 0.0;
		return true;
	}

	const tile = unit.get_tile();
	if (#is_defined(order.changes)) {
		tile.update_terraforming(order.changes);
	}
	if (#is_defined(order.feature_changes)) {
		tile.update_features(order.feature_changes);
	}
	if (#is_defined(order.rockiness_delta)) {
		tile.set_rockiness(tile.rockiness + order.rockiness_delta);
	}
	if (#is_defined(order.elevation_delta)) {
		tile.apply_elevation_change(order.elevation_delta);
	}
	unit.set_terraforming_order('none', 0);
	return false;
};

return {
	orders: orders,
	order_ids: order_ids,
	get_order: get_order,
	get_order_name: get_order_name,
	get_unavailable_reason: get_unavailable_reason,
	advance_order: advance_order,
};
