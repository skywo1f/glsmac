const set_base_production = #include('../default/game/event/set_base_production');
const process_base_production = #include('../default/game/event/process_base_production');

const owner = {id: 1};
const tile = {id: 'base-tile'};
const mind_worms = {id: 'MindWorms', name: 'Mind Worms', mineral_cost: 30};
const spore_launcher = {id: 'SporeLauncher', name: 'Spore Launcher', mineral_cost: 50};
let production = mind_worms;
let accumulated_minerals = 0;
let spawned_unit = #undefined;
let spawn_data = #undefined;
let despawned_unit = #undefined;

const definitions = {
	MindWorms: mind_worms,
	SporeLauncher: spore_launcher,
};

const base = {
	get_owner: () => {
		return owner;
	},
	get_tile: () => {
		return tile;
	},
	can_produce: (id) => {
		return #is_defined(definitions[id]);
	},
	get_production: () => {
		return production;
	},
	set_production: (id) => {
		production = definitions[id];
	},
	clear_production: () => {
		production = #undefined;
	},
	get_accumulated_minerals: () => {
		return accumulated_minerals;
	},
	set_accumulated_minerals: (minerals) => {
		accumulated_minerals = minerals;
	},
};

let turn_complete = false;
const game = {
	is_turn_complete: (player_id) => {
		test.assert(player_id == owner.id);
		return turn_complete;
	},
	get: (key) => {
		test.assert(key == 'f_base_get_pending_production');
		return (target_base) => {
			test.assert(target_base == base);
			return 7;
		};
	},
	um: {
		spawn_unit: (data) => {
			spawn_data = data;
			spawned_unit = {id: 17};
			return spawned_unit;
		},
		despawn_unit: (unit) => {
			despawned_unit = unit;
			spawned_unit = #undefined;
		},
	},
};

let event = {
	caller: owner.id,
	game: game,
	data: {
		base: base,
		type: 'SporeLauncher',
	},
};
test.assert(!#is_defined(set_base_production.validate(event)));
event.caller = 2;
test.assert(#is_defined(set_base_production.validate(event)));
event.caller = owner.id;
turn_complete = true;
test.assert(#is_defined(set_base_production.validate(event)));
turn_complete = false;
event.data.type = 'FungalTower';
test.assert(#is_defined(set_base_production.validate(event)));
event.data.type = 'SporeLauncher';

event.applied = set_base_production.apply(event);
test.assert(production == spore_launcher);
set_base_production.rollback(event);
test.assert(production == mind_worms);

production = #undefined;
event.applied = set_base_production.apply(event);
test.assert(production == spore_launcher);
set_base_production.rollback(event);
test.assert(!#is_defined(production));

production = mind_worms;
accumulated_minerals = 25;
spawned_unit = #undefined;
spawn_data = #undefined;
despawned_unit = #undefined;
event = {
	caller: 0,
	game: game,
	data: {
		base: base,
	},
};
test.assert(!#is_defined(process_base_production.validate(event)));
event.caller = owner.id;
test.assert(#is_defined(process_base_production.validate(event)));
event.caller = 0;

event.applied = process_base_production.apply(event);
test.assert(accumulated_minerals == 2);
test.assert(#is_defined(spawned_unit));
test.assert(spawn_data.def == mind_worms.id);
test.assert(spawn_data.owner == owner);
test.assert(spawn_data.tile == tile);
test.assert(spawn_data.morale == 1);
test.assert(spawn_data.health == 1.0);
process_base_production.rollback(event);
test.assert(accumulated_minerals == 25);
test.assert(!#is_defined(spawned_unit));
test.assert(despawned_unit.id == 17);

accumulated_minerals = 10;
spawn_data = #undefined;
despawned_unit = #undefined;
event.applied = process_base_production.apply(event);
test.assert(accumulated_minerals == 17);
test.assert(!#is_defined(spawn_data));
process_base_production.rollback(event);
test.assert(accumulated_minerals == 10);
test.assert(!#is_defined(despawned_unit));

production = #undefined;
accumulated_minerals = 9;
event.applied = process_base_production.apply(event);
test.assert(accumulated_minerals == 9);
test.assert(!#is_defined(event.applied.produced_unit));
process_base_production.rollback(event);
test.assert(accumulated_minerals == 9);
