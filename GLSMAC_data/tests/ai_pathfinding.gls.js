const pathfinding = #include('../default/game/ai/pathfinding');

const make_tile = (x, passable) => {
	let neighbours = [];
	return {
		x: x,
		y: 0,
		passable: passable,
		get_surrounding_tiles: () => { return neighbours; },
		set_neighbours: (tiles) => { neighbours = tiles; },
		is_adjactent_to: (tile) => {
			for (candidate of neighbours) {
				if (candidate == tile) {
					return true;
				}
			}
			return false;
		},
	};
};

const source = make_tile(0, true);
const water = make_tile(1, false);
const detour_a = make_tile(2, true);
const detour_b = make_tile(3, true);
const destination = make_tile(4, true);

source.set_neighbours([water, detour_a]);
water.set_neighbours([source, destination]);
detour_a.set_neighbours([source, detour_b]);
detour_b.set_neighbours([detour_a, destination]);
destination.set_neighbours([water, detour_b]);

const unit = {get_tile: () => { return source; }};
const can_enter = (source_tile, tile) => { return tile.passable; };
const tiles = [source, water, detour_a, detour_b, destination];
const tm = {
	get_tile: (x, y) => {
		for (tile of tiles) {
			if (tile.x == x && tile.y == y) {
				return tile;
			}
		}
		return null;
	},
};

test.assert(pathfinding.find_path_step(tm, unit, destination, can_enter) == detour_a);
detour_b.passable = false;
test.assert(pathfinding.find_path_step(tm, unit, destination, can_enter) == null);
