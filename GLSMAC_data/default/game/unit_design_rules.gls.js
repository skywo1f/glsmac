const manifest = #include('../content/base_units');
const cost_rules = #include('../units/design_rules');

const SUPPORTED_ABILITIES = {
	SuperFormer: true,
	AmphibiousPods: true,
	DropPods: true,
	AirSuperiority: true,
	CarrierDeck: true,
	AAATracking: true,
	CommJammer: true,
	AntigravStruts: true,
	EmpathSong: true,
	PolymorphicEncryption: true,
	FungicideTanks: true,
	HighMorale: true,
	HeavyArtillery: true,
	CleanReactor: true,
	BlinkDisplacer: true,
	HypnoticTrance: true,
	NerveGasPods: true,
	RepairBay: true,
	NonLethalMethods: true,
};

const find_component = (entries, id) => {
	for (entry of entries) {
		if (entry.id == id) {
			return entry;
		}
	}
	return null;
};

const is_available = (player, entry) => {
	return entry != null && (
		entry.availability == 'always' || (
			entry.availability == 'technology' &&
			player.has_technology(entry.required_technology)
		)
	);
};

const get_available = (player, entries, supported) => {
	let result = [];
	for (entry of entries) {
		if (
			is_available(player, entry) &&
			(!#is_defined(supported) || #is_defined(supported[entry.id]))
		) {
			result :+entry;
		}
	}
	return result;
};

const has_ability = (abilities, id) => {
	for (ability of abilities) {
		if (ability.id == id) {
			return true;
		}
	}
	return false;
};

const get_flag = (ability, index) => {
	// Crossfire adds an "only probe teams" bit before the original 11 flags.
	const offset = #sizeof(ability.flags) == 12 ? 1 : 0;
	return (ability.flags + '')[index + offset::index + offset + 1] == '1';
};

const get_role = (weapon) => {
	if (weapon.id == 'TerraformingUnit') {
		return 'terraformer';
	}
	if (weapon.offense > 0 || weapon.id == 'PsiAttack') {
		return 'combat';
	}
	return 'noncombat';
};

const is_ability_compatible = (chassis, weapon, armor, ability) => {
	if (!#is_defined(SUPPORTED_ABILITIES[ability.id])) {
		return false;
	}
	if (#sizeof(ability.flags) != 11 && #sizeof(ability.flags) != 12) {
		return false;
	}
	if (
		#sizeof(ability.flags) == 12 && get_flag(ability, 0 - 1) &&
		weapon.id != 'ProbeTeam'
	) {
		return false;
	}
	if (get_flag(ability, 1) && chassis.speed > 1) {
		return false;
	}
	if (get_flag(ability, 2) && weapon.id != 'TroopTransport') {
		return false;
	}
	const is_psi = weapon.id == 'PsiAttack' || armor.id == 'PsiDefense';
	if (get_flag(ability, 3) && is_psi) {
		return false;
	}
	if (get_flag(ability, 4) && weapon.id == 'ProbeTeam') {
		return false;
	}
	const role = get_role(weapon);
	if (
		(role == 'noncombat' && !get_flag(ability, 5)) ||
		(role == 'terraformer' && !get_flag(ability, 6)) ||
		(role == 'combat' && !get_flag(ability, 7))
	) {
		return false;
	}
	return (
		(chassis.triad == 'air' && get_flag(ability, 8)) ||
		(chassis.triad == 'sea' && get_flag(ability, 9)) ||
		(chassis.triad == 'land' && get_flag(ability, 10))
	);
};

const get_ability_limit = (player) => {
	return player.has_technology('NeuralGrafting') ? 2 : 1;
};

const get_components = (selection) => {
	return {
		chassis: find_component(manifest.chassis, selection.chassis),
		weapon: find_component(manifest.weapons, selection.weapon),
		armor: find_component(manifest.armors, selection.armor),
		reactor: find_component(manifest.reactors, selection.reactor),
	};
};

const canonicalize_abilities = (ability_ids) => {
	let selected = {};
	for (id of ability_ids) {
		if (#is_defined(selected[id])) {
			return null;
		}
		selected[id] = true;
	}
	let result = [];
	for (ability of manifest.abilities) {
		if (#is_defined(selected[ability.id])) {
			result :+ability;
			selected[ability.id] = false;
		}
	}
	for (id in selected) {
		if (selected[id]) {
			return null;
		}
	}
	return result;
};

const get_error = (player, selection) => {
	if (
		#typeof(selection) != 'Object' ||
		#typeof(selection.chassis) != 'String' ||
		#typeof(selection.weapon) != 'String' ||
		#typeof(selection.armor) != 'String' ||
		#typeof(selection.reactor) != 'String' ||
		#typeof(selection.abilities) != 'Array'
	) {
		return 'A unit design requires chassis, weapon, armor, reactor, and abilities';
	}
	const components = get_components(selection);
	if (!is_available(player, components.chassis)) {
		return 'Selected chassis is unavailable';
	}
	if (!is_available(player, components.weapon)) {
		return 'Selected weapon or equipment is unavailable';
	}
	if (!is_available(player, components.armor)) {
		return 'Selected armor is unavailable';
	}
	if (!is_available(player, components.reactor)) {
		return 'Selected reactor is unavailable';
	}
	const chassis = components.chassis;
	const weapon = components.weapon;
	const armor = components.armor;
	if (chassis.missile) {
		if (
			(weapon.id != 'ConventionalPayload' && weapon.id != 'PlanetBuster') ||
			armor.id != 'NoArmor'
		) {
			return 'Missiles require a payload and cannot carry armor';
		}
	} else if (weapon.id == 'ConventionalPayload' || weapon.id == 'PlanetBuster') {
		return 'Payload weapons require the Missile chassis';
	}
	if (
		(weapon.id == 'ColonyModule' || weapon.id == 'ProbeTeam') &&
		chassis.triad == 'air'
	) {
		return 'This equipment cannot use an air chassis';
	}
	if (weapon.id == 'TerraformingUnit' && chassis.triad == 'air') {
		return 'Terraforming equipment requires a land or sea chassis';
	}
	if (weapon.id == 'SupplyTransport' && chassis.triad != 'land') {
		return 'Supply transports require a land chassis';
	}
	const abilities = canonicalize_abilities(selection.abilities);
	if (abilities == null) {
		return 'Special abilities must be known and unique';
	}
	if (#sizeof(abilities) > get_ability_limit(player)) {
		return 'Neural Grafting is required for a second special ability';
	}
	for (ability of abilities) {
		if (!is_available(player, ability)) {
			return ability.name + ' is unavailable';
		}
		if (!is_ability_compatible(chassis, weapon, armor, ability)) {
			return ability.name + ' is incompatible with this design';
		}
	}
	return #undefined;
};

const get_render = (chassis, weapon) => {
	let x = weapon.id == 'TerraformingUnit' ? 206 : 2;
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
		type: 'sprite', file: 'units.pcx', x: x, y: y, w: 100, h: 75,
		cx: x + 51, cy: y + 51,
	};
};

