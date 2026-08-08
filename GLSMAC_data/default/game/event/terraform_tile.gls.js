const terraforming = #include('../../units/terraforming');

return {

	validate: (e) => {
		const unit = e.data.unit;
		const order = terraforming.get_order(e.data.type);
		if (order == null) {
			return 'Unknown terraforming order';
		}
		if (unit.owner != e.caller) {
			return 'A Former can only be ordered by its owner';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (unit.health <= 0.0) {
			return 'Dead unit cannot terraform';
		}
		if (!unit.get_def().can_terraform) {
			return 'Only Formers can terraform terrain';
		}
		if (unit.terraforming != 'none') {
			return 'Former already has a terraforming order';
		}
		if (unit.movement <= 0.0) {
			return 'Former is out of moves';
		}

		const tile = unit.get_tile();
		if (tile.is_locked()) {
			return 'Terraforming site is locked';
		}
		if (tile.is_water) {
			return 'Land Formers cannot terraform sea squares';
		}
		if (tile.get_base() != null) {
			return 'This improvement cannot be built at a base';
		}
		if (tile.features.monolith) {
			return 'Monoliths cannot be terraformed';
		}
		if (tile.features.xenofungus) {
			return 'Xenofungus must be removed before building this improvement';
		}
		if (tile.terraforming[e.data.type]) {
			return 'Tile already has this improvement';
		}
		for (other of tile.get_units()) {
			if (other.id != unit.id && other.terraforming != 'none') {
				return 'Another Former is already working this tile';
			}
		}
	},

	resolve: (e) => {
		// Apply after server acceptance so rejected client orders cannot advance local state.
		return {};
	},

	apply: (e) => {
		const unit = e.data.unit;
		const previous = {
			type: unit.terraforming,
			turns: unit.terraforming_turns_remaining,
			movement: unit.movement,
			moved_this_turn: unit.moved_this_turn,
		};
		const order = terraforming.get_order(e.data.type);
		unit.set_terraforming_order(e.data.type, order.turns);
		unit.movement = 0.0;
		unit.moved_this_turn = true;
		return previous;
	},

	rollback: (e) => {
		const unit = e.data.unit;
		unit.set_terraforming_order(e.applied.type, e.applied.turns);
		unit.movement = e.applied.movement;
		unit.moved_this_turn = e.applied.moved_this_turn;
	},

};
