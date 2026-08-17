const DEFAULT_STARTING_ENERGY = 10;
const FANATIC_ATTACK_MULTIPLIER = 1.25;

const rules = {
	HIVE: {
		free_base_facilities: ['PerimeterDefense'],
	},
	UNIVERSITY: {
		free_base_facilities: ['NetworkNode'],
		drone_per_population: 4,
	},
	MORGANITES: {
		starting_energy_bonus: 100,
		population_limit_modifier: 0 - 3,
	},
	BELIEVERS: {
		fanatic_attack: true,
	},
	PEACEKEEPERS: {
		population_limit_modifier: 2,
		talent_per_population: 4,
	},
};

const get_faction_id = (player) => {
	if (player == null || #typeof(player.get_faction) != 'Callable') {
		return '';
	}
	const faction = player.get_faction();
	return faction == null || !#is_defined(faction.id) ? '' : faction.id;
};

const get_rules = (player) => {
	const id = get_faction_id(player);
	return #is_defined(rules[id]) ? rules[id] : {};
};

const get_starting_energy = (player) => {
	const faction = get_rules(player);
	return DEFAULT_STARTING_ENERGY + (
		#is_defined(faction.starting_energy_bonus)
			? faction.starting_energy_bonus
			: 0
	);
};

const get_free_base_facilities = (player) => {
	const faction = get_rules(player);
	return #is_defined(faction.free_base_facilities)
		? faction.free_base_facilities
		: [];
};
const has_free_base_facility = (player, facility_id) => {
	for (candidate of get_free_base_facilities(player)) {
		if (candidate == facility_id) {
			return true;
		}
	}
	return false;
};

const apply_free_base_facilities = (base, player) => {
	let added = [];
	for (facility_id of get_free_base_facilities(player)) {
		if (!base.has_facility(facility_id)) {
			base.add_facility(facility_id);
			added :+facility_id;
		}
	}
	return added;
};

const rollback_free_base_facilities = (base, added) => {
	for (facility_id of added) {
		if (base.has_facility(facility_id)) {
			base.remove_facility(facility_id);
		}
	}
};


const get_population_limit_modifier = (player) => {
	const faction = get_rules(player);
	return #is_defined(faction.population_limit_modifier)
		? faction.population_limit_modifier
		: 0;
};

const get_psych_modifiers = (player, population) => {
	const faction = get_rules(player);
	const size = #max(population, 0);
	let drones = 0;
	let talents = 0;
	if (#is_defined(faction.drone_per_population)) {
		drones = #floor(
			#to_float(size) / #to_float(faction.drone_per_population)
		);
	}
	if (#is_defined(faction.talent_per_population) && size > 0) {
		talents = #floor(
			#to_float(size + faction.talent_per_population - 1) /
			#to_float(faction.talent_per_population)
		);
	}
	return {drones: drones, talents: talents};
};

const get_attack_multiplier = (player, is_psi_combat) => {
	const faction = get_rules(player);
	return !is_psi_combat && #is_defined(faction.fanatic_attack) && faction.fanatic_attack
		? FANATIC_ATTACK_MULTIPLIER
		: 1.0;
};

return {
	get_faction_id: get_faction_id,
	get_starting_energy: get_starting_energy,
	get_free_base_facilities: get_free_base_facilities,
	has_free_base_facility: has_free_base_facility,
	apply_free_base_facilities: apply_free_base_facilities,
	rollback_free_base_facilities: rollback_free_base_facilities,
	get_population_limit_modifier: get_population_limit_modifier,
	get_psych_modifiers: get_psych_modifiers,
	get_attack_multiplier: get_attack_multiplier,
};
