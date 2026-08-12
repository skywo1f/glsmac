const interception_rules = #include('../default/game/probe_interception');
const attack_unit = #include('../default/game/event/attack_unit');

const make_tile = (id, water) => {
	let units = [];
	let neighbours = [];
	return {
		id: id,
		x: id,
		y: 0,
		is_land: !water,
		is_water: water,
		get_units: () => { return units; },
		get_surrounding_tiles: () => { return neighbours; },
		set_units: (value) => { units = value; },
		set_neighbours: (value) => { neighbours = value; },
		is_adjactent_to: (tile) => {
			for (neighbour of neighbours) {
				if (neighbour == tile) {
					return true;
				}
			}
			return false;
		},
	};
};

let relation = 'treaty';
const actor = {
	id: 1,
	name: 'Peacekeepers',
	get_diplomatic_relation: (other) => { return relation; },
};
const target_player = {
	id: 2,
	name: 'University',
	get_diplomatic_relation: (other) => { return relation; },
};

const source = make_tile(1, false);
const target = make_tile(2, false);
source.set_neighbours([target]);
target.set_neighbours([source]);

let probe_tile = target;
const interceptor = {
	id: 10,
	owner: actor.id,
	health: 1.0,
	movement: 1.5,
	moved_this_turn: false,
	get_owner: () => { return actor; },
	get_tile: () => { return source; },
	get_def: () => { return {offense: 1, weapon: 'Laser'}; },
};
const probe = {
	id: 20,
	owner: target_player.id,
	health: 1.0,
	movement: 2.0,
	moved_this_turn: false,
	transport_id: 0,
	is_land: true,
	is_water: false,
	get_owner: () => { return target_player; },
	get_tile: () => { return probe_tile; },
	get_def: () => { return {offense: 0, weapon: 'ProbeTeam'}; },
	teleport_to_tile: (tile) => { probe_tile = tile; },
};
target.set_units([probe]);

const near_base_tile = make_tile(4, false);
const far_base_tile = make_tile(5, false);
const near_base = {
	id: 40,
	name: 'Academy Park',
	get_owner: () => { return target_player; },
	get_tile: () => { return near_base_tile; },
};
const far_base = {
	id: 50,
	name: 'University Base',
	get_owner: () => { return target_player; },
	get_tile: () => { return far_base_tile; },
};
let bases = [far_base, near_base];
let territory_owner = actor;
let notified = false;
let message = '';
const distances = {t4: 2, t5: 5};
const um = {
	has_unit: (id) => { return id == probe.id; },
	get_unit: (id) => {
		test.assert(id == probe.id);
		return probe;
	},
};
const tm = {
	get_distance: (from, to) => { return distances['t' + #to_string(to.id)]; },
};
const game = {
	get: (name) => {
		if (name == 'f_territory_get_owner') {
			return (tile) => { return territory_owner; };
		}
		return #undefined;
	},
	get_player: (id) => { return id == actor.id ? actor : target_player; },
	get_bm: () => { return {get_bases: () => { return bases; }}; },
	get_um: () => { return um; },
	get_tm: () => { return tm; },
	bm: {get_bases: () => { return bases; }},
	um: um,
	tm: tm,
	trigger: (name, data) => {
		notified = name == 'probe_interrogated' && data.player == actor &&
			data.target == target_player && data.unit == probe && data.base == near_base;
	},
	message: (text) => { message = text; },
};

let interception = interception_rules.get_interception(game, interceptor, probe);
test.assert(interception != null);
test.assert(interception.return_base == near_base);

const event = {
	game: game,
	data: {attacker: interceptor, defender: probe},
};
event.resolved = attack_unit.resolve(event);
test.assert(event.resolved.probe_interception.probe_id == probe.id);
test.assert(event.resolved.probe_interception.return_base_id == near_base.id);
event.applied = attack_unit.apply(event);
test.assert(probe_tile == near_base_tile);
test.assert(probe.movement == 2.0);
test.assert(probe.moved_this_turn == false);
test.assert(interceptor.get_tile() == source);
test.assert(interceptor.movement == 1.5);
test.assert(interceptor.moved_this_turn == false);
test.assert(notified);
test.assert(
	message ==
	'Peacekeepers interrogated and repatriated a University Probe Team to Academy Park.'
);
attack_unit.rollback(event);
test.assert(probe_tile == target);
test.assert(probe.movement == 2.0);
test.assert(probe.moved_this_turn == false);

relation = 'neutral';
test.assert(interception_rules.get_interception(game, interceptor, probe) != null);
relation = 'pact';
test.assert(interception_rules.get_interception(game, interceptor, probe) == null);
relation = 'vendetta';
test.assert(interception_rules.get_interception(game, interceptor, probe) == null);
relation = 'treaty';

territory_owner = target_player;
test.assert(interception_rules.get_interception(game, interceptor, probe) == null);
territory_owner = actor;

const noncombatant = #clone(interceptor);
noncombatant.get_def = () => { return {offense: 0, weapon: 'ColonyModule'}; };
test.assert(interception_rules.get_interception(game, noncombatant, probe) == null);

const guard = {
	id: 21,
	owner: target_player.id,
	health: 1.0,
	get_def: () => { return {offense: 1, weapon: 'Laser'}; },
};
target.set_units([probe, guard]);
test.assert(interception_rules.get_interception(game, interceptor, probe) == null);
target.set_units([probe]);

probe.transport_id = 99;
test.assert(interception_rules.get_interception(game, interceptor, probe) == null);
probe.transport_id = 0;

bases = [];
test.assert(interception_rules.get_interception(game, interceptor, probe) == null);
bases = [far_base, near_base];

const water = make_tile(6, true);
const sea_target = make_tile(7, true);
water.set_neighbours([sea_target]);
sea_target.set_neighbours([water]);
probe_tile = sea_target;
probe.is_land = false;
probe.is_water = true;
sea_target.set_units([probe]);
const ship = #clone(interceptor);
ship.get_tile = () => { return water; };
ship.get_def = () => { return {offense: 2, weapon: 'Laser'}; };

const landlocked_tile = make_tile(8, false);
landlocked_tile.set_neighbours([make_tile(9, false)]);
const coast_tile = make_tile(10, false);
coast_tile.set_neighbours([make_tile(11, true)]);
const landlocked_base = {
	id: 60,
	name: 'Inland Base',
	get_owner: () => { return target_player; },
	get_tile: () => { return landlocked_tile; },
};
const coast_base = {
	id: 70,
	name: 'Port University',
	get_owner: () => { return target_player; },
	get_tile: () => { return coast_tile; },
};
distances.t8 = 1;
distances.t10 = 3;
bases = [landlocked_base, coast_base];
interception = interception_rules.resolve(game, ship, probe);
test.assert(interception != null);
test.assert(interception.return_base_id == coast_base.id);
