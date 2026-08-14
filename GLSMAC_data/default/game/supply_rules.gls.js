const artifact_rules = #include('./artifact_rules');

const RESOURCE_TYPES = ['NUTRIENTS', 'MINERALS', 'ENERGY'];
const INTERBASE_TRANSFER = 1;

const is_resource = (resource) => {
	for (candidate of RESOURCE_TYPES) {
		if (candidate == resource) {
			return true;
		}
	}
	return false;
};

const is_supply_transport = (unit_or_def) => {
	const def = #is_defined(unit_or_def.get_def)
		? unit_or_def.get_def()
		: unit_or_def;
	return #is_defined(def.weapon) && def.weapon == 'SupplyTransport';
};

const get_home_base = (game, unit) => {
	if (!#is_defined(unit.home_base_id) || unit.home_base_id == 0) {
		return null;
	}
	for (base of game.get_bm().get_bases()) {
		if (base.id == unit.home_base_id && base.get_owner().id == unit.owner) {
			return base;
		}
	}
	return null;
};

const get_common_usage_error = (game, unit, caller) => {
	if (unit.owner != caller) {
		return 'Supply Transport can only be used by its owner';
	}
	if (game.is_turn_complete(caller)) {
		return 'Player has already completed this turn';
	}
	if (unit.health <= 0.0) {
		return 'Destroyed Supply Transport cannot be used';
	}
	if (#is_defined(unit.transport_id) && unit.transport_id > 0) {
		return 'Embarked Supply Transport cannot be used';
	}
	if (!is_supply_transport(unit)) {
		return 'Unit is not a Supply Transport';
	}
};

const get_order_error = (game, unit, caller, resource) => {
	const usage_error = get_common_usage_error(game, unit, caller);
	if (#is_defined(usage_error)) {
		return usage_error;
	}
	if (resource == 'none') {
		if (unit.convoy_resource == 'none') {
			return 'Supply Transport has no convoy order to cancel';
		}
		return;
	}
	if (!is_resource(resource)) {
		return 'Invalid convoy resource';
	}
	if (unit.movement <= 0.0) {
		return 'Supply Transport has no movement remaining';
	}
	if (unit.terraforming != 'none') {
		return 'Cancel the unit\'s terraforming order before convoying supplies';
	}
	const home_base = get_home_base(game, unit);
	if (home_base == null) {
		return 'Supply Transport needs an owned home base';
	}
	const current_base = unit.get_tile().get_base();
	if (current_base != null) {
		if (current_base.get_owner().id != caller) {
			return 'Supply Transport can only transfer resources to an owned base';
		}
		if (current_base.id == home_base.id) {
			return 'Move the Supply Transport outside its home base before convoying';
		}
	}
};

const get_contribution_target = (unit) => {
	const base = unit.get_tile().get_base();
	return base == null ? null : artifact_rules.get_contribution_target(base);
};

const get_contribution_error = (game, unit, caller) => {
	const usage_error = get_common_usage_error(game, unit, caller);
	if (#is_defined(usage_error)) {
		return usage_error;
	}
	const base = unit.get_tile().get_base();
	if (base == null || base.get_owner().id != caller) {
		return 'Supply Transport must be inside an owned base';
	}
	if (get_contribution_target(unit) == null) {
		return 'Base must be producing a Secret Project or an unprototyped unit';
	}
};

const get_base_convoy_adjustment = (game, base, tile_bonuses) => {
	let result = {NUTRIENTS: 0, MINERALS: 0, ENERGY: 0};
	if (!#is_defined(game.get_um)) {
		return result;
	}
	const bonuses = #is_defined(tile_bonuses) ? tile_bonuses : {};
	const worked_tile_energy_bonus = #is_defined(bonuses.worked_tile_energy_bonus)
		? bonuses.worked_tile_energy_bonus
		: 0;
	const social_tile_energy_bonus = #is_defined(bonuses.social_tile_energy_bonus)
		? bonuses.social_tile_energy_bonus
		: 0;
	const forest_nutrient_bonus = #is_defined(bonuses.forest_nutrient_bonus)
		? bonuses.forest_nutrient_bonus
		: 0;
	const forest_mineral_bonus = #is_defined(bonuses.forest_mineral_bonus)
		? bonuses.forest_mineral_bonus
		: 0;
	const forest_energy_bonus = #is_defined(bonuses.forest_energy_bonus)
		? bonuses.forest_energy_bonus
		: 0;
	const owner = base.get_owner();
	const owner_id = owner.id;
	const convoy_candidates = #is_defined(base.get_convoy_units)
		? base.get_convoy_units()
		: game.get_um().get_units();
	for (unit of convoy_candidates) {
		if (
			unit.owner != owner_id || !#is_defined(unit.convoy_resource) ||
			unit.convoy_resource == 'none' || !#is_defined(unit.health) ||
			unit.health <= 0.0 || !is_supply_transport(unit)
		) {
			continue;
		}
		const resource = unit.convoy_resource;
		if (!is_resource(resource)) {
			continue;
		}
		const tile = unit.get_tile();
		const current_base = tile.get_base();
		if (unit.home_base_id == base.id) {
			if (current_base == null) {
				const raw = tile.get_resources(owner);
				const is_forest = tile.is_land && tile.terraforming.forest;
				const intake = {
					NUTRIENTS: raw.NUTRIENTS +
						(is_forest ? forest_nutrient_bonus : 0),
					MINERALS: raw.MINERALS +
						(is_forest ? forest_mineral_bonus : 0),
					ENERGY: raw.ENERGY + worked_tile_energy_bonus +
						social_tile_energy_bonus +
						(is_forest ? forest_energy_bonus : 0),
				};
				result[resource] = result[resource] + intake[resource];
			}
		}
		else if (
			current_base != null && current_base.id == base.id &&
			get_home_base(game, unit) != null
		) {
			result[resource] = result[resource] + INTERBASE_TRANSFER;
		}
	}
	return result;
};

const get_base_convoy_consumption = (game, base) => {
	let result = {NUTRIENTS: 0, MINERALS: 0, ENERGY: 0};
	if (!#is_defined(game.get_um)) {
		return result;
	}
	const owner_id = base.get_owner().id;
	const convoy_candidates = #is_defined(base.get_convoy_units)
		? base.get_convoy_units()
		: game.get_um().get_units();
	for (unit of convoy_candidates) {
		if (
			unit.owner != owner_id || !#is_defined(unit.convoy_resource) ||
			unit.convoy_resource == 'none' || !#is_defined(unit.health) ||
			unit.health <= 0.0 || unit.home_base_id != base.id ||
			!is_supply_transport(unit) || !is_resource(unit.convoy_resource)
		) {
			continue;
		}
		const current_base = unit.get_tile().get_base();
		if (current_base != null && current_base.id != base.id) {
			const resource = unit.convoy_resource;
			result[resource] = result[resource] + INTERBASE_TRANSFER;
		}
	}
	return result;
};

return {
	resource_types: RESOURCE_TYPES,
	interbase_transfer: INTERBASE_TRANSFER,
	is_resource: is_resource,
	is_supply_transport: is_supply_transport,
	get_home_base: get_home_base,
	get_order_error: get_order_error,
	get_contribution_target: get_contribution_target,
	get_contribution_error: get_contribution_error,
	get_base_convoy_adjustment: get_base_convoy_adjustment,
	get_base_convoy_consumption: get_base_convoy_consumption,
};
