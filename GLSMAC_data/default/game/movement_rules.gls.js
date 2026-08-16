const unit_abilities = #include('unit_abilities');

const tile_has_friendly_unit = (unit, tile) => {
	for (other of tile.get_units()) {
		if (other.owner == unit.owner) {
			return true;
		}
	}
	return false;
};

const tile_is_in_enemy_zoc = (unit, tile) => {
	for (nearby of tile.get_surrounding_tiles()) {
		const base = nearby.get_base();
		if (base != null && base.get_owner().id != unit.owner) {
			return true;
		}
		for (other of nearby.get_units()) {
			if (other.owner != unit.owner && (other.is_land || other.is_air)) {
				return true;
			}
		}
	}
	return false;
};

const is_zoc_move_blocked = (unit, source, destination) => {
	if (
		!unit.is_land || unit_abilities.ignores_zoc(unit) ||
		destination.get_base() != null || tile_has_friendly_unit(unit, destination)
	) {
		return false;
	}
	return tile_is_in_enemy_zoc(unit, source) && tile_is_in_enemy_zoc(unit, destination);
};

const get_move_target_snapshot = (unit) => {
	if (#typeof(unit.get_move_target) != 'Callable') {
		return null;
	}
	const target = unit.get_move_target();
	return target == null ? null : {x: target.x + 0, y: target.y + 0};
};

const clear_move_target = (unit) => {
	if (#typeof(unit.clear_move_target) == 'Callable') {
		unit.clear_move_target();
	}
};

const restore_move_target = (unit, tm_or_game, snapshot) => {
	if (
		#typeof(unit.set_move_target) != 'Callable' ||
		#typeof(unit.clear_move_target) != 'Callable'
	) {
		return;
	}
	if (!#is_defined(snapshot) || snapshot == null) {
		unit.clear_move_target();
		return;
	}
	const tm = #typeof(tm_or_game.get_tm) == 'Callable'
		? tm_or_game.get_tm()
		: tm_or_game;
	if (tm == null || #typeof(tm.get_tile) != 'Callable') {
		unit.clear_move_target();
		return;
	}
	const target = tm.get_tile(snapshot.x, snapshot.y);
	if (target == null) {
		unit.clear_move_target();
		return;
	}
	unit.set_move_target(target);
};

return {
	is_zoc_move_blocked: is_zoc_move_blocked,
	tile_is_in_enemy_zoc: tile_is_in_enemy_zoc,
	get_move_target_snapshot: get_move_target_snapshot,
	clear_move_target: clear_move_target,
	restore_move_target: restore_move_target,
};
