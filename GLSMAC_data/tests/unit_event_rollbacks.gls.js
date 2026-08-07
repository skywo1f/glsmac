const despawn_unit = #include('../default/game/event/despawn_unit');
const attack_unit = #include('../default/game/event/attack_unit');
const advance_unit_after_combat = #include('../default/game/event/advance_unit_after_combat');
const move_unit = #include('../default/game/event/move_unit');

const owner = {id: 1};
const attacker_tile = {x: 3, y: 4};
const defender_tile = {x: 4, y: 4};
const open_combat_tile = {
	rockiness: 1,
	features: {xenofungus: false},
	terraforming: {bunker: false},
	get_base: () => { return null; },
};
const native_def = {
	is_native: true,
	offense: 1,
	defense: 1,
};
const artillery_def = {
	id: 'SporeLauncher',
	is_native: true,
	offense: 4,
	defense: 1,
};

test.assert(
	attack_unit.validate({
		caller: owner.id,
		game: {
			is_turn_complete: () => {
				return false;
			},
		},
		data: {
			attacker: {owner: owner.id},
			defender: {owner: owner.id},
		},
	}) == 'Unit cannot attack a friendly unit'
);

{
	const ranged_attacker_tile = {
		is_locked: () => { return false; },
		is_adjactent_to: (tile) => { return false; },
		is_land: true,
		is_water: false,
	};
	const ranged_defender_tile = {
		is_locked: () => { return false; },
		is_land: true,
		is_water: false,
	};
	const event = {
		caller: owner.id,
		game: {
			is_turn_complete: () => { return false; },
			tm: {
				get_distance: (from, to) => { return 2; },
			},
		},
		data: {
			attacker: {
				owner: owner.id,
				health: 1.0,
				movement: 1.0,
				is_immovable: false,
				is_land: true,
				is_water: false,
				terraforming: 'none',
				get_tile: () => { return ranged_attacker_tile; },
				get_def: () => { return artillery_def; },
			},
			defender: {
				owner: owner.id + 1,
				health: 1.0,
				is_land: true,
				is_water: false,
				get_tile: () => { return ranged_defender_tile; },
			},
		},
	};
	test.assert(!#is_defined(attack_unit.validate(event)));
	event.game.tm.get_distance = (from, to) => { return 3; };
	test.assert(attack_unit.validate(event) == 'Defender tile is out of artillery range');
}

{
	let random_index = 0;
	const random_values = [0.0, 0.3];
	const resolved = attack_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => {
					return random_values[random_index++];
				},
			},
		},
		data: {
			attacker: {
				morale: 3,
				health: 1.0,
				get_def: () => { return artillery_def; },
			},
			defender: {
				morale: 3,
				health: 0.2,
				get_def: () => { return native_def; },
			},
		},
	});
	test.assert(random_index == 2);
	test.assert(#sizeof(resolved.sequence) == 1);
	test.assert(resolved.sequence[0][0] == true);
	test.assert(resolved.sequence[0][1] > 0.099 && resolved.sequence[0][1] < 0.101);
	test.assert(resolved.attacker_dead == false);
	test.assert(resolved.defender_dead == false);
	test.assert(resolved.advance_after_combat == false);
}

{
	let random_index = 0;
	const random_values = [0.0, 0.1];
	const resolved = attack_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => {
					return random_values[random_index++];
				},
			},
		},
		data: {
			attacker: {
				morale: 3,
				health: 0.1,
				get_def: () => { return artillery_def; },
			},
			defender: {
				morale: 3,
				health: 0.1,
				get_def: () => { return artillery_def; },
			},
		},
	});
	test.assert(random_index == 2);
	test.assert(resolved.attacker_dead == false);
	test.assert(resolved.defender_dead == true);
	test.assert(resolved.advance_after_combat == false);
}

{
	const random_values = [0.1, 0.1];
	let random_index = 0;
	const resolved = attack_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => {
					return random_values[random_index++];
				},
			},
		},
		data: {
			attacker: {
				morale: 3,
				health: 0.1,
				movement: 1.0,
				is_land: false,
				get_tile: () => { return open_combat_tile; },
				get_def: () => {
					return native_def;
				},
			},
			defender: {
				morale: 3,
				health: 0.1,
				is_land: false,
				get_tile: () => { return open_combat_tile; },
				get_def: () => {
					return native_def;
				},
			},
		},
	});
	test.assert(random_index == 2);
	test.assert(#sizeof(resolved.sequence) == 1);
	test.assert(resolved.sequence[0][0] == true);
	test.assert(resolved.attacker_dead == false);
	test.assert(resolved.defender_dead == true);
}

