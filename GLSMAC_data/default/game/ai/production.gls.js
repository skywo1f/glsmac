const unit_abilities = #include('../unit_abilities');

const UNIT_SUPPORT_SCORE_PENALTY = 5000;
const MIN_HURRY_RESERVE = 20;
const HURRY_RESERVE_TURNS = 3;
const MIN_NONEMERGENCY_HURRY_MINERALS = 10;
const BASIC_INFRASTRUCTURE_SCORE_BONUS = 60000;
const EMERGENCY_GARRISON_SCORE = 1000000;
const SEA_COLONY_SCORE_BONUS = 10000;

const get_priority = (context, name, fallback) => {
	return #is_defined(context.priorities) && #is_defined(context.priorities[name])
		? context.priorities[name]
		: fallback;
};

const get_unit_support_penalty = (def, context) => {
	const projected_overage = #max(
		context.supported_units + unit_abilities.get_support_cost(def) - context.free_support,
		0
	);
	return projected_overage * UNIT_SUPPORT_SCORE_PENALTY;
};

const get_unit_ability_score = (def) => {
	let score = unit_abilities.get_morale_bonus(def) * 4000;
	if (def.can_terraform) {
		const general_rate = unit_abilities.get_terraforming_rate_multiplier(def, 'farm');
		const fungus_rate = unit_abilities.get_terraforming_rate_multiplier(
			def,
			'remove_fungus'
		);
		score += #round((general_rate - 1.0) * 15000.0);
		score += #round((fungus_rate - general_rate) * 5000.0);
	}
	return score;
};

const get_remaining_maintenance_budget = (def, available_energy) => {
	const budget = #max(available_energy, 0);
	return def.energy_maintenance <= budget
		? budget - def.energy_maintenance
		: null;
};

const score_unit = (def, context) => {
	if (def.can_found_base) {
		const sea_colony_bonus =
			#is_defined(def.is_water) && def.is_water &&
			#is_defined(context.needs_sea_colony) && context.needs_sea_colony
				? SEA_COLONY_SCORE_BONUS
				: 0;
		return context.needs_colony && context.can_expand
			? 45000 + get_priority(context, 'expansion', 50) * 500 +
				#max(context.nutrient_surplus, 0) * 250 + sea_colony_bonus -
				def.mineral_cost - get_unit_support_penalty(def, context)
			: null;
	}
	if (def.can_terraform) {
		return context.needs_former
			? 45000 + get_priority(context, 'terraforming', 70) * 500 -
				def.mineral_cost + #round(def.movement_per_turn * 1000.0) +
				get_unit_ability_score(def) - get_unit_support_penalty(def, context)
			: null;
	}
	if (def.offense <= 0) {
		return null;
	}
	if (context.needs_garrison) {
		return EMERGENCY_GARRISON_SCORE + def.defense * 1000 + def.offense * 100 +
			#round(def.movement_per_turn * 10.0) + get_unit_ability_score(def) - def.mineral_cost -
			get_unit_support_penalty(def, context);
	}
	if (!context.needs_military) {
		return null;
	}
	return 20000 + get_priority(context, 'military', 33) * 300 +
		def.offense * 1000 + def.defense * 250 +
		#round(def.movement_per_turn * 100.0) + get_unit_ability_score(def) - def.mineral_cost -
		get_unit_support_penalty(def, context);
};

