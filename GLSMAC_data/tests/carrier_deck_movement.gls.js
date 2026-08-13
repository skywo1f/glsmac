const move_unit = #include('../default/game/event/move_unit');

const owner = {id: 1, type: 'human'};

const make_tile = (is_land, is_water) => {
	let units = [];
	return {
		is_land: is_land,
		is_water: is_water,
		features: {river: false, xenofungus: false},
		terraforming: {road: false},
		rockiness: 0,
		get_base: () => { return null; },
		get_units: () => { return units; },
		is_locked: () => { return false; },
		is_adjactent_to: (tile) => { return true; },
		set_units: (value) => { units = value; },
	};
};

const source = make_tile(true, false);
const water = make_tile(false, true);
const landing = make_tile(true, false);
let current_tile = source;
let transport_id = 0;
let aircraft = null;

const carrier = {
	id: 20,
	owner: owner.id,
	transport_id: 0,
	is_water: true,
	get_def: () => {
		return {cargo_capacity: 2, abilities: ['CarrierDeck']};
	},
	get_cargo: () => { return []; },
};
const ordinary_transport = {
	id: 21,
	owner: owner.id,
	transport_id: 0,
	is_water: true,
	get_def: () => {
		return {cargo_capacity: 2, abilities: []};
	},
	get_cargo: () => { return []; },
};
aircraft = {
	id: 10,
	owner: owner.id,
	transport_id: 0,
	health: 1.0,
	is_land: false,
	is_water: false,
	is_air: true,
	is_immovable: false,
	terraforming: 'none',
	movement: 1.0,
	moved_this_turn: false,
	get_owner: () => { return owner; },
	get_def: () => {
		return {is_native: false, abilities: []};
	},
	get_tile: () => { return current_tile; },
	get_transport: () => { return transport_id == carrier.id ? carrier : null; },
	move_to_tile: (tile, oncomplete) => {
		current_tile = tile;
		oncomplete();
	},
	embark: (transport) => {
		transport_id = transport.id;
		aircraft.transport_id = transport.id;
	},
	disembark: () => {
		transport_id = 0;
		aircraft.transport_id = 0;
	},
};
const game = {
	is_turn_complete: () => { return false; },
	random: {get_float: () => { throw Error('full movement point should not roll'); }},
	um: {
		get_unit: (id) => {
			test.assert(id == carrier.id);
			return carrier;
		},
	},
};

water.set_units([ordinary_transport]);
let resolved = move_unit.resolve({game: game, data: {unit: aircraft, tile: water}});
test.assert(resolved.transport_id == 0);

water.set_units([ordinary_transport, carrier]);
resolved = move_unit.resolve({game: game, data: {unit: aircraft, tile: water}});
test.assert(resolved.transport_id == carrier.id);
test.assert(resolved.transport_reference == carrier);

let event = {
	caller: owner.id,
	game: game,
	data: {unit: aircraft, tile: water},
	resolved: resolved,
};
test.assert(!#is_defined(move_unit.validate(event)));
event.applied = move_unit.apply(event);
test.assert(current_tile == water);
test.assert(aircraft.transport_id == carrier.id);

water.set_units([carrier]);
event = {
	caller: owner.id,
	game: game,
	data: {unit: aircraft, tile: landing},
};
test.assert(!#is_defined(move_unit.validate(event)));
event.resolved = move_unit.resolve(event);
event.applied = move_unit.apply(event);
test.assert(current_tile == landing);
test.assert(aircraft.transport_id == 0);
move_unit.rollback(event);
test.assert(current_tile == water);
test.assert(aircraft.transport_id == carrier.id);
