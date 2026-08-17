const manifest = #include('../content/base_units');
const technologies = #include('../content/base_technologies');
const design_rules = #include('design_rules');
const sprite_render = #include('sprite_render');

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

const get_best_reactor = (known) => {
	let best = null;
	for (reactor of manifest.reactors) {
		if (!is_available(reactor, known)) {
			continue;
		}
		if (best == null || reactor.power > best.power) {
			best = reactor;
		}
	}
	return best;
};

const find_component = (entries, id) => {
	for (entry of entries) {
		if (entry.id == id) {
			return entry;
		}
	}
	throw Error('Missing unit component: ' + id);
};

const get_required_technologies = (chassis, weapon, armor, abilities, reactor) => {
	let required = {};
	const add = (component) => {
		if (component.availability == 'technology') {
			required[component.required_technology] = true;
		}
	};
	add(chassis);
	add(weapon);
	add(armor);
	add(reactor);
	for (ability of abilities) {
		add(ability);
	}
	if (#sizeof(abilities) > 1) {
		required.NeuralGrafting = true;
	}
	let result = [];
	for (technology_id of technologies.order) {
		if (#is_defined(required[technology_id])) {
			result :+technology_id;
		}
	}
	return result;
};

const hand_weapons = find_component(manifest.weapons, 'HandWeapons');
const no_armor = find_component(manifest.armors, 'NoArmor');
const colony_module = find_component(manifest.weapons, 'ColonyModule');
const terraforming_unit = find_component(manifest.weapons, 'TerraformingUnit');
const troop_transport = find_component(manifest.weapons, 'TroopTransport');
const supply_transport = find_component(manifest.weapons, 'SupplyTransport');
const conventional_payload = find_component(manifest.weapons, 'ConventionalPayload');
const planet_buster = find_component(manifest.weapons, 'PlanetBuster');
const heavy_artillery = find_component(manifest.abilities, 'HeavyArtillery');
const deep_radar = find_component(manifest.abilities, 'DeepRadar');
const cloaking_device = find_component(manifest.abilities, 'CloakingDevice');
const deep_pressure_hull = find_component(manifest.abilities, 'DeepPressureHull');
const carrier_deck = find_component(manifest.abilities, 'CarrierDeck');
const amphibious_pods = find_component(manifest.abilities, 'AmphibiousPods');
const drop_pods = find_component(manifest.abilities, 'DropPods');
const air_superiority = find_component(manifest.abilities, 'AirSuperiority');
const nerve_gas_pods = find_component(manifest.abilities, 'NerveGasPods');

const get_role_abilities = (known, role) => {
	let result = [];
	const add_if_available = (id) => {
		const ability = find_component(manifest.abilities, id);
		if (is_available(ability, known)) {
			result :+ability;
		}
	};
	if (role == 'assault') {
		add_if_available('EmpathSong');
		add_if_available('BlinkDisplacer');
	} else if (role == 'garrison') {
		add_if_available('HypnoticTrance');
		const aaa = find_component(manifest.abilities, 'AAATracking');
		if (is_available(aaa, known)) {
			result :+aaa;
		} else {
			add_if_available('CommJammer');
		}
	}
	return result;
};