{
	const attack_def = {
		is_native: false,
		offense: 4,
		defense: 1,
	};
	const defense_def = {
		is_native: false,
		offense: 1,
		defense: 2,
	};
	const random_state = {
		index: 0,
		max_values: [],
	};
	const random_values = [0.3, 0.1];
	const resolved = attack_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => {
					random_state.max_values :+max;
					const index = random_state.index;
					random_state.index = index + 1;
					return random_values[index];
				},
			},
		},
		data: {
			attacker: {
				morale: 2,
				health: 0.1,
				movement: 1.0,
				is_land: true,
				get_tile: () => { return open_combat_tile; },
				get_def: () => {
					return attack_def;
				},
			},
			defender: {
				morale: 2,
				health: 0.1,
				is_land: true,
				get_tile: () => { return open_combat_tile; },
				get_def: () => {
					return defense_def;
				},
			},
		},
	});
	test.assert(random_state.index == 2);
	test.assert(random_state.max_values[0] == 0.6);
	test.assert(resolved.attacker_dead == false);
	test.assert(resolved.defender_dead == true);
}

{
	const conventional_def = {
		is_native: false,
		offense: 100,
		defense: 100,
	};
	const random_state = {
		index: 0,
		max_values: [],
	};
	const random_values = [0.29, 0.1];
	const resolved = attack_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => {
					random_state.max_values :+max;
					const index = random_state.index;
					random_state.index = index + 1;
					return random_values[index];
				},
			},
		},
		data: {
			attacker: {
				morale: 2,
				health: 0.1,
				movement: 1.0,
				is_land: true,
				get_tile: () => { return open_combat_tile; },
				get_def: () => { return conventional_def; },
			},
			defender: {
				morale: 2,
				health: 0.1,
				is_land: true,
				get_tile: () => { return open_combat_tile; },
				get_def: () => { return native_def; },
			},
		},
	});
	test.assert(random_state.index == 2);
	test.assert(random_state.max_values[0] == 0.5);
	test.assert(resolved.attacker_dead == false);
	test.assert(resolved.defender_dead == true);
}

{
	const conventional_def = {
		is_native: false,
		offense: 4,
		defense: 2,
	};
	const fungus_tile = {
		rockiness: 1,
		features: {xenofungus: true},
		terraforming: {bunker: false},
		get_base: () => { return null; },
	};
	const random_state = {index: 0, max_values: []};
	const random_values = [0.44, 0.1];
	const resolved = attack_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => {
					random_state.max_values :+max;
					const index = random_state.index;
					random_state.index = index + 1;
					return random_values[index];
				},
			},
		},
		data: {
			attacker: {
				morale: 2,
				health: 0.1,
				movement: 0.5,
				is_land: true,
				get_tile: () => { return open_combat_tile; },
				get_def: () => { return native_def; },
			},
			defender: {
				morale: 2,
				health: 0.1,
				is_land: true,
				get_tile: () => { return fungus_tile; },
				get_def: () => { return conventional_def; },
			},
		},
	});
	test.assert(random_state.max_values[0] > 0.649 && random_state.max_values[0] < 0.651);
	test.assert(resolved.attacker_dead == false);
	test.assert(resolved.defender_dead == true);
}

{
	const conventional_def = {
		is_native: false,
		offense: 4,
		defense: 2,
	};
	const fortified_fungus = {
		rockiness: 3,
		features: {xenofungus: true},
		terraforming: {bunker: false},
		get_base: () => { return {id: 1}; },
	};
	const random_state = {index: 0, max_values: []};
	const random_values = [0.39, 0.1];
	const resolved = attack_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => {
					random_state.max_values :+max;
					const index = random_state.index;
					random_state.index = index + 1;
					return random_values[index];
				},
			},
		},
		data: {
			attacker: {
				morale: 2,
				health: 0.1,
				movement: 1.0,
				is_land: true,
				get_tile: () => { return open_combat_tile; },
				get_def: () => { return conventional_def; },
			},
			defender: {
				morale: 2,
				health: 0.1,
				is_land: true,
				get_tile: () => { return fortified_fungus; },
				get_def: () => { return conventional_def; },
			},
		},
	});
	test.assert(random_state.max_values[0] == 0.85);
	test.assert(resolved.attacker_dead == false);
	test.assert(resolved.defender_dead == true);
}

