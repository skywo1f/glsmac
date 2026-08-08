const manifest = #include('../content/base_units');
const technologies = #include('../content/base_technologies');

const add_technology_closure = (known, technology_id) => {
	if (technology_id == '' || #is_defined(known[technology_id])) {
		return;
	}
	const technology = technologies.definitions[technology_id];
	if (!#is_defined(technology)) {
		throw Error('Unknown unit component technology: ' + technology_id);
	}
	for (prerequisite of technology.prerequisites) {
		add_technology_closure(known, prerequisite);
	}
	known[technology_id] = true;
};

const is_available = (entry, known) => {
	if (entry.availability == 'always') {
		return true;
	}
	return entry.availability == 'technology' &&
		#is_defined(known[entry.required_technology]);
};

const get_best_weapon = (known) => {
	let best = null;
	for (weapon of manifest.weapons) {
		if (
			!is_available(weapon, known) || weapon.offense <= 0 ||
			weapon.id == 'PlanetBuster' || weapon.id == 'ConventionalPayload'
		) {
			continue;
		}
		if (best == null || weapon.offense > best.offense) {
			best = weapon;
		}
	}
	return best;
};

const get_best_armor = (known) => {
	let best = null;
	for (armor of manifest.armors) {
		if (!is_available(armor, known) || armor.defense <= 0) {
			continue;
		}
		if (best == null || armor.defense > best.defense) {
			best = armor;
		}
	}
	return best;
};

const get_best_chassis_by_triad = (known) => {
	let result = {};
	for (chassis of manifest.chassis) {
		if (!is_available(chassis, known) || chassis.missile) {
			continue;
		}
		if (
			!#is_defined(result[chassis.triad]) ||
			chassis.speed > result[chassis.triad].speed
		) {
			result[chassis.triad] = chassis;
		}
	}
	return result;
};

const find_component = (entries, id) => {
	for (entry of entries) {
		if (entry.id == id) {
			return entry;
		}
	}
	throw Error('Missing unit component: ' + id);
};

const hand_weapons = find_component(manifest.weapons, 'HandWeapons');

const get_render = (chassis, role) => {
	let x = role == 'assault' ? 206 : 2;
	let y = 156;
	if (chassis.triad == 'land' && chassis.speed > 1) {
		x = 104;
	} else if (chassis.triad == 'sea') {
		x = 2;
		y = 310;
	} else if (chassis.triad == 'air') {
		x = 2;
		y = 541;
	}
	return {
		type: 'sprite',
		file: 'units.pcx',
		x: x,
		y: y,
		w: 100,
		h: 75,
		cx: x + 51,
		cy: y + 51,
	};
};

const make_definition = (technology_id, chassis, weapon, armor, role) => {
	const role_name = role == 'assault' ? weapon.short_name : armor.short_name;
	return {
		id: 'Generated' + chassis.id + weapon.id + armor.id,
		data: {
			name: role_name + ' ' + chassis.name,
			mineral_cost: #max((chassis.cost + weapon.cost + armor.cost) * 5, 10),
			is_native: false,
			offense: weapon.offense,
			defense: armor.defense,
			can_found_base: false,
			can_terraform: false,
			required_technology: technology_id,
			morale: 'STANDARD',
			type: 'static',
			movement_type: chassis.triad == 'sea' ? 'water' : chassis.triad,
			movement_per_turn: chassis.speed,
			render: get_render(chassis, role),
		},
	};
};

let definitions = [];
let seen = {};
seen['Infantry|HandWeapons|NoArmor'] = true;
seen['Speeder|HandWeapons|NoArmor'] = true;
seen['Infantry|Laser|NoArmor'] = true;
seen['Infantry|HandWeapons|SynthmetalArmor'] = true;

const add_design = (technology_id, chassis, weapon, armor, role) => {
	const signature = chassis.id + '|' + weapon.id + '|' + armor.id;
	if (#is_defined(seen[signature])) {
		return;
	}
	seen[signature] = true;
	definitions :+make_definition(technology_id, chassis, weapon, armor, role);
};

const add_milestone_designs = (technology_id) => {
	let known = {};
	add_technology_closure(known, technology_id);
	const weapon = get_best_weapon(known);
	const armor = get_best_armor(known);
	const chassis_by_triad = get_best_chassis_by_triad(known);
	if (weapon == null || armor == null) {
		return;
	}
	for (triad in chassis_by_triad) {
		const chassis = chassis_by_triad[triad];
		add_design(technology_id, chassis, weapon, armor, 'assault');
		add_design(technology_id, chassis, hand_weapons, armor, 'garrison');
	}
};

add_milestone_designs('');
for (technology_id of technologies.order) {
	add_milestone_designs(technology_id);
}

return {
	definitions: definitions,
};
