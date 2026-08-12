const define_probes = #include('../default/game/probes');

let callbacks = {};
let values = {};
let bases = [];
let units = [];
let players = {};
const game = {
	on: (name, callback) => {
		if (!#is_defined(callbacks[name])) {
			callbacks[name] = [];
		}
		callbacks[name] :+callback;
	},
	set: (name, value) => { values[name] = value; },
	get: (name) => { return values[name]; },
	get_bm: () => { return {get_bases: () => { return bases; }}; },
	get_um: () => { return {get_units: () => { return units; }}; },
	get_tm: () => { return {get_distance: (first, second) => { return 4; }}; },
	get_player: (id) => { return players['p' + #to_string(id)]; },
};

values.f_social_get_ratings = (player) => { return {probe: player.probe_rating}; };
define_probes(game);
for (callback of callbacks.start) {
	callback({});
}

const make_player = (id, energy, rating, technologies) => {
	let infiltrated = false;
	let research_target = '';
	let research_progress = 0;
	return {
		id: id,
		energy_credits: energy,
		probe_rating: rating,
		get_research_state: () => {
			return {
				technologies: technologies,
				target: research_target,
				progress: research_progress,
			};
		},
		get_energy_credits: () => { return energy; },
		set_test_research: (target, progress) => {
			research_target = target;
			research_progress = progress;
		},
		get_social_engineering: () => {
			return {
				politics: 'Democratic', economics: 'Green',
				values: 'Knowledge', future_society: 'None',
			};
		},
		get_diplomatic_relation: (other) => { return 'neutral'; },
		has_infiltrated: (other) => { return infiltrated; },
		set_test_infiltrated: (value) => { infiltrated = value; },
	};
};

const actor = make_player(1, 500, 0, ['InformationNetworks']);
const target_player = make_player(2, 200, 0, ['InformationNetworks', 'PlanetaryNetworks']);
players.p1 = actor;
players.p2 = target_player;

const headquarters = {
	id: 1,
	name: 'Target Headquarters',
	get_owner: () => { return target_player; },
	get_facilities: () => { return [{id: 'Headquarters', is_project: false}]; },
	has_facility: (id) => { return id == 'Headquarters'; },
	get_tile: () => { return {id: 'headquarters'}; },
	get_size: () => { return 5; },
};
const target_tile = {id: 'target'};
const target_base = {
	id: 2,
	name: 'Target Outpost',
	get_owner: () => { return target_player; },
	get_facilities: () => { return []; },
	has_facility: (id) => { return false; },
	get_tile: () => { return target_tile; },
	get_size: () => { return 4; },
	get_pops: () => { return [
		{get_type: () => { return 'WORKER'; }},
		{get_type: () => { return 'DRONE'; }},
	]; },
};
bases = [headquarters, target_base];

const probe = {
	morale: 2,
	get_def: () => { return {weapon: 'ProbeTeam'}; },
};
const target_def = {
	mineral_cost: 40,
	offense: 2,
	weapon: 'Laser',
	can_found_base: false,
	can_terraform: false,
	abilities: [],
};
const target_unit = {
	owner: 2,
	health: 1.0,
	is_land: true,
	is_water: false,
	is_air: false,
	get_tile: () => { return target_base.get_tile(); },
	get_def: () => { return target_def; },
};
units = [target_unit];

test.assert(values.f_probe_is_unit(probe));
test.assert(values.f_probe_get_success_chance(probe, target_player, 'infiltrate') == 85);
test.assert(values.f_probe_get_success_chance(probe, target_player, 'infiltrate', target_base) == 85);
test.assert(values.f_probe_get_subversion_cost(actor, target_unit) == 94);
test.assert(values.f_probe_can_incite_drone_riots(target_base));
test.assert(values.f_probe_get_assassination_research_loss({
	get_research_state: () => { return {target: 'IndustrialBase', progress: 100}; },
}) == 25);
test.assert(values.f_probe_get_plague_population_loss(target_base) == 2);

const defending_probe = {
	id: 7, owner: 2, morale: 2, health: 1.0, transport_id: 0,
	get_tile: () => { return target_base.get_tile(); },
	get_def: () => { return {weapon: 'ProbeTeam'}; },
};
units :+defending_probe;
test.assert(values.f_probe_get_defending_probe(target_player, target_base) == defending_probe);
test.assert(values.f_probe_get_success_chance(
	probe, target_player, 'infiltrate', target_base
) == 65);
units = [target_unit];

target_def.abilities = ['PolymorphicEncryption'];
test.assert(values.f_probe_get_subversion_cost(actor, target_unit) == 187);
target_def.abilities = [];

target_player.probe_rating = 2;
test.assert(values.f_probe_get_success_chance(probe, target_player, 'infiltrate') == 65);
test.assert(values.f_probe_get_subversion_cost(actor, target_unit) == 187);
target_player.probe_rating = 3;
test.assert(values.f_probe_get_subversion_cost(actor, target_unit) == null);
target_player.probe_rating = 0;

test.assert(values.f_probe_get_mind_control_cost(actor, headquarters) == null);
const base_cost = values.f_probe_get_mind_control_cost(actor, target_base);
test.assert(base_cost > 20);
target_base.has_facility = (id) => { return id == 'GenejackFactory'; };
test.assert(
	values.f_probe_get_mind_control_cost(actor, target_base) ==
	#ceil(#to_float(base_cost) * 0.5)
);
target_base.has_facility = (id) => { return id == 'ChildrenSCreche'; };
test.assert(values.f_probe_get_mind_control_cost(actor, target_base) == base_cost * 2);
target_base.has_facility = (id) => { return id == 'PunishmentSphere'; };
test.assert(values.f_probe_get_mind_control_cost(actor, target_base) == base_cost * 2);
target_base.has_facility = (id) => { return id == 'ResearchHospital'; };
test.assert(values.f_probe_get_plague_population_loss(target_base) == 1);
target_base.has_facility = (id) => { return false; };

const unknown = values.f_probe_get_unknown_technologies(actor, target_player);
test.assert(unknown == ['PlanetaryNetworks']);

target_player.set_test_research('PlanetaryNetworks', 17);
values.f_technology_get_definition = (id) => {
	return id == 'PlanetaryNetworks'
		? {id: id, name: 'Planetary Networks', cost: 60}
		: null;
};
values.f_social_get_categories = () => { return [
	{id: 'politics', choices: [{id: 'Democratic', name: 'Democratic'}]},
	{id: 'economics', choices: [{id: 'Green', name: 'Green'}]},
	{id: 'values', choices: [{id: 'Knowledge', name: 'Knowledge'}]},
	{id: 'future_society', choices: [{id: 'None', name: 'None'}]},
]; };
values.f_council_has_intelligence = (source, target) => { return false; };
test.assert(values.f_probe_get_intelligence_source(actor, target_player) == '');
test.assert(values.f_probe_get_intelligence_report(actor, target_player) == null);

actor.set_test_infiltrated(true);
const report = values.f_probe_get_intelligence_report(actor, target_player);
test.assert(report.source == 'infiltrated_datalinks');
test.assert(report.relation == 'neutral');
test.assert(report.energy_credits == 200);
test.assert(report.research.target_name == 'Planetary Networks');
test.assert(report.research.progress == 17);
test.assert(report.research.cost == 60);
test.assert(report.research.known_technologies == 2);
test.assert(report.social_choices == ['Democratic', 'Green', 'Knowledge', 'None']);
test.assert(report.bases.count == 2);
test.assert(report.bases.population == 9);
test.assert(report.bases.facilities == 1);
test.assert(report.bases.projects == 0);
test.assert(report.bases.headquarters == 'Target Headquarters');
test.assert(report.units.total == 1);
test.assert(report.units.combat == 1);
test.assert(report.units.probes == 0);
test.assert(report.units.land == 1);

actor.set_test_infiltrated(false);
values.f_council_has_intelligence = (source, target) => {
	return source == actor && target == target_player;
};
const governor_report = values.f_probe_get_intelligence_report(actor, target_player);
test.assert(governor_report.source == 'planetary_governor');
test.assert(values.f_probe_get_intelligence_report(actor, actor) == null);

const hunter_seeker_base = {
	get_owner: () => { return target_player; },
	get_facilities: () => {
		return [{id: 'TheHunterSeekerAlgorithm', is_project: true}];
	},
};
bases :+hunter_seeker_base;
test.assert(values.f_probe_has_project(target_player, 'TheHunterSeekerAlgorithm'));
