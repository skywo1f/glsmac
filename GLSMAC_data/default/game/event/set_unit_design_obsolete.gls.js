const rules = #include('../unit_design_rules');

const get_queue_specs = (base) => {
	let result = [];
	for (production of base.get_production_queue()) {
		result :+{
			kind: production.production_kind,
			id: production.id,
		};
	}
	return result;
};

const set_obsolete = (player, id, obsolete) => {
	let designs = [];
	for (candidate of player.get_obsolete_unit_designs()) {
		if (candidate != id) {
			designs :+candidate;
		}
	}
	if (obsolete) {
		designs :+id;
	}
	player.set_obsolete_unit_designs(designs);
};

return {
	validate: (e) => {
		if (!e.game.is_started()) {
			return 'Unit designs can only be managed during a game';
		}
		const player = e.game.get_player(e.caller);
		if (player == null || player.type == 'native') {
			return 'Unit designs require a playable faction';
		}
		if (e.game.is_turn_complete(player.id)) {
			return 'Player has already completed this turn';
		}
		if (#typeof(e.data.id) != 'String' || #typeof(e.data.obsolete) != 'Bool') {
			return 'Unit design ID and obsolete state are required';
		}
		const definition = rules.find_definition(e.game, e.data.id);
		if (definition == null) {
			return 'Unit design does not exist';
		}
		if (definition.owner_player_id != player.id) {
			return 'Only faction-owned Workshop designs can be made obsolete';
		}
		if (!definition.buildable || definition.is_native) {
			return 'This unit design cannot be managed by the Workshop';
		}
	},

	apply: (e) => {
		const player = e.game.get_player(e.caller);
		const previous = player.is_unit_design_obsolete(e.data.id);
		if (previous == e.data.obsolete) {
			return {changed: false, previous: previous, queues: []};
		}
		set_obsolete(player, e.data.id, e.data.obsolete);
		let queues = [];
		if (e.data.obsolete) {
			for (base of e.game.get_bm().get_bases()) {
				if (base.get_owner().id != player.id) {
					continue;
				}
				const old_queue = get_queue_specs(base);
				let next_queue = [];
				let removed = false;
				for (production of old_queue) {
					if (production.kind == 'unit' && production.id == e.data.id) {
						removed = true;
					} else {
						next_queue :+production;
					}
				}
				if (removed) {
					queues :+{base: base, queue: old_queue};
					base.set_production_queue(next_queue);
				}
			}
		}
		e.game.trigger('unit_design_obsolescence_changed', {
			player: player,
			id: e.data.id,
			obsolete: e.data.obsolete,
		});
		return {changed: true, previous: previous, queues: queues};
	},

	rollback: (e) => {
		if (!e.applied.changed) {
			return;
		}
		const player = e.game.get_player(e.caller);
		set_obsolete(player, e.data.id, e.applied.previous);
		for (snapshot of e.applied.queues) {
			snapshot.base.set_production_queue(snapshot.queue);
		}
		e.game.trigger('unit_design_obsolescence_changed', {
			player: player,
			id: e.data.id,
			obsolete: e.applied.previous,
		});
	},
};
