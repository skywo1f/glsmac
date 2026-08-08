const score_unit = (def, context) => {
	if (def.can_found_base) {
		return context.needs_colony ? 70000 - def.mineral_cost : null;
	}
	if (def.can_terraform) {
		return context.needs_former ? 80000 - def.mineral_cost : null;
	}
	if (def.offense <= 0) {
		return null;
	}
	if (context.needs_garrison) {
		return 100000 + def.defense * 1000 + def.offense * 100 +
			#round(def.movement_per_turn * 10.0) - def.mineral_cost;
	}
	return 10000 + def.offense * 1000 + def.defense * 250 +
		#round(def.movement_per_turn * 100.0) - def.mineral_cost;
};

const score_facility = (def, context) => {
	if (def.energy_maintenance > context.available_energy) {
		return null;
	}
	return 40000 + def.nutrient_bonus * 1000 + def.mineral_bonus * 900 +
		def.energy_bonus * 500 + def.psych_bonus * (context.needs_psych ? 1200 : 100) -
		def.energy_maintenance * 250 - def.mineral_cost;
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
