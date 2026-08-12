const define_exploration = #include('../default/game/exploration');
const reveal_map_tiles = #include('../default/game/event/reveal_map_tiles');

const callbacks = {};
const values = {};
let events = [];
let triggers = [];
let players = [];
const um = {
	get_units: () => { return []; },
};
const bm = {
	get_bases: () => { return []; },
};
const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, value) => { values[name] = value; },
	get: (name) => { return values[name]; },
	is_master: () => { return true; },
	event: (name, data) => { events :+{name: name, data: data}; },
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
	get_um: () => { return um; },
	get_bm: () => { return bm; },
	get_player: (id) => { return players[id]; },
	get_players: () => { return players; },
};

const center = {x: 2, y: 2, neighbours: []};
center.get_surrounding_tiles = () => { return center.neighbours; };
const west = {x: 0, y: 2, neighbours: []};
west.get_surrounding_tiles = () => { return west.neighbours; };
const east = {x: 4, y: 2, neighbours: []};
east.get_surrounding_tiles = () => { return east.neighbours; };
const far = {x: 6, y: 2, neighbours: []};
far.get_surrounding_tiles = () => { return far.neighbours; };
center.neighbours = [west, east];
west.neighbours = [];
east.neighbours = [far];
far.neighbours = [];

const make_player = (id) => {
	let explored = {};
	let relations = {};
	return {
		id: id,
		get_diplomatic_relation: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(relations[key]) ? relations[key] : 'neutral';
		},
		set_diplomatic_relation: (other, relation) => {
			relations['p' + #to_string(other.id)] = relation;
		},
		has_explored: (tile) => {
			return #is_defined(explored[#to_string(tile.x) + '_' + #to_string(tile.y)]);
		},
		set_explored: (tile, value) => {
			const key = #to_string(tile.x) + '_' + #to_string(tile.y);
			explored[key] = value ? true : #undefined;
		},
		get_explored_tiles: () => {
			let result = [];
			for (tile of [center, west, east, far]) {
				if (#is_defined(explored[#to_string(tile.x) + '_' + #to_string(tile.y)])) {
					result :+tile;
				}
			}
			return result;
		},
	};
};

const alpha = make_player(0);
const beta = make_player(1);
players = [alpha, beta];
define_exploration(game);
callbacks.start({});

center.terraforming = {sensor: true};
values.f_territory_get_owner = (tile) => { return alpha; };
callbacks.terraforming_completed({type: 'sensor', tile: center});
test.assert(#sizeof(events) == 1 && #sizeof(events[0].data.tiles) == 4);
events = [];

test.assert(#sizeof(values.f_exploration_get_tiles_in_radius(center, 1)) == 3);
test.assert(#sizeof(values.f_exploration_get_tiles_in_radius(center, 2)) == 4);

let reveal = {
	caller: 0,
	game: game,
	data: {player: alpha, tiles: [center, west, east]},
};
test.assert(!#is_defined(reveal_map_tiles.validate(reveal)));
reveal.applied = reveal_map_tiles.apply(reveal);
test.assert(alpha.has_explored(center) && alpha.has_explored(west));
test.assert(#sizeof(reveal.applied.tiles) == 3 && #sizeof(triggers) == 1);
reveal_map_tiles.rollback(reveal);
test.assert(!alpha.has_explored(center) && !alpha.has_explored(west));

reveal.data.tiles = [center, center];
test.assert(#is_defined(reveal_map_tiles.validate(reveal)));
reveal.data.tiles = [center, west];
reveal.caller = 1;
test.assert(#is_defined(reveal_map_tiles.validate(reveal)));
reveal.caller = 0;

values.f_exploration_queue_at_tile(alpha, center);
test.assert(#sizeof(events) == 1 && events[0].name == 'reveal_map_tiles');
test.assert(#sizeof(events[0].data.tiles) == 3);
events = [];
const radar_unit = {get_def: () => { return {abilities: ['DeepRadar']}; }};
values.f_exploration_queue_at_tile(alpha, center, radar_unit);
test.assert(#sizeof(events) == 1 && #sizeof(events[0].data.tiles) == 4);

values.f_exploration_apply_reveal(alpha, [center, west, east]);
values.f_exploration_apply_reveal(beta, [center]);
test.assert(values.f_exploration_count_shareable_tiles(alpha, beta) == 2);
const shared = values.f_exploration_apply_map_share(alpha, beta);
test.assert(beta.has_explored(west) && beta.has_explored(east));
values.f_exploration_rollback_reveal(shared);
test.assert(beta.has_explored(center) && !beta.has_explored(west));

alpha.set_diplomatic_relation(beta, 'pact');
beta.set_diplomatic_relation(alpha, 'pact');
const pact_reveal = values.f_exploration_apply_reveal(alpha, [far]);
test.assert(alpha.has_explored(far) && beta.has_explored(far));
values.f_exploration_rollback_reveal(pact_reveal);
test.assert(!alpha.has_explored(far) && !beta.has_explored(far));

test.assert(true);
