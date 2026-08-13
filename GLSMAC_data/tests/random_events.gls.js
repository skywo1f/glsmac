const configure_random_events = #include('../default/game/random_events');

let callbacks = {};
let registered_events = {};
let values = {};
let messages = [];
let events = [];
let dust_duration = 2;
let random_values = [0, 14];
let random_index = 0;
let game_context = null;
let is_master = true;

const owner = {
	id: 1,
	has_explored: (tile) => { return true; },
};

let tiles = [];
const make_tile = (x, y, elevation, mount_planet) => {
	const tile = {
		x: x,
		y: y,
		elevation: elevation,
		landmarks: {mount_planet: mount_planet},
	};
	tiles :+tile;
	return tile;
};
const ordinary = make_tile(0, 0, 1000, false);
const mount_slope = make_tile(2, 0, 2000, true);
const mount_peak = make_tile(4, 0, 3000, true);

const selected_tile = ordinary;
let bases = [];
for (let i = 0; i < 8; i++) {
	let base = {
		id: i + 1,
		name: 'Base ' + #to_string(i + 1),
		size: i == 0 ? 5 : 1,
	};
	base.get_owner = () => { return owner; };
	base.get_size = () => { return base.size; };
	base.get_tile = () => { return selected_tile; };
	bases :+base;
}

const tm = {
	get_map_width: () => { return 6; },
	get_map_height: () => { return 1; },
	get_tile: (x, y) => {
		for (tile of tiles) {
			if (tile.x == x && tile.y == y) { return tile; }
		}
		return ordinary;
	},
	get_distance: (first, second) => { return 5; },
	get_climate_state: () => { return {dust_cloud_duration: dust_duration}; },
	set_dust_cloud_duration: (duration) => { dust_duration = duration; },
};

const game = {
	random: {
		get_int: (minimum, maximum) => {
			const result = random_values[random_index];
			random_index++;
			return result;
		},
	},
	get_year: () => { return 2200; },
	get_bm: () => { return {get_bases: () => { return bases; }}; },
	get_tm: () => { return tm; },
	is_master: () => { return is_master; },
	on: (name, callback) => { callbacks[name] = callback; },
	register_event: (name, definition) => { registered_events[name] = definition; },
	set: (name, value) => { values[name] = value; },
	message: (message) => { messages :+message; },
	event: (name, data) => {
		events :+{name: name, data: data};
		if (#is_defined(registered_events[name])) {
			const definition = registered_events[name];
			const e = {game: game_context, caller: 0, data: data};
			const error = definition.validate(e);
			test.assert(!#is_defined(error));
			e.applied = definition.apply(e);
		}
	},
};
game_context = game;

configure_random_events(game);
callbacks.start({});
test.assert(values.f_random_events_find_mount_planet_center(tm) == mount_peak);
test.assert(values.f_random_events_select_major_eruption() == bases[0]);

random_values = [0, 14];
random_index = 0;
callbacks.turn({});
test.assert(dust_duration == 1);
test.assert(#sizeof(events) == 2);
test.assert(events[0].name == 'advance_dust_cloud');
test.assert(events[1].name == 'major_volcanic_eruption');
test.assert(events[1].data.base == bases[0]);

random_values = [99];
random_index = 0;
callbacks.turn({});
test.assert(dust_duration == 0);
test.assert(#sizeof(messages) == 1);
test.assert(#sizeof(events) == 3);
test.assert(events[2].name == 'advance_dust_cloud');

random_values = [99];
random_index = 0;
callbacks.turn({});
test.assert(dust_duration == 0);
test.assert(#sizeof(messages) == 1);
test.assert(#sizeof(events) == 3);

is_master = false;
dust_duration = 2;
callbacks.turn({});
test.assert(dust_duration == 2);
test.assert(#sizeof(events) == 3);
is_master = true;

const advance = registered_events.advance_dust_cloud;
dust_duration = 2;
const applied = advance.apply({game: game});
test.assert(applied == 2);
test.assert(dust_duration == 1);
advance.rollback({game: game, applied: applied});
test.assert(dust_duration == 2);
test.assert(#is_defined(advance.validate({caller: 1})));
