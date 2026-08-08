const define_economy = #include('../default/game/economy');
const process_player_economy = #include('../default/game/event/process_player_economy');
const hurry_base_production = #include('../default/game/event/hurry_base_production');
const liquidate_base_facility = #include('../default/game/event/liquidate_base_facility');

let player = null;
player = {
	id: 1,
	energy_credits: 5,
	set_energy_credits: (value) => { player.energy_credits = value; },
};
let other_player = null;
other_player = {
	id: 2,
	energy_credits: 0,
	set_energy_credits: (value) => { other_player.energy_credits = value; },
};
const positive_base = {
	get_owner: () => { return player; },
	get_intake: () => { return {ENERGY: 10}; },
	get_consumption: () => { return {ENERGY: 0}; },
	get_facilities: () => { return [{psych_bonus: 4}]; },
};
const deficit_base = {
	get_owner: () => { return player; },
	get_intake: () => { return {ENERGY: 2}; },
	get_consumption: () => { return {ENERGY: 5}; },
	get_facilities: () => { return []; },
};

let callbacks = {};
let values = {
	f_technology_get_base_labs: (base) => {
		return {
			allocation: 0.4,
			value: base == positive_base ? 4 : 0,
			bonus: 2,
			total: base == positive_base ? 6 : 2,
		};
	},
};
let events = [];
const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (key, value) => { values[key] = value; },
	get: (key) => { return values[key]; },
	get_bm: () => { return {get_bases: () => { return [positive_base, deficit_base]; }}; },
	get_players: () => { return [player, other_player]; },
	is_master: () => { return true; },
	event: (name, data) => { events :+{name: name, data: data}; },
};

define_economy(game);
callbacks.start({});
test.assert(values.f_economy_get_base(game, positive_base) == 4);
test.assert(values.f_economy_get_base(game, deficit_base) == 0 - 3);
test.assert(values.f_economy_get_player(game, player) == 1);
const deficit_allocation = values.f_economy_get_base_allocation(game, deficit_base);
test.assert(deficit_allocation.economy.value == 0 - 3);
test.assert(deficit_allocation.labs.value == 0);
test.assert(deficit_allocation.psych.value == 0);
const positive_allocation = values.f_economy_get_base_allocation(game, positive_base);
test.assert(positive_allocation.psych.value == 2);
test.assert(positive_allocation.psych.bonus == 4);
test.assert(values.f_economy_get_base_psych(game, positive_base) == 6);

let hurry_minerals = 10;
let hurry_production = {production_kind: 'unit', mineral_cost: 20};
const hurry_base = {
	get_owner: () => { return player; },
	get_production: () => { return hurry_production; },
	get_accumulated_minerals: () => { return hurry_minerals; },
	set_accumulated_minerals: (value) => { hurry_minerals = value; },
};
test.assert(values.f_economy_get_hurry_cost(hurry_base) == 25);
hurry_minerals = 0;
test.assert(values.f_economy_get_hurry_cost(hurry_base) == 120);
hurry_minerals = 10;
hurry_production = {production_kind: 'facility', mineral_cost: 40};
test.assert(values.f_economy_get_hurry_cost(hurry_base) == 60);
hurry_minerals = 40;
test.assert(values.f_economy_get_hurry_cost(hurry_base) == 0);

