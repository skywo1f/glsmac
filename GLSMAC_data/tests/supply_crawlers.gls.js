const supply_rules = #include('../default/game/supply_rules');
const set_convoy = #include('../default/game/event/set_supply_convoy');
const contribute = #include('../default/game/event/contribute_supply_transport');

const player = {
	id: 1,
	name: 'The University',
	has_prototyped_component: (id) => { return false; },
};
const other_player = {id: 2, name: 'The Hive'};
let production = {
	id: 'TheWeatherParadigm',
	name: 'The Weather Paradigm',
	production_kind: 'project',
	mineral_cost: 200,
};
let base_a_minerals = 10;
let base_b_minerals = 20;
let base_a = null;
let base_b = null;
const base_a_tile = {
	x: 2,
	y: 2,
	get_base: () => { return base_a; },
};
const base_b_tile = {
	x: 8,
	y: 2,
	get_base: () => { return base_b; },
};
base_a = {
	id: 10,
	name: 'Alpha Base',
	get_owner: () => { return player; },
	get_tile: () => { return base_a_tile; },
	get_production: () => { return production; },
	get_accumulated_minerals: () => { return base_a_minerals; },
	set_accumulated_minerals: (value) => { base_a_minerals = value; },
};
base_b = {
	id: 11,
	name: 'Beta Base',
	get_owner: () => { return player; },
	get_tile: () => { return base_b_tile; },
	get_production: () => { return production; },
	get_accumulated_minerals: () => { return base_b_minerals; },
	set_accumulated_minerals: (value) => { base_b_minerals = value; },
};
const source_tile = {
	x: 4,
	y: 2,
	is_land: true,
	terraforming: {forest: false},
	get_base: () => { return null; },
	get_resources: (owner) => { return {NUTRIENTS: 2, MINERALS: 4, ENERGY: 1}; },
};
const supply_def = {
	id: 'SupplyCrawler',
	name: 'Supply Crawler',
	weapon: 'SupplyTransport',
	mineral_cost: 30,
};
let current_tile = source_tile;
let convoy_resource = 'none';
let crawler = null;
crawler = {
	id: 21,
	def: supply_def.id,
	owner: player.id,
	movement: 1.0,
	morale: 2,
	health: 1.0,
	moved_this_turn: false,
	terraforming: 'none',
	terraforming_turns_remaining: 0,
	home_base_id: base_a.id,
	fuel: 0,
	transport_id: 0,
	native_capture_attempted: false,
	get_def: () => { return supply_def; },
	get_tile: () => { return current_tile; },
	set_convoy_resource: (value) => {
		convoy_resource = value;
		crawler.convoy_resource = value;
	},
	convoy_resource: convoy_resource,
};

let units = [crawler];
let turn_complete = false;
let despawned = null;
let spawned_data = null;
let messages = [];
const game = {
	is_turn_complete: (id) => { return turn_complete; },
	get_player: (id) => { return id == player.id ? player : other_player; },
	get_bm: () => { return {get_bases: () => { return [base_a, base_b]; }}; },
	get_um: () => { return {get_units: () => { return units; }}; },
	message: (value) => { messages :+value; },
	um: {
		despawn_unit: (unit) => { despawned = unit; },
		spawn_unit: (data) => {
			spawned_data = data;
			return {
				movement: 0.0,
				moved_this_turn: true,
				native_capture_attempted: false,
			};
		},
	},
	tm: {
		get_tile: (x, y) => {
			if (x == source_tile.x && y == source_tile.y) {
				return source_tile;
			}
			return x == base_a_tile.x ? base_a_tile : base_b_tile;
		},
	},
};

test.assert(supply_rules.is_supply_transport(crawler));
test.assert(supply_rules.get_home_base(game, crawler) == base_a);
test.assert(!#is_defined(supply_rules.get_order_error(
	game,
	crawler,
	player.id,
	'MINERALS'
)));

let event = {
	caller: player.id,
	game: game,
	data: {unit: crawler, resource: 'MINERALS'},
};
event.resolved = set_convoy.resolve(event);
event.applied = set_convoy.apply(event);
test.assert(crawler.convoy_resource == 'MINERALS');
test.assert(event.data.unit.movement == 0.0);
test.assert(event.data.unit.moved_this_turn);

let adjustment = supply_rules.get_base_convoy_adjustment(game, base_a);
test.assert(adjustment == {NUTRIENTS: 0, MINERALS: 4, ENERGY: 0});

set_convoy.rollback(event);
test.assert(crawler.convoy_resource == 'none');
test.assert(event.data.unit.movement == 1.0);
test.assert(!event.data.unit.moved_this_turn);

crawler.set_convoy_resource('ENERGY');
adjustment = supply_rules.get_base_convoy_adjustment(game, base_a, {
	worked_tile_energy_bonus: 1,
	social_tile_energy_bonus: 2,
});
test.assert(adjustment == {NUTRIENTS: 0, MINERALS: 0, ENERGY: 4});
current_tile = base_b_tile;
adjustment = supply_rules.get_base_convoy_adjustment(game, base_a);
test.assert(adjustment == {NUTRIENTS: 0, MINERALS: 0, ENERGY: 0});
let convoy_consumption = supply_rules.get_base_convoy_consumption(game, base_a);
test.assert(convoy_consumption == {NUTRIENTS: 0, MINERALS: 0, ENERGY: 1});
adjustment = supply_rules.get_base_convoy_adjustment(game, base_b);
test.assert(adjustment == {NUTRIENTS: 0, MINERALS: 0, ENERGY: 1});
current_tile = base_a_tile;
adjustment = supply_rules.get_base_convoy_adjustment(game, base_a);
test.assert(adjustment == {NUTRIENTS: 0, MINERALS: 0, ENERGY: 0});
convoy_consumption = supply_rules.get_base_convoy_consumption(game, base_a);
test.assert(convoy_consumption == {NUTRIENTS: 0, MINERALS: 0, ENERGY: 0});

crawler.set_convoy_resource('none');
crawler.movement = 1.0;
crawler.moved_this_turn = false;
current_tile = base_b_tile;
event = {caller: player.id, game: game, data: {unit: crawler}};
test.assert(!#is_defined(contribute.validate(event)));
event.resolved = contribute.resolve(event);
test.assert(event.resolved.minerals == supply_def.mineral_cost);
event.applied = contribute.apply(event);
test.assert(base_b_minerals == 50);
test.assert(despawned == crawler);
test.assert(messages == [
	'The University has disbanded Supply Crawler for 30 minerals toward ' +
	'The Weather Paradigm.',
]);

contribute.rollback(event);
test.assert(base_b_minerals == 20);
test.assert(spawned_data.id == crawler.id);
test.assert(spawned_data.convoy_resource == 'none');

current_tile = base_a_tile;
test.assert(#is_defined(supply_rules.get_order_error(
	game,
	crawler,
	player.id,
	'NUTRIENTS'
)));
turn_complete = true;
test.assert(#is_defined(supply_rules.get_contribution_error(game, crawler, player.id)));
