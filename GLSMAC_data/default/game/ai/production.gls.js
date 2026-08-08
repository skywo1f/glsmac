const UNIT_SUPPORT_SCORE_PENALTY = 5000;
const MIN_HURRY_RESERVE = 20;
const HURRY_RESERVE_TURNS = 3;
const MIN_NONEMERGENCY_HURRY_MINERALS = 10;
const BASIC_INFRASTRUCTURE_SCORE_BONUS = 60000;
const EMERGENCY_GARRISON_SCORE = 1000000;

const get_priority = (context, name, fallback) => {
	return #is_defined(context.priorities) && #is_defined(context.priorities[name])
		? context.priorities[name]
		: fallback;
};

const get_unit_support_penalty = (context) => {
	const projected_overage = #max(context.supported_units + 1 - context.free_support, 0);
	return projected_overage * UNIT_SUPPORT_SCORE_PENALTY;
};

const score_unit = (def, context) => {
	if (def.can_found_base) {
		return context.needs_colony && context.can_expand
			? 45000 + get_priority(context, 'expansion', 50) * 500 +
				#max(context.nutrient_surplus, 0) * 250 -
				def.mineral_cost - get_unit_support_penalty(context)
			: null;
	}
	if (def.can_terraform) {
		return context.needs_former
			? 45000 + get_priority(context, 'terraforming', 70) * 500 -
				def.mineral_cost - get_unit_support_penalty(context)
			: null;
	}
	if (def.offense <= 0) {
		return null;
	}
	if (context.needs_garrison) {
		return EMERGENCY_GARRISON_SCORE + def.defense * 1000 + def.offense * 100 +
			#round(def.movement_per_turn * 10.0) - def.mineral_cost -
			get_unit_support_penalty(context);
	}
	if (!context.needs_military) {
		return null;
	}
	return 20000 + get_priority(context, 'military', 33) * 300 +
		def.offense * 1000 + def.defense * 250 +
		#round(def.movement_per_turn * 100.0) - def.mineral_cost -
		get_unit_support_penalty(context);
};

const score_facility = (def, context) => {
	if (def.energy_maintenance > context.available_energy) {
		return null;
	}
	const growth_priority = get_priority(context, 'growth', context.needs_growth ? 100 : 0);
	const psych_priority = get_priority(context, 'psych', context.needs_psych ? 100 : 0);
	const nutrient_weight = 1000 + growth_priority * 15;
	const psych_weight = 100 + psych_priority * 11;
	const infrastructure_bonus = (
		#is_defined(context.needs_infrastructure) && context.needs_infrastructure
	) ? BASIC_INFRASTRUCTURE_SCORE_BONUS : 0;
	return 30000 + infrastructure_bonus +
		get_priority(context, 'development', 50) * 200 +
		def.nutrient_bonus * nutrient_weight + def.mineral_bonus * 900 +
		def.energy_bonus * 500 + def.psych_bonus * psych_weight -
		def.energy_maintenance * 250 - def.mineral_cost +
		#round(def.research_multiplier * #to_float(context.base_labs) * 1000.0);
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
		if (def.mineral_bonus > 0) {
			urgency += 15000;
		}
		if (def.research_multiplier > 0.0 && context.base_labs > 0) {
			urgency += 10000;
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
		consider('facility', def, score_facility(def, context));
	}
	return best;
};

return {
	score_unit: score_unit,
	score_facility: score_facility,
	score_hurry: score_hurry,
	choose_hurry: choose_hurry,
	choose: choose,
};
