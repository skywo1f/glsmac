const terraform_tile = #include('../default/game/event/terraform_tile');
const cancel_terraform = #include('../default/game/event/cancel_terraform');
const terraforming = #include('../default/units/terraforming');

let tile_state = {
	is_water: false,
	is_locked: false,
	base: null,
	other_units: [],
	nearby_tiles: [],
	updates: 0,
	feature_updates: 0,
	rockiness_updates: 0,
	elevation_updates: 0,
	elevation_change_error: '',
};

let known_technologies = {};
let diplomatic_relation = 'neutral';
let cost_bases = [];
let owner = null;
owner = {
	id: 1,
	type: 'human',
	difficulty_level: 'Transcend',
	energy_credits: 1000,
	has_technology: (id) => {
		return #is_defined(known_technologies[id]);
	},
	get_diplomatic_relation: () => { return diplomatic_relation; },
	set_energy_credits: (value) => { owner.energy_credits = value; },
};
const enemy_owner = {
	id: 2,
	has_technology: () => { return false; },
};

let tile = null;
tile = {
	is_water: false,
	is_land: true,
	x: 4,
	y: 6,
	features: {
		monolith: false,
		xenofungus: false,
		volcano: false,
		river: false,
	},
	terraforming: {
		road: false,
		mag_tube: false,
		forest: false,
		farm: false,
		soil_enricher: false,
		mine: false,
		solar: false,
		condenser: false,
		mirror: false,
		borehole: false,
		aquifer: false,
		raise_land: false,
		lower_land: false,
		level_terrain: false,
		sensor: false,
		bunker: false,
		airbase: false,
		remove_fungus: false,
		plant_fungus: false,
	},
	rockiness: 1,
	elevation: 0,
	is_locked: () => {
		return tile_state.is_locked;
	},
	get_base: () => {
		return tile_state.base;
	},
	get_units: () => {
		return tile_state.other_units;
	},
	get_surrounding_tiles: () => {
		return tile_state.nearby_tiles;
	},
	update_terraforming: (changes) => {
		for (type in changes) {
			tile.terraforming[type] = changes[type];
		}
		tile_state.updates = tile_state.updates + 1;
	},
	update_features: (changes) => {
		for (type in changes) {
			tile.features[type] = changes[type];
		}
		tile_state.feature_updates = tile_state.feature_updates + 1;
	},
	set_rockiness: (value) => {
		tile.rockiness = value;
		tile_state.rockiness_updates = tile_state.rockiness_updates + 1;
	},
	get_elevation_change_error: (amount) => {
		test.assert(amount == -1000 || amount == 1000);
		return tile_state.elevation_change_error;
	},
	apply_elevation_change: (amount) => {
		tile.elevation = tile.elevation + amount;
		tile_state.elevation_updates = tile_state.elevation_updates + 1;
		return 'terrain-snapshot';
	},
};

let can_terraform = true;
let former_is_water = false;
let former_abilities = [];
let helper_unit = null;
let unit = null;
unit = {
	id: 10,
	owner: 1,
	movement: 1.0,
	health: 1.0,
	moved_this_turn: false,
	terraforming: 'none',
	terraforming_turns_remaining: 0,
	transport_id: 0,
	is_land: true,
	is_water: false,
	get_def: () => {
		return {
			can_terraform: can_terraform,
			is_water: former_is_water,
			abilities: former_abilities,
		};
	},
	get_tile: () => {
		return tile;
	},
	get_owner: () => { return owner; },
	set_terraforming_order: (type, turns) => {
		unit.terraforming = type;
		unit.terraforming_turns_remaining = turns;
	},
};

