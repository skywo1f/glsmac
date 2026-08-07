const define_bases = #include('../default/game/bases');

const callbacks = {};
const values = {};
let events = [];
const game = {
	get_bm: () => {
		return {
			on: (name, callback) => {},
			get_bases: () => { return []; },
		};
	},
	get_tm: () => {
		return {
			get_map_width: () => { return 20; },
			get_map_height: () => { return 10; },
		};
	},
	event: (name, data) => {
		events :+{name: name, data: data};
	},
	on: (name, callback) => {
		callbacks[name] = callback;
	},
	set: (key, value) => {
		values[key] = value;
	},
	get: (key) => {
		return values[key];
	},
	is_master: () => { return true; },
};

define_bases(game);
callbacks.start({});
events = [];

const owner = {id: 1};
const make_tile = (x, nutrients, minerals, energy) => {
	let working_pop = #undefined;
	return {
		x: x,
		y: 0,
		get_resources: (player) => {
			test.assert(player == owner);
			return {
				NUTRIENTS: nutrients,
				MINERALS: minerals,
				ENERGY: energy,
			};
		},
		get: (key) => {
			return key == 'working_pop' ? working_pop : #undefined;
		},
		set_working_pop: (pop) => {
			working_pop = pop;
		},
	};
};

const mineral_tile = make_tile(1, 0, 4, 0);
const nutrient_tile = make_tile(2, 2, 0, 0);
let accumulated_nutrients = 20;
let base_size = 1;
let intake_nutrients = 2;
let consumption_nutrients = 2;
let unworked_tiles = [mineral_tile, nutrient_tile];
let worked_tiles = [];
let pops = [];
const base = {
	get_owner: () => { return owner; },
	get_size: () => { return base_size; },
	get_intake: () => { return {NUTRIENTS: intake_nutrients, MINERALS: 1, ENERGY: 1}; },
	get_consumption: () => { return {NUTRIENTS: consumption_nutrients, MINERALS: 0, ENERGY: 0}; },
	get_unworked_tiles: () => { return unworked_tiles; },
	get_worked_tiles: () => { return worked_tiles; },
	get_pops: () => { return pops; },
	get: (key) => {
		test.assert(key == 'accumulated_nutrients');
		return accumulated_nutrients;
	},
	set: (key, value) => {
		test.assert(key == 'accumulated_nutrients');
		accumulated_nutrients = value;
	},
};

const find_tiles = values.f_base_find_best_or_worst_tiles;
test.assert((find_tiles(base, [mineral_tile, nutrient_tile], 1, 1))[0] == mineral_tile);
test.assert((find_tiles(base, [mineral_tile, nutrient_tile], 1, 1, 2))[0] == nutrient_tile);

values.f_base_process_growth(game, base);
test.assert(#sizeof(events) == 1);
test.assert(events[0].name == 'add_base_pop');
test.assert(events[0].data.base == base);
test.assert(events[0].data.type == 'WORKER');
test.assert(events[0].data.worked_tile == nutrient_tile);

const mineral_pop = {has: (key) => { return key == 'worked_tile'; }};
const nutrient_pop = {has: (key) => { return key == 'worked_tile'; }};
mineral_tile.set_working_pop(mineral_pop);
nutrient_tile.set_working_pop(nutrient_pop);
events = [];
base_size = 2;
intake_nutrients = 2;
consumption_nutrients = 4;
unworked_tiles = [];
worked_tiles = [mineral_tile, nutrient_tile];
pops = [mineral_pop, nutrient_pop];
accumulated_nutrients = 0 - 1;

values.f_base_process_growth(game, base);
test.assert(#sizeof(events) == 1);
test.assert(events[0].name == 'remove_base_pop');
test.assert(events[0].data.base == base);
test.assert(events[0].data.pop == mineral_pop);
