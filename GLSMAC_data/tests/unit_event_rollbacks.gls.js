const despawn_unit = #include('../default/game/event/despawn_unit');
const attack_unit = #include('../default/game/event/attack_unit');
const advance_unit_after_combat = #include('../default/game/event/advance_unit_after_combat');
const move_unit = #include('../default/game/event/move_unit');
const spawn_unit = #include('../default/game/event/spawn_unit');

const owner = {id: 1};
const attacker_tile = {x: 3, y: 4};
let unit_event_defender_base = null;
let unit_event_defender_units = [];
const defender_tile = {
	x: 4,
	y: 4,
	is_water: false,
	get_base: () => { return unit_event_defender_base; },
	get_units: () => { return unit_event_defender_units; },
};
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
	morale_set: 'NATIVE',
};
const artillery_def = {
	id: 'HeavyArtilleryUnit',
	is_native: true,
	abilities: ['HeavyArtillery'],
	offense: 4,
	defense: 1,
	morale_set: 'NATIVE',
};

{
	const home_tile = {x: 8, y: 6};
	const spawned = {id: 99};
	let spawn_data = null;
	let despawned = null;
	const event = {
		game: {
			bm: {
				get_bases: () => {
					return [{
						id: 12,
						get_owner: () => { return owner; },
						get_tile: () => { return home_tile; },
					}];
				},
			},
			um: {
				spawn_unit: (data) => {
					spawn_data = data;
					return spawned;
				},
				despawn_unit: (unit) => { despawned = unit; },
			},
		},
		data: {
			type: 'TestNeedlejet',
			owner: owner,
			tile: home_tile,
			morale: 2,
			health: 1.0,
			home_base_at_tile: true,
			fuel: 1,
		},
	};
	event.applied = spawn_unit.apply(event);
	test.assert(spawn_data.home_base_id == 12);
	test.assert(spawn_data.fuel == 1);
	spawn_unit.rollback(event);
	test.assert(despawned == spawned);
}

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
	let atrocities = 1000000;
	const source = {
		is_land: true,
		is_water: false,
		is_locked: () => { return false; },
		is_adjactent_to: (tile) => { return true; },
	};
	let stack = [];
	const target = {
		is_land: true,
		is_water: false,
		rockiness: 1,
		features: {xenofungus: false},
		terraforming: {bunker: false},
		is_locked: () => { return false; },
		get_base: () => { return null; },
		get_units: () => { return stack; },
	};
	const make_defender = (id, is_native, defense) => {
		return {
			id: id,
			owner: 2,
			morale: 2,
			health: 1.0,
			is_land: true,
			get_owner: () => { return {id: 2}; },
			get_tile: () => { return target; },
			get_def: () => {
				return {
					id: 'StackDefender',
					is_native: is_native,
					offense: 1,
					defense: defense,
					abilities: [],
				};
			},
		};
	};
	const clicked_native = make_defender(10, true, 1);
	const conventional = make_defender(20, false, 8);
	stack = [clicked_native, conventional];
	const gas_attacker = {
		id: 1,
		owner: 1,
		morale: 2,
		health: 1.0,
		movement: 1.0,
		moved_this_turn: false,
		is_land: true,
		is_immovable: false,
		terraforming: 'none',
		get_owner: () => { return {id: 1}; },
		get_tile: () => { return source; },
		get_def: () => {
			return {
				id: 'NerveGasAttacker',
				is_native: false,
				is_psi_attack: false,
				offense: 2,
				defense: 1,
				abilities: ['NerveGasPods'],
			};
		},
	};
	const gas_event = {
		caller: 1,
		game: {
			is_turn_complete: (id) => { return false; },
			get_player: (id) => {
				return {get_major_atrocities: () => { return atrocities; }};
			},
			get: (name) => { return #undefined; },
		},
		data: {attacker: gas_attacker, defender: clicked_native},
	};
	test.assert(
		attack_unit.validate(gas_event) == 'Major atrocity limit has been reached'
	);
	atrocities = 999999;
	test.assert(!#is_defined(attack_unit.validate(gas_event)));
	const resolved = attack_unit.resolve({
		game: {
			get: (name) => { return #undefined; },
			random: {get_float: (min, max) => { return min; }},
		},
		data: gas_event.data,
	});
	test.assert(resolved.defender_id == conventional.id && resolved.nerve_gas);
}

{
	let units = [];
	const stack_tile = {
		rockiness: 1,
		features: {xenofungus: false},
		terraforming: {bunker: false},
		get_base: () => { return null; },
		get_units: () => { return units; },
	};
	const make_stack_unit = (id, defense, abilities) => {
		return {
			id: id,
			owner: owner.id + 1,
			morale: 2,
			health: 1.0,
			is_land: true,
			get_tile: () => { return stack_tile; },
			get_def: () => {
				return {
					id: 'StackDefender',
					is_native: false,
					offense: 1,
					defense: defense,
					abilities: abilities,
				};
			},
		};
	};
	const weak = make_stack_unit(10, 1, []);
	const strong = make_stack_unit(20, 4, ['CloakingDevice']);
	units = [weak, strong];
	const stack_attacker = {
		id: 1,
		owner: owner.id,
		morale: 2,
		health: 1.0,
		movement: 1.0,
		is_land: true,
		get_tile: () => {
			return {is_adjactent_to: (tile) => { return tile == stack_tile; }};
		},
		get_def: () => {
			return {id: 'StackAttacker', is_native: false, offense: 2, defense: 1};
		},
	};
	const resolved = attack_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => { return min; },
			},
		},
		data: {attacker: stack_attacker, defender: weak},
	});
	test.assert(resolved.defender_id == weak.id);
	test.assert(resolved.defender == weak);
}

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
				health: 0.6,
				is_land: true,
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
	let units = [];
	const bombardment_tile = {
		rockiness: 1,
		features: {xenofungus: false},
		terraforming: {bunker: false},
		get_base: () => { return null; },
		get_units: () => { return units; },
	};
	const make_target = (id, health) => {
		return {
			id: id,
			owner: 2,
			morale: 3,
			health: health,
			is_land: true,
			get_tile: () => { return bombardment_tile; },
			get_def: () => {
				return {
					id: 'BombardmentTarget',
					is_native: false,
					is_artillery: false,
					offense: 1,
					defense: 1,
					abilities: [],
				};
			},
		};
	};
	const first = make_target(30, 1.0);
	const second = make_target(31, 0.6);
	const already_suppressed = make_target(32, 0.5);
	units = [first, second, already_suppressed];
	const artillery = {
		id: 20,
		owner: 1,
		morale: 3,
		health: 1.0,
		get_def: () => { return artillery_def; },
	};
	let random_index = 0;
	const random_values = [0.0, 0.2, 0.0, 0.2];
	const resolved = attack_unit.resolve({
		game: {
			random: {
				get_float: (min, max) => { return random_values[random_index++]; },
			},
		},
		data: {attacker: artillery, defender: first},
	});
	test.assert(resolved.is_bombardment);
	test.assert(random_index == 4);
	test.assert(#sizeof(resolved.bombardments) == 2);
	test.assert(resolved.bombardments[0].unit == first);
	test.assert(resolved.bombardments[0].damage > 0.299);
	test.assert(resolved.bombardments[1].unit == second);
	test.assert(resolved.bombardments[1].damage > 0.099);
	test.assert(!resolved.bombardments[0].dead && !resolved.bombardments[1].dead);

	const naval = make_target(33, 0.1);
	naval.is_land = false;
	naval.is_water = true;
	naval.get_def = () => {
		return {
			id: 'NavalGunship',
			is_native: false,
			is_artillery: true,
			offense: 2,
			defense: 1,
			abilities: [],
		};
	};
	units = [first, naval];
	const duel = attack_unit.resolve({
		game: {random: {get_float: (min, max) => { return min; }}},
		data: {attacker: artillery, defender: first},
	});
	test.assert(duel.defender_id == naval.id);
	test.assert(!#is_defined(duel.is_bombardment));
	test.assert(duel.defender_dead);
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
		fuel: 0,
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
		set_fuel: (fuel) => {
			unit.fuel = fuel;
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
	let movement_abilities = [];
	const unit = {
		movement: 1.5,
		moved_this_turn: false,
		get_def: () => { return {is_native: false, abilities: movement_abilities}; },
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

	movement_abilities = ['AntigravStruts'];
	event = {
		data: {unit: unit, tile: destination},
		resolved: {is_movement_successful: true},
	};
	event.applied = move_unit.apply(event);
	test.assert(event.data.unit.movement == 0.5);
	move_unit.rollback(event);
	current_tile = source;
	movement_abilities = [];

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
	let conventional_tile = src_tile;
	const conventional = {
		owner: owner.id,
		is_land: true,
		movement: 1.0,
		moved_this_turn: false,
		get_def: () => { return {is_native: false}; },
		get_tile: () => { return conventional_tile; },
		get_owner: () => { return owner; },
		move_to_tile: (tile, oncomplete) => {
			conventional_tile = tile;
			oncomplete();
		},
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

	const xeno_game = {
		get: (key) => {
			if (
				key == 'f_diplomacy_queue_contacts_at_tile' ||
				key == 'f_exploration_queue_at_tile'
			) {
				return #undefined;
			}
			test.assert(key == 'f_project_get_player_effects');
			return (player) => {
				test.assert(player == owner);
				return {fungus_movement_as_road: true};
			};
		},
		random: {get_float: () => { throw Error('fungus road movement should not roll'); }},
	};
	conventional.movement = 0.34;
	test.assert(move_unit.resolve({
		game: xeno_game,
		data: {unit: conventional, tile: fungus_tile},
	}).is_movement_successful == true);
	conventional.movement = 1.0;
	let xeno_event = {
		game: xeno_game,
		data: {unit: conventional, tile: fungus_tile},
		resolved: {is_movement_successful: true, transport_id: 0},
	};
	xeno_event.applied = move_unit.apply(xeno_event);
	test.assert(conventional_tile == fungus_tile);
	test.assert(
		xeno_event.data.unit.movement > 0.666 &&
		xeno_event.data.unit.movement < 0.667
	);
	move_unit.rollback(xeno_event);
	test.assert(conventional_tile == src_tile);
	test.assert(xeno_event.data.unit.movement == 1.0);
	test.assert(!xeno_event.data.unit.moved_this_turn);

	const native = {
		movement: 1.0,
		get_def: () => { return {is_native: true}; },
		get_tile: () => { return src_tile; },
		get_owner: () => { return owner; },
	};
	test.assert(move_unit.resolve({
		game: {random: {get_float: () => { throw Error('native fungus movement should not roll'); }}},
		data: {unit: native, tile: fungus_tile},
	}).is_movement_successful == true);

	src_tile.terraforming.road = true;
	fungus_tile.terraforming.road = true;
	const road_conventional = {
		movement: 0.3,
		get_def: () => { return {is_native: false}; },
		get_tile: () => { return src_tile; },
	};
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
		data: {unit: road_conventional, tile: fungus_tile},
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
	let support_bases = [];
	const attacker_owner = {id: owner.id};
	const defender_owner = {id: 2};
	let supported_unit = null;
	supported_unit = {
		owner: defender_owner.id,
		home_base_id: 9,
		get_tile: () => { return {x: 8, y: 8}; },
		set_home_base_id: (id) => { supported_unit.home_base_id = id; },
	};
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
			bm: {
				get_bases: () => { return support_bases; },
			},
			um: {
				get_units: () => { return [supported_unit]; },
			},
			tm: {
				get_distance: (source, destination) => { return destination.distance; },
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
	let destination_production_queue = [
		{production_kind: 'unit', id: 'LockedUnit'},
		{production_kind: 'unit', id: 'AvailableUnit'},
	];
	destination_base = {
		id: 9,
		has_facility: (id) => { return false; },
		get_owner: () => {
			return current_base_owner;
		},
		set_owner: (new_owner) => {
			base_owner_changes++;
			current_base_owner = new_owner;
		},
		get_production_queue: () => { return destination_production_queue; },
		can_produce: (kind, id) => {
			return current_base_owner.id != attacker_owner.id || id != 'LockedUnit';
		},
		set_production_queue: (queue) => {
			destination_production_queue = [];
			for (production of queue) {
				destination_production_queue :+{
					production_kind: production.kind,
					id: production.id,
				};
			}
		},
	};
	const higher_id_base = {
		id: 11,
		get_owner: () => { return defender_owner; },
		get_tile: () => { return {distance: 2}; },
	};
	const lower_id_base = {
		id: 10,
		get_owner: () => { return defender_owner; },
		get_tile: () => { return {distance: 2}; },
	};
	support_bases = [destination_base, higher_id_base, lower_id_base];
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
	test.assert(#sizeof(destination_production_queue) == 1);
	test.assert(destination_production_queue[0].id == 'AvailableUnit');
	test.assert(#sizeof(event.applied.rehomed_units) == 1);
	test.assert(supported_unit.home_base_id == lower_id_base.id);
	test.assert(unit.movement == 0.0);
	test.assert(unit.moved_this_turn == true);
	advance_unit_after_combat.rollback(event);
	test.assert(current_tile == src_tile);
	test.assert(move_calls == 2);
	test.assert(current_base_owner == defender_owner);
	test.assert(base_owner_changes == 2);
	test.assert(#sizeof(destination_production_queue) == 2);
	test.assert(destination_production_queue[0].id == 'LockedUnit');
	test.assert(supported_unit.home_base_id == destination_base.id);

	support_bases = [destination_base];
	event.applied = advance_unit_after_combat.apply(event);
	test.assert(supported_unit.home_base_id == 0);
	advance_unit_after_combat.rollback(event);
	test.assert(supported_unit.home_base_id == destination_base.id);
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
	let combat_relation = 'treaty';
	let major_atrocities = 2;
	let sanction_turns = 3;
	let active_gas_base = null;
	let gas_pops = [];
	let gas_facilities = [];
	let support_units = [];
	let attacker_player = null;
	let defender_player = null;
	const make_combat_player = (id, other_id) => {
		let grievances = {};
		return {
			id: id,
			name: id == 1 ? 'Attacker' : 'Defender',
			type: 'ai',
			difficulty_level: 'Talent',
			get_diplomatic_relation: (other) => { return combat_relation; },
			set_diplomatic_relation: (other, relation) => { combat_relation = relation; },
			get_diplomatic_offer: (other) => { return ''; },
			set_diplomatic_offer: (other, offer) => {},
			get_diplomatic_grievance: (other) => {
				const key = 'p' + #to_string(other.id);
				return #is_defined(grievances[key]) ? #clone(grievances[key]) : {
					wants_revenge: false,
					atrocity_victim: false,
					major_atrocity_victim: false,
				};
			},
			set_diplomatic_grievance: (other, grievance) => {
				grievances['p' + #to_string(other.id)] = #clone(grievance);
			},
			get_major_atrocities: () => { return major_atrocities; },
			set_major_atrocities: (value) => { major_atrocities = value; },
			get_sanction_turns: () => { return sanction_turns; },
			set_sanction_turns: (value) => { sanction_turns = value; },
		};
	};
	attacker_player = make_combat_player(1, 2);
	defender_player = make_combat_player(2, 1);
	defender.owner = defender_player.id;
	const make_gas_pop = (type, worked_tile) => {
		let tile = worked_tile;
		return {
			get_type: () => { return type; },
			get: (key) => { return key == 'worked_tile' ? tile : #undefined; },
			set_worked_tile: (value) => { tile = value; },
		};
	};
	const make_gas_base = (id, name, starting_nutrients) => {
		let nutrients = starting_nutrients;
		return {
			id: id,
			name: name,
			get_owner: () => { return defender_player; },
			get_tile: () => { return defender_tile; },
			get_facilities: () => { return gas_facilities; },
			get_size: () => { return #sizeof(gas_pops); },
			get_pops: () => { return gas_pops; },
			create_pop: (data) => {
				const pop = make_gas_pop(data.type, #undefined);
				gas_pops :+pop;
				return pop;
			},
			destroy_pop: (doomed) => {
				let remaining = [];
				for (pop of gas_pops) {
					if (pop != doomed) {
						remaining :+pop;
					}
				}
				gas_pops = remaining;
			},
			get: (key) => {
				return key == 'accumulated_nutrients' ? nutrients : #undefined;
			},
			set: (key, value) => {
				if (key == 'accumulated_nutrients') {
					nutrients = value;
				}
			},
		};
	};

	const um = {
		get_moraleset: (id) => {
			test.assert(id == 'NATIVE');
			return ['Hatchling', 'Larval Mass', 'Pre-Boil', 'Boil', 'Mature Boil', 'Great Boil', 'Demon Boil'];
		},
		has_unit: (id) => {
			if (id == attacker.id) {
				return active_attacker != null;
			}
			for (unit of support_units) {
				if (unit.id == id) {
					return true;
				}
			}
			return id == defender.id && active_defender != null;
		},
		get_unit: (id) => {
			if (id == attacker.id) {
				return active_attacker;
			}
			for (unit of support_units) {
				if (unit.id == id) {
					return unit;
				}
			}
			test.assert(id == defender.id);
			return active_defender;
		},
		get_units: () => {
			let result = [];
			if (active_attacker != null) {
				result :+active_attacker;
			}
			if (active_defender != null) {
				result :+active_defender;
			}
			for (unit of support_units) {
				result :+unit;
			}
			return result;
		},
		despawn_unit: (unit) => {
			if (unit.id == attacker.id) {
				active_attacker = null;
			} else if (unit.id == defender.id) {
				active_defender = null;
			} else {
				let remaining = [];
				for (supported of support_units) {
					if (supported.id != unit.id) {
						remaining :+supported;
					}
				}
				support_units = remaining;
			}
		},
		spawn_unit: (data) => {
			const unit = make_unit(data.id, data.def, data.tile, 9.0, data.morale, data.health, false);
			unit.owner = data.owner.id;
			if (data.id == attacker.id) {
				active_attacker = unit;
			} else if (data.id == defender.id) {
				active_defender = unit;
			} else {
				support_units :+unit;
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
			return id == attacker_player.id ? attacker_player : defender_player;
		},
		get: (name) => {
			if (name == 'f_message_to_player') {
				return (player, text) => {};
			}
			if (name == 'f_message_to_players') {
				return (text, players) => {};
			}
			if (name == 'f_council_is_un_charter_repealed') {
				return () => { return false; };
			}
			if (name == 'f_base_reset_nutrients') {
				return (game, base) => { base.set('accumulated_nutrients', 0); };
			}
			if (name == 'f_base_pop_unwork_tile') {
				return (base, pop) => { pop.set_worked_tile(#undefined); };
			}
			if (name == 'f_base_pop_work_tile') {
				return (base, pop, tile) => { pop.set_worked_tile(tile); };
			}
			if (name == 'f_base_get_effective_facilities') {
				return (base) => { return base.get_facilities(); };
			}
			if (
				name == 'f_economy_get_base_psych' ||
				name == 'f_base_process_psych'
			) {
				return #undefined;
			}
			if (name == 'f_diplomacy_snapshot_pair') {
				return (player, other) => {
					return {
						player_relation: player.get_diplomatic_relation(other),
						other_relation: other.get_diplomatic_relation(player),
						player_offer: '',
						other_offer: '',
						player_grievance: player.get_diplomatic_grievance(other),
						other_grievance: other.get_diplomatic_grievance(player),
					};
				};
			}
			if (name == 'f_diplomacy_set_bilateral_relation') {
				return (player, other, relation) => {
					player.set_diplomatic_relation(other, relation);
					other.set_diplomatic_relation(player, relation);
				};
			}
			if (name == 'f_diplomacy_clear_offers') {
				return (player, other) => {};
			}
			if (name == 'f_diplomacy_add_grievance') {
				return (player, other, wants_revenge, atrocity_victim, major_victim) => {
					const current = player.get_diplomatic_grievance(other);
					player.set_diplomatic_grievance(other, {
						wants_revenge: current.wants_revenge || wants_revenge ||
							atrocity_victim || major_victim,
						atrocity_victim: current.atrocity_victim || atrocity_victim ||
							major_victim,
						major_atrocity_victim: current.major_atrocity_victim || major_victim,
					});
				};
			}
			test.assert(name == 'f_diplomacy_restore_pair');
			return (player, other, snapshot) => {
				player.set_diplomatic_relation(other, snapshot.player_relation);
				other.set_diplomatic_relation(player, snapshot.other_relation);
				player.set_diplomatic_grievance(other, snapshot.player_grievance);
				other.set_diplomatic_grievance(player, snapshot.other_grievance);
			};
		},
		trigger: (name, data) => {},
		message: (text) => {},
		tm: {
			get_tile: (x, y) => {
				if (x == attacker_tile.x && y == attacker_tile.y) {
					return attacker_tile;
				}
				return defender_tile;
			},
			get_distance: (from, to) => { return 1; },
		},
		bm: {
			get_bases: () => { return active_gas_base == null ? [] : [active_gas_base]; },
			snapshot_base: (base) => {
				let pop_types = [];
				for (pop of gas_pops) {
					pop_types :+pop.get_type();
				}
				return {
					id: base.id,
					name: base.name,
					nutrients: base.get('accumulated_nutrients'),
					pop_types: pop_types,
				};
			},
			despawn_base: (id) => {
				test.assert(active_gas_base != null && active_gas_base.id == id);
				const despawned = active_gas_base;
				active_gas_base = null;
				unit_event_defender_base = null;
				// Native base wrappers become invalid as soon as the base is despawned.
				despawned.id = #undefined;
			},
			restore_base: (snapshot) => {
				active_gas_base = make_gas_base(snapshot.id, snapshot.name, snapshot.nutrients);
				unit_event_defender_base = active_gas_base;
				gas_pops = [];
				for (type of snapshot.pop_types) {
					gas_pops :+make_gas_pop(type, #undefined);
				}
				return active_gas_base;
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
	test.assert(combat_relation == 'vendetta');
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
	test.assert(combat_relation == 'treaty');
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
	test.assert(active_attacker.morale == 4);
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
	test.assert(active_attacker.morale == 3);
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
	test.assert(active_attacker.morale == 4);
	test.assert(despawn_requests == 4);
	test.assert(#sizeof(animations) == 2);
	test.assert(!#is_defined(animations[1].oncomplete));
	test.assert(advance_requests == 1);
	attack_unit.rollback(event);
	test.assert(active_attacker.morale == 3);
	test.assert(active_attacker.health == 0.8);
	test.assert(active_defender.health == 0.9);

	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	active_attacker.morale = 6;
	event.applied = attack_unit.apply(event);
	test.assert(active_attacker.morale == 6);
	attack_unit.rollback(event);
	test.assert(active_attacker.morale == 6);

	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	active_attacker.morale = 3;
	event.resolved = {
		sequence: [[false, 0.8]],
		attacker_dead: true,
		defender_dead: false,
	};
	event.applied = attack_unit.apply(event);
	test.assert(active_defender.morale == 6);
	attack_unit.rollback(event);
	test.assert(active_attacker.morale == 3);
	test.assert(active_defender.morale == 5);

	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	active_attacker.get_def = () => { return artillery_def; };
	active_defender.get_def = () => {
		return {
			id: 'BombardmentDefender',
			is_native: false,
			is_artillery: false,
			offense: 1,
			defense: 1,
			abilities: [],
		};
	};
	const collateral = make_unit(22, 'GroundedAircraft', defender_tile, 1.0, 2, 0.2, false);
	collateral.owner = defender_player.id;
	collateral.is_land = false;
	collateral.is_air = true;
	collateral.get_def = () => {
		return {
			id: 'GroundedAircraft',
			is_native: false,
			is_artillery: false,
			offense: 2,
			defense: 1,
			abilities: [],
		};
	};
	support_units = [collateral];
	unit_event_defender_units = [active_defender, collateral];
	event.resolved = {
		sequence: [[true, 0.4]],
		is_bombardment: true,
		bombardments: [
			{unit: active_defender, damage: 0.4, dead: false},
			{unit: collateral, damage: 0.2, dead: true},
		],
		attacker_dead: false,
		defender_dead: false,
		advance_after_combat: false,
		nerve_gas: false,
	};
	is_master = true;
	const despawns_before_bombardment = despawn_requests;
	test.assert(event.resolved.bombardments[0].unit == active_defender);
	event.applied = attack_unit.apply(event);
	test.assert(active_defender.health > 0.499 && active_defender.health < 0.501);
	test.assert(#sizeof(support_units) == 0);
	test.assert(despawn_requests == despawns_before_bombardment + 1);
	test.assert(#sizeof(animations) == 2);
	attack_unit.rollback(event);
	test.assert(active_defender.health == 0.9);
	test.assert(#sizeof(support_units) == 1);
	test.assert(support_units[0].id == collateral.id && support_units[0].health == 0.2);
	support_units = [];
	unit_event_defender_units = [];
	active_attacker.get_def = () => { return native_def; };
	active_defender.get_def = () => { return native_def; };

	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	active_attacker.def = 'TestMissile';
	active_attacker.fuel = 1;
	active_attacker.get_def = () => {
		return {morale_set: 'NATIVE', is_missile: true};
	};
	event.resolved = {
		sequence: [],
		attacker_dead: false,
		defender_dead: false,
	};
	const despawns_before_missile = despawn_requests;
	event.applied = attack_unit.apply(event);
	test.assert(despawn_requests == despawns_before_missile + 1);
	test.assert(active_attacker == null);
	test.assert(active_defender != null);
	test.assert(#sizeof(animations) == 1);
	attack_unit.rollback(event);
	test.assert(active_attacker.def == 'TestMissile');
	test.assert(active_attacker.fuel == 1);
	test.assert(active_attacker.health == 0.8);

	attacker_player.type = 'human';
	defender_player.type = 'native';
	active_attacker.def = 'MindWorms';
	active_attacker.get_def = () => { return native_def; };
	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	event.resolved = {
		sequence: [[true, 0.1]],
		attacker_dead: false,
		defender_dead: false,
		native_capture: {
			attempted: true,
			captured: false,
			mark_attempted: true,
			reason: 'roll_failed',
		},
	};
	combat_relation = 'treaty';
	event.applied = attack_unit.apply(event);
	test.assert(combat_relation == 'treaty');
	test.assert(active_defender.native_capture_attempted);
	attack_unit.rollback(event);
	test.assert(combat_relation == 'treaty');
	test.assert(!active_defender.native_capture_attempted);
	defender_player.type = 'ai';

	gas_pops = [
		make_gas_pop('WORKER', defender_tile),
		make_gas_pop('TALENT', #undefined),
		make_gas_pop('DRONE', #undefined),
	];
	active_gas_base = make_gas_base(50, 'Gas Target', 12);
	unit_event_defender_base = active_gas_base;
	active_attacker.def = 'NerveGasLaser';
	active_attacker.get_def = () => {
		return {
			id: 'NerveGasLaser',
			is_native: false,
			is_psi_attack: false,
			offense: 2,
			defense: 1,
			morale_set: 'NATIVE',
			abilities: ['NerveGasPods'],
		};
	};
	active_defender.def = 'ConventionalDefender';
	active_defender.get_def = () => {
		return {
			id: 'ConventionalDefender',
			is_native: false,
			is_psi_defense: false,
			offense: 1,
			defense: 1,
			morale_set: 'NATIVE',
			abilities: [],
		};
	};
	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	event.resolved = {
		sequence: [[true, 0.9]],
		attacker_dead: false,
		defender_dead: true,
		advance_after_combat: false,
		nerve_gas: true,
	};
	combat_relation = 'treaty';
	event.applied = attack_unit.apply(event);
	test.assert(major_atrocities == 3);
	test.assert(sanction_turns == 13);
	test.assert(active_gas_base.get_size() == 1);
	test.assert(active_gas_base.get('accumulated_nutrients') == 0);
	test.assert(event.applied.nerve_gas.population_loss == 2);
	const gas_grievance = defender_player.get_diplomatic_grievance(attacker_player);
	test.assert(gas_grievance.wants_revenge && gas_grievance.atrocity_victim);
	test.assert(!gas_grievance.major_atrocity_victim);
	attack_unit.rollback(event);
	test.assert(major_atrocities == 2);
	test.assert(sanction_turns == 3);
	test.assert(active_gas_base.get_size() == 3);
	test.assert(active_gas_base.get('accumulated_nutrients') == 12);
	test.assert(gas_pops[0].get_type() == 'WORKER');
	test.assert(gas_pops[1].get_type() == 'TALENT');
	test.assert(gas_pops[2].get_type() == 'DRONE');
	test.assert(!defender_player.get_diplomatic_grievance(attacker_player).wants_revenge);

	gas_pops = [make_gas_pop('WORKER', #undefined)];
	let supported = null;
	supported = {
		id: 99,
		owner: defender_player.id,
		home_base_id: active_gas_base.id,
		get_tile: () => { return defender_tile; },
		set_home_base_id: (id) => { supported.home_base_id = id; },
	};
	support_units = [supported];
	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	event.applied = attack_unit.apply(event);
	test.assert(active_gas_base == null);
	test.assert(supported.home_base_id == 0);
	test.assert(event.applied.nerve_gas.population_loss == 1);
	test.assert(event.applied.nerve_gas.base_id == 50);
	attack_unit.rollback(event);
	test.assert(active_gas_base != null && active_gas_base.get_size() == 1);
	test.assert(active_gas_base.get('accumulated_nutrients') == 12);
	test.assert(supported.home_base_id == 50);
	test.assert(major_atrocities == 2 && sanction_turns == 3);

	active_attacker.def = 'ConventionalAttacker';
	active_attacker.get_def = () => {
		return {
			id: 'ConventionalAttacker',
			is_native: false,
			is_psi_attack: false,
			offense: 2,
			defense: 1,
			morale_set: 'NATIVE',
			abilities: [],
		};
	};
	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	event.resolved = {
		sequence: [[true, 0.9]],
		attacker_dead: false,
		defender_dead: true,
		advance_after_combat: false,
		nerve_gas: false,
	};
	gas_pops = [
		make_gas_pop('WORKER', defender_tile),
		make_gas_pop('TALENT', #undefined),
		make_gas_pop('DRONE', #undefined),
	];
	gas_facilities = [];
	active_gas_base = make_gas_base(50, 'Conventional Target', 12);
	unit_event_defender_base = active_gas_base;
	event.applied = attack_unit.apply(event);
	test.assert(active_gas_base.get_size() == 2);
	test.assert(active_gas_base.get('accumulated_nutrients') == 0);
	test.assert(event.applied.base_combat_population.population_loss == 1);
	attack_unit.rollback(event);
	test.assert(active_gas_base.get_size() == 3);
	test.assert(active_gas_base.get('accumulated_nutrients') == 12);

	gas_facilities = [{id: 'PerimeterDefense'}];
	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	event.applied = attack_unit.apply(event);
	test.assert(active_gas_base.get_size() == 3);
	test.assert(!#is_defined(event.applied.base_combat_population));
	attack_unit.rollback(event);

	gas_facilities = [];
	defender_tile.is_water = true;
	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	event.applied = attack_unit.apply(event);
	test.assert(active_gas_base.get_size() == 3);
	test.assert(!#is_defined(event.applied.base_combat_population));
	attack_unit.rollback(event);
	defender_tile.is_water = false;

	defender_player.type = 'human';
	defender_player.difficulty_level = 'Citizen';
	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	event.applied = attack_unit.apply(event);
	test.assert(active_gas_base.get_size() == 3);
	test.assert(!#is_defined(event.applied.base_combat_population));
	attack_unit.rollback(event);
	defender_player.type = 'ai';
	defender_player.difficulty_level = 'Talent';

	unit_event_defender_units = [active_defender, supported];
	supported.health = 1.0;
	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	event.applied = attack_unit.apply(event);
	test.assert(active_gas_base.get_size() == 3);
	test.assert(!#is_defined(event.applied.base_combat_population));
	attack_unit.rollback(event);
	unit_event_defender_units = [];

	gas_pops = [make_gas_pop('WORKER', #undefined)];
	supported.home_base_id = 50;
	support_units = [supported];
	event.data.attacker = active_attacker;
	event.data.defender = active_defender;
	event.applied = attack_unit.apply(event);
	test.assert(active_gas_base == null);
	test.assert(supported.home_base_id == 0);
	test.assert(#is_defined(event.applied.base_combat_population.destroyed_base));
	test.assert(event.applied.base_combat_population.base_id == 50);
	attack_unit.rollback(event);
	test.assert(active_gas_base != null && active_gas_base.get_size() == 1);
	test.assert(active_gas_base.get('accumulated_nutrients') == 12);
	test.assert(supported.home_base_id == 50);
}