const make_definition = (
	chassis,
	weapon,
	armor,
	role,
	abilities,
	reactor
) => {
	const required_technologies = get_required_technologies(
		chassis,
		weapon,
		armor,
		abilities,
		reactor
	);
	const required_technology = #sizeof(required_technologies) == 0
		? ''
		: required_technologies[#sizeof(required_technologies) - 1];
	const role_name = role == 'assault' ? weapon.short_name : armor.short_name;
	let ability_name = '';
	let ability_ids = [];
	let ability_suffix = '';
	for (ability of abilities) {
		if (ability.abbreviation != '') {
			ability_name += ability.abbreviation + ' ';
		}
		ability_ids :+ability.id;
		ability_suffix += ability.id;
	}
	const reactor_name = reactor.power == 1 ? '' : (
		reactor.power == 2 ? 'Fusion ' : (
			reactor.power == 3 ? 'Quantum ' : 'Singularity '
		)
	);
	let name = reactor_name + ability_name + role_name + ' ' + chassis.name;
	if (role == 'artillery') {
		name = reactor_name + weapon.short_name + ' Artillery ' + chassis.name;
	} else if (role == 'former') {
		name = reactor_name + ability_name +
			(chassis.id == 'Infantry' ? 'Former' : chassis.name + ' Former');
	} else if (role == 'transport') {
		name = reactor_name + ability_name + chassis.name + ' Transport';
	} else if (role == 'supply') {
		name = reactor_name + (
			chassis.id == 'Infantry' ? 'Supply Crawler' : 'Supply ' + chassis.name
		);
	} else if (role == 'colony') {
		name = reactor_name + (
			chassis.id == 'Infantry' ? 'Colony Pod' : chassis.name + ' Colony Pod'
		);
	}
	const reactor_suffix = reactor.power == 1 ? '' : reactor.id;
	const cargo_capacity = design_rules.get_cargo_capacity(
		chassis,
		weapon,
		abilities,
		reactor
	);
	return {
		id: 'Generated' + chassis.id + weapon.id + armor.id + ability_suffix + reactor_suffix,
		data: {
			name: name,
			mineral_cost: design_rules.get_mineral_cost(
				chassis,
				weapon,
				armor,
				abilities,
				reactor
			),
			is_native: false,
			offense: weapon.offense,
			defense: armor.defense,
			can_found_base: role == 'colony',
			can_terraform: role == 'former',
			required_technology: required_technology,
			required_technologies: required_technologies,
			chassis: chassis.id,
			weapon: weapon.id,
			armor: armor.id,
			reactor: reactor.id,
			reactor_power: reactor.power,
			abilities: ability_ids,
			morale: 'STANDARD',
			type: 'static',
			movement_type: chassis.triad == 'sea' ? 'water' : chassis.triad,
			movement_per_turn: chassis.speed,
			operational_range: chassis.range,
			is_missile: chassis.missile,
			cargo_capacity: cargo_capacity,
			render: sprite_render.get(chassis.id, armor.id, weapon.id, reactor.id),
		},
	};
};

let definitions = [];
let seen = {};
seen['Infantry|HandWeapons|NoArmor||FissionPlant'] = true;
seen['Speeder|HandWeapons|NoArmor||FissionPlant'] = true;
seen['Infantry|Laser|NoArmor||FissionPlant'] = true;
seen['Infantry|HandWeapons|SynthmetalArmor||FissionPlant'] = true;
seen['Infantry|ColonyModule|NoArmor||FissionPlant'] = true;
seen['Infantry|TerraformingUnit|NoArmor||FissionPlant'] = true;
seen['Foil|TroopTransport|NoArmor||FissionPlant'] = true;
seen['Infantry|SupplyTransport|NoArmor||FissionPlant'] = true;

const add_design = (chassis, weapon, armor, role, abilities, reactor) => {
	let ability_signature = '';
	for (ability of abilities) {
		ability_signature += ability.id + ',';
	}
	const signature = chassis.id + '|' + weapon.id + '|' + armor.id + '|' +
		ability_signature + '|' + reactor.id;
	if (#is_defined(seen[signature])) {
		return;
	}
	seen[signature] = true;
	definitions :+make_definition(
		chassis,
		weapon,
		armor,
		role,
		abilities,
		reactor
	);
};

const add_milestone_designs = (technology_id, known) => {
	const weapon = get_best_weapon(known);
	const armor = get_best_armor(known);
	const chassis_by_triad = get_best_chassis_by_triad(known);
	const reactor = get_best_reactor(known);
	if (weapon == null || armor == null || reactor == null) {
		return;
	}
	const reactor_changed = technology_id == '' ||
		reactor.required_technology == technology_id;
	const add = (chassis, weapon, armor, role, abilities) => {
		add_design(chassis, weapon, armor, role, abilities, reactor);
	};
	for (triad in chassis_by_triad) {
		const chassis = chassis_by_triad[triad];
		add(chassis, weapon, armor, 'assault', []);
		add(chassis, hand_weapons, armor, 'garrison', []);
		const assault_abilities = get_role_abilities(known, 'assault');
		if (#sizeof(assault_abilities) > 0) {
			add(chassis, weapon, armor, 'assault', assault_abilities);
		}
		const garrison_abilities = get_role_abilities(known, 'garrison');
		if (#sizeof(garrison_abilities) > 0) {
			add(chassis, hand_weapons, armor, 'garrison', garrison_abilities);
		}
		if (triad != 'air' && is_available(heavy_artillery, known)) {
			add(chassis, weapon, armor, 'artillery', [heavy_artillery]);
			if (is_available(deep_radar, known) && #is_defined(known.NeuralGrafting)) {
				add(chassis, weapon, armor, 'artillery', [deep_radar, heavy_artillery]);
			}
		}
		if (triad == 'land' && is_available(cloaking_device, known)) {
			add(chassis, weapon, armor, 'assault', [cloaking_device]);
		}
		if (triad == 'sea' && is_available(deep_pressure_hull, known)) {
			add(chassis, weapon, armor, 'assault', [deep_pressure_hull]);
		}
		if (triad == 'land' && is_available(amphibious_pods, known)) {
			add(chassis, weapon, armor, 'assault', [amphibious_pods]);
		}
		if (triad == 'land' && is_available(drop_pods, known)) {
			add(chassis, weapon, armor, 'assault', [drop_pods]);
		}
		if (is_available(air_superiority, known)) {
			add(chassis, weapon, armor, 'assault', [air_superiority]);
		}
		if (
			triad != 'sea' && weapon.id != 'PsiAttack' &&
			is_available(nerve_gas_pods, known)
		) {
			add(chassis, weapon, armor, 'assault', [nerve_gas_pods]);
		}
	}
	for (chassis of manifest.chassis) {
		if (
			chassis.missile || !is_available(chassis, known) ||
			(chassis.required_technology != technology_id && !reactor_changed)
		) {
			continue;
		}
		add(chassis, weapon, armor, 'assault', []);
		add(chassis, hand_weapons, armor, 'garrison', []);
		if (chassis.triad != 'air') {
			add(chassis, colony_module, no_armor, 'colony', []);
		}
	}
	if (is_available(troop_transport, known)) {
		for (chassis of manifest.chassis) {
			if (
				chassis.triad != 'sea' || !is_available(chassis, known) ||
				(
					chassis.required_technology != technology_id &&
					troop_transport.required_technology != technology_id &&
					!reactor_changed
				)
			) {
				continue;
			}
			add(chassis, troop_transport, no_armor, 'transport', []);
		}
	}
	if (is_available(supply_transport, known)) {
		for (chassis of manifest.chassis) {
			if (
				chassis.triad != 'land' || !is_available(chassis, known) ||
				(
					chassis.required_technology != technology_id &&
					supply_transport.required_technology != technology_id &&
					!reactor_changed
				)
			) {
				continue;
			}
			add(chassis, supply_transport, no_armor, 'supply', []);
		}
	}
	const missile = find_component(manifest.chassis, 'Missile');
	if (
		(
			technology_id == missile.required_technology ||
			technology_id == conventional_payload.required_technology ||
			reactor_changed
		) &&
		is_available(missile, known) && is_available(conventional_payload, known)
	) {
		add(
			missile,
			conventional_payload,
			no_armor,
			'assault',
			[]
		);
	}
	if (
		(
			technology_id == planet_buster.required_technology || reactor_changed
		) &&
		is_available(missile, known) && is_available(planet_buster, known)
	) {
		add(
			missile,
			planet_buster,
			no_armor,
			'assault',
			[]
		);
	}
	const carrier_chassis = chassis_by_triad['sea'];
	if (
		(
			technology_id == carrier_deck.required_technology || reactor_changed
		) &&
		#is_defined(carrier_chassis) && is_available(carrier_deck, known) &&
		is_available(troop_transport, known)
	) {
		add(
			carrier_chassis,
			troop_transport,
			armor,
			'transport',
			[carrier_deck]
		);
	}
	const infantry = find_component(manifest.chassis, 'Infantry');
	for (ability_id of ['HighMorale', 'CleanReactor']) {
		const ability = find_component(manifest.abilities, ability_id);
		if (is_available(ability, known)) {
			add(infantry, hand_weapons, no_armor, 'garrison', [ability]);
		}
	}

	for (former_triad of ['land', 'sea']) {
		const former_chassis = chassis_by_triad[former_triad];
		if (!#is_defined(former_chassis) || !is_available(terraforming_unit, known)) {
			continue;
		}
		add(former_chassis, terraforming_unit, no_armor, 'former', []);
		let former_abilities = [];
		for (ability_id of ['SuperFormer', 'FungicideTanks']) {
			const ability = find_component(manifest.abilities, ability_id);
			if (is_available(ability, known)) {
				former_abilities :+ability;
			}
		}
		if (#sizeof(former_abilities) > 0) {
			add(
				former_chassis,
				terraforming_unit,
				no_armor,
				'former',
				former_abilities
			);
		}
		const clean_reactor = find_component(manifest.abilities, 'CleanReactor');
		if (is_available(clean_reactor, known)) {
			add(
				former_chassis,
				terraforming_unit,
				no_armor,
				'former',
				[clean_reactor]
			);
		}
	}
};

const generate_available = (known) => {
	let combined = {};
	add_milestone_designs('', combined);
	for (technology_id of technologies.order) {
		if (#is_defined(known[technology_id])) {
			let branch = {};
			add_technology_closure(branch, technology_id);
			add_milestone_designs(technology_id, branch);
			add_technology_closure(combined, technology_id);
		}
	}
	add_milestone_designs('', combined);
	result.definitions = definitions;
	return definitions;
};

const generate_all = () => {
	let combined = {};
	add_milestone_designs('', combined);
	for (technology_id of technologies.order) {
		let branch = {};
		add_technology_closure(branch, technology_id);
		add_milestone_designs(technology_id, branch);
		add_technology_closure(combined, technology_id);
	}
	add_milestone_designs('', combined);
	result.definitions = definitions;
	return definitions;
};

let result = {
	definitions: definitions,
	generate_available: generate_available,
	generate_all: generate_all,
};

return result;
