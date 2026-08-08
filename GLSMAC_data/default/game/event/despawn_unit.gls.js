return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master is allowed to despawn units';
		}
	},

	apply: (e) => {
		const unit = e.data.unit;
		const tile = unit.get_tile();
		const backup = {
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
		e.game.um.despawn_unit(unit);
		return {
			unit: backup,
		};
	},

	rollback: (e) => {
		const u = e.applied.unit;
		const unit = e.game.um.spawn_unit({
			id: u.id,
			def: u.def,
			owner: e.game.get_player(u.owner),
			tile: e.game.tm.get_tile(u.tile_x, u.tile_y),
			morale: u.morale,
			health: u.health,
			terraforming: u.terraforming,
			terraforming_turns_remaining: u.terraforming_turns_remaining,
			home_base_id: u.home_base_id,
		});
		unit.movement = u.movement;
		unit.moved_this_turn = u.moved_this_turn;
	},

};
