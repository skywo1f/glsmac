const move_unit_to = #include('../default/game/event/move_unit_to');

const make_tile = (x) => {
	let neighbours = [];
	let units = [];
	return {
		x: x,
		y: 0,
		is_land: true,
		is_water: false,
		set_neighbours: (value) => { neighbours = value; },
		set_units: (value) => { units = value; },
		get_surrounding_tiles: () => { return neighbours; },
		get_units: () => { return units; },
		get_base: () => { return null; },
		is_locked: () => { return false; },
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

const source = make_tile(0);
const first = make_tile(1);
const second = make_tile(2);
const destination = make_tile(3);
source.set_neighbours([first]);
first.set_neighbours([source, second]);
second.set_neighbours([first, destination]);
destination.set_neighbours([second]);
const tiles = [source, first, second, destination];
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

let current_tile = source;
const owner = {id: 1};
const unit = {
	owner: owner.id,
	health: 1.0,
	is_land: true,
	is_water: false,
	is_air: false,
	is_immovable: false,
	terraforming: 'none',
	movement: 3.0,
	get_tile: () => { return current_tile; },
	get_owner: () => { return owner; },
	get_def: () => { return {weapon: 'HandWeapons', abilities: []}; },
};
let moved_to = [];
const game = {
	is_master: () => { return true; },
	is_turn_complete: (player_id) => { return false; },
	get_tm: () => { return tm; },
	event_as: (caller, name, data) => {
		test.assert(caller == owner.id && name == 'move_unit');
		test.assert(current_tile.is_adjactent_to(data.tile));
		current_tile = data.tile;
		unit.movement = unit.movement - 1.0;
		moved_to :+data.tile;
	},
};
const event = {
	caller: owner.id,
	game: game,
	data: {unit: unit, tile: destination},
};

test.assert(!#is_defined(move_unit_to.validate(event)));
const applied = move_unit_to.apply(event);
test.assert(applied.steps == 3);
test.assert(current_tile == destination);
test.assert(moved_to == [first, second, destination]);

current_tile = source;
unit.movement = 3.0;
moved_to = [];
destination.set_units([{owner: 2, is_land: true, is_water: false, is_air: false}]);
const blocked = move_unit_to.apply(event);
test.assert(blocked.steps == 0);
test.assert(current_tile == source && #sizeof(moved_to) == 0);

const exhausted_unit = #clone(unit);
exhausted_unit.movement = 0.0;
test.assert(#is_defined(move_unit_to.validate({
	caller: owner.id,
	game: game,
	data: {unit: exhausted_unit, tile: destination},
})));
test.assert(#is_defined(move_unit_to.validate({
	caller: 2,
	game: game,
	data: {unit: unit, tile: destination},
})));