{
	const conventional_def = {
		is_native: false,
		offense: 4,
		defense: 2,
	};
	const random_state = {index: 0, max_values: []};
	const random_values = [0.19, 0.1];
	const resolved = attack_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => {
					random_state.max_values :+max;
					const index = random_state.index;
					random_state.index = index + 1;
					return random_values[index];
				},
			},
		},
		data: {
			attacker: {
				morale: 2,
				health: 0.1,
				movement: 0.5,
				is_land: true,
				get_tile: () => { return open_combat_tile; },
				get_def: () => { return conventional_def; },
			},
			defender: {
				morale: 2,
				health: 0.1,
				is_land: true,
				get_tile: () => { return open_combat_tile; },
				get_def: () => { return conventional_def; },
			},
		},
	});
	test.assert(random_state.max_values[0] == 0.4);
	test.assert(resolved.attacker_dead == false);
	test.assert(resolved.defender_dead == true);
}

const make_unit = (id, def, tile, movement, morale, health, moved_this_turn) => {
	let unit = null;
	unit = {
		id: id,
		def: def,
		owner: owner.id,
		movement: movement,
		morale: morale,
		health: health,
		moved_this_turn: moved_this_turn,
		terraforming: 'none',
		terraforming_turns_remaining: 0,
		get_tile: () => {
			return tile;
		},
		get_def: () => {
			return native_def;
		},
		set_terraforming_order: (type, turns) => {
			unit.terraforming = type;
			unit.terraforming_turns_remaining = turns;
		},
	};
	return unit;
};

{
	let active_unit = make_unit(10, 'MindWorms', attacker_tile, 0.75, 4, 0.6, true);
	let spawn_data = null;
	const game = {
		um: {
			despawn_unit: (unit) => {
				test.assert(unit == active_unit);
				active_unit = null;
			},
			spawn_unit: (data) => {
				spawn_data = data;
				active_unit = make_unit(data.id, data.def, data.tile, 9.0, data.morale, data.health, false);
				return active_unit;
			},
		},
		get_player: (id) => {
			test.assert(id == owner.id);
			return owner;
		},
		tm: {
			get_tile: (x, y) => {
				test.assert(x == attacker_tile.x);
				test.assert(y == attacker_tile.y);
				return attacker_tile;
			},
		},
	};
	const original = active_unit;
	const event = {
		game: game,
		data: {unit: original},
	};

	event.applied = despawn_unit.apply(event);
	test.assert(active_unit == null);
	original.movement = 5.0;
	original.health = 0.1;
	original.moved_this_turn = false;
	despawn_unit.rollback(event);
	test.assert(spawn_data.id == 10);
	test.assert(spawn_data.def == 'MindWorms');
	test.assert(spawn_data.owner == owner);
	test.assert(spawn_data.tile == attacker_tile);
	test.assert(active_unit.movement == 0.75);
	test.assert(active_unit.morale == 4);
	test.assert(active_unit.health == 0.6);
	test.assert(active_unit.moved_this_turn == true);
}

{
	const source = {
		is_land: true,
		features: {river: false, xenofungus: false},
		terraforming: {road: false, forest: false},
		rockiness: 0,
	};
	const destination = {
		is_land: true,
		features: {river: false, xenofungus: false},
		terraforming: {road: false, forest: true},
		rockiness: 0,
		get_base: () => { return null; },
	};
	let current_tile = source;
	const unit = {
		movement: 1.5,
		moved_this_turn: false,
		get_def: () => { return {is_native: false}; },
		get_tile: () => { return current_tile; },
		move_to_tile: (tile, oncomplete) => {
			current_tile = tile;
			oncomplete();
		},
	};
	let event = {
		data: {unit: unit, tile: destination},
		resolved: {is_movement_successful: true},
	};
	event.applied = move_unit.apply(event);
	test.assert(event.data.unit.movement == 0.0);
	move_unit.rollback(event);
	test.assert(event.data.unit.movement == 1.5);
	current_tile = source;

	source.terraforming.road = true;
	destination.terraforming.road = true;
	event = {
		data: {unit: unit, tile: destination},
		resolved: {is_movement_successful: true},
	};
	event.applied = move_unit.apply(event);
	test.assert(event.data.unit.movement > 1.166 && event.data.unit.movement < 1.167);
	move_unit.rollback(event);
	current_tile = source;

	destination.terraforming.forest = false;
	destination.rockiness = 3;
	event = {
		data: {unit: unit, tile: destination},
		resolved: {is_movement_successful: true},
	};
	event.applied = move_unit.apply(event);
	test.assert(event.data.unit.movement > 1.166 && event.data.unit.movement < 1.167);
	move_unit.rollback(event);
}

