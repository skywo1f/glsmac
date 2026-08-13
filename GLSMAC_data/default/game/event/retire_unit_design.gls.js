const rules = #include('../unit_design_rules');

const set_retired = (player, id, retired) => {
	let designs = [];
	for (candidate of player.get_retired_unit_designs()) {
		if (candidate != id) {
			designs :+candidate;
		}
	}
	if (retired) {
		designs :+id;
	}
	player.set_retired_unit_designs(designs);
};

return {
	player_visibility: 'private',
	validate: (e) => {
		if (!e.game.is_started()) {
			return 'Unit designs can only be retired during a game';
		}
		const player = e.game.get_player(e.caller);
		if (player == null || player.type == 'native') {
			return 'Unit designs require a playable faction';
		}
		if (e.game.is_turn_complete(player.id)) {
			return 'Player has already completed this turn';
		}
		if (#typeof(e.data.id) != 'String') {
			return 'Unit design ID is required';
		}
		const definition = rules.find_definition(e.game, e.data.id);
		if (definition == null) {
			return 'Unit design does not exist';
		}
		if (definition.owner_player_id != player.id) {
			return 'Only faction-owned Workshop designs can be retired';
		}
		if (!definition.buildable || definition.is_native) {
			return 'This unit design cannot be retired by the Workshop';
		}
		if (player.is_unit_design_retired(e.data.id)) {
			return 'Unit design has already been permanently retired';
		}
		if (!player.is_unit_design_obsolete(e.data.id)) {
			return 'Unit design must be made obsolete before permanent retirement';
		}
	},

	apply: (e) => {
		const player = e.game.get_player(e.caller);
		set_retired(player, e.data.id, true);
		e.game.trigger('unit_design_retirement_changed', {
			player: player,
			id: e.data.id,
			retired: true,
		});
		const definition = rules.find_definition(e.game, e.data.id);
		e.game.message(player.name + ' permanently retired ' + definition.name + '.');
		return {retired: true};
	},

	rollback: (e) => {
		const player = e.game.get_player(e.caller);
		set_retired(player, e.data.id, false);
		e.game.trigger('unit_design_retirement_changed', {
			player: player,
			id: e.data.id,
			retired: false,
		});
	},
};
