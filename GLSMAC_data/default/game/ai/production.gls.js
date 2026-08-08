const UNIT_SUPPORT_SCORE_PENALTY = 5000;

const get_unit_support_penalty = (context) => {
	const projected_overage = #max(context.supported_units + 1 - context.free_support, 0);
	return projected_overage * UNIT_SUPPORT_SCORE_PENALTY;
};

const score_unit = (def, context) => {
	if (def.can_found_base) {
		return context.needs_colony && context.can_expand
			? 70000 + #max(context.nutrient_surplus, 0) * 250 -
				def.mineral_cost - get_unit_support_penalty(context)
			: null;
	}
	if (def.can_terraform) {
		return context.needs_former
			? 80000 - def.mineral_cost - get_unit_support_penalty(context)
			: null;
	}
	if (def.offense <= 0) {
		return null;
	}
	if (context.needs_garrison) {
		return 100000 + def.defense * 1000 + def.offense * 100 +
			#round(def.movement_per_turn * 10.0) - def.mineral_cost -
			get_unit_support_penalty(context);
	}
	if (!context.needs_military) {
		return null;
	}
	return 30000 + def.offense * 1000 + def.defense * 250 +
		#round(def.movement_per_turn * 100.0) - def.mineral_cost -
		get_unit_support_penalty(context);
};

const score_facility = (def, context) => {
	if (def.energy_maintenance > context.available_energy) {
		return null;
	}
	const nutrient_weight = context.needs_growth ? 2500 : 1000;
	return 40000 + def.nutrient_bonus * nutrient_weight + def.mineral_bonus * 900 +
		def.energy_bonus * 500 + def.psych_bonus * (context.needs_psych ? 1200 : 100) -
		def.energy_maintenance * 250 - def.mineral_cost +
		#round(def.research_multiplier * #to_float(context.base_labs) * 1000.0);
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
	choose: choose,
};
