const define_projects = #include('../default/game/projects');

const command_center = {id: 'CommandCenter', is_project: false};
const network_node = {id: 'NetworkNode', is_project: false};
const project = {
	id: 'TestProject',
	is_project: true,
	granted_facility: 'CommandCenter',
	global_talent_bonus: 1,
	global_growth_rating_bonus: 2,
	global_population_limit_bonus: 3,
	global_mineral_bonus: 4,
	global_support_bonus: 5,
	global_maintenance_multiplier: 0.5,
	global_native_lifecycle_bonus: 1,
	network_node_drone_modifier: -2,
	network_node_research_bonus: 1,
	global_prevent_riots: true,
	global_terraforming_rate_multiplier: 1.5,
	new_base_population: 3,
	small_base_drone_modifier: -1,
	global_psi_attack_multiplier: 1.5,
	global_psi_defense_multiplier: 1.25,
	global_naval_movement_bonus: 2.0,
	global_full_repair: true,
	global_police_rating_bonus: 1,
	global_extra_police_units: 2,
};

const owner = {id: 1};
const rival = {id: 2};
const project_base = {
	get_owner: () => { return owner; },
	get_facilities: () => { return [project]; },
};
const target_base = {
	get_owner: () => { return owner; },
	get_facilities: () => { return [network_node]; },
};
const rival_base = {
	get_owner: () => { return rival; },
	get_facilities: () => { return []; },
};

const values = {};
const game = {
	get_bm: () => {
		return {
			get_bases: () => { return [project_base, target_base, rival_base]; },
			get_facility_def: (id) => {
				test.assert(id == 'CommandCenter');
				return command_center;
			},
		};
	},
	set: (key, value) => { values[key] = value; },
};

define_projects(game);

test.assert(values.f_project_get_owned(target_base) == [project]);
test.assert(values.f_project_get_owned(rival_base) == []);
test.assert(values.f_project_get_effects(target_base) == {
	talent_bonus: 1,
	growth_rating_bonus: 2,
	population_limit_bonus: 3,
	mineral_bonus: 4,
	support_bonus: 5,
	maintenance_multiplier: 0.5,
	native_lifecycle_bonus: 1,
	network_node_drone_modifier: -2,
	network_node_research_bonus: 1,
	prevent_riots: true,
	terraforming_rate_multiplier: 1.5,
	new_base_population: 3,
	small_base_drone_modifier: -1,
	psi_attack_multiplier: 1.5,
	psi_defense_multiplier: 1.25,
	naval_movement_bonus: 2.0,
	full_repair: true,
	police_rating_bonus: 1,
	extra_police_units: 2,
});
test.assert(values.f_project_get_player_effects(owner) == values.f_project_get_effects(target_base));
test.assert(values.f_base_get_effective_facilities(target_base) == [network_node, command_center]);
test.assert(values.f_base_get_effective_facilities(project_base) == [project, command_center]);
