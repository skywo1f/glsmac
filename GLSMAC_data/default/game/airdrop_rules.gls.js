const unit_abilities = #include('unit_abilities');
const orbital_rules = #include('orbital_rules');

const NORMAL_RANGE = 8;

const is_airbase = (tile) => {
	return #is_defined(tile.terraforming) &&
		#is_defined(tile.terraforming.airbase) && tile.terraforming.airbase;
};

const is_friendly_airbase = (game, player, tile) => {
	if (!is_airbase(tile)) {
		return false;
	}
	const is_friendly = #is_defined(game.get)
		? game.get('f_territory_is_friendly')
		: #undefined;
	return #is_defined(is_friendly) && is_friendly(player, tile);
};

const has_orbital_insertion = (game, player) => {
	return player.has_technology('GravitonTheory') ||
		orbital_rules.has_space_elevator(game, player);
};

const get_source_error = (game, unit, caller) => {
	if (unit.owner != caller) {
		return 'Unit can only be air-dropped by its owner';
	}
	if (game.is_turn_complete(caller)) {
		return 'Player has already completed this turn';
	}
	if (unit.health <= 0.0) {
		return 'Destroyed unit cannot make an air drop';
	}
	if (#is_defined(unit.transport_id) && unit.transport_id > 0) {
		return 'Embarked unit must air-drop with its transport';
	}
	if (!unit.is_land || !unit_abilities.has(unit, 'DropPods')) {
		return 'Unit does not have usable Drop Pods';
	}
	if (unit.terraforming != 'none') {
		return 'Cancel the unit\'s terraforming order before air-dropping';
	}
	if (
		unit.moved_this_turn ||
		(#is_defined(unit.airdropped_this_turn) && unit.airdropped_this_turn)
	) {
		return 'Unit must begin the turn at its launch site';
	}
	const source = unit.get_tile();
	if (source.is_locked()) {
		return 'Air-drop launch site is currently busy';
	}
	const source_base = source.get_base();
	if (source_base != null && source_base.get_owner().id == caller) {
		return;
	}
	const player = game.get_player(caller);
	if (!is_friendly_airbase(game, player, source)) {
		return 'Unit must begin the turn in an owned base or friendly airbase';
	}
};

const is_foreign_occupied = (tile, caller) => {
	const base = tile.get_base();
	if (base != null && base.get_owner().id != caller) {
		return true;
	}
	for (unit of tile.get_units(true)) {
		if (unit.owner != caller) {
			return true;
		}
	}
	return false;
};

const get_interceptors = (game, caller) => {
	let result = [];
	for (unit of game.get_um().get_units()) {
		if (
			unit.owner == caller || !unit.is_air || unit.health <= 0.0 ||
			!unit_abilities.has(unit, 'AirSuperiority')
		) {
			continue;
		}
		const tile = unit.get_tile();
		if (tile.get_base() != null || is_airbase(tile)) {
			result :+unit;
		}
	}
	return result;
};

const has_interceptor = (game, caller, destination, interceptors) => {
	const patrols = #is_defined(interceptors)
		? interceptors
		: get_interceptors(game, caller);
	for (unit of patrols) {
		if (game.get_tm().get_distance(unit.get_tile(), destination) <= 2) {
			return true;
		}
	}
	return false;
};

const get_drop_error = (game, unit, caller, destination, interceptors) => {
	const source_error = get_source_error(game, unit, caller);
	if (#is_defined(source_error)) {
		return source_error;
	}
	if (!#is_defined(destination) || destination == null) {
		return 'Select an air-drop destination';
	}
	const source = unit.get_tile();
	if (destination == source) {
		return 'Air-drop destination must differ from the launch site';
	}
	if (destination.is_locked()) {
		return 'Air-drop destination is currently busy';
	}
	if (destination.is_water && destination.get_base() == null) {
		return 'Land units cannot air-drop into open ocean';
	}
	const player = game.get_player(caller);
	if (
		!has_orbital_insertion(game, player) &&
		game.get_tm().get_distance(source, destination) > NORMAL_RANGE
	) {
		return 'Air-drop destination is more than eight squares away';
	}
	if (is_foreign_occupied(destination, caller)) {
		return 'Air-drop destination contains foreign units or a foreign base';
	}
	if (has_interceptor(game, caller, destination, interceptors)) {
		return 'Enemy Air Superiority patrols block this air drop';
	}
};

const get_available_destinations = (game, unit, caller) => {
	let result = [];
	const tm = game.get_tm();
	const interceptors = get_interceptors(game, caller);
	for (let y = 0; y < tm.get_map_height(); y++) {
		for (let x = 0; x < tm.get_map_width(); x++) {
			if (x % 2 != y % 2) {
				continue;
			}
			const tile = tm.get_tile(x, y);
			if (!#is_defined(get_drop_error(game, unit, caller, tile, interceptors))) {
				result :+tile;
			}
		}
	}
	return result;
};

const get_damage = (unit) => {
	return unit.get_def().reactor_power >= 4 ? 0.26 : 0.20;
};

return {
	normal_range: NORMAL_RANGE,
	is_airbase: is_airbase,
	has_orbital_insertion: has_orbital_insertion,
	get_interceptors: get_interceptors,
	get_source_error: get_source_error,
	get_drop_error: get_drop_error,
	get_available_destinations: get_available_destinations,
	get_damage: get_damage,
};
