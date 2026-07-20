const set_base_production = #include('../default/game/event/set_base_production');
const queue_base_production = #include('../default/game/event/queue_base_production');
const remove_base_production = #include('../default/game/event/remove_base_production');
const process_base_production = #include('../default/game/event/process_base_production');

const owner = {id: 1};
const tile = {id: 'base-tile'};
const mind_worms = {
	id: 'MindWorms',
	name: 'Mind Worms',
	production_kind: 'unit',
	mineral_cost: 30,
};
const spore_launcher = {
	id: 'SporeLauncher',
	name: 'Spore Launcher',
	production_kind: 'unit',
	mineral_cost: 50,
};
const recycling_tanks = {
	id: 'RecyclingTanks',
	name: 'Recycling Tanks',
	production_kind: 'facility',
	mineral_cost: 40,
};
const definitions = [mind_worms, spore_launcher, recycling_tanks];

let production_queue = [];
let built_facilities = [];
let accumulated_minerals = 0;
let pending_production = 7;
let spawned_unit = #undefined;
let spawn_data = #undefined;
let despawned_unit = #undefined;

const find_definition = (kind, id) => {
	for (definition of definitions) {
		if (definition.production_kind == kind && definition.id == id) {
			return definition;
		}
	}
	return #undefined;
};

const has_facility = (id) => {
	for (facility_id of built_facilities) {
		if (facility_id == id) {
			return true;
		}
	}
	return false;
};

const queue_is_valid = (candidate_queue) => {
	if (#sizeof(candidate_queue) > 8) {
		return false;
	}
	let queued_facilities = [];
	for (item of candidate_queue) {
		if (!#is_defined(find_definition(item.production_kind, item.id))) {
			return false;
		}
		if (item.production_kind == 'facility') {
			if (has_facility(item.id)) {
				return false;
			}
			for (facility_id of queued_facilities) {
				if (facility_id == item.id) {
					return false;
				}
			}
			queued_facilities :+item.id;
		}
	}
	return true;
};

const get_queue_state = () => {
	let result = [];
	for (item of production_queue) {
		result :+item.production_kind + ':' + item.id;
	}
	return result;
};

