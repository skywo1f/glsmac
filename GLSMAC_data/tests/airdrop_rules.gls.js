const rules = #include('../default/game/airdrop_rules');
const event_rules = #include('../default/game/event/airdrop_unit');

let has_graviton = false;
const owner = {
	id: 1,
	name: 'Test Faction',
	has_technology: (id) => { return has_graviton && id == 'GravitonTheory'; },
};
const foreign_owner = {id: 2};

const make_tile = (x, y) => {
	let base = null;
	let units = [];
	return {
		x: x,
		y: y,
		is_water: false,
		terraforming: {airbase: false},
		locked: false,
		get_base: () => { return base; },
		set_base: (value) => { base = value; },
		get_units: (include_embarked) => { return units; },
		set_units: (value) => { units = value; },
		is_locked: () => { return this.locked; },
	};
};

const make_base = (tile, base_owner) => {
	const base = {get_owner: () => { return base_owner; }};
	tile.set_base(base);
	return base;
};

const source = make_tile(0, 0);
make_base(source, owner);
const near = make_tile(8, 0);
const far = make_tile(9, 1);
const ocean = make_tile(6, 0);
ocean.is_water = true;
const tiles = [source, near, far, ocean];
let world_units = [];
let space_elevator = false;
let friendly_airbase = true;
const game = {
	is_turn_complete: (id) => { return false; },
	get_player: (id) => { return owner; },
	get_um: () => { return {get_units: () => { return world_units; }}; },
	get_bm: () => { return {get_bases: () => { return []; }}; },
	get_tm: () => {
		return {
			get_distance: (a, b) => { return #abs(a.x - b.x); },
			get_map_width: () => { return 10; },
			get_map_height: () => { return 2; },
			get_tile: (x, y) => {
				for (tile of tiles) {
					if (tile.x == x && tile.y == y) { return tile; }
				}
				return make_tile(x, y);
			},
		};
	},
	get: (key) => {
		if (key == 'f_project_has') {
			return (player, id) => { return space_elevator && id == 'TheSpaceElevator'; };
		}
		if (key == 'f_territory_is_friendly') {
			return (player, tile) => { return friendly_airbase; };
		}
		return #undefined;
	},
};

const make_unit = (tile, unit_owner, reactor, abilities) => {
	return {
		id: 10,
		def: 'DropInfantry',
		owner: unit_owner.id,
		movement: 1.0,
		morale: 2,
		health: 1.0,
		moved_this_turn: false,
		airdropped_this_turn: false,
		terraforming: 'none',
		terraforming_turns_remaining: 0,
		home_base_id: 1,
		fuel: 0,
		transport_id: 0,
		convoy_resource: 'none',
		native_capture_attempted: false,
		is_land: true,
		is_air: false,
		get_tile: () => { return tile; },
		get_def: () => {
			return {name: 'Drop Infantry', reactor_power: reactor, abilities: abilities};
		},
		get_cargo: () => { return []; },
	};
};

const drop_unit = make_unit(source, owner, 1, ['DropPods']);
test.assert(!#is_defined(rules.get_source_error(game, drop_unit, owner.id)));
test.assert(!#is_defined(rules.get_drop_error(game, drop_unit, owner.id, near)));
test.assert(
	rules.get_drop_error(game, drop_unit, owner.id, far) ==
	'Air-drop destination is more than eight squares away'
);
test.assert(
	rules.get_drop_error(game, drop_unit, owner.id, ocean) ==
	'Land units cannot air-drop into open ocean'
);

drop_unit.moved_this_turn = true;
test.assert(#is_defined(rules.get_source_error(game, drop_unit, owner.id)));
drop_unit.moved_this_turn = false;
drop_unit.airdropped_this_turn = true;
test.assert(#is_defined(rules.get_source_error(game, drop_unit, owner.id)));
drop_unit.airdropped_this_turn = false;

	has_graviton = true;
	test.assert(!#is_defined(rules.get_drop_error(game, drop_unit, owner.id, far)));
	has_graviton = false;
space_elevator = true;
test.assert(!#is_defined(rules.get_drop_error(game, drop_unit, owner.id, far)));
space_elevator = false;

near.set_units([{owner: foreign_owner.id}]);
test.assert(#is_defined(rules.get_drop_error(game, drop_unit, owner.id, near)));
near.set_units([]);
make_base(near, foreign_owner);
test.assert(#is_defined(rules.get_drop_error(game, drop_unit, owner.id, near)));
near.set_base(null);

const interceptor_tile = make_tile(6, 0);
make_base(interceptor_tile, foreign_owner);
const interceptor = make_unit(interceptor_tile, foreign_owner, 1, ['AirSuperiority']);
interceptor.is_land = false;
interceptor.is_air = true;
world_units = [interceptor];
test.assert(
	rules.get_drop_error(game, drop_unit, owner.id, near) ==
	'Enemy Air Superiority patrols block this air drop'
);
interceptor.get_def = () => { return {reactor_power: 1, abilities: []}; };
test.assert(!#is_defined(rules.get_drop_error(game, drop_unit, owner.id, near)));
world_units = [];

const airbase_source = make_tile(2, 0);
airbase_source.terraforming.airbase = true;
const airbase_unit = make_unit(airbase_source, owner, 1, ['DropPods']);
test.assert(!#is_defined(rules.get_source_error(game, airbase_unit, owner.id)));
friendly_airbase = false;
test.assert(#is_defined(rules.get_source_error(game, airbase_unit, owner.id)));
friendly_airbase = true;

const no_drop_unit = make_unit(source, owner, 1, []);
test.assert(#is_defined(rules.get_source_error(game, no_drop_unit, owner.id)));
test.assert(rules.get_damage(drop_unit) == 0.20);
const singularity = make_unit(source, owner, 4, ['DropPods']);
test.assert(rules.get_damage(singularity) == 0.26);

{
	const destination = make_tile(4, 0);
	let carrier_tile = source;
	let cargo_tile = source;
	const carrier = make_unit(source, owner, 1, ['DropPods']);
	carrier.movement = 0.75;
	carrier.get_tile = () => { return carrier_tile; };
	const cargo = make_unit(source, owner, 4, []);
	cargo.id = 11;
	cargo.def = 'Cargo';
	cargo.health = 0.9;
	cargo.transport_id = carrier.id;
	cargo.get_tile = () => { return cargo_tile; };
	carrier.get_cargo = () => { return [cargo]; };
	carrier.teleport_to_tile = (tile) => {
		carrier_tile = tile;
		cargo_tile = tile;
	};
	let active_carrier = carrier;
	const event = {
		caller: owner.id,
		game: {
			get_player: (id) => { return owner; },
			get_um: () => {
				return {
					has_unit: (id) => { return id == active_carrier.id || id == cargo.id; },
					get_unit: (id) => { return id == active_carrier.id ? active_carrier : cargo; },
				};
			},
			get_tm: () => { return {get_tile: (x, y) => { return source; }}; },
			trigger: (name, data) => {},
			message: (text) => {},
			is_master: () => { return false; },
		},
		data: {unit: carrier, destination: destination},
	};
	active_carrier = event.data.unit;
	event.resolved = event_rules.resolve(event);
	test.assert(event.resolved.units[0].unit == carrier);
	test.assert(event.resolved.units[1].unit == cargo);
	test.assert(!#is_defined(event.resolved.units[0].id));
	test.assert(!#is_defined(event.resolved.units[1].id));
	event.applied = event_rules.apply(event);
	test.assert(carrier_tile == destination && cargo_tile == destination);
	test.assert(active_carrier.health > 0.799 && active_carrier.health < 0.801);
	test.assert(cargo.health > 0.639 && cargo.health < 0.641);
	test.assert(active_carrier.movement == 0.75);
	test.assert(active_carrier.moved_this_turn && active_carrier.airdropped_this_turn);
	test.assert(cargo.moved_this_turn && cargo.airdropped_this_turn);
	event_rules.rollback(event);
	test.assert(carrier_tile == source && cargo_tile == source);
	test.assert(active_carrier.health == 1.0 && cargo.health == 0.9);
	test.assert(active_carrier.movement == 0.75);
	test.assert(!active_carrier.moved_this_turn && !active_carrier.airdropped_this_turn);
}

{
	const destination = make_tile(4, 0);
	let despawned = [];
	const carrier = make_unit(source, owner, 1, ['DropPods']);
	carrier.health = 0.1;
	const cargo = make_unit(source, owner, 1, []);
	cargo.id = 11;
	cargo.transport_id = carrier.id;
	carrier.get_cargo = () => { return [cargo]; };
	carrier.teleport_to_tile = (tile) => {};
	const event = {
		caller: owner.id,
		game: {
			get_player: (id) => { return owner; },
			get_um: () => { return {has_unit: (id) => { return true; }}; },
			trigger: (name, data) => {},
			message: (text) => {},
			is_master: () => { return true; },
			event: (name, data) => { despawned :+data.unit.id; },
		},
		data: {unit: carrier, destination: destination},
	};
	event.resolved = event_rules.resolve(event);
	event_rules.apply(event);
	test.assert(despawned == [cargo.id, carrier.id]);
}
