const rules = #include('../unit_upgrade_rules');
const snapshots = #include('../entity_snapshots');

const upgraded_snapshot = (snapshot, target) => {
	const result = #clone(snapshot);
	result.def = target.id;
	result.fuel = #min(
		snapshot.fuel,
		#is_defined(target.operational_range) ? target.operational_range : 0
	);
	return result;
};

const combine = (first, second) => {
	let result = [];
	for (entry of first) { result :+entry; }
	for (entry of second) { result :+entry; }
	return result;
};

return {
	validate: (e) => {
		return rules.get_bulk_error(
			e.game,
			e.caller,
			e.data.source_def_id,
			e.data.target_def_id
		);
	},

	resolve: (e) => {
		const player = e.game.get_player(e.caller);
		const source = rules.find_definition(e.game, e.data.source_def_id);
		const target = rules.find_definition(e.game, e.data.target_def_id);
		const plan = rules.get_bulk_plan(e.game, player, source, target);
		let unit_ids = [];
		for (unit of plan.units) { unit_ids :+unit.id; }
		return {
			source_def_id: source.id,
			target_def_id: target.id,
			unit_ids: unit_ids,
			cost_per_unit: plan.cost_per_unit,
			total_cost: plan.total_cost,
		};
	},

	apply: (e) => {
		const player = e.game.get_player(e.caller);
		const source = rules.find_definition(e.game, e.resolved.source_def_id);
		const target = rules.find_definition(e.game, e.resolved.target_def_id);
		let original_units = [];
		let cargo = [];
		for (id of e.resolved.unit_ids) {
			const unit = e.game.um.get_unit(id);
			original_units :+snapshots.snapshot_unit(unit);
			if (#typeof(unit.get_cargo) == 'Callable') {
				for (passenger of unit.get_cargo()) {
					cargo :+snapshots.snapshot_unit(passenger);
				}
			}
		}
		snapshots.despawn_unit_snapshots(e.game, combine(original_units, cargo));
		let upgraded_units = [];
		for (snapshot of original_units) {
			upgraded_units :+upgraded_snapshot(snapshot, target);
		}
		snapshots.spawn_unit_snapshots(e.game, combine(upgraded_units, cargo));
		const count = #sizeof(original_units);
		const old_energy = rules.get_energy_credits(player);
		player.set_energy_credits(old_energy - e.resolved.total_cost);
		e.game.trigger('economy_updated', {player: player});
		for (snapshot of original_units) {
			e.game.trigger('unit_upgraded', {
				player: player,
				unit: e.game.um.get_unit(snapshot.id),
				previous_def_id: source.id,
				cost: e.resolved.cost_per_unit,
			});
		}
		e.game.trigger('unit_design_upgraded', {
			player: player,
			source_def_id: source.id,
			target_def_id: target.id,
			count: count,
			cost: e.resolved.total_cost,
		});
		e.game.message(
			player.name + ' upgraded ' + #to_string(count) + ' ' + source.name +
			(count == 1 ? ' unit' : ' units') + ' to ' + target.name + ' for ' +
			#to_string(e.resolved.total_cost) + ' energy credits.'
		);
		return {
			units: original_units,
			cargo: cargo,
			energy_credits: old_energy,
		};
	},

	rollback: (e) => {
		const player = e.game.get_player(e.caller);
		snapshots.despawn_unit_snapshots(
			e.game,
			combine(e.applied.units, e.applied.cargo)
		);
		snapshots.spawn_unit_snapshots(
			e.game,
			combine(e.applied.units, e.applied.cargo)
		);
		player.set_energy_credits(e.applied.energy_credits);
		e.game.trigger('economy_updated', {player: player});
		for (snapshot of e.applied.units) {
			e.game.trigger('unit_upgraded', {
				player: player,
				unit: e.game.um.get_unit(snapshot.id),
				previous_def_id: e.resolved.target_def_id,
				cost: 0 - e.resolved.cost_per_unit,
			});
		}
		e.game.trigger('unit_design_upgraded', {
			player: player,
			source_def_id: e.resolved.target_def_id,
			target_def_id: e.resolved.source_def_id,
			count: #sizeof(e.applied.units),
			cost: 0 - e.resolved.total_cost,
		});
	},
};