{
	const src_tile = {
		is_land: true,
		is_water: false,
		features: {
			river: false,
			xenofungus: false,
		},
		terraforming: {road: false},
		rockiness: 0,
	};
	const dst_tile = {
		is_land: true,
		is_water: false,
		features: {
			river: false,
			xenofungus: false,
		},
		terraforming: {road: false},
		rockiness: 0,
	};
	let current_tile = src_tile;
	let move_calls = 0;
	let pending_move_callback = null;
	const unit = {
		movement: 0.5,
		moved_this_turn: false,
		get_def: () => {
			return {is_native: false};
		},
		get_tile: () => {
			return current_tile;
		},
		move_to_tile: (tile, oncomplete) => {
			move_calls++;
			current_tile = tile;
			pending_move_callback = oncomplete;
		},
	};
	const failed_event = {
		data: {
			unit: unit,
			tile: dst_tile,
		},
		resolved: {
			is_movement_successful: false,
		},
	};

	failed_event.applied = move_unit.apply(failed_event);
	test.assert(move_calls == 0);
	test.assert(current_tile == src_tile);
	test.assert(failed_event.applied.movement_started == false);
	test.assert(failed_event.applied.orig.movement == 0.5);
	test.assert(failed_event.applied.orig.moved_this_turn == false);
	move_unit.rollback(failed_event);
	test.assert(move_calls == 0);
	test.assert(current_tile == src_tile);

	unit.movement = 1.5;
	const successful_event = {
		data: {
			unit: unit,
			tile: dst_tile,
		},
		resolved: {
			is_movement_successful: true,
		},
	};
	successful_event.applied = move_unit.apply(successful_event);
	test.assert(move_calls == 1);
	test.assert(current_tile == dst_tile);
	test.assert(successful_event.applied.movement_started == true);
	test.assert(successful_event.applied.orig.movement == 1.5);
	test.assert(successful_event.applied.orig.moved_this_turn == false);
	test.assert(successful_event.data.unit.movement == 0.5);
	test.assert(successful_event.data.unit.moved_this_turn == true);
	test.assert(pending_move_callback != null);
	pending_move_callback();
	pending_move_callback = null;
	move_unit.rollback(successful_event);
	test.assert(move_calls == 2);
	test.assert(current_tile == src_tile);
	test.assert(successful_event.data.unit.movement == 1.5);
	test.assert(successful_event.data.unit.moved_this_turn == false);
	test.assert(pending_move_callback != null);
	pending_move_callback();
}

{
	const src_tile = {
		is_land: true,
		is_water: false,
		features: {river: false, xenofungus: false},
		terraforming: {road: false},
		rockiness: 0,
	};
	const fungus_tile = {
		is_land: true,
		is_water: false,
		features: {river: false, xenofungus: true},
		terraforming: {road: false},
		rockiness: 0,
	};
	let random_max = 0.0;
	const conventional = {
		movement: 1.0,
		get_def: () => { return {is_native: false}; },
		get_tile: () => { return src_tile; },
	};
	const resolved = move_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => {
					random_max = max;
					return 2.0;
				},
			},
		},
		data: {unit: conventional, tile: fungus_tile},
	});
	test.assert(random_max == 3.0);
	test.assert(resolved.is_movement_successful == false);

	const native = {
		movement: 1.0,
		get_def: () => { return {is_native: true}; },
		get_tile: () => { return src_tile; },
	};
	test.assert(move_unit.resolve({
		game: {random: {get_float: () => { throw Error('native fungus movement should not roll'); }}},
		data: {unit: native, tile: fungus_tile},
	}).is_movement_successful == true);

	src_tile.terraforming.road = true;
	fungus_tile.terraforming.road = true;
	conventional.movement = 0.3;
	random_max = 0.0;
	test.assert(move_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => {
					random_max = max;
					return 0.32;
				},
			},
		},
		data: {unit: conventional, tile: fungus_tile},
	}).is_movement_successful == false);
	test.assert(random_max > 0.333 && random_max < 0.334);
}

