const psi_gate_rules = #include('../psi_gate_rules');

return {
	validate: (e) => {
		return psi_gate_rules.get_teleport_error(
			e.game,
			e.data.unit,
			e.caller,
			e.data.destination
		);
	},

	resolve: (e) => {
		return {};
	},

	apply: (e) => {
		const unit = e.data.unit;
		const source = unit.get_tile().get_base();
		const destination = e.data.destination;
		const result = {
			source: source,
			destination: destination,
			source_used_turn: psi_gate_rules.snapshot_used_turn(source),
			destination_used_turn: psi_gate_rules.snapshot_used_turn(destination),
			convoy_resource: #is_defined(unit.convoy_resource)
				? '' + unit.convoy_resource : 'none',
		};
		source.set(psi_gate_rules.used_turn_key, e.game.get_turn());
		destination.set(psi_gate_rules.used_turn_key, e.game.get_turn());
		if (#is_defined(unit.set_convoy_resource) && unit.convoy_resource != 'none') {
			unit.set_convoy_resource('none');
		}
		unit.teleport_to_tile(destination.get_tile());
		let queue_contacts = #undefined;
		if (#is_defined(e.game) && #typeof(e.game.get) == 'Callable') {
			queue_contacts = e.game.get('f_diplomacy_queue_contacts_at_tile');
		}
		if (#is_defined(queue_contacts)) {
			queue_contacts(unit.get_owner(), destination.get_tile());
		}
		return result;
	},

	rollback: (e) => {
		e.data.unit.teleport_to_tile(e.applied.source.get_tile());
		if (#is_defined(e.data.unit.set_convoy_resource)) {
			e.data.unit.set_convoy_resource(e.applied.convoy_resource);
		}
		psi_gate_rules.restore_used_turn(
			e.applied.source,
			e.applied.source_used_turn
		);
		psi_gate_rules.restore_used_turn(
			e.applied.destination,
			e.applied.destination_used_turn
		);
	},
};
