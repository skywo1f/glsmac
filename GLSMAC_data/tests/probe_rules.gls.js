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
	let known_technologies = technologies;
	return {
		id: id,
		energy_credits: energy,
		probe_rating: rating,
		get_research_state: () => {
			return {
				technologies: known_technologies,
				target: research_target,
				progress: research_progress,
			};
		},
		get_energy_credits: () => { return energy; },
		set_test_research: (target, progress) => {
			research_target = target;
			research_progress = progress;
		},
		has_technology: (technology_id) => {
			for (known of known_technologies) {
				if (known == technology_id) { return true; }
			}
			return false;
		},
		set_test_technologies: (value) => { known_technologies = value; },
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
let target_base_values = {};
target_base.has = (key) => { return #is_defined(target_base_values[key]); };
target_base.get = (key) => { return target_base_values[key]; };
target_base.set = (key, value) => { target_base_values[key] = value; };
target_base.unset = (key) => { target_base_values[key] = #undefined; };
bases = [headquarters, target_base];

const probe = {
	owner: 1,
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
target_tile.get_units = () => { return units; };

test.assert(values.f_probe_is_unit(probe));
test.assert(values.f_probe_get_success_chance(probe, target_player, 'infiltrate') == 100);
test.assert(values.f_probe_get_success_chance(probe, target_player, 'infiltrate', target_base) == 100);
test.assert(values.f_probe_get_survival_chance(probe, target_player, 'infiltrate') == 50);
test.assert(values.f_probe_get_success_chance(
	probe, target_player, 'assassinate_researchers', target_base
) == 50);
test.assert(values.f_probe_get_survival_chance(
	probe, target_player, 'assassinate_researchers', target_base
) == 0);
test.assert(values.f_probe_get_success_chance(
	probe,
	target_player,
	'steal_technology',
	target_base,
	{target_technology_id: 'PlanetaryNetworks'}
) == 50);
test.assert(values.f_probe_get_success_chance(
	probe,
	target_player,
	'steal_technology',
	target_base,
	{frame_player_id: 3}
) == 50);
test.assert(values.f_probe_get_success_chance(
	probe,
	target_player,
	'steal_technology',
	target_base,
	{target_technology_id: 'PlanetaryNetworks', frame_player_id: 3}
) == 0);
target_base.set('probe_research_data_stolen', true);
test.assert(values.f_probe_get_success_chance(
	probe, target_player, 'steal_technology', target_base
) == 50);
test.assert(values.f_probe_get_success_chance(
	probe,
	target_player,
	'steal_technology',
	target_base,
	{target_technology_id: 'PlanetaryNetworks'}
) == 0);
target_base.unset('probe_research_data_stolen');
target_base.set('probe_energy_reserves_drained', true);
test.assert(values.f_probe_get_success_chance(
	probe, target_player, 'drain_energy', target_base
) == 50);
test.assert(values.f_probe_get_survival_chance(
	probe, target_player, 'drain_energy', target_base
) == 0);
target_base.unset('probe_energy_reserves_drained');
test.assert(values.f_probe_get_success_chance(
	probe,
	target_player,
	'sabotage',
	target_base,
	{sabotage_target_id: 'RecyclingTanks'}
) == 50);
test.assert(values.f_probe_get_success_chance(
	probe,
	target_player,
	'sabotage',
	target_base,
	{sabotage_target_id: 'PerimeterDefense'}
) == 0);
test.assert(values.f_probe_get_subversion_cost(actor, target_unit) == 332);
test.assert(values.f_probe_get_subversion_error(probe, target_unit) == '');
const stacked_unit = #clone(target_unit);
stacked_unit.health = 1.0;
units :+stacked_unit;
test.assert(
	values.f_probe_get_subversion_error(probe, target_unit) ==
	'A unit in a stack cannot be individually subverted'
);
units = [target_unit];
target_def.is_native = true;
test.assert(
	values.f_probe_get_subversion_error(probe, target_unit) ==
	'Native life cannot be subverted by Probe Teams'
);
target_def.is_native = false;
target_unit.is_air = true;
test.assert(
	values.f_probe_get_subversion_error(probe, target_unit) ==
	'Air Superiority is required to subvert an air unit'
);
target_unit.is_air = false;
test.assert(values.f_probe_get_success_chance(
	probe, target_player, 'subvert_unit', target_unit, {untraceable: true}
) == 50);
test.assert(values.f_probe_get_survival_chance(
	probe, target_player, 'subvert_unit', target_unit, {untraceable: true}
) == 100);
test.assert(values.f_probe_get_energy_drain_limit(target_base) == 80);
test.assert(values.f_probe_can_incite_drone_riots(target_base));
test.assert(values.f_probe_get_assassination_research_loss({
	get_research_state: () => { return {target: 'IndustrialBase', progress: 100}; },
}, {get_int: (minimum, maximum) => { return 37; }}) == 37);
test.assert(values.f_probe_get_plague_population_loss(target_base) == 3);
const plague_damage = values.f_probe_get_plague_unit_damage(
	target_base,
	{get_int: (minimum, maximum) => { return minimum; }}
);
test.assert(#sizeof(plague_damage) == 1);
test.assert(plague_damage[0].health == 0.5);

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
test.assert(values.f_probe_get_subversion_cost(actor, target_unit) == 664);
target_def.abilities = [];

target_player.probe_rating = 2;
test.assert(values.f_probe_get_success_chance(probe, target_player, 'infiltrate') == 100);
test.assert(values.f_probe_get_subversion_cost(actor, target_unit) == 664);
target_player.probe_rating = 3;
test.assert(values.f_probe_get_subversion_cost(actor, target_unit) == null);
target_player.probe_rating = 0;

test.assert(values.f_probe_get_mind_control_cost(actor, headquarters) == null);
const base_cost = values.f_probe_get_mind_control_cost(actor, target_base);
test.assert(base_cost == 875);
target_base.has_facility = (id) => { return id == 'GenejackFactory'; };
test.assert(values.f_probe_get_mind_control_cost(actor, target_base) == 435);
target_base.has_facility = (id) => { return id == 'ChildrenSCreche'; };
test.assert(values.f_probe_get_mind_control_cost(actor, target_base) == 1165);
target_base.has_facility = (id) => { return id == 'PunishmentSphere'; };
test.assert(values.f_probe_get_mind_control_cost(actor, target_base) == 1165);
target_base.has_facility = (id) => { return id == 'ResearchHospital'; };
test.assert(values.f_probe_get_plague_population_loss(target_base) == 2);
target_base.has_facility = (id) => { return false; };

actor.set_test_technologies(['InformationNetworks', 'PolymorphicSoftware']);
test.assert(values.f_probe_get_morale(probe) == 3);
test.assert(values.f_probe_get_survival_chance(probe, target_player, 'infiltrate') == 67);
actor.set_test_technologies(['InformationNetworks']);

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
