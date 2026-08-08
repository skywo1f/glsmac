const is_artillery = (def) => {
	return def.id == 'SporeLauncher';
};

const get_morale_multiplier = (unit) => {
	return 0.75 + #to_float(unit.morale) * 0.125;
};

const get_base_defense_multiplier = (defender) => {
	const base = defender.get_tile().get_base();
	if (
		base == null ||
		!#is_defined(base.get_owner) ||
		!#is_defined(base.get_facilities) ||
		base.get_owner().id != defender.owner
	) {
		return 1.0;
	}
	let multiplier = 1.0;
	for (facility of base.get_facilities()) {
		multiplier = #max(multiplier, facility.defense_multiplier);
	}
	return multiplier;
};

const get_combat_powers = (attacker, defender) => {
	const attacker_def = attacker.get_def();
	const defender_def = defender.get_def();
	let attack_strength = #to_float(attacker_def.offense);
	let defence_strength = #to_float(defender_def.defense);
	const is_psi_combat = attacker_def.is_native || defender_def.is_native;
	if (is_psi_combat) {
		attack_strength = defender.is_land ? 3.0 : 1.0;
		defence_strength = defender.is_land ? 2.0 : 1.0;
	}

	let attack_modifier = 1.0;
	let defence_modifier = 1.0;
	const defender_tile = defender.get_tile();
	if (defender_tile.rockiness >= 3) {
		defence_modifier += 0.5;
	}
	if (defender_tile.features.xenofungus) {
		if (attacker_def.is_native) {
			attack_modifier += 0.5;
		} else {
			defence_modifier += 0.5;
		}
	}
	if (defender_tile.get_base() != null || defender_tile.terraforming.bunker) {
		defence_modifier += 0.25;
	}
	if (!is_psi_combat) {
		defence_modifier *= get_base_defense_multiplier(defender);
	}
	if (attacker.is_land && !attacker_def.is_native && attacker.movement < 1.0) {
		attack_modifier *= attacker.movement;
	}
	return {
		attack: attack_strength * get_morale_multiplier(attacker) * attacker.health * attack_modifier,
		defence: defence_strength * get_morale_multiplier(defender) * defender.health * defence_modifier,
	};
};

const get_artillery_powers = (attacker, defender) => {
	const attacker_def = attacker.get_def();
	const defender_def = defender.get_def();
	return {
		attack: #to_float(attacker_def.offense) * get_morale_multiplier(attacker) * attacker.health,
		defence: #to_float(
			is_artillery(defender_def) ? defender_def.offense : defender_def.defense
		) * get_morale_multiplier(defender) * defender.health,
	};
};

const get_attack_powers = (attacker, defender) => {
	return is_artillery(attacker.get_def())
		? get_artillery_powers(attacker, defender)
		: get_combat_powers(attacker, defender);
};

return {
	is_artillery: is_artillery,
	get_morale_multiplier: get_morale_multiplier,
	get_base_defense_multiplier: get_base_defense_multiplier,
	get_combat_powers: get_combat_powers,
	get_artillery_powers: get_artillery_powers,
	get_attack_powers: get_attack_powers,
};
