const rules = #include('../default/game/unit_upgrade_rules');
const upgrade_design = #include('../default/game/event/upgrade_unit_design');

const make_def = (
	id,
	name,
	mineral_cost,
	chassis,
	weapon,
	armor,
	offense,
	defense,
	abilities
) => {
	return {
		id: id,
		name: name,
		mineral_cost: mineral_cost,
		chassis: chassis,
		weapon: weapon,
		armor: armor,
		reactor: 'FissionPlant',
		reactor_power: 1,
		offense: offense,
		defense: defense,
		required_technology: '',
		abilities: abilities,
		is_native: false,
		movement_per_turn: chassis == 'Foil' ? 4.0 : 1.0,
		operational_range: chassis == 'Needlejet' ? 2 : 0,
		cargo_capacity: 0,
	};
};

const scout = make_def(
	'ScoutPatrol', 'Scout Patrol', 10, 'Infantry', 'HandWeapons', 'NoArmor',
	1, 1, []
);
const laser = make_def(
	'LaserInfantry', 'Laser Infantry', 20, 'Infantry', 'Laser', 'NoArmor',
	2, 1, []
);
const transport = make_def(
	'TransportFoil', 'Transport Foil', 20, 'Foil', 'TroopTransport', 'NoArmor',
	0, 1, ['CarrierDeck']
);
transport.cargo_capacity = 2;
const plain_transport = #clone(transport);
plain_transport.id = 'PlainTransportFoil';
plain_transport.name = 'Plain Transport Foil';
plain_transport.abilities = [];
const improved_transport = #clone(transport);
improved_transport.id = 'ImprovedTransportFoil';
improved_transport.name = 'Improved Transport Foil';
improved_transport.mineral_cost = 30;
const needlejet = make_def(
	'Needlejet', 'Needlejet', 40, 'Needlejet', 'Laser', 'NoArmor',
	2, 1, []
);
const definitions = [
	scout, laser, transport, plain_transport, improved_transport, needlejet,
];

const player = {
	id: 1,
	type: 'human',
	name: 'Test Faction',
	energy_credits: 140,
	has_technology: (id) => { return true; },
	has_prototyped_component: (id) => { return true; },
	is_unit_design_obsolete: (id) => { return false; },
};
player.set_energy_credits = (value) => { player.energy_credits = value; };
const foreign_player = {id: 2, type: 'human', name: 'Other Faction'};
const tile = {x: 4, y: 6};
let units = [];

const find_unit = (id) => {
	for (unit of units) {
		if (unit.id == id) { return unit; }
	}
	return null;
};

const make_unit = (data) => {
	const def = rules.find_definition(game, data.def);
	let unit = {
		id: data.id,
		def: data.def,
		owner: data.owner.id,
		movement: #is_defined(data.movement) ? data.movement : def.movement_per_turn,
		morale: data.morale,
		health: data.health,
		moved_this_turn: #is_defined(data.moved_this_turn) ? data.moved_this_turn : false,
		terraforming: #is_defined(data.terraforming) ? data.terraforming : 'none',
		terraforming_turns_remaining: #is_defined(data.terraforming_turns_remaining)
			? data.terraforming_turns_remaining : 0,
		home_base_id: #is_defined(data.home_base_id) ? data.home_base_id : 0,
		fuel: #is_defined(data.fuel) ? data.fuel : def.operational_range,
		transport_id: #is_defined(data.transport_id) ? data.transport_id : 0,
		convoy_resource: #is_defined(data.convoy_resource) ? data.convoy_resource : 'none',
		native_capture_attempted: #is_defined(data.native_capture_attempted)
			? data.native_capture_attempted : false,
		monolith_upgraded: #is_defined(data.monolith_upgraded)
			? data.monolith_upgraded : false,
		is_air: data.def == needlejet.id,
	};
	unit.get_def = () => { return rules.find_definition(game, unit.def); };
	unit.get_tile = () => { return tile; };
	unit.get_cargo = () => {
		let cargo = [];
		for (candidate of units) {
			if (candidate.transport_id == unit.id) { cargo :+candidate; }
		}
		return cargo;
	};
	return unit;
};

const um = {
	get_unit_defs: () => { return definitions; },
	get_units: (include_embarked) => {
		let result = [];
		for (unit of units) {
			if (include_embarked || unit.transport_id == 0) { result :+unit; }
		}
		return result;
	},
	get_unit: (id) => { return find_unit(id); },
	has_unit: (id) => { return find_unit(id) != null; },
	despawn_unit: (unit) => {
		if (#sizeof(unit.get_cargo()) > 0) {
			throw Error('cargo must be removed before its transport');
		}
		let next = [];
		for (candidate of units) {
			if (candidate.id != unit.id) { next :+candidate; }
		}
		units = next;
	},
	spawn_unit: (data) => {
		const unit = make_unit(data);
		units :+unit;
		return unit;
	},
};

