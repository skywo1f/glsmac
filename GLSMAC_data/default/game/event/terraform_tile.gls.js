const terraforming = #include('../../units/terraforming');
const movement_rules = #include('../movement_rules');

return {
	unit_visibility: 'private',

	validate: (e) => {
		const unit = e.data.unit;
		if (#typeof(e.data.type) != 'String') {
			return 'Terraforming order must be identified by name';
		}
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
		const def = unit.get_def();
		if (!def.can_terraform) {
			return 'Only Formers can terraform terrain';
		}
		if (unit.transport_id != 0) {
			return 'An embarked Former cannot terraform terrain';
		}
		if (unit.terraforming != 'none') {
			return 'Former already has a terraforming order';
		}
		if (unit.movement <= 0.0) {
			return 'Former is out of moves';
		}

		const tile = unit.get_tile();
		if (tile.is_water && !def.is_water) {
			return 'Land Formers cannot terraform sea squares';
		}
		if (!tile.is_water && def.is_water) {
			return 'Sea Formers cannot terraform land squares';
		}
		if (tile.is_locked()) {
			return 'Terraforming site is locked';
		}
		const get_effects = #is_defined(e.game.get)
			? e.game.get('f_project_get_player_effects')
			: #undefined;
		const effects = #is_defined(get_effects)
			? get_effects(unit.get_owner())
			: {advanced_terraforming: false};
		const unavailable = terraforming.get_unavailable_reason(
			tile,
			unit.get_owner(),
			e.data.type,
			effects
		);
		if (unavailable != null) {
			return unavailable;
		}
		if (
			terraforming.is_elevation_order(e.data.type) &&
			!terraforming.has_order_helper(tile, unit, e.data.type)
		) {
			const owner = unit.get_owner();
			const cost = terraforming.get_elevation_change_cost(e.game, tile, owner);
			if (owner.energy_credits < cost) {
				return terraforming.get_order_name(e.data.type, tile.is_water) + ' costs ' +
					#to_string(cost) + ' energy credits; only ' +
					#to_string(owner.energy_credits) + ' are available';
			}
		}
		for (other of tile.get_units()) {
			if (other.id != unit.id && other.terraforming != 'none') {
				if (other.owner != unit.owner || other.terraforming != e.data.type) {
					return 'Another Former is already performing a different order on this tile';
				}
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
			type: '' + unit.terraforming,
			turns: unit.terraforming_turns_remaining + 0,
			movement: unit.movement + 0.0,
			moved_this_turn: unit.moved_this_turn == true,
			move_target: movement_rules.get_move_target_snapshot(unit),
		};
		movement_rules.clear_move_target(unit);
		const get_effects = #is_defined(e.game.get)
			? e.game.get('f_project_get_player_effects')
			: #undefined;
		const effects = #is_defined(get_effects)
			? get_effects(unit.get_owner())
			: {
				terraforming_rate_multiplier: 1.0,
				fungus_terraforming_rate_multiplier: 1.0,
			};
		const turns = terraforming.get_joined_completion_turns(
			unit.get_tile(),
			unit,
			e.data.type,
			effects
		);
		let helper_states = [];
		for (helper of unit.get_tile().get_units()) {
			if (
				helper.id != unit.id && helper.owner == unit.owner &&
				helper.terraforming == e.data.type
			) {
				helper_states :+{
					id: helper.id + 0,
					type: '' + helper.terraforming,
					turns: helper.terraforming_turns_remaining + 0,
				};
			}
		}
		if (#sizeof(helper_states) > 0) {
			previous.helpers = helper_states;
			const um = e.game.get_um();
			for (state of helper_states) {
				um.get_unit(state.id).set_terraforming_order(e.data.type, turns);
			}
		}
		if (terraforming.is_elevation_order(e.data.type) && #sizeof(helper_states) == 0) {
			const owner = unit.get_owner();
			const cost = terraforming.get_elevation_change_cost(
				e.game,
				unit.get_tile(),
				owner
			);
			previous.energy_credits = owner.energy_credits + 0;
			owner.set_energy_credits(owner.energy_credits - cost);
		}
		unit.set_terraforming_order(e.data.type, turns);
		unit.movement = 0.0;
		unit.moved_this_turn = true;
		return previous;
	},

	rollback: (e) => {
		const unit = e.data.unit;
		unit.set_terraforming_order(e.applied.type, e.applied.turns);
		unit.movement = e.applied.movement;
		unit.moved_this_turn = e.applied.moved_this_turn;
		movement_rules.restore_move_target(unit, e.game, e.applied.move_target);
		if (#is_defined(e.applied.energy_credits)) {
			unit.get_owner().set_energy_credits(e.applied.energy_credits);
		}
		if (#is_defined(e.applied.helpers)) {
			const um = e.game.get_um();
			for (state of e.applied.helpers) {
				if (um.has_unit(state.id)) {
					um.get_unit(state.id).set_terraforming_order(state.type, state.turns);
				}
			}
		}
	},

};