const get_name = (components, abilities) => {
	const chassis = components.chassis;
	const weapon = components.weapon;
	const armor = components.armor;
	const reactor = components.reactor;
	let prefix = reactor.power == 1 ? '' : (
		reactor.power == 2 ? 'Fusion ' : (
			reactor.power == 3 ? 'Quantum ' : 'Singularity '
		)
	);
	for (ability of abilities) {
		if (ability.abbreviation != '') {
			prefix += ability.abbreviation + ' ';
		}
	}
	if (weapon.id == 'ColonyModule') {
		return prefix + (chassis.id == 'Infantry'
			? 'Colony Pod'
			: chassis.name + ' Colony Pod');
	}
	if (weapon.id == 'TerraformingUnit') {
		return prefix + (chassis.id == 'Infantry'
			? 'Former'
			: chassis.name + ' Former');
	}
	if (weapon.id == 'TroopTransport') {
		return prefix + chassis.name + ' Transport';
	}
	if (weapon.id == 'SupplyTransport') {
		return prefix + (chassis.id == 'Infantry'
			? 'Supply Crawler'
			: 'Supply ' + chassis.name);
	}
	if (weapon.id == 'ProbeTeam') {
		return prefix + (chassis.id == 'Infantry'
			? 'Probe Team'
			: chassis.name + ' Probe Team');
	}
	if (chassis.missile) {
		return prefix + weapon.short_name;
	}
	const combat_name = weapon.offense >= armor.defense
		? weapon.short_name
		: armor.short_name;
	return prefix + combat_name + ' ' + chassis.name;
};