const score_facility = (def, context) => {
	if (get_remaining_maintenance_budget(def, context.available_energy) == null) {
		return null;
	}
	const growth_priority = get_priority(context, 'growth', context.needs_growth ? 100 : 0);
	const psych_priority = get_priority(context, 'psych', context.needs_psych ? 100 : 0);
	const defense_priority = get_priority(context, 'defense', 0);
	const development_priority = get_priority(context, 'development', 50);
	const military_priority = get_priority(context, 'military', context.needs_military ? 100 : 0);
	const nutrient_weight = 1000 + growth_priority * 15;
	const psych_weight = 100 + psych_priority * 11;
	const defense_weight = 5000 + defense_priority * 500;
	const economy_weight = 5000 + development_priority * 300;
	const research_weight = 3000 + development_priority * 200;
	const morale_weight = 5000 + military_priority * 300;
	const infrastructure_bonus = (
		#is_defined(context.needs_infrastructure) && context.needs_infrastructure
	) ? BASIC_INFRASTRUCTURE_SCORE_BONUS : 0;
	const forest_nutrient_bonus = #is_defined(def.forest_nutrient_bonus)
		? def.forest_nutrient_bonus
		: 0;
	const forest_mineral_bonus = #is_defined(def.forest_mineral_bonus)
		? def.forest_mineral_bonus
		: 0;
	const forest_energy_bonus = #is_defined(def.forest_energy_bonus)
		? def.forest_energy_bonus
		: 0;
	return 30000 + infrastructure_bonus +
		development_priority * 200 +
		def.nutrient_bonus * nutrient_weight + def.mineral_bonus * 900 +
		def.growth_rating_bonus * nutrient_weight * 4 +
		def.energy_bonus * 500 + def.psych_bonus * psych_weight +
		forest_nutrient_bonus * nutrient_weight * 3 +
		forest_mineral_bonus * 2700 + forest_energy_bonus * 1500 -
		def.energy_maintenance * 250 - def.mineral_cost +
		#round(def.research_multiplier * #to_float(context.base_labs) * 1000.0) +
		def.research_bonus * research_weight +
		#round(#max(def.defense_multiplier - 1.0, 0.0) * #to_float(defense_weight)) +
		#round(#max(def.water_defense_multiplier - 1.0, 0.0) * #to_float(defense_weight)) +
		#round(#max(def.air_defense_multiplier - 1.0, 0.0) * #to_float(defense_weight)) +
		#round(def.economy_multiplier * #to_float(economy_weight)) +
		#round(
			def.mineral_multiplier * #to_float(#max(context.mineral_surplus, 1)) * 1000.0
		) +
		#round(def.psych_multiplier * #to_float(1000 + psych_priority * 100)) +
		(
			def.population_limit > context.base_size && context.needs_population_capacity
				? 120000 + growth_priority * 1000
				: 0
		) +
		(#max(0 - def.drone_modifier, 0) + def.talent_bonus) * psych_weight * 2 -
		#max(def.drone_modifier, 0) * psych_weight * 2 +
		(def.suppress_psych && context.needs_psych ? 100000 : 0) +
		(
			def.unit_morale_bonus + def.unit_morale_land_bonus +
			def.unit_morale_water_bonus + def.unit_morale_air_bonus +
			def.native_lifecycle_bonus
		) * morale_weight;
};

const score_project = (def, context) => {
	if (
		!#is_defined(context.can_start_project) || !context.can_start_project ||
		context.needs_garrison || context.needs_former ||
		(context.needs_colony && context.can_expand)
	) {
		return null;
	}
	const has_effect =
		def.nutrient_bonus > 0 || def.mineral_bonus > 0 || def.energy_bonus > 0 ||
		def.psych_bonus > 0 || def.research_multiplier != 0.0 ||
		def.defense_multiplier > 1.0 || def.economy_multiplier > 0.0 ||
		def.unit_morale_bonus > 0 || def.research_bonus > 0 ||
		def.mineral_multiplier > 0.0 || def.psych_multiplier > 0.0 ||
		def.population_limit > 0 || def.drone_modifier != 0 || def.talent_bonus > 0 ||
		def.suppress_psych || def.unit_morale_land_bonus > 0 ||
		def.unit_morale_water_bonus > 0 || def.unit_morale_air_bonus > 0 ||
		def.water_defense_multiplier > 1.0 || def.air_defense_multiplier > 1.0 ||
		def.growth_rating_bonus > 0 || def.native_lifecycle_bonus > 0 ||
		def.granted_facility != '' || def.global_talent_bonus > 0 ||
		def.global_growth_rating_bonus > 0 || def.global_population_limit_bonus > 0 ||
		def.global_mineral_bonus > 0 || def.global_support_bonus > 0 ||
		def.global_maintenance_multiplier < 1.0 ||
		def.global_native_lifecycle_bonus > 0 || def.network_node_drone_modifier != 0 ||
		def.network_node_research_bonus > 0 || def.worked_tile_energy_bonus > 0 ||
		def.global_prevent_riots || def.global_terraforming_rate_multiplier > 1.0 ||
		def.new_base_population > 0 || def.small_base_drone_modifier != 0 ||
		def.global_psi_attack_multiplier > 1.0 ||
		def.global_psi_defense_multiplier > 1.0 ||
		def.global_naval_movement_bonus > 0.0 || def.global_full_repair;
	if (!has_effect) {
		return null;
	}
	return score_facility(def, context) +
		get_priority(context, 'development', 50) * 500 +
		def.global_talent_bonus * 30000 + def.global_mineral_bonus * 20000 +
		def.global_support_bonus * 15000 + def.global_growth_rating_bonus * 5000 +
		def.global_population_limit_bonus * 5000 +
		def.global_native_lifecycle_bonus * 20000 +
		def.network_node_research_bonus * 15000 + def.worked_tile_energy_bonus * 20000 +
		(def.granted_facility != '' ? 50000 : 0) +
		(def.global_maintenance_multiplier < 1.0 ? 40000 : 0) +
		(def.global_prevent_riots ? 50000 : 0) +
		#round((def.global_terraforming_rate_multiplier - 1.0) * 80000.0) +
		def.new_base_population * 20000 - def.small_base_drone_modifier * 30000 +
		#round((def.global_psi_attack_multiplier - 1.0) * 60000.0) +
		#round((def.global_psi_defense_multiplier - 1.0) * 60000.0) +
		#round(def.global_naval_movement_bonus * 20000.0) +
		(def.global_full_repair ? 40000 : 0);
};