let triggers = [];
let message = '';
let turn_complete = false;
const game = {
	um: um,
	tm: {get_tile: (x, y) => { return tile; }},
	get_um: () => { return um; },
	get_player: (id) => { return id == player.id ? player : foreign_player; },
	is_turn_complete: (id) => { return turn_complete; },
	get: (key) => { return #undefined; },
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
	message: (value) => { message = value; },
};

units = [
	make_unit({
		id: 10, def: transport.id, owner: player, morale: 2, health: 1.0,
	}),
	make_unit({
		id: 1, def: scout.id, owner: player, morale: 4, health: 0.7,
		movement: 0.25, moved_this_turn: true, home_base_id: 3,
		monolith_upgraded: true,
	}),
	make_unit({
		id: 2, def: scout.id, owner: player, morale: 2, health: 1.0,
		movement: 0.0, moved_this_turn: true, transport_id: 10,
	}),
	make_unit({
		id: 3, def: scout.id, owner: foreign_player, morale: 1, health: 1.0,
	}),
];

let plan = rules.get_bulk_plan(game, player, scout, laser);
test.assert(plan.count == 2);
test.assert(plan.cost_per_unit == 30);
test.assert(plan.total_cost == 60);

let event = {
	caller: player.id,
	game: game,
	data: {source_def_id: scout.id, target_def_id: laser.id},
};
test.assert(!#is_defined(upgrade_design.validate(event)));
event.resolved = upgrade_design.resolve(event);
test.assert(event.resolved.unit_ids == [1, 2]);
event.applied = upgrade_design.apply(event);
test.assert(find_unit(1).def == laser.id && find_unit(2).def == laser.id);
test.assert(find_unit(3).def == scout.id);
test.assert(find_unit(1).movement == 0.25 && find_unit(1).moved_this_turn);
test.assert(find_unit(1).morale == 4 && find_unit(1).health == 0.7);
test.assert(find_unit(1).home_base_id == 3);
test.assert(find_unit(1).monolith_upgraded && !find_unit(2).monolith_upgraded);
test.assert(find_unit(2).transport_id == 10 && find_unit(2).movement == 0.0);
test.assert(player.energy_credits == 80);
test.assert(#sizeof(triggers) == 4);
test.assert(
	message == 'Test Faction upgraded 2 Scout Patrol units to Laser Infantry for ' +
		'60 energy credits.'
);

upgrade_design.rollback(event);
test.assert(find_unit(1).def == scout.id && find_unit(2).def == scout.id);
test.assert(find_unit(2).transport_id == 10);
test.assert(find_unit(1).monolith_upgraded && !find_unit(2).monolith_upgraded);
test.assert(player.energy_credits == 140);
test.assert(#sizeof(triggers) == 8);

player.energy_credits = 50;
test.assert(
	upgrade_design.validate(event) ==
		'Not enough energy credits to upgrade all units of this design'
);
player.energy_credits = 140;
turn_complete = true;
test.assert(upgrade_design.validate(event) == 'Player has already completed this turn');
turn_complete = false;

units :+make_unit({
	id: 20, def: transport.id, owner: player, morale: 2, health: 1.0,
});
units :+make_unit({
	id: 21, def: needlejet.id, owner: player, morale: 2, health: 1.0,
	transport_id: 20,
});
test.assert(
	rules.get_bulk_plan(game, player, transport, plain_transport).error ==
		'Carrier Deck is required by embarked aircraft'
);

event = {
	caller: player.id,
	game: game,
	data: {source_def_id: transport.id, target_def_id: improved_transport.id},
};
test.assert(!#is_defined(upgrade_design.validate(event)));
event.resolved = upgrade_design.resolve(event);
test.assert(event.resolved.unit_ids == [10, 20]);
event.applied = upgrade_design.apply(event);
test.assert(find_unit(10).def == improved_transport.id);
test.assert(find_unit(20).def == improved_transport.id);
test.assert(find_unit(21).def == needlejet.id && find_unit(21).transport_id == 20);
test.assert(player.energy_credits == 80);
test.assert(#sizeof(triggers) == 12);
upgrade_design.rollback(event);
test.assert(find_unit(10).def == transport.id && find_unit(20).def == transport.id);
test.assert(find_unit(21).def == needlejet.id && find_unit(21).transport_id == 20);
test.assert(player.energy_credits == 140);
test.assert(#sizeof(triggers) == 16);