let turn_complete = false;
let terraforming_rate_multiplier = 1.0;
let fungus_terraforming_rate_multiplier = 1.0;
let advanced_terraforming = false;
const event = {
	caller: 1,
	data: {
		unit: unit,
		type: 'farm',
	},
	game: {
		is_turn_complete: (player) => {
			return turn_complete;
		},
		get: (key) => {
			test.assert(key == 'f_project_get_player_effects');
			return (owner) => {
				test.assert(owner.id == 1);
				return {
					terraforming_rate_multiplier: terraforming_rate_multiplier,
					advanced_terraforming: advanced_terraforming,
					fungus_terraforming_rate_multiplier:
						fungus_terraforming_rate_multiplier,
				};
			};
		},
		get_players: () => { return [owner, enemy_owner]; },
		get_player: (id) => { return id == owner.id ? owner : enemy_owner; },
		get_tm: () => {
			return {get_distance: (source, destination) => { return destination.distance; }};
		},
		get_bm: () => {
			return {get_bases: () => { return cost_bases; }};
		},
		get_um: () => {
			return {
				get_unit: (id) => { return id == unit.id ? unit : helper_unit; },
				has_unit: (id) => {
					return id == unit.id || (helper_unit != null && id == helper_unit.id);
				},
			};
		},
	},
};

