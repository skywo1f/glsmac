const eruption = #include('../default/game/event/major_volcanic_eruption');

const key = (prefix, id) => { return prefix + #to_string(id); };

let units = {};
let bases = {};
let base_order = [];
let base_pops = {};
let base_snapshots = {};
let tiles = [];
let terrain_applied = false;
let terrain_restored = false;
let dust_duration = 3;
let current_year = 2200;
let messages = [];
let scoped_messages = [];
let triggers = [];

const owner = {
	id: 1,
	name: 'Gaia',
	has_explored: (tile) => { return true; },
};

const make_tile = (index) => {
	let tile = {
		x: index * 2,
		y: 0,
		elevation: index == 5 ? 3000 : 1000,
		landmarks: {mount_planet: index == 5},
		base_id: 0,
		locked: false,
		neighbours: [],
	};
	tile.get_surrounding_tiles = () => { return tile.neighbours; };
	tile.get_base = () => {
		if (tile.base_id == 0) { return null; }
		const state_key = key('b', tile.base_id);
		return bases[state_key];
	};
	tile.get_units = (include_embarked) => {
		let result = [];
		for (unit_id in units) {
			const unit = units[unit_id];
			if (
				unit != null && unit.get_tile() == tile &&
				(include_embarked || unit.transport_id == 0)
			) {
				result :+unit;
			}
		}
		return result;
	};
	tile.is_locked = () => { return tile.locked; };
	tiles :+tile;
	return tile;
};
for (let i = 0; i < 9; i++) {
	make_tile(i);
}
tiles[4].neighbours = [tiles[3], tiles[5]];
tiles[3].neighbours = [tiles[2]];
tiles[2].neighbours = [tiles[1]];
tiles[1].neighbours = [tiles[0]];
tiles[5].neighbours = [tiles[6]];
tiles[6].neighbours = [tiles[7]];
tiles[7].neighbours = [tiles[8]];

const make_base = (id, tile_index, size) => {
	const state_key = key('b', id);
	base_pops[state_key] = [];
	for (let i = 0; i < size; i++) {
		base_pops[state_key] :+{id: i};
	}
	const base_tile = tiles[tile_index];
	let base = {id: id, name: 'Base ' + #to_string(id)};
	base.get_owner = () => { return owner; };
	base.get_tile = () => { return base_tile; };
	base.get_size = () => { return #sizeof(base_pops[state_key]); };
	base.get_pops = () => { return base_pops[state_key]; };
	base.destroy_pop = (pop) => {
		let remaining = [];
		for (candidate of base_pops[state_key]) {
			if (candidate != pop) { remaining :+candidate; }
		}
		base_pops[state_key] = remaining;
	};
	bases[state_key] = base;
	let replaced = false;
	for (let index = 0; index < #sizeof(base_order); index++) {
		if (base_order[index] == null || base_order[index].id == id) {
			base_order[index] = base;
			replaced = true;
			break;
		}
	}
	if (!replaced) {
		base_order :+base;
	}
	base_tile.base_id = id;
	return base;
};

const ring4 = make_base(1, 0, 7);
const ring3 = make_base(2, 1, 7);
const ring2 = make_base(3, 2, 8);
const ring1 = make_base(4, 3, 8);
const selected = make_base(5, 4, 8);
const mount_base = make_base(6, 5, 5);
const other_ring2 = make_base(7, 6, 5);
const other_ring3 = make_base(8, 7, 5);

const make_unit = (id, tile_index, health, home_base_id) => {
	const unit_tile = tiles[tile_index];
	let unit = {
		id: id,
		def: 'ScoutPatrol',
		owner: owner.id,
		movement: 1.0,
		morale: 2,
		health: health,
		moved_this_turn: false,
		terraforming: 'none',
		terraforming_turns_remaining: 0,
		home_base_id: home_base_id,
		fuel: 0,
		transport_id: 0,
	};
	unit.get_tile = () => { return unit_tile; };
	unit.set_home_base_id = (value) => { unit.home_base_id = value; };
	const unit_key = key('u', id);
	units[unit_key] = unit;
	return unit;
};

const doomed_unit = make_unit(100, 5, 0.8, selected.id);
const damaged_unit = make_unit(101, 8, 0.6, selected.id);

const get_base_list = () => {
	let result = [];
	for (base of base_order) {
		if (base != null) { result :+base; }
	}
	return result;
};

const game = {
	get_year: () => { return current_year; },
	get_player: (id) => { return owner; },
	get: (name) => {
		return name == 'f_message_to_contacts'
			? (player, text) => { scoped_messages :+{player: player, text: text}; }
			: #undefined;
	},
	message: (message) => { messages :+message; },
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
};

game.tm = {
	get_map_width: () => { return 18; },
	get_map_height: () => { return 1; },
	get_tile: (x, y) => { return tiles[x / 2]; },
	get_distance: (first, second) => { return #abs(first.x - second.x) / 2; },
	get_climate_state: () => { return {dust_cloud_duration: dust_duration}; },
	set_dust_cloud_duration: (duration) => { dust_duration = duration; },
	apply_major_eruption: (center) => {
		test.assert(center == selected.get_tile());
		terrain_applied = true;
		return 'terrain:before';
	},
	restore_terrain: (snapshot) => {
		test.assert(snapshot == 'terrain:before');
		terrain_restored = true;
	},
};
game.get_tm = () => { return game.tm; };

game.um = {
	get_units: () => {
		let result = [];
		for (unit_id in units) {
			if (units[unit_id] != null) { result :+units[unit_id]; }
		}
		return result;
	},
	has_unit: (id) => {
		const unit_id = key('u', id);
		return #is_defined(units[unit_id]) && units[unit_id] != null;
	},
	get_unit: (id) => {
		const unit_id = key('u', id);
		return units[unit_id];
	},
	despawn_unit: (unit) => {
		const unit_id = key('u', unit.id);
		units[unit_id] = null;
	},
	spawn_unit: (info) => {
		let tile_index = info.tile.x / 2;
		const unit = make_unit(info.id, tile_index, info.health, info.home_base_id);
		unit.movement = info.movement;
		unit.morale = info.morale;
		unit.moved_this_turn = info.moved_this_turn;
		unit.terraforming = info.terraforming;
		unit.terraforming_turns_remaining = info.terraforming_turns_remaining;
		unit.fuel = info.fuel;
		unit.transport_id = info.transport_id;
		return unit;
	},
};
game.get_um = () => { return game.um; };

game.bm = {
	get_bases: get_base_list,
	snapshot_base: (base) => {
		const snapshot = 'base:' + #to_string(base.id);
		base_snapshots[snapshot] = {
			id: base.id,
			tile_index: base.get_tile().x / 2,
			size: base.get_size(),
		};
		return snapshot;
	},
	despawn_base: (base_or_id) => {
		let id = 0;
		if (#typeof(base_or_id) == 'Int') {
			id = base_or_id;
		} else {
			id = base_or_id.id;
		}
		const state_key = key('b', id);
		const base = bases[state_key];
		const base_tile = base.get_tile();
		base_tile.base_id = 0;
		bases[state_key] = null;
		for (let index = 0; index < #sizeof(base_order); index++) {
			if (base_order[index] != null && base_order[index].id == id) {
				base_order[index] = null;
			}
		}
	},
	restore_base: (snapshot) => {
		const state = base_snapshots[snapshot];
		return make_base(state.id, state.tile_index, state.size);
	},
};
game.get_bm = () => { return game.bm; };

let event = {caller: 1, data: {base: selected}, game: game};
test.assert(#is_defined(eruption.validate(event)));
event.caller = 0;
current_year = 2174;
test.assert(#is_defined(eruption.validate(event)));
current_year = 2200;
tiles[8].locked = true;
test.assert(#is_defined(eruption.validate(event)));
tiles[8].locked = false;
test.assert(!#is_defined(eruption.validate(event)));

event.resolved = eruption.resolve(event);
event.applied = eruption.apply(event);
test.assert(terrain_applied);
test.assert(dust_duration == 10);
test.assert(#sizeof(messages) == 1);
test.assert(#sizeof(scoped_messages) == 1 && scoped_messages[0].player.id == owner.id);
test.assert(#sizeof(triggers) == 1);
test.assert(triggers[0].name == 'major_volcanic_eruption');
test.assert(game.um.has_unit(doomed_unit.id) == false);
const active_damaged = game.um.get_unit(damaged_unit.id);
test.assert(active_damaged.health == 0.3);
test.assert(active_damaged.home_base_id == other_ring3.id);
const selected_key = key('b', selected.id);
const ring1_key = key('b', ring1.id);
const mount_base_key = key('b', mount_base.id);
const ring2_key = key('b', ring2.id);
const ring3_key = key('b', ring3.id);
const ring4_key = key('b', ring4.id);
test.assert(bases[selected_key] == null);
test.assert(bases[ring1_key] == null);
test.assert(bases[mount_base_key] == null);
test.assert(ring2.get_size() == 2);
test.assert(ring3.get_size() == 4);
test.assert(ring4.get_size() == 6);
test.assert(other_ring2.get_size() == 2);
test.assert(other_ring3.get_size() == 3);

eruption.rollback(event);
test.assert(terrain_restored);
test.assert(dust_duration == 3);
test.assert(bases[selected_key].get_size() == 8);
test.assert(bases[ring1_key].get_size() == 8);
test.assert(bases[ring2_key].get_size() == 8);
test.assert(bases[ring3_key].get_size() == 7);
test.assert(bases[ring4_key].get_size() == 7);
test.assert(game.um.has_unit(doomed_unit.id));
const restored_doomed = game.um.get_unit(doomed_unit.id);
const restored_damaged = game.um.get_unit(damaged_unit.id);
test.assert(restored_doomed.health == 0.8);
test.assert(restored_damaged.health == 0.6);
test.assert(restored_damaged.home_base_id == selected.id);
