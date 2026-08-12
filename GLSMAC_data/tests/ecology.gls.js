const define_ecology = #include('../default/game/ecology');

const callbacks = {};
const values = {};
const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, value) => { values[name] = value; },
	get: (name) => { return values[name]; },
};
define_ecology(game);
callbacks.start({});

const blank_terraforming = () => {
	return {
		road: false, mag_tube: false, forest: false, farm: false,
		soil_enricher: false, mine: false, solar: false, condenser: false,
		mirror: false, borehole: false,
	};
};

let worked = blank_terraforming();
worked.farm = true;
worked.road = true;
worked.borehole = true;
let unworked = blank_terraforming();
unworked.mine = true;
unworked.solar = true;
unworked.condenser = true;
unworked.mirror = true;
unworked.forest = true;

let context = {
	tiles: [
		{terraforming: worked, worked: true},
		{terraforming: unworked, worked: false},
	],
	facilities: {
		TreeFarm: true,
		CentauriPreserve: true,
		TempleOfPlanet: true,
	},
	minerals: 30,
	previous_damages: 0,
	clean_mineral_facilities: 0,
	major_atrocities: 0,
	technologies: 20,
	planet: 0,
	life: 2,
	difficulty: 3,
	perihelion: false,
	ecology_divisor_bonus: 0,
};

let result = values.f_ecology_calculate(context);
test.assert(result.terraforming_raw == 27);
test.assert(result.terraforming_after_facilities == 13);
test.assert(result.terraforming_before_clean == 1);
test.assert(result.clean_allowance == 16);
test.assert(result.clean_terraforming == 1);
test.assert(result.clean_minerals == 15);
test.assert(result.minerals_after_clean == 15);
test.assert(result.facility_divisor == 3);
test.assert(result.mineral_damage == 5);
test.assert(result.value == 5);
test.assert(result.percent == 6);

context.perihelion = true;
result = values.f_ecology_calculate(context);
test.assert(result.value == 10);
test.assert(result.percent == 12);

context.facilities.HybridForest = true;
context.perihelion = false;
result = values.f_ecology_calculate(context);
test.assert(result.terraforming_after_facilities == 0);
test.assert(result.terraforming_before_clean == 0);
test.assert(result.clean_minerals == 16);
test.assert(result.mineral_damage == 4);

context.previous_damages = 8;
result = values.f_ecology_calculate(context);
test.assert(result.clean_allowance == 24);
test.assert(result.clean_minerals == 24);
test.assert(result.mineral_damage == 2);

context.clean_mineral_facilities = 4;
result = values.f_ecology_calculate(context);
test.assert(result.clean_allowance == 28);
test.assert(result.clean_minerals == 28);
test.assert(result.mineral_damage == 0);
context.clean_mineral_facilities = 0;

context.major_atrocities = 2;
result = values.f_ecology_calculate(context);
test.assert(result.value == 12);

context.major_atrocities = 0;
context.ecology_divisor_bonus = 1;
result = values.f_ecology_calculate(context);
test.assert(result.facility_divisor == 4);
test.assert(result.mineral_damage == 1);

test.assert(values.f_ecology_get_life_level(0.0) == 0);
test.assert(values.f_ecology_get_life_level(0.25) == 1);
test.assert(values.f_ecology_get_life_level(0.5) == 2);
test.assert(values.f_ecology_get_life_level(0.75) == 3);
test.assert(!values.f_ecology_is_perihelion(2189));
test.assert(values.f_ecology_is_perihelion(2190));
test.assert(values.f_ecology_is_perihelion(2209));
test.assert(!values.f_ecology_is_perihelion(2210));
test.assert(values.f_ecology_is_perihelion(2270));

