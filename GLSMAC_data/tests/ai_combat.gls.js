const combat = #include('../default/game/ai/combat');

const player_id = 1;
const other_player_id = 2;

const make_tile = (x, y) => {
	let base = null;
	return {
		x: x,
		y: y,
		get_base: () => { return base; },
		set_base: (value) => { base = value; },
	};
};

const make_base = (owner_id, tile) => {
	const base = {
		get_owner: () => { return {id: owner_id}; },
		get_tile: () => { return tile; },
	};
	tile.set_base(base);
	return base;
};

const make_unit = (tile, health) => {
	return {
		health: health,
		get_tile: () => { return tile; },
	};
};

const tm = {
	get_distance: (first, second) => {
		return #abs(first.x - second.x) + #abs(first.y - second.y);
	},
};

const field = make_tile(5, 5);
const north_tile = make_tile(5, 3);
const west_tile = make_tile(3, 5);
const enemy_tile = make_tile(5, 4);
const north_base = make_base(player_id, north_tile);
const west_base = make_base(player_id, west_tile);
const enemy_base = make_base(other_player_id, enemy_tile);
const bases = [enemy_base, north_base, west_base];

test.assert(combat.find_nearest_friendly_base(tm, player_id, field, bases) == north_base);
test.assert(combat.find_nearest_friendly_base(tm, player_id, field, [enemy_base]) == null);

test.assert(combat.get_repair_destination(tm, make_unit(field, 0.49), player_id, bases) == north_base);
test.assert(combat.get_repair_destination(tm, make_unit(field, 0.5), player_id, bases) == null);

test.assert(combat.get_repair_destination(tm, make_unit(north_tile, 0.79), player_id, bases) == north_base);
test.assert(combat.get_repair_destination(tm, make_unit(north_tile, 0.8), player_id, bases) == null);
test.assert(combat.get_repair_destination(tm, make_unit(enemy_tile, 0.49), player_id, bases) == north_base);
