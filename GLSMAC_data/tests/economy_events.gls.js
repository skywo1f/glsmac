const define_economy = #include('../default/game/economy');
const process_player_economy = #include('../default/game/event/process_player_economy');
const hurry_base_production = #include('../default/game/event/hurry_base_production');

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
};
const deficit_base = {
	get_owner: () => { return player; },
	get_intake: () => { return {ENERGY: 2}; },
	get_consumption: () => { return {ENERGY: 5}; },
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
