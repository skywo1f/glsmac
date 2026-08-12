const artifact_rules = #include('../artifact_rules');
const technology_acquisition = #include('../technology_acquisition');
const snapshots = #include('../entity_snapshots');
const snapshot_unit = snapshots.snapshot_unit;

const restore_unit = (game, snapshot) => {
	return snapshots.spawn_unit_snapshot(game, snapshot);
};

return {
	validate: (e) => {
		return artifact_rules.get_study_error(e.game, e.data.unit, e.caller);
	},

	resolve: (e) => {
		return {};
	},

	apply: (e) => {
		const unit = e.data.unit;
		const base = unit.get_tile().get_base();
		const method = artifact_rules.get_study_method(base);
		const linked_state = {
			defined: base.has(artifact_rules.linked_key),
			value: base.get(artifact_rules.linked_key),
		};
		if (method == 'network_node') {
			base.set(artifact_rules.linked_key, true);
		}
		const acquired = technology_acquisition.apply(
			e.game,
			base.get_owner(),
			1
		);
		if (!#is_defined(acquired)) {
			throw Error('Alien Artifact did not discover a technology');
		}
		const backup = snapshot_unit(unit);
		e.game.um.despawn_unit(unit);
		for (name of acquired.completed_names) {
			e.game.message(
				base.get_owner().name + ' has decoded ' + name +
					' from an Alien Artifact.'
			);
		}
		return {
			base: base,
			method: method,
			linked_state: linked_state,
			research: acquired,
			unit: backup,
		};
	},

	rollback: (e) => {
		technology_acquisition.rollback(e.game, e.applied.research);
		if (e.applied.linked_state.defined) {
			e.applied.base.set(
				artifact_rules.linked_key,
				e.applied.linked_state.value
			);
		} else {
			e.applied.base.unset(artifact_rules.linked_key);
		}
		restore_unit(e.game, e.applied.unit);
	},
};
