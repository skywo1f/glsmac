const manifest = #include('../content/base_units');

const integer_divide = (numerator, denominator) => {
	return numerator / denominator;
};

const get_reactor_divisor = (power) => {
	if (power == 1) { return 4; }
	if (power == 2) { return 8; }
	if (power == 3) { return 16; }
	if (power == 4) { return 32; }
	throw Error('Unsupported unit reactor power: ' + #to_string(power));
};

const get_dynamic_ability_cost = (ability, weapon_cost, armor_cost, speed_cost) => {
	if (ability.cost >= 0) {
		return ability.cost;
	}
	switch (ability.cost) {
		case 0 - 1: {
			return armor_cost > 0
				? #max(0, #min(integer_divide(weapon_cost, armor_cost), 2))
				: 0;
		}
		case 0 - 2: { return #max(weapon_cost - 1, 0); }
		case 0 - 3: { return #max(armor_cost - 1, 0); }
		case 0 - 4: { return #max(speed_cost - 1, 0); }
		case 0 - 5: { return #max(weapon_cost + armor_cost - 2, 0); }
		case 0 - 6: { return #max(weapon_cost + speed_cost - 2, 0); }
		case 0 - 7: { return #max(armor_cost + speed_cost - 2, 0); }
	}
	return 0;
};

const get_ability_cost_modifier = (abilities, weapon, armor, chassis) => {
	let modifier = 0;
	let flags_modifier = 0;
	let selected = {};
	for (ability of abilities) {
		selected[ability.id] = ability;
	}
	for (canonical of manifest.abilities) {
		if (!#is_defined(selected[canonical.id])) {
			continue;
		}
		const ability = selected[canonical.id];
		if (modifier > 0) {
			modifier++;
		}
		modifier += get_dynamic_ability_cost(
			ability,
			weapon.cost,
			armor.cost,
			chassis.cost
		);
		if (chassis.triad == 'land' && ability.id == 'DeepRadar') {
			flags_modifier++;
		}
	}
	return modifier + flags_modifier;
};

// Preserve the original engine's integer operation order; costs are mineral rows.
const get_mineral_cost = (chassis, weapon, armor, abilities, reactor) => {
	if (chassis.missile && weapon.offense >= 99) {
		return weapon.cost * 10;
	}
	let armor_cost = armor.cost;
	let speed_cost = chassis.cost;
	const ability_modifier = get_ability_cost_modifier(
		abilities,
		weapon,
		armor,
		chassis
	);
	if (chassis.triad == 'sea') {
		armor_cost = integer_divide(armor_cost, 2);
		speed_cost += reactor.power;
	} else if (chassis.triad == 'air') {
		if (armor_cost > 1) {
			armor_cost *= reactor.power * 2;
		}
		speed_cost += reactor.power * 2;
	}
	let combat_modifier = #max(integer_divide(armor_cost, 2) + 1, weapon.cost);
	let rows = 0;
	if (
		combat_modifier == 1 && armor_cost == 1 && speed_cost == 1 &&
		reactor.power == 1
	) {
		rows = 1;
	} else {
		const divisor = get_reactor_divisor(reactor.power);
		rows = integer_divide(
			(speed_cost + armor_cost) * combat_modifier + integer_divide(divisor, 2),
			divisor
		);
		if (speed_cost == 1) {
			rows = integer_divide(rows, 2) + 1;
		}
		if (weapon.cost > 1 && armor.cost > 1) {
			rows++;
			if (chassis.triad == 'land' && speed_cost > 1) {
				rows++;
			}
		}
		if (chassis.triad == 'sea' && weapon.id != 'ProbeTeam') {
			rows = integer_divide(rows + 1, 2);
		} else if (chassis.triad == 'air') {
			rows = integer_divide(rows, weapon.mode > 2 ? 2 : 4);
		}
		rows = #max(rows, integer_divide(reactor.power * 3 + 1, 2));
	}
	return #max(
		integer_divide(rows * (ability_modifier + 4) + 2, 4) * 10,
		10
	);
};

const has_ability = (abilities, id) => {
	for (ability of abilities) {
		if (ability.id == id) {
			return true;
		}
	}
	return false;
};

const get_cargo_capacity = (chassis, weapon, abilities, reactor) => {
	if (weapon.id != 'TroopTransport') {
		return 0;
	}
	let capacity = chassis.cargo;
	if (chassis.triad == 'sea') {
		capacity *= reactor.power;
	}
	if (has_ability(abilities, 'SlowUnit')) {
		capacity = integer_divide(capacity, 2);
	}
	if (has_ability(abilities, 'HeavyTransport')) {
		capacity = integer_divide(capacity * 3 + 1, 2);
	}
	return capacity;
};

return {
	integer_divide: integer_divide,
	get_reactor_divisor: get_reactor_divisor,
	get_dynamic_ability_cost: get_dynamic_ability_cost,
	get_ability_cost_modifier: get_ability_cost_modifier,
	get_mineral_cost: get_mineral_cost,
	get_cargo_capacity: get_cargo_capacity,
};
