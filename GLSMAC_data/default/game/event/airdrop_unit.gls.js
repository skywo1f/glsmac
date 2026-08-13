const rules = #include('../airdrop_rules');
const snapshots = #include('../entity_snapshots');
const monoliths = #include('../monoliths');

const collect_group = (unit, result) => {
	result :+unit;
	if (#typeof(unit.get_cargo) == 'Callable') {
		for (cargo of unit.get_cargo()) {
			collect_group(cargo, result);
		}
	}
};

const find_damage = (resolved, unit_id) => {
	for (entry of resolved.units) {
		if (entry.unit.id == unit_id) {
			return entry.damage;
		}
	}
	throw Error('Air-drop resolution is missing a transported unit');
};

return {
	unit_visibility: 'private',

	validate: (e) => {
		return rules.get_drop_error(e.game, e.data.unit, e.caller, e.data.destination);
	},

	resolve: (e) => {
		let group = [];
		collect_group(e.data.unit, group);
		let units = [];
		for (unit of group) {
			units :+{unit: unit, damage: rules.get_damage(unit)};
		}
		return {units: units};
	},

	apply: (e) => {
		let group = [];
		collect_group(e.data.unit, group);
		let state = [];
		for (unit of group) {
			state :+snapshots.snapshot_unit(unit);
		}

		e.data.unit.teleport_to_tile(e.data.destination);
		let destroyed = [];
		let destroyed_ids = {};
		let monolith_visits = [];
		for (let i = 0; i < #sizeof(group); i++) {
			const unit = group[i];
			const damage = find_damage(e.resolved, unit.id);
			if (#is_defined(unit.set_convoy_resource) && unit.convoy_resource != 'none') {
				unit.set_convoy_resource('none');
			}
			unit.health = #max(0.0, unit.health - damage);
			unit.moved_this_turn = true;
			unit.airdropped_this_turn = true;
			const transport_key = 'u' + #to_string(unit.transport_id);
			if (
				unit.health <= 0.0 ||
				(unit.transport_id != 0 && #is_defined(destroyed_ids[transport_key]))
			) {
				destroyed :+unit;
				destroyed_ids['u' + #to_string(unit.id)] = true;
			}
		}
		if (
			#typeof(e.data.destination.features) == 'Object' &&
			#is_defined(e.data.destination.features.monolith) &&
			e.data.destination.features.monolith
		) {
			for (unit of group) {
				if (unit.health > 0.0) {
					monolith_visits :+monoliths.apply(e.game, unit);
				}
			}
		}

		e.game.trigger('unit_airdropped', {
			player: e.game.get_player(e.caller),
			unit: e.data.unit,
			destination: e.data.destination,
		});
		e.game.message(
			e.game.get_player(e.caller).name + ' air-dropped ' +
			e.data.unit.get_def().name + ' to (' +
			#to_string(e.data.destination.x) + ', ' +
			#to_string(e.data.destination.y) + ').'
		);
		let queue_contacts = #undefined;
		if (#is_defined(e.game) && #typeof(e.game.get) == 'Callable') {
			queue_contacts = e.game.get('f_diplomacy_queue_contacts_at_tile');
		}
		if (#is_defined(queue_contacts) && e.game.get_um().has_unit(e.data.unit.id)) {
			queue_contacts(e.data.unit.get_owner(), e.data.destination);
		}
		let queue_exploration = #undefined;
		if (#is_defined(e.game) && #typeof(e.game.get) == 'Callable') {
			queue_exploration = e.game.get('f_exploration_queue_at_tile');
		}
		if (#is_defined(queue_exploration) && e.game.get_um().has_unit(e.data.unit.id)) {
			queue_exploration(e.data.unit.get_owner(), e.data.destination, e.data.unit);
		}

		if (e.game.is_master()) {
			for (let i = #sizeof(destroyed) - 1; i >= 0; i--) {
				if (e.game.get_um().has_unit(destroyed[i].id)) {
					e.game.event('despawn_unit', {unit: destroyed[i]});
				}
			}
		}
		return {units: state, monolith_visits: monolith_visits};
	},

	rollback: (e) => {
		for (let i = #sizeof(e.applied.monolith_visits) - 1; i >= 0; i--) {
			const visit = e.applied.monolith_visits[i];
			if (e.game.get_um().has_unit(visit.unit_id)) {
				monoliths.rollback(visit, e.game.get_um().get_unit(visit.unit_id));
			}
		}
		const carrier_snapshot = e.applied.units[0];
		if (e.game.get_um().has_unit(carrier_snapshot.id)) {
			const carrier = e.game.get_um().get_unit(carrier_snapshot.id);
			carrier.teleport_to_tile(
				e.game.get_tm().get_tile(carrier_snapshot.tile_x, carrier_snapshot.tile_y)
			);
		}
		for (snapshot of e.applied.units) {
			if (!e.game.get_um().has_unit(snapshot.id)) {
				continue;
			}
			const unit = e.game.get_um().get_unit(snapshot.id);
			unit.health = snapshot.health;
			unit.movement = snapshot.movement;
			unit.moved_this_turn = snapshot.moved_this_turn;
			unit.airdropped_this_turn = snapshot.airdropped_this_turn;
			if (#is_defined(unit.set_convoy_resource)) {
				unit.set_convoy_resource(snapshot.convoy_resource);
			}
		}
	},

};
