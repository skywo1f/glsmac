const score_technology = (technology, unit_defs, facility_defs, context) => {
	let score = 1000 - technology.cost;
	for (def of unit_defs) {
		if (def.required_technology != technology.id) {
			continue;
		}
		if (def.can_found_base) {
			score += context.needs_colony ? 60000 : 5000;
		}
		if (def.can_terraform) {
			score += context.needs_former ? 50000 : 5000;
		}
		if (def.offense > 0) {
			score += context.needs_military ? 30000 : 5000;
			score += def.offense * 1000 + def.defense * 500;
			score += #round(def.movement_per_turn * 100.0);
		}
	}
	for (def of facility_defs) {
		if (def.required_technology != technology.id) {
			continue;
		}
		score += 2000;
		score += def.nutrient_bonus * (context.needs_growth ? 5000 : 500);
		score += def.mineral_bonus * 1500 + def.energy_bonus * 1000;
		score += def.psych_bonus * (context.needs_psych ? 12000 : 100);
		score += #round(
			def.research_multiplier * #to_float(context.base_labs) * 2000.0
		);
	}
	return score;
};

const choose = (technologies, unit_defs, facility_defs, context) => {
	let best = null;
	let best_score = 0;
	for (technology of technologies) {
		const score = score_technology(technology, unit_defs, facility_defs, context);
		if (
			best == null ||
			score > best_score ||
			(score == best_score && technology.id < best.id)
		) {
			best = technology;
			best_score = score;
		}
	}
	return best;
};

const choose_id = (technology_ids, get_definition, unit_defs, facility_defs, context) => {
	let best_id = '';
	let best_score = 0;
	for (technology_id of technology_ids) {
		const technology = get_definition(technology_id);
		const score = score_technology(technology, unit_defs, facility_defs, context);
		if (
			best_id == '' ||
			score > best_score ||
			(score == best_score && technology_id < best_id)
		) {
			best_id = technology_id;
			best_score = score;
		}
	}
	return best_id;
};

return {
	score_technology: score_technology,
	choose: choose,
	choose_id: choose_id,
};
