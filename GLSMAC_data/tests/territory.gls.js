const define_territory = #include('../default/game/territory');

const callbacks = {};
const values = {};
let bases = [];
const distance = (a, b) => { return a.x < b.x ? b.x - a.x : a.x - b.x; };
const game = {
	get_bm: () => { return {get_bases: () => { return bases; }}; },
	get_tm: () => { return {get_distance: distance}; },
	on: (name, callback) => { callbacks[name] = callback; },
	set: (key, value) => { values[key] = value; },
};

const make_tile = (x, is_water) => {
	let surrounding = [];
	let base = null;
	return {
		x: x,
		y: 0,
		is_water: is_water,
		get_surrounding_tiles: () => { return surrounding; },
		set_surrounding_tiles: (tiles) => { surrounding = tiles; },
		get_base: () => { return base; },
		set_base: (value) => { base = value; },
	};
};

const connect = (a, b) => {
	let a_surrounding = a.get_surrounding_tiles();
	a_surrounding :+b;
	a.set_surrounding_tiles(a_surrounding);
	let b_surrounding = b.get_surrounding_tiles();
	b_surrounding :+a;
	b.set_surrounding_tiles(b_surrounding);
};

const make_line = (count, is_water) => {
	let result = [];
	for (let i = 0; i < count; i++) {
		result :+make_tile(i, is_water);
		if (i > 0) {
			connect(result[i - 1], result[i]);
		}
	}
	return result;
};

const player_one = {id: 1, name: 'One'};
const player_two = {id: 2, name: 'Two'};
const make_base = (id, owner, tile) => {
	const base = {
		id: id,
		get_owner: () => { return owner; },
		get_tile: () => { return tile; },
	};
	tile.set_base(base);
	return base;
};

define_territory(game);
callbacks.start({});

const land = make_line(14, false);
const oldest = make_base(1, player_one, land[0]);
const newer = make_base(2, player_two, land[4]);
bases = [newer, oldest];
const tie_claim = values.f_territory_get_base(land[2]);
test.assert(tie_claim == oldest);
test.assert(values.f_territory_get_owner(land[3]) == player_two);
test.assert(values.f_territory_is_friendly(player_two, land[3]));
test.assert(values.f_territory_get_owner(land[13]) == null);
test.assert(values.f_territory_get_max_distance() == 8);

const coast = [make_tile(0, false), make_tile(1, true), make_tile(2, true), make_tile(3, true)];
for (let i = 1; i < #sizeof(coast); i++) {
	connect(coast[i - 1], coast[i]);
}
const coastal_base = make_base(3, player_one, coast[0]);
bases = [coastal_base];
test.assert(values.f_territory_get_owner(coast[2]) == player_one);
test.assert(values.f_territory_get_owner(coast[3]) == null);

const sea = make_line(9, true);
const sea_base = make_base(4, player_two, sea[5]);
bases = [sea_base];
test.assert(values.f_territory_get_owner(sea[8]) == player_two);
const dry_near_sea_base = make_tile(6, false);
test.assert(values.f_territory_get_owner(dry_near_sea_base) == null);

const connected_base_tile = make_tile(0, false);
const land_step_one = make_tile(1, false);
const land_step_two = make_tile(2, false);
const contested_land = make_tile(4, false);
connect(connected_base_tile, land_step_one);
connect(land_step_one, land_step_two);
connect(land_step_two, contested_land);
const disconnected_base_tile = make_tile(5, false);
const ocean_barrier = make_tile(3, true);
connect(contested_land, ocean_barrier);
connect(ocean_barrier, disconnected_base_tile);
const connected_base = make_base(5, player_one, connected_base_tile);
const disconnected_base = make_base(6, player_two, disconnected_base_tile);
bases = [connected_base, disconnected_base];
test.assert(values.f_territory_get_owner(contested_land) == player_one);

const connected_sea_base_tile = make_tile(10, true);
const connected_water = make_tile(11, true);
const contested_water = make_tile(13, true);
connect(connected_sea_base_tile, connected_water);
connect(connected_water, contested_water);
const land_barrier = make_tile(12, false);
const disconnected_sea_base_tile = make_tile(14, true);
connect(contested_water, land_barrier);
connect(land_barrier, disconnected_sea_base_tile);
const connected_sea_base = make_base(7, player_one, connected_sea_base_tile);
const disconnected_sea_base = make_base(8, player_two, disconnected_sea_base_tile);
bases = [connected_sea_base, disconnected_sea_base];
test.assert(values.f_territory_get_owner(contested_water) == player_one);
