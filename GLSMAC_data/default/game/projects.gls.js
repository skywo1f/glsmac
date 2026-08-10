const empty_effects = () => {
	return {
		talent_bonus: 0,
		growth_rating_bonus: 0,
		population_limit_bonus: 0,
		mineral_bonus: 0,
		support_bonus: 0,
		maintenance_multiplier: 1.0,
		native_lifecycle_bonus: 0,
		network_node_drone_modifier: 0,
		network_node_research_bonus: 0,
		prevent_riots: false,
		terraforming_rate_multiplier: 1.0,
		new_base_population: 1,
		small_base_drone_modifier: 0,
		psi_attack_multiplier: 1.0,
		psi_defense_multiplier: 1.0,
		naval_movement_bonus: 0.0,
		full_repair: false,
		police_rating_bonus: 0,
		extra_police_units: 0,
	};
};

const get_player_projects = (game, player) => {
	let result = [];
	for (candidate of game.get_bm().get_bases()) {
		if (candidate.get_owner().id != player.id) {
			continue;
		}
		for (facility of candidate.get_facilities()) {
			if (facility.is_project) {
				result :+facility;
			}
		}
	}
	return result;
};

const get_owned_projects = (game, base) => {
	return get_player_projects(game, base.get_owner());
};

const get_player_effects = (game, player) => {
	const result = empty_effects();
	for (project of get_player_projects(game, player)) {
		result.talent_bonus = result.talent_bonus + project.global_talent_bonus;
		result.growth_rating_bonus = result.growth_rating_bonus + project.global_growth_rating_bonus;
		result.population_limit_bonus = result.population_limit_bonus + project.global_population_limit_bonus;
		result.mineral_bonus = result.mineral_bonus + project.global_mineral_bonus;
		result.support_bonus = result.support_bonus + project.global_support_bonus;
		result.maintenance_multiplier = result.maintenance_multiplier *
			project.global_maintenance_multiplier;
		result.native_lifecycle_bonus = result.native_lifecycle_bonus +
			project.global_native_lifecycle_bonus;
		result.network_node_drone_modifier = result.network_node_drone_modifier +
			project.network_node_drone_modifier;
		result.network_node_research_bonus = result.network_node_research_bonus +
			project.network_node_research_bonus;
		result.prevent_riots = result.prevent_riots || project.global_prevent_riots;
		result.terraforming_rate_multiplier = result.terraforming_rate_multiplier * (
			#is_defined(project.global_terraforming_rate_multiplier)
				? project.global_terraforming_rate_multiplier
				: 1.0
		);
		result.new_base_population = #max(
			result.new_base_population,
			#is_defined(project.new_base_population) ? project.new_base_population : 0
		);
		result.small_base_drone_modifier = result.small_base_drone_modifier + (
			#is_defined(project.small_base_drone_modifier) ? project.small_base_drone_modifier : 0
		);
		result.psi_attack_multiplier = result.psi_attack_multiplier * (
			#is_defined(project.global_psi_attack_multiplier)
				? project.global_psi_attack_multiplier
				: 1.0
		);
		result.psi_defense_multiplier = result.psi_defense_multiplier * (
			#is_defined(project.global_psi_defense_multiplier)
				? project.global_psi_defense_multiplier
				: 1.0
		);
		result.naval_movement_bonus = result.naval_movement_bonus + (
			#is_defined(project.global_naval_movement_bonus)
				? project.global_naval_movement_bonus
				: 0.0
		);
		result.full_repair = result.full_repair || (
			#is_defined(project.global_full_repair) && project.global_full_repair
		);
		result.police_rating_bonus = result.police_rating_bonus + (
			#is_defined(project.global_police_rating_bonus)
				? project.global_police_rating_bonus
				: 0
		);
		result.extra_police_units = result.extra_police_units + (
			#is_defined(project.global_extra_police_units)
				? project.global_extra_police_units
				: 0
		);
	}
	return result;
};

const get_effects = (game, base) => {
	return get_player_effects(game, base.get_owner());
};

const get_effective_facilities = (game, base) => {
	let result = [];
	let seen = {};
	for (facility of base.get_facilities()) {
		result :+facility;
		seen[facility.id] = true;
	}
	for (project of get_owned_projects(game, base)) {
		if (project.granted_facility == '' || #is_defined(seen[project.granted_facility])) {
			continue;
		}
		const facility = game.get_bm().get_facility_def(project.granted_facility);
		result :+facility;
		seen[facility.id] = true;
	}
	return result;
};

return (game) => {
	game.set('f_project_get_owned', (base) => { return get_owned_projects(game, base); });
	game.set('f_project_get_effects', (base) => { return get_effects(game, base); });
	game.set(
		'f_project_get_player_effects',
		(player) => { return get_player_effects(game, player); }
	);
	game.set(
		'f_base_get_effective_facilities',
		(base) => { return get_effective_facilities(game, base); }
	);
};
