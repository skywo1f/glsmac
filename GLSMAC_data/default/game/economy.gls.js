const PSYCH_ALLOCATION = 0.2;

const get_effective_facilities = (game, base) => {
	const resolver = game.get('f_base_get_effective_facilities');
	return #is_defined(resolver) ? resolver(base) : base.get_facilities();
};

const get_base_allocation = (game, base) => {
	const intake = base.get_intake();
	const consumption = base.get_consumption();
	const total_energy = intake.ENERGY - consumption.ENERGY;
	const energy_surplus = #max(total_energy, 0);
	const labs = game.get('f_technology_get_base_labs')(base);
	const psych = #round(#to_float(energy_surplus) * PSYCH_ALLOCATION);
	let psych_bonus = 0;
	let psych_multiplier = 0.0;
	let economy_multiplier = 0.0;
	for (facility of get_effective_facilities(game, base)) {
		psych_bonus += facility.psych_bonus;
		psych_multiplier += #is_defined(facility.psych_multiplier)
			? facility.psych_multiplier
			: 0.0;
		if (#is_defined(facility.economy_multiplier)) {
			economy_multiplier += facility.economy_multiplier;
		}
	}
	psych_bonus += #ceil(#to_float(psych) * psych_multiplier);
	const economy_value = total_energy - labs.value - psych;
	const economy_bonus = #ceil(#to_float(#max(economy_value, 0)) * economy_multiplier);
	return {
		economy: {
			allocation: 1.0 - labs.allocation - PSYCH_ALLOCATION,
			value: economy_value,
			bonus: economy_bonus,
		},
		labs: labs,
		psych: {
			allocation: PSYCH_ALLOCATION,
			value: psych,
			bonus: psych_bonus,
		},
	};
};

const get_base_economy = (game, base) => {
	const economy = get_base_allocation(game, base).economy;
	return economy.value + economy.bonus;
};

const get_base_psych = (game, base) => {
	const psych = get_base_allocation(game, base).psych;
	return psych.value + psych.bonus;
};

const get_hurry_cost = (base) => {
	const production = base.get_production();
	if (!#is_defined(production)) {
		return 0;
	}
	const accumulated = base.get_accumulated_minerals();
	const missing = #max(production.mineral_cost - accumulated, 0);
	if (missing == 0) {
		return 0;
	}
	let cost = missing * 2;
	if (production.production_kind == 'unit') {
		cost += #floor(
			#to_float(missing * missing) / #to_float(production.mineral_cost)
		);
	}
	if (accumulated < 10) {
		cost *= 2;
	}
	return cost;
};

const get_player_economy = (game, player) => {
	let result = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			result += get_base_economy(game, base);
		}
	}
	return result;
};

const get_liquidation_candidate = (game, player) => {
	let result = null;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id != player.id) {
			continue;
		}
		for (facility of base.get_facilities()) {
			if (
				facility.energy_maintenance > 0 &&
				(
					result == null ||
					facility.energy_maintenance > result.facility.energy_maintenance ||
					(
						facility.energy_maintenance == result.facility.energy_maintenance &&
						base.id < result.base.id
					)
				)
			) {
				result = {base: base, facility: facility};
			}
		}
	}
	return result;
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_economy_get_base_allocation', get_base_allocation);
		game.set('f_economy_get_base', get_base_economy);
		game.set('f_economy_get_base_psych', get_base_psych);
		game.set('f_economy_get_player', get_player_economy);
		game.set('f_economy_get_hurry_cost', get_hurry_cost);
		game.set('f_economy_get_liquidation_candidate', get_liquidation_candidate);
		game.on('turn', (e) => {
			if (!game.is_master()) {
				return;
			}
			for (player of game.get_players()) {
				game.event('settle_player_economy', {
					player: player,
					liquidation_count: 0,
				});
			}
		});
	});
};
