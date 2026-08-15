return {

	validate: (e) => {
		if (e.caller != e.data.base.get_owner().id) {
			return 'Only base owner can control base pops';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (e.data.pop.get_base() != e.data.base) {
			return 'Population does not belong to this base';
		}
		if (e.data.pop.has('worked_tile')) {
			return 'Tile workers cannot become specialists';
		}
		if (#typeof(e.data.type) != 'String' || e.data.type == '') {
			return 'Specialist type must be a non-empty string';
		}
		const resolver = e.game.get('f_base_get_available_specialists');
		if (#typeof(resolver) != 'Callable') {
			return 'Specialist catalog is unavailable';
		}
		for (specialist of resolver(e.data.base.get_owner())) {
			if (specialist.id == e.data.type) {
				return;
			}
		}
		return 'Specialist type is unavailable';
	},

	apply: (e) => {
		let pop_type_snapshots = [];
		for (pop of e.data.base.get_pops()) {
			pop_type_snapshots :+{pop: pop, type: pop.get_type()};
		}
		e.data.pop.set_type(e.data.type);
		const psych = e.game.get('f_economy_get_base_psych')(e.game, e.data.base);
		e.game.get('f_base_process_psych')(e.game, e.data.base, psych);
		return {pop_type_snapshots: pop_type_snapshots};
	},

	rollback: (e) => {
		for (snapshot of e.applied.pop_type_snapshots) {
			snapshot.pop.set_type(snapshot.type);
		}
	},

};
