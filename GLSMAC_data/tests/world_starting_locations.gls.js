const make_tile = (x, y, is_water) => {
	return {x: x, y: y, is_water: is_water};
};

let tiles = {};
for (let y = 0; y < 2; y++) {
	for (let x = y % 2; x < 6; x += 2) {
		tiles[#to_string(x) + '_' + #to_string(y)] = make_tile(x, y, false);
	}
}
const tm = {
	get_map_width: () => { return 6; },
	get_map_height: () => { return 2; },
	get_tile: (x, y) => { return tiles[#to_string(x) + '_' + #to_string(y)]; },
	get_distance: (a, b) => { return #abs(a.x - b.x) + #abs(a.y - b.y); },
};
let spawned_keys = [];
const players = [
	{id: 1, get_faction: () => { return {is_naval: false}; }},
	{id: 2, get_faction: () => { return {is_naval: false}; }},
	{id: 3, get_faction: () => { return {is_naval: false}; }},
	{id: 4, get_faction: () => { return {is_naval: false}; }},
	{id: 5, get_faction: () => { return {is_naval: false}; }},
	{id: 6, get_faction: () => { return {is_naval: false}; }},
];
const game = {
	random: {get_int: (minimum, maximum) => { return minimum; }},
	get_players: () => { return players; },
	get_tm: () => { return tm; },
	event: (name, data) => {
		if (name == 'spawn_base') {
			spawned_keys :+(#to_string(data.tile.x) + '_' + #to_string(data.tile.y));
		}
	},
};

#include('../default/game/world/default')(game);
test.assert(#sizeof(spawned_keys) == #sizeof(players));
let seen = {};
for (key of spawned_keys) {
	test.assert(!#is_defined(seen[key]));
	seen[key] = true;
}