test.assert(!#is_defined(terraform_tile.validate(event)));
test.assert(terraform_tile.resolve(event) == {});

event.data.type = 1;
test.assert(#is_defined(terraform_tile.validate(event)));
event.data.type = 'unknown';
test.assert(#is_defined(terraform_tile.validate(event)));
event.data.type = 'farm';
event.caller = 2;
test.assert(#is_defined(terraform_tile.validate(event)));
event.caller = 1;
turn_complete = true;
test.assert(#is_defined(terraform_tile.validate(event)));
turn_complete = false;
can_terraform = false;
test.assert(#is_defined(terraform_tile.validate(event)));
can_terraform = true;
event.data.unit.transport_id = 12;
test.assert(#is_defined(terraform_tile.validate(event)));
event.data.unit.transport_id = 0;
tile.is_water = true;
test.assert(#is_defined(terraform_tile.validate(event)));
former_is_water = true;
test.assert(!#is_defined(terraform_tile.validate(event)));
test.assert(terraforming.get_order_name('farm', true) == 'Kelp Farm');
event.data.type = 'mine';
test.assert(!#is_defined(terraform_tile.validate(event)));
event.data.type = 'solar';
test.assert(!#is_defined(terraform_tile.validate(event)));
event.data.type = 'road';
test.assert(#is_defined(terraform_tile.validate(event)));
tile.is_water = false;
test.assert(#is_defined(terraform_tile.validate(event)));
former_is_water = false;
event.data.type = 'farm';
tile.features.xenofungus = true;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.features.xenofungus = false;
tile.terraforming.farm = true;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.terraforming.farm = false;
tile_state.other_units = [{id: 11, terraforming: 'mine'}];
test.assert(#is_defined(terraform_tile.validate(event)));
tile_state.other_units = [];

event.data.type = 'condenser';
test.assert(#is_defined(terraform_tile.validate(event)));
advanced_terraforming = true;
test.assert(!#is_defined(terraform_tile.validate(event)));
event.data.type = 'borehole';
test.assert(!#is_defined(terraform_tile.validate(event)));
event.data.type = 'mirror';
test.assert(#is_defined(terraform_tile.validate(event)));
event.data.type = 'aquifer';
test.assert(#is_defined(terraform_tile.validate(event)));
advanced_terraforming = false;
event.data.type = 'condenser';
known_technologies.EcologicalEngineering = true;
test.assert(!#is_defined(terraform_tile.validate(event)));
known_technologies = {};

event.data.type = 'farm';
tile.rockiness = 3;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.rockiness = 1;

tile.features.volcano = true;
tile.elevation = 1000;
tile_state.nearby_tiles = [{features: {volcano: true}, elevation: 2000}];
event.data.type = 'farm';
test.assert(#is_defined(terraform_tile.validate(event)));
event.data.type = 'forest';
test.assert(#is_defined(terraform_tile.validate(event)));
event.data.type = 'road';
test.assert(!#is_defined(terraform_tile.validate(event)));
tile.elevation = 3000;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.features.volcano = false;
tile_state.nearby_tiles = [];

event.data.type = 'soil_enricher';
known_technologies.AdvancedEcologicalEngineering = true;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.terraforming.farm = true;
test.assert(!#is_defined(terraform_tile.validate(event)));
tile.terraforming.farm = false;
known_technologies = {};

event.data.type = 'mag_tube';
known_technologies.MonopoleMagnets = true;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.terraforming.road = true;
test.assert(!#is_defined(terraform_tile.validate(event)));
tile.terraforming.road = false;
known_technologies = {};

event.data.type = 'borehole';
known_technologies.EcologicalEngineering = true;
tile_state.nearby_tiles = [{
	terraforming: {borehole: true},
	features: {river: false},
	is_water: false,
	elevation: 0,
}];
test.assert(#is_defined(terraform_tile.validate(event)));
tile_state.nearby_tiles = [{
	terraforming: {borehole: false},
	features: {river: false},
	is_water: false,
	elevation: 0,
}];
tile.elevation = 1000;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.elevation = 0;
tile_state.nearby_tiles = [];
test.assert(!#is_defined(terraform_tile.validate(event)));
known_technologies = {};

event.data.type = 'aquifer';
test.assert(#is_defined(terraform_tile.validate(event)));
known_technologies.EcologicalEngineering = true;
test.assert(!#is_defined(terraform_tile.validate(event)));
tile.features.river = true;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.features.river = false;
tile_state.nearby_tiles = [{features: {river: true}}];
test.assert(#is_defined(terraform_tile.validate(event)));
tile_state.nearby_tiles = [];
tile.terraforming.borehole = true;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.terraforming.borehole = false;
known_technologies = {};

const make_river_tile = (x, y, elevation, is_water) => {
	let nearby = [];
	let result = null;
	result = {
		x: x,
		y: y,
		elevation: elevation,
		is_water: is_water,
		features: {river: false},
		get_surrounding_tiles: () => { return nearby; },
		set_nearby: (value) => { nearby = value; },
		update_features: (changes) => { result.features.river = changes.river; },
	};
	return result;
};
const river_source = make_river_tile(4, 4, 2000, false);
const river_high = make_river_tile(6, 4, 1500, false);
const river_low = make_river_tile(5, 5, 1000, false);
const river_mouth = make_river_tile(7, 5, 0 - 1, true);
river_source.set_nearby([river_high, river_low]);
river_high.set_nearby([river_source]);
river_low.set_nearby([river_source, river_mouth]);
river_mouth.set_nearby([river_low]);
test.assert(terraforming.create_aquifer_river(river_source) == [river_source, river_low]);
test.assert(river_source.features.river && river_low.features.river);
test.assert(!river_high.features.river && !river_mouth.features.river);

event.data.type = 'level_terrain';
tile.rockiness = 1;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.rockiness = 3;
test.assert(!#is_defined(terraform_tile.validate(event)));

event.data.type = 'raise_land';
test.assert(#is_defined(terraform_tile.validate(event)));
advanced_terraforming = true;
test.assert(!#is_defined(terraform_tile.validate(event)));
advanced_terraforming = false;
known_technologies.EnvironmentalEconomics = true;
test.assert(!#is_defined(terraform_tile.validate(event)));
owner.energy_credits = 3;
test.assert(#is_defined(terraform_tile.validate(event)));
owner.energy_credits = 1000;
tile_state.elevation_change_error = 'Terrain cannot be raised any further';
test.assert(#is_defined(terraform_tile.validate(event)));
tile_state.elevation_change_error = '';

tile.elevation = 0;
tile.features.xenofungus = false;
test.assert(terraforming.get_elevation_change_cost(event.game, tile, owner) == 4);
cost_bases = [
	{owner: 1, get_size: () => { return 2; }, get_tile: () => { return {distance: 3}; }},
	{owner: 2, get_size: () => { return 10; }, get_tile: () => { return {distance: 1}; }},
];
test.assert(terraforming.get_elevation_change_cost(event.game, tile, owner) == 144);
diplomatic_relation = 'pact';
test.assert(terraforming.get_elevation_change_cost(event.game, tile, owner) == 12);
diplomatic_relation = 'neutral';
cost_bases = [];
tile.is_water = true;
tile.elevation = 0 - 1;
test.assert(terraforming.get_elevation_change_cost(event.game, tile, owner) == 36);
known_technologies.DoctrineAirPower = true;
test.assert(terraforming.get_elevation_change_cost(event.game, tile, owner) == 18);
known_technologies.DoctrineAirPower = #undefined;
tile.is_water = false;
tile.elevation = 0;

event.data.type = 'lower_land';
test.assert(!#is_defined(terraform_tile.validate(event)));
tile.is_water = true;
former_is_water = true;
test.assert(!#is_defined(terraform_tile.validate(event)));
test.assert(terraforming.get_order_name('raise_land', true) == 'Raise Sea Floor');
test.assert(terraforming.get_order_name('lower_land', true) == 'Lower Sea Floor');
tile.is_water = false;
former_is_water = false;
known_technologies = {};

event.data.type = 'remove_fungus';
test.assert(#is_defined(terraform_tile.validate(event)));
tile.features.xenofungus = true;
test.assert(!#is_defined(terraform_tile.validate(event)));
event.data.type = 'plant_fungus';
known_technologies.EcologicalEngineering = true;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.features.xenofungus = false;
known_technologies = {};

event.data.type = 'farm';
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming == 'farm');
test.assert(unit.terraforming_turns_remaining == 4);
test.assert(event.data.unit.movement == 0.0);
test.assert(event.data.unit.moved_this_turn);
terraform_tile.rollback(event);
test.assert(unit.terraforming == 'none');
test.assert(unit.terraforming_turns_remaining == 0);
test.assert(event.data.unit.movement == 1.0);
test.assert(!event.data.unit.moved_this_turn);

terraforming_rate_multiplier = 1.5;
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 3);
terraform_tile.rollback(event);
terraforming_rate_multiplier = 1.0;

former_abilities = ['SuperFormer'];
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 2);
terraform_tile.rollback(event);
former_abilities = [];

event.data.type = 'remove_fungus';
tile.features.xenofungus = true;
former_abilities = ['FungicideTanks'];
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 3);
terraform_tile.rollback(event);
former_abilities = [];

fungus_terraforming_rate_multiplier = 2.0;
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 3);
terraform_tile.rollback(event);
fungus_terraforming_rate_multiplier = 1.0;

terraforming_rate_multiplier = 1.5;
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 6);
terraform_tile.rollback(event);

event.data.type = 'plant_fungus';
tile.features.xenofungus = false;
known_technologies.EcologicalEngineering = true;
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 4);
terraform_tile.rollback(event);

fungus_terraforming_rate_multiplier = 2.0;
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 2);
terraform_tile.rollback(event);

fungus_terraforming_rate_multiplier = 1.0;
terraforming_rate_multiplier = 1.0;
known_technologies = {};

event.data.type = 'road';
tile.rockiness = 2;
tile.features.river = true;
tile.features.xenofungus = false;
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 3);
terraform_tile.rollback(event);

event.data.type = 'solar';
tile.rockiness = 3;
tile.features.river = false;
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 8);
terraform_tile.rollback(event);

event.data.type = 'farm';
tile.rockiness = 1;
owner.type = 'ai';
owner.difficulty_level = 'Thinker';
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 3);
terraform_tile.rollback(event);
owner.difficulty_level = 'Librarian';
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 4);
terraform_tile.rollback(event);
owner.type = 'human';
owner.difficulty_level = 'Transcend';

event.data.type = 'raise_land';
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 12);
test.assert(owner.energy_credits == 996);
terraform_tile.rollback(event);
test.assert(owner.energy_credits == 1000);
event.data.type = 'lower_land';
event.applied = terraform_tile.apply(event);
test.assert(owner.energy_credits == 996);
terraform_tile.rollback(event);
test.assert(owner.energy_credits == 1000);

helper_unit = {
	id: 11,
	owner: 1,
	movement: 0.0,
	terraforming: 'farm',
	terraforming_turns_remaining: 4,
	get_def: () => { return {abilities: []}; },
	get_owner: () => { return owner; },
	get_tile: () => { return tile; },
	set_terraforming_order: (type, turns) => {
		helper_unit.terraforming = type;
		helper_unit.terraforming_turns_remaining = turns;
	},
};
tile_state.other_units = [unit, helper_unit];
event.data.type = 'farm';
test.assert(!#is_defined(terraform_tile.validate(event)));
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 2);
test.assert(helper_unit.terraforming_turns_remaining == 2);
terraform_tile.rollback(event);
test.assert(unit.terraforming == 'none');
test.assert(helper_unit.terraforming_turns_remaining == 4);

helper_unit.set_terraforming_order('raise_land', 12);
event.data.type = 'raise_land';
event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming_turns_remaining == 6);
test.assert(helper_unit.terraforming_turns_remaining == 6);
test.assert(owner.energy_credits == 1000);
terraform_tile.rollback(event);

unit.set_terraforming_order('farm', 2);
helper_unit.set_terraforming_order('farm', 2);
let helper_completion = terraforming.advance_order_result(helper_unit, event.game);
test.assert(helper_completion.in_progress);
test.assert(unit.terraforming_turns_remaining == 2);
test.assert(helper_unit.terraforming_turns_remaining == 2);
helper_completion = terraforming.advance_order_result(unit, event.game);
test.assert(helper_completion.in_progress);
test.assert(unit.terraforming_turns_remaining == 1);
test.assert(helper_unit.terraforming_turns_remaining == 1);
const group_cancel_event = {caller: 1, game: event.game, data: {unit: unit}};
group_cancel_event.applied = cancel_terraform.apply(group_cancel_event);
test.assert(unit.terraforming == 'none');
test.assert(helper_unit.terraforming_turns_remaining == 2);
cancel_terraform.rollback(group_cancel_event);
test.assert(unit.terraforming_turns_remaining == 1);
test.assert(helper_unit.terraforming_turns_remaining == 1);
helper_completion = terraforming.advance_order_result(unit, event.game);
test.assert(helper_completion.completed);
test.assert(unit.terraforming == 'none');
test.assert(helper_unit.terraforming == 'none');
test.assert(tile.terraforming.farm);
tile.terraforming.farm = false;
tile_state.updates = 0;
tile_state.other_units = [];
helper_unit = null;

event.data.type = 'farm';
tile.features.xenofungus = false;

unit.set_terraforming_order('farm', 4);
test.assert(terraforming.advance_order(unit));
test.assert(unit.terraforming_turns_remaining == 3);
test.assert(terraforming.advance_order(unit));
test.assert(unit.terraforming_turns_remaining == 2);
test.assert(terraforming.advance_order(unit));
test.assert(unit.terraforming_turns_remaining == 1);
test.assert(!terraforming.advance_order(unit));
test.assert(unit.terraforming == 'none');
test.assert(unit.terraforming_turns_remaining == 0);
test.assert(tile.terraforming.farm);
test.assert(tile_state.updates == 1);

tile.terraforming.solar = true;
unit.set_terraforming_order('mine', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.terraforming.mine);
test.assert(!tile.terraforming.solar);
test.assert(tile_state.updates == 2);

unit.set_terraforming_order('road', 2);
test.assert(terraforming.advance_order(unit));
test.assert(unit.terraforming_turns_remaining == 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.terraforming.road);
test.assert(tile_state.updates == 3);

tile.terraforming.farm = true;
tile.terraforming.mine = true;
tile.terraforming.solar = true;
unit.set_terraforming_order('forest', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.terraforming.forest);
test.assert(!tile.terraforming.farm);
test.assert(!tile.terraforming.mine);
test.assert(!tile.terraforming.solar);
test.assert(tile_state.updates == 4);

unit.set_terraforming_order('solar', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(!tile.terraforming.forest);
test.assert(tile.terraforming.solar);
test.assert(!tile.terraforming.mine);
test.assert(tile_state.updates == 5);

tile.features.xenofungus = true;
unit.set_terraforming_order('remove_fungus', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(!tile.features.xenofungus);
test.assert(tile_state.updates == 5);
test.assert(tile_state.feature_updates == 1);

tile.terraforming.farm = true;
tile.terraforming.soil_enricher = true;
tile.terraforming.solar = true;
unit.set_terraforming_order('plant_fungus', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.features.xenofungus);
test.assert(!tile.terraforming.farm);
test.assert(!tile.terraforming.soil_enricher);
test.assert(!tile.terraforming.solar);
test.assert(tile_state.updates == 6);
test.assert(tile_state.feature_updates == 2);

unit.set_terraforming_order('borehole', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.terraforming.borehole);
test.assert(tile_state.updates == 7);

tile.features.river = false;
unit.set_terraforming_order('aquifer', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.features.river);
test.assert(tile_state.feature_updates == 3);

tile.rockiness = 3;
unit.set_terraforming_order('level_terrain', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.rockiness == 2);
test.assert(tile_state.rockiness_updates == 1);
unit.set_terraforming_order('level_terrain', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.rockiness == 1);
test.assert(tile_state.rockiness_updates == 2);

tile.elevation = 0;
unit.set_terraforming_order('raise_land', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.elevation == 1000);
test.assert(tile_state.elevation_updates == 1);
unit.set_terraforming_order('lower_land', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.elevation == 0);
test.assert(tile_state.elevation_updates == 2);

tile_state.elevation_change_error = 'Terrain cannot change the domain of a base';
unit.set_terraforming_order('raise_land', 1);
let completion = terraforming.advance_order_result(unit);
test.assert(!completion.in_progress);
test.assert(!completion.completed);
test.assert(completion.unit_survived);
test.assert(unit.terraforming == 'none');
test.assert(tile_state.elevation_updates == 2);
tile_state.elevation_change_error = '';

let unit_alive = true;
tile_state.other_units = [unit];
const apply_elevation_without_domain_change = tile.apply_elevation_change;
tile.apply_elevation_change = (amount) => {
	tile.elevation = tile.elevation + amount;
	tile.is_water = true;
	tile.is_land = false;
	tile_state.elevation_updates = tile_state.elevation_updates + 1;
	return 'terrain-snapshot';
};
unit.set_terraforming_order('lower_land', 1);
completion = terraforming.advance_order_result(unit, {
	get_tm: () => {
		return {get_tile: (x, y) => {
			test.assert(x == tile.x && y == tile.y);
			return tile;
		}};
	},
	get_um: () => {
		return {
			has_unit: (id) => { return id == unit.id && unit_alive; },
			despawn_unit: (candidate) => {
				test.assert(candidate.id == unit.id);
				unit_alive = false;
			},
		};
	},
});
test.assert(completion.completed);
test.assert(!unit_alive);
test.assert(!completion.unit_survived);
test.assert(tile.is_water);
test.assert(unit.terraforming == 'none');
tile.apply_elevation_change = apply_elevation_without_domain_change;
tile_state.other_units = [];
tile.is_water = false;
tile.is_land = true;

unit.set_terraforming_order('solar', 2);
unit.movement = 0.0;
unit.moved_this_turn = true;
const cancel_event = {
	caller: 1,
	game: event.game,
	data: {unit: unit},
};
test.assert(!#is_defined(cancel_terraform.validate(cancel_event)));
cancel_event.applied = cancel_terraform.apply(cancel_event);
test.assert(unit.terraforming == 'none');
test.assert(unit.terraforming_turns_remaining == 0);
cancel_terraform.rollback(cancel_event);
test.assert(unit.terraforming == 'solar');
test.assert(unit.terraforming_turns_remaining == 2);
test.assert(unit.movement == 0.0);
test.assert(unit.moved_this_turn);
