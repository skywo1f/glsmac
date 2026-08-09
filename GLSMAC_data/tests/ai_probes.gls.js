const probes = #include('../default/game/ai/probes');

let relation = 'neutral';
let infiltrated = false;
let hunter_seeker = false;
let unknown_technologies = [];
let mind_control_cost = 100;
let subversion_cost = 50;

const player = {
	id: 0,
	energy_credits: 1000,
	has_infiltrated: (other) => { return infiltrated; },
	get_diplomatic_relation: (other) => { return relation; },
};
const target_player = {id: 1, energy_credits: 200};
const base_tile = {};
const base = {
	id: 10,
	get_owner: () => { return target_player; },
	get_size: () => { return 3; },
	get_accumulated_minerals: () => { return 20; },
	get_tile: () => { return base_tile; },
};
const unit = {
	id: 20,
	owner: 1,
	transport_id: 0,
	get_cargo: () => { return []; },
	get_def: () => { return {mineral_cost: 4}; },
};
const game = {
	get: (key) => {
		if (key == 'f_probe_has_project') {
			return (owner, project) => { return hunter_seeker; };
		}
		if (key == 'f_probe_get_mind_control_cost') {
			return (actor, target) => { return mind_control_cost; };
		}
		if (key == 'f_probe_get_unknown_technologies') {
			return (actor, target) => { return unknown_technologies; };
		}
		if (key == 'f_probe_get_subversion_cost') {
			return (actor, target) => { return subversion_cost; };
		}
	},
	get_player: (id) => { return target_player; },
	get_tm: () => {
		return {get_distance: (from, to) => { return to == base_tile ? 4 : 20; }};
	},
};
const probe = {
	get_tile: () => {
		return {
			get_surrounding_tiles: () => {
				return [{get_base: () => { return base; }, get_units: () => { return [unit]; }}];
			},
		};
	},
};

test.assert(probes.get_base_action(game, player, probe, base).operation == 'infiltrate');
infiltrated = true;
test.assert(probes.get_base_action(game, player, probe, base) == null);
relation = 'treaty';
infiltrated = false;
test.assert(probes.get_base_action(game, player, probe, base) == null);

relation = 'vendetta';
infiltrated = true;
unknown_technologies = ['IndustrialBase'];
test.assert(probes.get_base_action(game, player, probe, base).operation == 'mind_control_base');
player.energy_credits = 75;
test.assert(probes.get_base_action(game, player, probe, base).operation == 'steal_technology');
unknown_technologies = [];
test.assert(probes.get_base_action(game, player, probe, base).operation == 'drain_energy');

player.energy_credits = 1000;
hunter_seeker = true;
test.assert(probes.get_base_action(game, player, probe, base) == null);
hunter_seeker = false;

test.assert(probes.get_unit_action(game, player, probe, unit).operation == 'subvert_unit');
relation = 'neutral';
test.assert(probes.get_unit_action(game, player, probe, unit) == null);
relation = 'vendetta';
subversion_cost = 2000;
test.assert(probes.get_unit_action(game, player, probe, unit) == null);
subversion_cost = 50;
mind_control_cost = null;

test.assert(probes.choose_adjacent_action(game, player, probe).operation == 'drain_energy');
const destination = probes.choose_target_base(game, player, probe, [base]);
test.assert(destination.base == base);
test.assert(destination.action.operation == 'drain_energy');
