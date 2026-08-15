const rules = #include('../unit_design_rules');
const MAX_DESIGN_NAME_LENGTH = 64;

return {
	validate: (e) => {
		if (!e.game.is_started()) {
			return 'Unit designs can only be created during a game';
		}
		const player = e.game.get_player(e.caller);
		if (player == null || player.type == 'native') {
			return 'Unit designs require a playable faction';
		}
		if (e.game.is_turn_complete(player.id)) {
			return 'Player has already completed this turn';
		}
		if (#typeof(e.data.name) != 'String') {
			return 'Unit design names must contain 1 to 64 characters';
		}
		const name = #trim(e.data.name);
		if (#sizeof(name) == 0 || #sizeof(name) > MAX_DESIGN_NAME_LENGTH) {
			return 'Unit design names must contain 1 to 64 characters';
		}
		const error = rules.get_error(player, e.data.selection);
		if (#is_defined(error)) {
			return error;
		}
		const preview = rules.get_preview(e.game, player, e.data.selection);
		if (preview.exists) {
			return 'This component combination already has a faction design';
		}
	},

	resolve: (e) => {
		return rules.get_definition(
			e.game.get_player(e.caller),
			e.data.selection,
			#trim(e.data.name)
		);
	},

	apply: (e) => {
		e.game.um.define_unit(e.resolved.id, e.resolved.data);
		const player = e.game.get_player(e.caller);
		e.game.trigger('unit_design_created', {
			player: player,
			definition: e.game.um.get_unit_def(e.resolved.id),
		});
		const message = player.name + ' designed ' + e.resolved.data.name + '.';
		const scoped_message = #typeof(e.game.get) == 'Callable'
			? e.game.get('f_message_to_player') : #undefined;
		if (#typeof(scoped_message) == 'Callable') {
			scoped_message(player, message);
		} else {
			e.game.message(message);
		}
		return {id: e.resolved.id};
	},

	rollback: (e) => {
		e.game.um.undefine_unit(e.applied.id);
		e.game.trigger('unit_design_removed', {
			player: e.game.get_player(e.caller),
			id: e.applied.id,
		});
	},
};
