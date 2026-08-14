const unity_pods = #include('../default/game/ai/unity_pods');

const make_tile = (x, pod) => {
	let neighbours = [];
	return {
		x: x,
		y: 0,
		is_land: true,
		is_water: false,
		features: {unity_pod: pod},
		get_surrounding_tiles: () => { return neighbours; },
		set_neighbours: (values) => { neighbours = values; },
	};
};

const source = make_tile(0, false);
const near = make_tile(2, true);
const detour = make_tile(4, false);
const far = make_tile(6, true);
const tail = make_tile(8, false);
source.set_neighbours([near, detour]);
near.set_neighbours([source]);
detour.set_neighbours([source, far]);
far.set_neighbours([detour, tail]);
tail.set_neighbours([far]);
const tiles = [source, near, detour, far, tail];
let tile_lookups = 0;
const tm = {
	get_tile: (x, y) => {
		tile_lookups++;
		for (tile of tiles) {
			if (tile.x == x) { return tile; }
		}
		return null;
	},
};
let explored = [source, near, detour, far];
const player = {
	has_explored: (candidate) => {
		for (tile of explored) {
			if (tile == candidate) { return true; }
		}
		return false;
	},
	get_explored_tiles: () => { return explored; },
};
const game = {
	get_tm: () => { return tm; },
	get_player: (id) => { return player; },
};
const definition = {weapon: 'HandWeapons'};
let unit = {
	owner: 1,
	is_air: false,
	is_immovable: false,
	is_land: true,
	is_water: false,
	get_tile: () => { return source; },
	get_def: () => { return definition; },
};
const can_enter = (from, tile) => { return true; };
let destination = unity_pods.choose_destination(game, unit, can_enter);
test.assert(destination.target == near && destination.step == near && destination.distance == 1);

near.features.unity_pod = false;
destination = unity_pods.choose_destination(game, unit, can_enter);
test.assert(destination.target == far && destination.step == detour && destination.distance == 2);

near.features.unity_pod = false;
far.features.unity_pod = false;
tile_lookups = 0;
test.assert(unity_pods.choose_destination(game, unit, can_enter) == null);
test.assert(tile_lookups == 0);
near.features.unity_pod = true;
far.features.unity_pod = true;

explored = [source, detour];
test.assert(unity_pods.choose_destination(game, unit, can_enter) == null);
explored = [source, near, detour, far];

unit.is_air = true;
test.assert(unity_pods.choose_destination(game, unit, can_enter) == null);
unit.is_air = false;
definition.weapon = 'AlienArtifact';
test.assert(unity_pods.choose_destination(game, unit, can_enter) == null);