const base = {
	get_owner: () => {
		return owner;
	},
	get_tile: () => {
		return tile;
	},
	get_production: () => {
		return #sizeof(production_queue) > 0
			? production_queue[0]
			: #undefined;
	},
	get_production_queue: () => {
		return production_queue;
	},
	can_set_production: (kind, id) => {
		const definition = find_definition(kind, id);
		if (!#is_defined(definition)) {
			return false;
		}
		let candidate_queue = [];
		for (item of production_queue) {
			candidate_queue :+item;
		}
		if (#sizeof(candidate_queue) == 0) {
			candidate_queue :+definition;
		} else {
			candidate_queue[0] = definition;
		}
		return queue_is_valid(candidate_queue);
	},
	can_queue_production: (kind, id) => {
		const definition = find_definition(kind, id);
		if (!#is_defined(definition)) {
			return false;
		}
		let candidate_queue = [];
		for (item of production_queue) {
			candidate_queue :+item;
		}
		candidate_queue :+definition;
		return queue_is_valid(candidate_queue);
	},
	set_production: (kind, id) => {
		const definition = find_definition(kind, id);
		if (#sizeof(production_queue) == 0) {
			production_queue :+definition;
		} else {
			production_queue[0] = definition;
		}
	},
	queue_production: (kind, id) => {
		production_queue :+find_definition(kind, id);
	},
	remove_production: (index) => {
		let updated_queue = [];
		let i = 0;
		for (item of production_queue) {
			if (i != index) {
				updated_queue :+item;
			}
			i++;
		}
		production_queue = updated_queue;
	},
	set_production_queue: (specs) => {
		let restored_queue = [];
		for (spec of specs) {
			restored_queue :+find_definition(spec.kind, spec.id);
		}
		test.assert(queue_is_valid(restored_queue));
		production_queue = restored_queue;
	},
	clear_production: () => {
		production_queue = [];
	},
	has_facility: (id) => {
		return has_facility(id);
	},
	add_facility: (id) => {
		test.assert(!has_facility(id));
		built_facilities :+id;
	},
	remove_facility: (id) => {
		let updated_facilities = [];
		let removed = false;
		for (facility_id of built_facilities) {
			if (facility_id == id) {
				removed = true;
			} else {
				updated_facilities :+facility_id;
			}
		}
		test.assert(removed);
		built_facilities = updated_facilities;
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
			return pending_production;
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

production_queue = [mind_worms, spore_launcher];
let event = {
	caller: owner.id,
	game: game,
	data: {
		base: base,
		kind: 'facility',
		id: 'RecyclingTanks',
	},
};
test.assert(!#is_defined(set_base_production.validate(event)));
event.caller = 2;
test.assert(#is_defined(set_base_production.validate(event)));
event.caller = owner.id;
turn_complete = true;
test.assert(#is_defined(set_base_production.validate(event)));
turn_complete = false;
event.data.kind = 'unit';
event.data.id = 'FungalTower';
test.assert(#is_defined(set_base_production.validate(event)));
event.data.kind = 'facility';
event.data.id = 'RecyclingTanks';

event.applied = set_base_production.apply(event);
test.assert(get_queue_state() == ['facility:RecyclingTanks', 'unit:SporeLauncher']);
set_base_production.rollback(event);
test.assert(get_queue_state() == ['unit:MindWorms', 'unit:SporeLauncher']);

production_queue = [];
event.applied = set_base_production.apply(event);
test.assert(get_queue_state() == ['facility:RecyclingTanks']);
set_base_production.rollback(event);
test.assert(get_queue_state() == []);

production_queue = [mind_worms];
event = {
	caller: owner.id,
	game: game,
	data: {
		base: base,
		kind: 'unit',
		id: 'SporeLauncher',
	},
};
test.assert(!#is_defined(queue_base_production.validate(event)));
event.caller = 2;
test.assert(#is_defined(queue_base_production.validate(event)));
event.caller = owner.id;
turn_complete = true;
test.assert(#is_defined(queue_base_production.validate(event)));
turn_complete = false;

event.applied = queue_base_production.apply(event);
test.assert(get_queue_state() == ['unit:MindWorms', 'unit:SporeLauncher']);
queue_base_production.rollback(event);
test.assert(get_queue_state() == ['unit:MindWorms']);

production_queue = [mind_worms, recycling_tanks];
event.data.kind = 'facility';
event.data.id = 'RecyclingTanks';
test.assert(#is_defined(queue_base_production.validate(event)));
production_queue = [mind_worms, mind_worms, mind_worms, mind_worms, mind_worms, mind_worms, mind_worms, mind_worms];
event.data.kind = 'unit';
event.data.id = 'SporeLauncher';
test.assert(#is_defined(queue_base_production.validate(event)));

production_queue = [mind_worms, recycling_tanks, spore_launcher];
event = {
	caller: owner.id,
	game: game,
	data: {
		base: base,
		index: 1,
	},
};
test.assert(!#is_defined(remove_base_production.validate(event)));
event.caller = 2;
test.assert(#is_defined(remove_base_production.validate(event)));
event.caller = owner.id;
turn_complete = true;
test.assert(#is_defined(remove_base_production.validate(event)));
turn_complete = false;
event.data.index = -1;
test.assert(#is_defined(remove_base_production.validate(event)));
event.data.index = 3;
test.assert(#is_defined(remove_base_production.validate(event)));
event.data.index = 1;

event.applied = remove_base_production.apply(event);
test.assert(get_queue_state() == ['unit:MindWorms', 'unit:SporeLauncher']);
remove_base_production.rollback(event);
test.assert(get_queue_state() == ['unit:MindWorms', 'facility:RecyclingTanks', 'unit:SporeLauncher']);

production_queue = [mind_worms, spore_launcher];
built_facilities = [];
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
test.assert(get_queue_state() == ['unit:SporeLauncher']);
test.assert(#is_defined(spawned_unit));
test.assert(spawn_data.def == mind_worms.id);
test.assert(spawn_data.owner == owner);
test.assert(spawn_data.tile == tile);
test.assert(spawn_data.morale == 1);
test.assert(spawn_data.health == 1.0);
process_base_production.rollback(event);
test.assert(accumulated_minerals == 25);
test.assert(get_queue_state() == ['unit:MindWorms', 'unit:SporeLauncher']);
test.assert(!#is_defined(spawned_unit));
test.assert(despawned_unit.id == 17);

production_queue = [mind_worms];
accumulated_minerals = 25;
spawned_unit = #undefined;
despawned_unit = #undefined;
event.applied = process_base_production.apply(event);
test.assert(accumulated_minerals == 2);
test.assert(get_queue_state() == ['unit:MindWorms']);
test.assert(#is_defined(spawned_unit));
process_base_production.rollback(event);
test.assert(accumulated_minerals == 25);
test.assert(get_queue_state() == ['unit:MindWorms']);

production_queue = [mind_worms];
accumulated_minerals = 10;
spawn_data = #undefined;
despawned_unit = #undefined;
event.applied = process_base_production.apply(event);
test.assert(accumulated_minerals == 17);
test.assert(get_queue_state() == ['unit:MindWorms']);
test.assert(!#is_defined(spawn_data));
process_base_production.rollback(event);
test.assert(accumulated_minerals == 10);
test.assert(get_queue_state() == ['unit:MindWorms']);
test.assert(!#is_defined(despawned_unit));

production_queue = [recycling_tanks, spore_launcher];
built_facilities = [];
accumulated_minerals = 35;
spawn_data = #undefined;
event.applied = process_base_production.apply(event);
test.assert(accumulated_minerals == 2);
test.assert(get_queue_state() == ['unit:SporeLauncher']);
test.assert(has_facility('RecyclingTanks'));
test.assert(!#is_defined(spawn_data));
process_base_production.rollback(event);
test.assert(accumulated_minerals == 35);
test.assert(get_queue_state() == ['facility:RecyclingTanks', 'unit:SporeLauncher']);
test.assert(!has_facility('RecyclingTanks'));

production_queue = [];
accumulated_minerals = 9;
event.applied = process_base_production.apply(event);
test.assert(accumulated_minerals == 9);
test.assert(!#is_defined(event.applied.produced_unit));
test.assert(!#is_defined(event.applied.completed_facility));
process_base_production.rollback(event);
test.assert(accumulated_minerals == 9);
test.assert(get_queue_state() == []);