{
	let current_tile = null;
	let destination_units = [];
	let destination_base = null;
	let move_calls = 0;
	let stopped_animations_id = 0;
	let tiles_locked = true;
	let base_owner_changes = 0;
	const attacker_owner = {id: owner.id};
	const defender_owner = {id: 2};
	const src_tile = {
		is_land: true,
		is_water: false,
		is_locked: () => {
			return tiles_locked;
		},
		is_adjactent_to: (tile) => {
			return true;
		},
	};
	const dst_tile = {
		is_land: true,
		is_water: false,
		is_locked: () => {
			return tiles_locked;
		},
		get_base: () => {
			return destination_base;
		},
		get_units: () => {
			return destination_units;
		},
	};
	current_tile = src_tile;
	const unit = {
		owner: owner.id,
		health: 0.8,
		is_land: true,
		is_water: false,
		movement: 0.0,
		moved_this_turn: true,
		get_owner: () => {
			return attacker_owner;
		},
		get_tile: () => {
			return current_tile;
		},
		move_to_tile: (tile, oncomplete) => {
			test.assert(tiles_locked == false);
			move_calls++;
			current_tile = tile;
			oncomplete();
		},
	};
	const event = {
		caller: 0,
		game: {
			am: {
				stop_animations: (id) => {
					stopped_animations_id = id;
					tiles_locked = false;
				},
			},
		},
		data: {
			unit: unit,
			tile: dst_tile,
			animations_id: 73,
		},
	};

	test.assert(!#is_defined(advance_unit_after_combat.validate(event)));
	event.caller = owner.id;
	test.assert(#is_defined(advance_unit_after_combat.validate(event)));
	event.caller = 0;
	destination_units = [{owner: 2, health: 1.0}];
	test.assert(#is_defined(advance_unit_after_combat.validate(event)));
	destination_units = [{owner: 2, health: 0.0}];
	test.assert(!#is_defined(advance_unit_after_combat.validate(event)));
	destination_units = [];
	let current_base_owner = defender_owner;
	destination_base = {
		get_owner: () => {
			return current_base_owner;
		},
		set_owner: (new_owner) => {
			base_owner_changes++;
			current_base_owner = new_owner;
		},
	};
	test.assert(!#is_defined(advance_unit_after_combat.validate(event)));

	event.applied = advance_unit_after_combat.apply(event);
	test.assert(event.applied.orig_tile == src_tile);
	test.assert(event.applied.base == destination_base);
	test.assert(event.applied.orig_base_owner == defender_owner);
	test.assert(stopped_animations_id == 73);
	test.assert(current_tile == dst_tile);
	test.assert(move_calls == 1);
	test.assert(current_base_owner == attacker_owner);
	test.assert(base_owner_changes == 1);
	test.assert(unit.movement == 0.0);
	test.assert(unit.moved_this_turn == true);
	advance_unit_after_combat.rollback(event);
	test.assert(current_tile == src_tile);
	test.assert(move_calls == 2);
	test.assert(current_base_owner == defender_owner);
	test.assert(base_owner_changes == 2);
}

{
	let attacker = make_unit(20, 'MindWorms', attacker_tile, 0.5, 3, 0.8, false);
	let defender = make_unit(21, 'MindWorms', defender_tile, 1.0, 5, 0.9, false);
	let active_attacker = attacker;
	let active_defender = defender;
	let animations = null;
	let stopped_animation_id = 0;
	let is_master = false;
	let despawn_requests = 0;
	let advance_requests = 0;
	let advance_data = null;

	const um = {
		has_unit: (id) => {
			if (id == attacker.id) {
				return active_attacker != null;
			}
			return active_defender != null;
		},
		get_unit: (id) => {
			if (id == attacker.id) {
				return active_attacker;
			}
			return active_defender;
		},
		despawn_unit: (unit) => {
			if (unit.id == attacker.id) {
				active_attacker = null;
			} else {
				active_defender = null;
			}
		},
		spawn_unit: (data) => {
			const unit = make_unit(data.id, data.def, data.tile, 9.0, data.morale, data.health, false);
			if (data.id == attacker.id) {
				active_attacker = unit;
			} else {
				active_defender = unit;
			}
			return unit;
		},
	};
	const game = {
		um: um,
		is_master: () => {
			return is_master;
		},
		am: {
			show_animations: (value) => {
				animations = value;
				return 73;
			},
			stop_animations: (id) => {
				stopped_animation_id = id;
			},
		},
		get_player: (id) => {
			return owner;
		},
		tm: {
			get_tile: (x, y) => {
				if (x == attacker_tile.x && y == attacker_tile.y) {
					return attacker_tile;
				}
				return defender_tile;
			},
		},
		event: (name, data) => {
			if (name == 'despawn_unit') {
				despawn_requests++;
				um.despawn_unit(data.unit);
			}
			else {
				test.assert(name == 'advance_unit_after_combat');
				advance_requests++;
				advance_data = data;
			}
		},
	};
	const event = {
		game: game,
		data: {
			attacker: attacker,
			defender: defender,
		},
		resolved: {
			sequence: [
				[true, 0.4],
				[false, 0.3],
				[true, 0.5],
				[false, 0.5],
			],
			attacker_dead: true,
			defender_dead: true,
		},
	};

	event.applied = attack_unit.apply(event);
	test.assert(event.applied.backup.attacker.moved_this_turn == false);
	test.assert(event.data.attacker.health == 0.0);
	test.assert(event.data.defender.health == 0.0);
	test.assert(event.data.attacker.movement == 0.0);
	test.assert(despawn_requests == 0);
	test.assert(#sizeof(animations) == 6);
	for (animation of animations) {
		test.assert(!#is_defined(animation.oncomplete));
	}

	attack_unit.rollback(event);
	test.assert(stopped_animation_id == 73);
	test.assert(active_attacker.id == 20);
	test.assert(active_attacker.movement == 0.5);
	test.assert(active_attacker.morale == 3);
	test.assert(active_attacker.health == 0.8);
	test.assert(active_attacker.moved_this_turn == false);
	test.assert(active_defender.id == 21);
	test.assert(active_defender.movement == 1.0);
	test.assert(active_defender.morale == 5);
	test.assert(active_defender.health == 0.9);
	test.assert(active_defender.moved_this_turn == false);

	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	is_master = true;
	event.applied = attack_unit.apply(event);
	test.assert(despawn_requests == 2);
	test.assert(active_attacker == null);
	test.assert(active_defender == null);
	attack_unit.rollback(event);
	test.assert(active_attacker.health == 0.8);
	test.assert(active_defender.health == 0.9);

	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	active_attacker.movement = 2.0;
	event.resolved = {
		sequence: [[true, 0.9]],
		attacker_dead: false,
		defender_dead: true,
	};
	event.applied = attack_unit.apply(event);
	test.assert(active_attacker.movement == 1.0);
	test.assert(despawn_requests == 3);
	test.assert(#sizeof(animations) == 2);
	test.assert(#is_defined(animations[1].oncomplete));
	test.assert(advance_requests == 0);
	animations[1].oncomplete();
	test.assert(advance_requests == 1);
	test.assert(advance_data.unit == active_attacker);
	test.assert(advance_data.tile == defender_tile);
	test.assert(advance_data.animations_id == 73);
	attack_unit.rollback(event);
	test.assert(active_attacker.movement == 2.0);
	test.assert(active_attacker.health == 0.8);
	test.assert(active_defender.health == 0.9);

	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	event.resolved = {
		sequence: [[true, 0.9]],
		attacker_dead: false,
		defender_dead: true,
		advance_after_combat: false,
	};
	event.applied = attack_unit.apply(event);
	test.assert(despawn_requests == 4);
	test.assert(#sizeof(animations) == 2);
	test.assert(!#is_defined(animations[1].oncomplete));
	test.assert(advance_requests == 1);
	attack_unit.rollback(event);
	test.assert(active_attacker.health == 0.8);
	test.assert(active_defender.health == 0.9);
}