callbacks.turn({});
test.assert(#sizeof(events) == 2);
test.assert(events[0].name == 'process_player_economy');
test.assert(events[0].data.player == player);
test.assert(events[0].data.energy_credits == 6);
test.assert(events[1].data.energy_credits == 0);

let trigger_count = 0;
const event_game = {trigger: (name, data) => {
	test.assert(name == 'economy_updated' && data.player.id == player.id);
	trigger_count++;
}};
let event = {
	caller: 0,
	game: event_game,
	data: {player: player, energy_credits: 12},
};
test.assert(!#is_defined(process_player_economy.validate(event)));
event.applied = process_player_economy.apply(event);
test.assert(player.energy_credits == 12);
test.assert(event.applied.energy_credits == 5);
process_player_economy.rollback(event);
test.assert(player.energy_credits == 5);
test.assert(trigger_count == 2);

event.caller = 1;
test.assert(#is_defined(process_player_economy.validate(event)));
event.caller = 0;
event.data.energy_credits = 0 - 1;
test.assert(#is_defined(process_player_economy.validate(event)));
event.data.energy_credits = 1000000001;
test.assert(#is_defined(process_player_economy.validate(event)));

player.energy_credits = 100;
hurry_minerals = 10;
hurry_production = {production_kind: 'unit', mineral_cost: 20};
let hurry_trigger_count = 0;
const hurry_game = {
	is_turn_complete: (player_id) => { return false; },
	get: (key) => { return values[key]; },
	trigger: (name, data) => { hurry_trigger_count++; },
};
let hurry_event = {caller: 1, game: hurry_game, data: {base: hurry_base}};
test.assert(!#is_defined(hurry_base_production.validate(hurry_event)));
hurry_event.applied = hurry_base_production.apply(hurry_event);
test.assert(player.energy_credits == 75);
test.assert(hurry_minerals == 20);
test.assert(hurry_event.applied.energy_credits == 100);
test.assert(hurry_event.applied.minerals == 10);
hurry_base_production.rollback(hurry_event);
test.assert(player.energy_credits == 100);
test.assert(hurry_minerals == 10);
test.assert(hurry_trigger_count == 2);

hurry_event.caller = 2;
test.assert(#is_defined(hurry_base_production.validate(hurry_event)));
hurry_event.caller = 1;
player.energy_credits = 24;
test.assert(#is_defined(hurry_base_production.validate(hurry_event)));

let poor_has_node = true;
let poor_player = null;
poor_player = {
	id: 3,
	energy_credits: 0,
	set_energy_credits: (value) => { poor_player.energy_credits = value; },
};
const network_node = {id: 'NetworkNode', energy_maintenance: 1, psych_bonus: 0};
const poor_base = {
	id: 9,
	get_owner: () => { return poor_player; },
	get_intake: () => { return {ENERGY: 0}; },
	get_consumption: () => { return {ENERGY: poor_has_node ? 2 : 1}; },
	get_facilities: () => { return poor_has_node ? [network_node] : []; },
	get_pops: () => { return []; },
	has_facility: (id) => { return poor_has_node && id == 'NetworkNode'; },
	remove_facility: (id) => { poor_has_node = false; },
	add_facility: (id) => { poor_has_node = true; },
};
let poor_callbacks = {};
let poor_values = {
	f_technology_get_base_labs: (base) => {
		return {allocation: 0.4, value: 0, bonus: 0, total: 0};
	},
	f_economy_get_base_psych: (game, base) => { return 0; },
	f_base_process_psych: (game, base, psych) => {},
};
let poor_events = [];
let poor_game = null;
poor_game = {
	on: (name, callback) => { poor_callbacks[name] = callback; },
	set: (key, value) => { poor_values[key] = value; },
	get: (key) => { return poor_values[key]; },
	get_bm: () => { return {
		get_bases: () => { return [poor_base]; },
		get_facility_def: (id) => { return network_node; },
	}; },
	get_players: () => { return [poor_player]; },
	is_master: () => { return true; },
	event: (name, data) => {
		poor_events :+{name: name, data: data};
		if (name == 'liquidate_base_facility') {
			const liquidation = {caller: 0, game: poor_game, data: data};
			test.assert(!#is_defined(liquidate_base_facility.validate(liquidation)));
			liquidate_base_facility.apply(liquidation);
		}
	},
};
define_economy(poor_game);
poor_callbacks.start({});
poor_callbacks.turn({});
test.assert(!poor_has_node);
test.assert(#sizeof(poor_events) == 2);
test.assert(poor_events[0].name == 'liquidate_base_facility');
test.assert(poor_events[1].name == 'process_player_economy');
test.assert(poor_events[1].data.energy_credits == 0);

poor_has_node = true;
let liquidation = {
	caller: 0,
	game: poor_game,
	data: {base: poor_base, facility_id: 'NetworkNode'},
};
test.assert(!#is_defined(liquidate_base_facility.validate(liquidation)));
liquidation.applied = liquidate_base_facility.apply(liquidation);
test.assert(!poor_has_node);
liquidate_base_facility.rollback(liquidation);
test.assert(poor_has_node);
liquidation.caller = 1;
test.assert(#is_defined(liquidate_base_facility.validate(liquidation)));