const score_hurry = (def, context) => {
	if (context.hurry_cost <= 0 || context.hurry_cost > context.energy_credits) {
		return null;
	}
	const emergency = context.kind == 'unit' && def.offense > 0 && context.needs_garrison;
	const reserve = #max(
		MIN_HURRY_RESERVE,
		#max(context.energy_income, 0) * HURRY_RESERVE_TURNS
	);
	if (!emergency) {
		if (
			context.accumulated_minerals < MIN_NONEMERGENCY_HURRY_MINERALS ||
			context.energy_credits - context.hurry_cost < reserve
		) {
			return null;
		}
	}

	const missing = #max(def.mineral_cost - context.accumulated_minerals, 0);
	const mineral_surplus = #max(context.mineral_surplus, 1);
	const turns_remaining = #ceil(
		#to_float(missing) / #to_float(mineral_surplus)
	);
	if (!emergency && turns_remaining <= 1) {
		return null;
	}

	let urgency = emergency ? 100000 : 0;
	if (context.kind == 'unit') {
		if (def.can_found_base && context.needs_colony && context.can_expand) {
			urgency += 40000;
		}
		if (def.can_terraform && context.needs_former) {
			urgency += 25000;
		}
		if (def.offense > 0 && context.needs_military) {
			urgency += 15000;
		}
	} else if (context.kind == 'facility') {
		if (def.psych_bonus > 0 && context.needs_psych) {
			urgency += 60000;
		}
		if (def.nutrient_bonus > 0 && context.needs_growth) {
			urgency += 30000;
		}
		if (def.growth_rating_bonus > 0 && context.needs_growth) {
			urgency += 60000;
		}
		if (def.population_limit > context.base_size && context.needs_population_capacity) {
			urgency += 100000;
		}
		if (
			context.needs_psych &&
			(def.drone_modifier < 0 || def.talent_bonus > 0 || def.suppress_psych)
		) {
			urgency += 60000;
		}
		if (def.mineral_bonus > 0) {
			urgency += 15000;
		}
		if (def.research_multiplier > 0.0 && context.base_labs > 0) {
			urgency += 10000;
		}
		if (def.research_bonus > 0) {
			urgency += def.research_bonus * get_priority(context, 'development', 50) * 100;
		}
		if (
			def.defense_multiplier > 1.0 || def.water_defense_multiplier > 1.0 ||
			def.air_defense_multiplier > 1.0
		) {
			urgency += get_priority(context, 'defense', 0) * 400;
		}
		if (def.economy_multiplier > 0.0) {
			urgency += get_priority(context, 'development', 50) * 200;
		}
		if (
			def.unit_morale_bonus > 0 || def.unit_morale_land_bonus > 0 ||
			def.unit_morale_water_bonus > 0 || def.unit_morale_air_bonus > 0 ||
			def.native_lifecycle_bonus > 0
		) {
			urgency += get_priority(context, 'military', 0) * 200;
		}
	}
	if (urgency <= 0) {
		return null;
	}

	const score = urgency + #max(turns_remaining - 1, 0) * 5000 +
		#floor(#to_float(context.production_score) / 100.0) - context.hurry_cost * 100;
	return score > 0 ? score : null;
};

const choose_hurry = (candidates) => {
	let best = null;
	for (candidate of candidates) {
		if (
			best == null ||
			candidate.score > best.score ||
			(candidate.score == best.score && candidate.base.id < best.base.id)
		) {
			best = candidate;
		}
	}
	return best;
};

const choose = (base, unit_defs, facility_defs, context) => {
	let best = null;
	const consider = (kind, def, score) => {
		if (score == null || !base.can_set_production(kind, def.id)) {
			return;
		}
		if (
			best == null ||
			score > best.score ||
			(score == best.score && def.id < best.id)
		) {
			best = {kind: kind, id: def.id, def: def, score: score};
		}
	};
	for (def of unit_defs) {
		consider('unit', def, score_unit(def, context));
	}
	for (def of facility_defs) {
		consider(
			def.production_kind,
			def,
			def.production_kind == 'project'
				? score_project(def, context)
				: score_facility(def, context)
		);
	}
	return best;
};

return {
	get_remaining_maintenance_budget: get_remaining_maintenance_budget,
	get_unit_ability_score: get_unit_ability_score,
	score_unit: score_unit,
	score_facility: score_facility,
	score_project: score_project,
	score_hurry: score_hurry,
	choose_hurry: choose_hurry,
	choose: choose,
};