const get_id = (player, components, abilities) => {
	let id = 'WorkshopP' + #to_string(player.id) + '_' + components.chassis.id +
		'_' + components.weapon.id + '_' + components.armor.id;
	for (ability of abilities) {
		id += '_' + ability.id;
	}
	return id + '_' + components.reactor.id;
};

const get_definition = (player, selection, name) => {
	const error = get_error(player, selection);
	if (#is_defined(error)) {
		throw Error(error);
	}
	const components = get_components(selection);
	const abilities = canonicalize_abilities(selection.abilities);
	let ability_ids = [];
	for (ability of abilities) {
		ability_ids :+ability.id;
	}
	const movement_bonus = has_ability(abilities, 'AntigravStruts')
		? (components.chassis.triad == 'air' ? components.reactor.power * 2 : 1)
		: 0;
	return {
		id: get_id(player, components, abilities),
		data: {
			name: name,
			mineral_cost: cost_rules.get_mineral_cost(
				components.chassis,
				components.weapon,
				components.armor,
				abilities,
				components.reactor
			),
			required_technology: '',
			is_native: false,
			offense: components.weapon.id == 'PsiAttack'
				? 1
				: components.weapon.offense,
			defense: components.armor.id == 'PsiDefense'
				? 1
				: components.armor.defense,
			can_found_base: components.weapon.id == 'ColonyModule',
			can_terraform: components.weapon.id == 'TerraformingUnit',
			chassis: components.chassis.id,
			weapon: components.weapon.id,
			armor: components.armor.id,
			reactor: components.reactor.id,
			reactor_power: components.reactor.power,
			abilities: ability_ids,
			morale: 'STANDARD',
			type: 'static',
			movement_type: components.chassis.triad == 'sea'
				? 'water'
				: components.chassis.triad,
			movement_per_turn: components.chassis.speed + movement_bonus,
			operational_range: components.chassis.range,
			is_missile: components.chassis.missile,
			cargo_capacity: cost_rules.get_cargo_capacity(
				components.chassis,
				components.weapon,
				abilities,
				components.reactor
			),
			owner_player_id: player.id,
			render: get_render(components.chassis, components.weapon),
		},
	};
};

const find_definition = (game, id) => {
	for (def of game.get_um().get_unit_defs()) {
		if (def.id == id) {
			return def;
		}
	}
	return null;
};

const get_preview = (game, player, selection) => {
	const error = get_error(player, selection);
	if (#is_defined(error)) {
		return {error: error};
	}
	const components = get_components(selection);
	const abilities = canonicalize_abilities(selection.abilities);
	const name = get_name(components, abilities);
	const definition = get_definition(player, selection, name);
	return {
		error: #undefined,
		id: definition.id,
		name: name,
		data: definition.data,
		exists: find_definition(game, definition.id) != null,
	};
};

return {
	manifest: manifest,
	supported_abilities: SUPPORTED_ABILITIES,
	find_component: find_component,
	is_available: is_available,
	get_available: get_available,
	get_ability_limit: get_ability_limit,
	is_ability_compatible: is_ability_compatible,
	canonicalize_abilities: canonicalize_abilities,
	get_error: get_error,
	get_name: get_name,
	get_id: get_id,
	get_definition: get_definition,
	find_definition: find_definition,
	get_preview: get_preview,
};
