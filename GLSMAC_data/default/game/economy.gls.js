const PSYCH_ALLOCATION = 0.2;
const MAX_ENERGY_CREDITS = 1000000000;

const get_base_allocation = (game, base) => {
	const intake = base.get_intake();
	const consumption = base.get_consumption();
	const total_energy = intake.ENERGY - consumption.ENERGY;
	const energy_surplus = #max(total_energy, 0);
	const labs = game.get('f_technology_get_base_labs')(base);
	const psych = #round(#to_float(energy_surplus) * PSYCH_ALLOCATION);
	return {
		economy: {
			allocation: 1.0 - labs.allocation - PSYCH_ALLOCATION,
			value: total_energy - labs.value - psych,
			bonus: 0,
		},
		labs: labs,
		psych: {
			allocation: PSYCH_ALLOCATION,
			value: psych,
			bonus: 0,
		},
	};
};

const get_base_economy = (game, base) => {
	const economy = get_base_allocation(game, base).economy;
	return economy.value + economy.bonus;
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
		game.set('f_economy_get_player', get_player_economy);
		game.set('f_economy_get_hurry_cost', get_hurry_cost);
		game.set('f_economy_get_liquidation_candidate', get_liquidation_candidate);
		game.on('turn', (e) => {
			if (!game.is_master()) {
				return;
			}
			for (player of game.get_players()) {
				let economy = get_player_economy(game, player);
				let liquidation_count = 0;
				while (player.energy_credits + economy < 0) {
					const candidate = get_liquidation_candidate(game, player);
					if (candidate == null) {
						break;
					}
					game.event('liquidate_base_facility', {
						base: candidate.base,
						facility_id: candidate.facility.id,
					});
					const updated_economy = get_player_economy(game, player);
					if (updated_economy <= economy) {
						throw Error('Facility liquidation did not reduce faction upkeep');
					}
					economy = updated_economy;
					liquidation_count++;
					if (liquidation_count > 1024) {
						throw Error('Facility liquidation limit exceeded');
					}
				}
				const updated = #min(
					MAX_ENERGY_CREDITS,
					#max(0, player.energy_credits + economy)
				);
				game.event('process_player_economy', {
					player: player,
					energy_credits: updated,
				});
			}
		});
	});
};
