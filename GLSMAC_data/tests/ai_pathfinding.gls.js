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
const tail = make_tile(5, true);

source.set_neighbours([water, detour_a]);
water.set_neighbours([source, destination]);
detour_a.set_neighbours([source, detour_b]);
detour_b.set_neighbours([detour_a, destination]);
destination.set_neighbours([water, detour_b, tail]);
tail.set_neighbours([destination]);

const unit = {get_tile: () => { return source; }};
const can_enter = (source_tile, tile) => { return tile.passable; };
const tiles = [source, water, detour_a, detour_b, destination, tail];
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
test.assert(pathfinding.find_path_step(tm, unit, destination, can_enter, 1) == null);
test.assert(pathfinding.find_path_step(tm, unit, destination, can_enter, 2) == detour_a);
const destination_score = (tile, distance) => {
	return tile == destination ? 100 - distance : null;
};
let best = pathfinding.find_best_reachable(tm, unit, can_enter, destination_score);
test.assert(best.target == destination);
test.assert(best.step == detour_a);
test.assert(best.distance == 3);
detour_b.passable = false;
test.assert(pathfinding.find_path_step(tm, unit, destination, can_enter) == null);
test.assert(pathfinding.find_best_reachable(tm, unit, can_enter, destination_score) == null);

const source_score = (tile, distance) => {
	return tile == source ? 10 : null;
};
best = pathfinding.find_best_reachable(tm, unit, can_enter, source_score);
test.assert(best.target == source);
test.assert(best.step == null);
test.assert(best.distance == 0);

detour_b.passable = true;
test.assert(pathfinding.find_best_reachable(tm, unit, can_enter, destination_score, 2) == null);
best = pathfinding.find_best_reachable(tm, unit, can_enter, destination_score, 3);
test.assert(best.target == destination && best.distance == 3);

let tail_scored = false;
const counted_destination_score = (tile, distance) => {
	if (tile == tail) {
		tail_scored = true;
	}
	return destination_score(tile, distance);
};
best = pathfinding.find_best_reachable(
	tm,
	unit,
	can_enter,
	counted_destination_score,
	#undefined,
	1
);
test.assert(best.target == destination && best.distance == 3);
test.assert(!tail_scored);
test.assert(
	pathfinding.find_best_reachable(
		tm,
		unit,
		can_enter,
		counted_destination_score,
		#undefined,
		0
	) == null
);

let farther_layer_scored = false;
const nearest_target_score = (tile, distance) => {
	if (tile == detour_b) {
		farther_layer_scored = true;
	}
	return tile == detour_a ? 1000 - distance * 100 : null;
};
best = pathfinding.find_best_reachable(
	tm,
	unit,
	can_enter,
	nearest_target_score,
	#undefined,
	#undefined,
	true
);
test.assert(best.target == detour_a && best.distance == 1);
test.assert(!farther_layer_scored);
