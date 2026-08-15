const terraforming = #include('../../units/terraforming');

return {
	unit_visibility: 'private',

	validate: (e) => {
		const unit = e.data.unit;
		if (unit.owner != e.caller) {
			return 'A Former can only be ordered by its owner';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (unit.health <= 0.0) {
			return 'Dead unit cannot cancel terraforming';
		}
		if (unit.terraforming == 'none') {
			return 'Former has no terraforming order to cancel';
		}
	},

	resolve: (e) => {
		return {};
	},

	apply: (e) => {
		const unit = e.data.unit;
		const previous = {
			type: '' + unit.terraforming,
			turns: unit.terraforming_turns_remaining + 0,
			movement: unit.movement + 0.0,
			moved_this_turn: unit.moved_this_turn == true,
		};
		const get_effects = #is_defined(e.game.get)
			? e.game.get('f_project_get_player_effects')
			: #undefined;
		const effects = #is_defined(get_effects)
			? get_effects(unit.get_owner())
			: {
				terraforming_rate_multiplier: 1.0,
				fungus_terraforming_rate_multiplier: 1.0,
			};
		let helper_states = [];
		let helper_contribution = 0;
		for (helper of unit.get_tile().get_units()) {
			if (
				helper.id != unit.id && helper.owner == unit.owner &&
				helper.terraforming == unit.terraforming
			) {
				helper_states :+{
					id: helper.id + 0,
					type: '' + helper.terraforming,
					turns: helper.terraforming_turns_remaining + 0,
				};
				helper_contribution += terraforming.get_contribution(
					helper,
					unit.terraforming,
					effects
				);
			}
		}
		if (#sizeof(helper_states) > 0) {
			const total_contribution = helper_contribution + terraforming.get_contribution(
				unit,
				unit.terraforming,
				effects
			);
			const turns = #max(1, #ceil(
				#to_float(unit.terraforming_turns_remaining * total_contribution) /
				#to_float(helper_contribution)
			));
			previous.helpers = helper_states;
			const um = e.game.get_um();
			for (state of helper_states) {
				um.get_unit(state.id).set_terraforming_order(unit.terraforming, turns);
			}
		}
		unit.set_terraforming_order('none', 0);
		unit.movement = 0.0;
		unit.moved_this_turn = true;
		return previous;
	},

	rollback: (e) => {
		const unit = e.data.unit;
		unit.set_terraforming_order(e.applied.type, e.applied.turns);
		unit.movement = e.applied.movement;
		unit.moved_this_turn = e.applied.moved_this_turn;
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
