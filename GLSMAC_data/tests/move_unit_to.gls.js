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
let current_target = null;
const owner = {id: 1};
const unit = {
	id: 1,
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
	get_move_target: () => { return current_target; },
	set_move_target: (tile) => { current_target = tile; },
	clear_move_target: () => { current_target = null; },
};
let moved_to = [];
let attacked = null;
const game = {
	is_master: () => { return true; },
	is_turn_complete: (player_id) => { return false; },
	get_tm: () => { return tm; },
	event_for: (caller, name, data) => {
		test.assert(caller == owner.id);
		if (name == 'attack_unit') {
			attacked = data.defender;
			return;
		}
		test.assert(name == 'move_unit' && data.preserve_move_target);
		test.assert(current_tile.is_adjactent_to(data.tile));
		current_tile = data.tile;
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
test.assert(applied.steps == 1 && current_tile == first);
test.assert(current_target == destination && !applied.attacked);
move_unit_to.apply(event);
const completed = move_unit_to.apply(event);
test.assert(completed.steps == 1 && current_tile == destination);
test.assert(moved_to == [first, second, destination] && current_target == destination);
const arrived = move_unit_to.apply(event);
test.assert(arrived.steps == 0 && current_target == null);

current_tile = source;
unit.movement = 3.0;
moved_to = [];
const first_turn = move_unit_to.apply(event);
test.assert(first_turn.steps == 1 && current_tile == first);
test.assert(current_target == destination);
const second_turn = move_unit_to.apply(event);
test.assert(second_turn.steps == 1 && current_tile == second);
test.assert(current_target == destination);

current_tile = source;
unit.movement = 3.0;
moved_to = [];
const enemy = {
	id: 2,
	owner: 2,
	health: 1.0,
	is_land: true,
	is_water: false,
	is_air: false,
	transport_id: 0,
	get_tile: () => { return destination; },
};
destination.set_units([enemy]);
move_unit_to.apply(event);
move_unit_to.apply(event);
const combat_move = move_unit_to.apply(event);
test.assert(combat_move.steps == 0 && combat_move.attacked);
test.assert(current_tile == second && attacked == enemy && current_target == null);

current_tile = source;
unit.movement = 3.0;
moved_to = [];
attacked = null;
destination.set_units([]);
first.set_units([enemy]);
const blocked = move_unit_to.apply(event);
test.assert(blocked.steps == 0 && !blocked.attacked);
test.assert(current_tile == source && #sizeof(moved_to) == 0 && current_target == null);
first.set_units([]);

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