let climate_state = {level: 0, future_change: 0, progress: 0};
let sea_level = 0;
game.get_tm = () => {
	return {
		get_sea_level: () => { return sea_level; },
		get_climate_state: () => { return #clone(climate_state); },
		set_climate_state: (level, future_change, progress) => {
			climate_state = {
				level: level,
				future_change: future_change,
				progress: progress,
			};
		},
	};
};
test.assert(values.f_ecology_get_climate_trigger(0) == 12);
test.assert(values.f_ecology_get_climate_trigger(500) == 18);
climate_state.level = 11;
const warming = values.f_ecology_advance_climate_damage({
	get_ecological_damage_events: () => { return 12; },
});
test.assert(warming.warming_triggered);
test.assert(warming.pending_change == 100);
test.assert(climate_state.level == 0);
test.assert(climate_state.future_change == 100);
climate_state.progress = 19;
test.assert(values.f_ecology_advance_pending_climate() == 100);
test.assert(climate_state.future_change == 0);
test.assert(climate_state.progress == 0);

let is_master = true;
let submitted_events = [];
let runtime_ecological_damage_events = 0;
let runtime_clean_mineral_facilities = 0;
const runtime_owner = {
	difficulty_level: 'Transcend',
	get_research_state: () => {
		return {
			technologies: [
				'1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
				'11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
			],
		};
	},
	get_ecological_damage_events: () => { return runtime_ecological_damage_events; },
	get_clean_mineral_facilities: () => { return runtime_clean_mineral_facilities; },
	set_clean_mineral_facilities: (count) => { runtime_clean_mineral_facilities = count; },
	get_major_atrocities: () => { return 0; },
};
const runtime_tile = {
	x: 4,
	y: 4,
	terraforming: blank_terraforming(),
	features: {monolith: false, xenofungus: false},
	get_base: () => { return null; },
};
const runtime_base = {
	get_owner: () => { return runtime_owner; },
	get_workable_tiles: () => { return [runtime_tile]; },
	is_tile_worked: (tile) => { return false; },
	get_facilities: () => { return []; },
	get_intake: () => { return {MINERALS: 100}; },
};
values.f_social_get_ratings = (owner) => { return {planet: 0 - 3}; };
game.is_master = () => { return is_master; };
game.get_bm = () => { return {get_bases: () => { return [runtime_base]; }}; };
game.get_players = () => { return [runtime_owner]; };
game.get_settings = () => {
	return {global: {difficulty_level: 'Transcend', map: {native_lifeforms: 0.75}}};
};
game.get_year = () => { return 2200; };
game.random = {get_int: (minimum, maximum) => { return minimum; }};
game.event = (name, data) => { submitted_events :+{name: name, data: data}; };

test.assert(!#is_defined(
	values.f_ecology_apply_facility_completion(runtime_base, 'TreeFarm')
));
test.assert(runtime_clean_mineral_facilities == 0);
runtime_ecological_damage_events = 1;
test.assert(!#is_defined(
	values.f_ecology_apply_facility_completion(runtime_base, 'RecyclingTanks')
));
const clean_completion = values.f_ecology_apply_facility_completion(
	runtime_base,
	'CentauriPreserve'
);
test.assert(clean_completion.facility_id == 'CentauriPreserve');
test.assert(runtime_clean_mineral_facilities == 1);
values.f_ecology_rollback_facility_completion(clean_completion);
test.assert(runtime_clean_mineral_facilities == 0);

callbacks.turn({});
test.assert(#sizeof(submitted_events) == 1);
test.assert(submitted_events[0].name == 'fungal_bloom');
test.assert(submitted_events[0].data.base == runtime_base);
test.assert(submitted_events[0].data.tile == runtime_tile);
test.assert(submitted_events[0].data.damage >= 100);

let volcano_tile = null;
volcano_tile = {
	x: 0,
	y: 0,
	is_water: true,
	features: {volcano: false},
	landmarks: {mount_planet: false},
	get_surrounding_tiles: () => { return [volcano_tile]; },
	get_base: () => { return null; },
	get_units: (include_embarked) => { return []; },
	is_locked: () => { return false; },
};
game.get_tm = () => {
	return {
		get_sea_level: () => { return sea_level; },
		get_climate_state: () => { return #clone(climate_state); },
		set_climate_state: (level, future_change, progress) => {
			climate_state = {
				level: level,
				future_change: future_change,
				progress: progress,
			};
		},
		get_map_width: () => { return 1; },
		get_map_height: () => { return 1; },
		get_tile: (x, y) => { return volcano_tile; },
	};
};
runtime_ecological_damage_events = 10;
callbacks.turn({});
test.assert(#sizeof(submitted_events) == 3);
test.assert(submitted_events[2].name == 'create_volcano');
test.assert(submitted_events[2].data.tile == volcano_tile);
volcano_tile.features.volcano = true;
test.assert(values.f_ecology_has_dynamic_volcano());
test.assert(!values.f_ecology_can_create_volcano());

is_master = false;
callbacks.turn({});
test.assert(#sizeof(submitted_events) == 3);
