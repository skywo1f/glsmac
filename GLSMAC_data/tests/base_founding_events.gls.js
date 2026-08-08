const found_base = #include('../default/game/event/found_base');

const owner = {id: 1};
const work_tile = {
	x: 8,
	y: 8,
	get_base: () => { return null; },
	has: (key) => { return false; },
};
const occupied_work_tile = {
	x: 9,
	y: 8,
	get_base: () => { return null; },
	has: (key) => { return key == 'working_pop'; },
};
const validation_state = {
	site_base: null,
	nearby_base: null,
	occupants: [],
	can_found_base: true,
	turn_complete: false,
	site_locked: false,
};

const nearby_tile = {
	get_base: () => {
		return validation_state.nearby_base;
	},
};

const site = {
	x: 6,
	y: 6,
	is_water: false,
	is_locked: () => {
		return validation_state.site_locked;
	},
	get_base: () => {
		return validation_state.site_base;
	},
	get_surrounding_tiles: () => {
		return [nearby_tile];
	},
	get_units: () => {
		return validation_state.occupants;
	},
};

const unit = {
	id: 42,
	def: 'ColonyPod',
	owner: owner.id,
	movement: 1.0,
	morale: 2,
	health: 0.75,
	moved_this_turn: false,
	get_def: () => {
		return {can_found_base: validation_state.can_found_base};
	},
	get_owner: () => {
		return owner;
	},
	get_tile: () => {
		return site;
	},
};

const validation_event = {
	caller: owner.id,
	game: {
		is_turn_complete: (id) => {
			test.assert(id == owner.id);
			return validation_state.turn_complete;
		},
	},
	data: {unit: unit},
};

validation_event.data.unit.owner = 2;
const wrong_owner_result = found_base.validate(validation_event);
test.assert(wrong_owner_result == 'A colony pod can only be ordered by its owner');

validation_event.data.unit.owner = owner.id;
validation_state.turn_complete = true;
test.assert(found_base.validate(validation_event) == 'Player has already completed this turn');

validation_state.turn_complete = false;
validation_state.can_found_base = false;
test.assert(found_base.validate(validation_event) == 'Unit cannot found a base');

validation_state.can_found_base = true;
validation_event.data.unit.movement = 0.0;
test.assert(found_base.validate(validation_event) == 'Colony pod is out of moves');

validation_event.data.unit.movement = 1.0;
validation_state.site_locked = true;
test.assert(found_base.validate(validation_event) == 'Base site is locked');

validation_state.site_locked = false;
site.is_water = true;
test.assert(found_base.validate(validation_event) == 'Land bases cannot be founded at sea');

site.is_water = false;
validation_state.site_base = {id: 8};
test.assert(found_base.validate(validation_event) == 'Tile already contains a base');

validation_state.site_base = null;
validation_state.nearby_base = {id: 9};
test.assert(found_base.validate(validation_event) == 'Bases cannot be founded on adjacent tiles');

validation_state.nearby_base = null;
validation_state.occupants = [{owner: 2}];
test.assert(found_base.validate(validation_event) == 'Base site contains an enemy unit');

validation_state.occupants = [unit, {owner: owner.id}];
test.assert(!#is_defined(found_base.validate(validation_event)));
test.assert(#is_defined(found_base.resolve(validation_event)));

validation_event.data.name = 1;
test.assert(#is_defined(found_base.validate(validation_event)));
validation_event.data.name = '';
test.assert(#is_defined(found_base.validate(validation_event)));
let long_base_name = '';
while (#sizeof(long_base_name) < 64) {
	long_base_name += 'x';
}
validation_event.data.name = long_base_name;
test.assert(!#is_defined(found_base.validate(validation_event)));
validation_event.data.name = long_base_name + 'x';
test.assert(#is_defined(found_base.validate(validation_event)));
validation_event.data.name = #undefined;

{
	const state = {
		active_unit: unit,
		restored_unit: null,
		spawned_info: null,
		despawned_base: null,
		created_pop: null,
		worked_pop: null,
		worked_tile: null,
	};

	const base = {
		id: 88,
		create_pop: (data) => {
			test.assert(data.type == 'WORKER');
			state.created_pop = {id: 1, type: data.type};
			return state.created_pop;
		},
		get_unworked_tiles: () => {
			return [occupied_work_tile, work_tile];
		},
	};

	const game = {
		bm: {
			spawn_base: (base_owner, tile, info) => {
				test.assert(base_owner == owner);
				test.assert(tile == site);
				state.spawned_info = info;
				validation_state.site_base = base;
				return base;
			},
			despawn_base: (value) => {
				test.assert(value == base);
				state.despawned_base = value;
				validation_state.site_base = null;
			},
		},
		um: {
			despawn_unit: (value) => {
				test.assert(value == state.active_unit);
				state.active_unit = null;
			},
			spawn_unit: (data) => {
				test.assert(data.id == 42);
				test.assert(data.def == 'ColonyPod');
				test.assert(data.owner == owner);
				test.assert(data.tile == site);
				state.restored_unit = {
					id: data.id,
					movement: 0.0,
					morale: data.morale,
					health: data.health,
					moved_this_turn: true,
				};
				state.active_unit = state.restored_unit;
				return state.restored_unit;
			},
		},
		get_player: (id) => {
			test.assert(id == owner.id);
			return owner;
		},
		tm: {
			get_tile: (x, y) => {
				test.assert(x == site.x);
				test.assert(y == site.y);
				return site;
			},
		},
		get: (key) => {
			if (key == 'f_base_find_best_or_worst_tiles') {
				return (value_base, tiles, count, modifier) => {
					test.assert(value_base == base);
					test.assert(#sizeof(tiles) == 1);
					test.assert(tiles[0] == work_tile);
					test.assert(count == 1);
					test.assert(modifier == 1);
					return tiles;
				};
			}
			test.assert(key == 'f_base_pop_work_tile');
			return (value_base, pop, tile) => {
				test.assert(value_base == base);
				state.worked_pop = pop;
				state.worked_tile = tile;
			};
		},
	};

	const event = {
		game: game,
		data: {
			unit: unit,
			name: 'New Test Base',
		},
	};

	event.applied = found_base.apply(event);
	test.assert(event.applied.base == base);
	test.assert(event.applied.unit.id == 42);
	test.assert(state.spawned_info.name == 'New Test Base');
	test.assert(state.spawned_info.production == 'ScoutPatrol');
	test.assert(validation_state.site_base == base);
	test.assert(state.active_unit == null);
	test.assert(state.worked_pop == state.created_pop);
	test.assert(state.worked_tile == work_tile);

	unit.movement = 0.0;
	unit.moved_this_turn = true;
	found_base.rollback(event);
	test.assert(state.despawned_base == base);
	test.assert(validation_state.site_base == null);
	test.assert(state.active_unit == state.restored_unit);
	test.assert(state.restored_unit.movement == 1.0);
	test.assert(state.restored_unit.morale == 2);
	test.assert(state.restored_unit.health == 0.75);
	test.assert(state.restored_unit.moved_this_turn == false);
}
