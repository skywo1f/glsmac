const MAX_SEA_LEVEL_CHANGE = 1000;

return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only the host can announce a sea-level change';
		}
		if (
			#typeof(e.data.amount) != 'Int' || e.data.amount == 0 ||
			e.data.amount < 0 - MAX_SEA_LEVEL_CHANGE ||
			e.data.amount > MAX_SEA_LEVEL_CHANGE ||
			#typeof(e.data.level) != 'Int' ||
			e.data.level < -3500 || e.data.level > 3500
		) {
			return 'Sea-level announcement is invalid';
		}
		if (e.game.tm.get_sea_level() != e.data.level) {
			return 'Sea-level announcement arrived before the terrain update';
		}
	},

	apply: (e) => {
		const direction = e.data.amount > 0 ? 'rose' : 'fell';
		e.game.message(
			'Sea levels ' + direction + ' by ' + #to_string(#abs(e.data.amount)) + ' metres.'
		);
		e.game.trigger('sea_level_changed', {
			amount: e.data.amount,
			level: e.data.level,
		});
	},

	rollback: (e) => {},

};
