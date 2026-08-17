const define_projects = #include('../default/game/projects');

const command_center = {id: 'CommandCenter', is_project: false};
const network_node = {id: 'NetworkNode', is_project: false};
const recycling_tanks = {id: 'RecyclingTanks', is_project: false};
const pressure_dome = {id: 'PressureDome', is_project: false};
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
	network_node_psych_multiplier: 0.5,
	network_node_research_bonus: 1,
	global_ecology_divisor_bonus: 1,
	global_prevent_riots: true,
	global_terraforming_rate_multiplier: 1.5,
	global_advanced_terraforming: true,
	new_base_population: 3,
	small_base_drone_modifier: -1,
	global_psi_attack_multiplier: 1.5,
	global_psi_defense_multiplier: 1.25,
	global_naval_movement_bonus: 2.0,
	global_full_repair: true,
	global_police_rating_bonus: 1,
	global_extra_police_units: 2,
};

let economics = 'Simple';
const owner = {
	id: 1,
	get_social_engineering: () => { return {economics: economics}; },
};
const rival = {id: 2};
const project_base = {
	get_owner: () => { return owner; },
	get_facilities: () => { return [project]; },
	has_facility: (id) => { return id == project.id; },
};
let target_facilities = [network_node];
const target_base = {
	get_owner: () => { return owner; },
	get_facilities: () => { return target_facilities; },
	has_facility: (id) => {
		for (facility of target_facilities) {
			if (facility.id == id) {
				return true;
			}
		}
		return false;
	},
};
const rival_base = {
	get_owner: () => { return rival; },
	get_facilities: () => { return []; },
};

const values = {};
const bm_callbacks = {};
const game_callbacks = {};
const bm = {
	get_bases: () => { return [project_base, target_base, rival_base]; },
	get_facility_def: (id) => {
		test.assert(id == 'CommandCenter');
		return command_center;
	},
	on: (name, callback) => { bm_callbacks[name] = callback; },
};
const game = {
	get_bm: () => { return bm; },
	on: (name, callback) => { game_callbacks[name] = callback; },
	set: (key, value) => { values[key] = value; },
};

define_projects(game);
const invalidate_projects = () => { bm_callbacks.project_state_update({}); };
const update_economics = (value) => {
	economics = value;
	game_callbacks.social_engineering_updated({player: owner});
};

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
	network_node_psych_multiplier: 0.5,
	network_node_research_bonus: 1,
	psych_multiplier: 0.5,
	prevent_riots: true,
	terraforming_rate_multiplier: 1.5,
	advanced_terraforming: true,
	new_base_population: 3,
	small_base_drone_modifier: -1,
	psi_attack_multiplier: 1.5,
	psi_defense_multiplier: 1.25,
	naval_movement_bonus: 2.0,
	full_repair: true,
	police_rating_bonus: 1,
	extra_police_units: 2,
	unit_upgrade_cost_multiplier: 1.0,
	ecology_divisor_bonus: 1,
	native_fungus_combat: false,
	fungus_movement_as_road: false,
	fungus_terraforming_rate_multiplier: 1.0,
	drone_modifier: 0,
	economy_multiplier: 0.0,
	ignore_power_penalties: false,
	ignore_thought_control_penalties: false,
	ignore_cybernetic_penalties: false,
	orbital_access: false,
	orbital_production_multiplier: 1.0,
});
test.assert(values.f_project_get_player_effects(owner).psych_multiplier == 0.0);
test.assert(values.f_project_get_effects(target_base).psych_multiplier == 0.5);
test.assert(values.f_project_get_effects(project_base).psych_multiplier == 0.0);
test.assert(values.f_base_get_effective_facilities(target_base) == [network_node, command_center]);
test.assert(values.f_base_get_effective_facilities(project_base) == [project, command_center]);
target_facilities = [recycling_tanks, pressure_dome];
test.assert(values.f_base_get_effective_facilities(target_base) == [pressure_dome, command_center]);
target_facilities = [network_node];

project.id = 'ThePholusMutagen';
invalidate_projects();
let effects = values.f_project_get_player_effects(owner);
test.assert(effects.ecology_divisor_bonus == 1);
test.assert(effects.native_fungus_combat);

project.id = 'TheNanoFactory';
invalidate_projects();
test.assert(values.f_project_get_player_effects(owner).unit_upgrade_cost_multiplier == 0.5);

project.id = 'TheSpaceElevator';
invalidate_projects();
effects = values.f_project_get_player_effects(owner);
test.assert(effects.orbital_access);
test.assert(effects.orbital_production_multiplier == 2.0);

project.id = 'TheXenoempathyDome';
invalidate_projects();
effects = values.f_project_get_player_effects(owner);
test.assert(effects.fungus_movement_as_road);
test.assert(effects.fungus_terraforming_rate_multiplier == 2.0);

project.id = 'TheCloningVats';
invalidate_projects();
effects = values.f_project_get_player_effects(owner);
test.assert(effects.ignore_power_penalties);
test.assert(effects.ignore_thought_control_penalties);
test.assert(!effects.ignore_cybernetic_penalties);

project.id = 'TheNetworkBackbone';
invalidate_projects();
effects = values.f_project_get_player_effects(owner);
test.assert(!effects.ignore_power_penalties);
test.assert(!effects.ignore_thought_control_penalties);
test.assert(effects.ignore_cybernetic_penalties);

project.id = 'TheLongevityVaccine';
invalidate_projects();
update_economics('Simple');
test.assert(values.f_project_get_player_effects(owner).drone_modifier == -1);
update_economics('Green');
test.assert(values.f_project_get_player_effects(owner).drone_modifier == -1);
update_economics('Planned');
test.assert(values.f_project_get_player_effects(owner).drone_modifier == -2);
update_economics('FreeMarket');
test.assert(values.f_project_get_player_effects(owner).drone_modifier == 0);
test.assert(values.f_project_get_effects(project_base).economy_multiplier == 0.5);
test.assert(values.f_project_get_effects(target_base).economy_multiplier == 0.0);
