const snapshot_unit = (unit) => {
	const tile = unit.get_tile();
	return {
		id: unit.id,
		def: unit.def,
		owner: unit.owner,
		tile_x: tile.x,
		tile_y: tile.y,
		movement: unit.movement,
		morale: unit.morale,
		health: unit.health,
		moved_this_turn: unit.moved_this_turn,
		terraforming: unit.terraforming,
		terraforming_turns_remaining: unit.terraforming_turns_remaining,
		home_base_id: unit.home_base_id,
	};
};

const restore_unit = (e, backup) => {
	const unit = e.game.um.spawn_unit({
		id: backup.id,
		def: backup.def,
		owner: e.game.get_player(backup.owner),
		tile: e.game.tm.get_tile(backup.tile_x, backup.tile_y),
		morale: backup.morale,
		health: backup.health,
		terraforming: backup.terraforming,
		terraforming_turns_remaining: backup.terraforming_turns_remaining,
		home_base_id: backup.home_base_id,
	});
	unit.movement = backup.movement;
	unit.moved_this_turn = backup.moved_this_turn;
};

return {

	validate: (e) => {
		const unit = e.data.unit;
		if (unit.owner != e.caller) {
			return 'A colony pod can only be ordered by its owner';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (!unit.get_def().can_found_base) {
			return 'Unit cannot found a base';
		}
		if (unit.movement <= 0.0) {
			return 'Colony pod is out of moves';
		}

		const tile = unit.get_tile();
		if (tile.is_locked()) {
			return 'Base site is locked';
		}
		if (tile.is_water) {
			return 'Land bases cannot be founded at sea';
		}
		if (tile.get_base() != null) {
			return 'Tile already contains a base';
		}
		for (nearby of tile.get_surrounding_tiles()) {
			if (nearby.get_base() != null) {
				return 'Bases cannot be founded on adjacent tiles';
			}
		}
		for (occupant of tile.get_units()) {
			if (occupant.owner != e.caller) {
				return 'Base site contains an enemy unit';
			}
		}
	},

	resolve: (e) => {
		// Defer client-side creation until the server accepts the event so base IDs stay ordered.
		return {};
	},

	apply: (e) => {
		const unit = e.data.unit;
		const tile = unit.get_tile();
		const backup = snapshot_unit(unit);
		let info = {
			production: 'ScoutPatrol',
		};
		if (#is_defined(e.data.name)) {
			info.name = e.data.name;
		}

		const base = e.game.bm.spawn_base(unit.get_owner(), tile, info);
		e.game.um.despawn_unit(unit);

		const pop = base.create_pop({type: 'WORKER'});
		let unoccupied = [];
		for (candidate of base.get_unworked_tiles()) {
			if (candidate.get_base() == null && !candidate.has('working_pop')) {
				unoccupied :+candidate;
			}
		}
		const workable = e.game.get('f_base_find_best_or_worst_tiles')(
			base,
			unoccupied,
			1,
			1
		);
		if (#sizeof(workable) > 0) {
			e.game.get('f_base_pop_work_tile')(base, pop, workable[0]);
		}

		return {
			base: base,
			unit: backup,
		};
	},

	rollback: (e) => {
		e.game.bm.despawn_base(e.applied.base);
		restore_unit(e, e.applied.unit);
	},

};
