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

const make_combat_unit = (owner_id, tile, offense) => {
	return {
		owner: owner_id,
		get_tile: () => { return tile; },
		get_def: () => { return {offense: offense}; },
	};
};

const home_tile = make_tile(0, 0);
const home_base = make_base(player_id, home_tile);
const near_enemy_tile = make_tile(2, 0);
const second_enemy_tile = make_tile(0, 2);
const far_enemy_tile = make_tile(4, 0);
const near_enemy = make_combat_unit(other_player_id, near_enemy_tile, 1);
const second_enemy = make_combat_unit(other_player_id, second_enemy_tile, 2);
const far_enemy = make_combat_unit(other_player_id, far_enemy_tile, 2);
const friendly = make_combat_unit(player_id, near_enemy_tile, 2);
const colony = make_combat_unit(other_player_id, near_enemy_tile, 0);

test.assert(combat.get_required_garrison(tm, home_base, player_id, []) == 1);
test.assert(combat.get_required_garrison(tm, home_base, player_id, [near_enemy]) == 2);
test.assert(combat.get_required_garrison(tm, home_base, player_id, [near_enemy, second_enemy]) == 3);
test.assert(combat.get_required_garrison(tm, home_base, player_id, [near_enemy, second_enemy, far_enemy]) == 3);
test.assert(combat.get_required_garrison(tm, home_base, player_id, [friendly, colony, far_enemy]) == 1);
