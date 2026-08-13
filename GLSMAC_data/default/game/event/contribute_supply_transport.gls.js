const supply_rules = #include('../supply_rules');
const snapshots = #include('../entity_snapshots');

return {
	unit_visibility: 'private',
	validate: (e) => {
		return supply_rules.get_contribution_error(e.game, e.data.unit, e.caller);
	},

	resolve: (e) => {
		return {minerals: e.data.unit.get_def().mineral_cost + 0};
	},

	apply: (e) => {
		const unit = e.data.unit;
		const base = unit.get_tile().get_base();
		const target = supply_rules.get_contribution_target(unit);
		if (target == null) {
			throw Error('Supply Transport has no valid production target');
		}
		const old_minerals = base.get_accumulated_minerals();
		const backup = snapshots.snapshot_unit(unit);
		const unit_name = unit.get_def().name;
		base.set_accumulated_minerals(old_minerals + e.resolved.minerals);
		e.game.um.despawn_unit(unit);
		e.game.message(
			base.get_owner().name + ' has disbanded ' + unit_name +
			' for ' + #to_string(e.resolved.minerals) + ' minerals toward ' +
			target.production.name + '.'
		);
		return {
			base: base,
			old_minerals: old_minerals,
			target_kind: target.kind,
			unit: backup,
		};
	},

	rollback: (e) => {
		e.applied.base.set_accumulated_minerals(e.applied.old_minerals);
		snapshots.spawn_unit_snapshot(e.game, e.applied.unit);
	},
};
