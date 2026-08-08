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
	};
};

const get_owned_projects = (game, base) => {
	let result = [];
	const owner_id = base.get_owner().id;
	for (candidate of game.get_bm().get_bases()) {
		if (candidate.get_owner().id != owner_id) {
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

const get_effects = (game, base) => {
	const result = empty_effects();
	for (project of get_owned_projects(game, base)) {
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
	}
	return result;
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
		'f_base_get_effective_facilities',
		(base) => { return get_effective_facilities(game, base); }
	);
};
