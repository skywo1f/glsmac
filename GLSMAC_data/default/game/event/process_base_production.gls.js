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

return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master is allowed to process base production';
		}
	},

	apply: (e) => {
		const base = e.data.base;
		const old_minerals = base.get_accumulated_minerals();
		const old_queue = get_queue_specs(base);
		const production = base.get_production();
		let produced_unit = #undefined;
		let completed_facility = #undefined;
		let consumed_pops = [];

		if (#is_defined(production)) {
			let updated_minerals = old_minerals + e.game.get('f_base_get_pending_production')(base);
			const population_cost = (
				production.production_kind == 'unit' &&
				#is_defined(production.can_found_base) &&
				production.can_found_base
			) ? 1 : 0;
			const has_population = population_cost == 0 || base.get_size() > population_cost;
			if (updated_minerals >= production.mineral_cost && has_population) {
				updated_minerals -= production.mineral_cost;
				const queue_size = #sizeof(base.get_production_queue());
				if (production.production_kind == 'unit') {
					produced_unit = e.game.um.spawn_unit({
						def: production.id,
						owner: base.get_owner(),
						tile: base.get_tile(),
						morale: 1,
						health: 1.0,
						home_base_id: base.id,
					});
					for (let i = 0; i < population_cost; i++) {
						const pop = e.game.get('f_base_select_population_for_reduction')(base);
						if (pop == null) {
							throw Error('Could not select population for unit production');
						}
						const worked_tile = pop.get('worked_tile');
						consumed_pops :+{
							type: pop.get_type(),
							worked_tile: worked_tile,
						};
						if (#is_defined(worked_tile)) {
							base.unwork_pop_tile(pop, worked_tile);
						}
						base.destroy_pop(pop);
					}
					if (queue_size > 1) {
						base.remove_production(0);
					}
				} else if (production.production_kind == 'facility') {
					base.remove_production(0);
					base.add_facility(production.id);
					completed_facility = production.id;
				} else {
					throw Error('Unknown production kind: ' + production.production_kind);
				}
			}
			base.set_accumulated_minerals(updated_minerals);
		}

		return {
			old_minerals: old_minerals,
			old_queue: old_queue,
			produced_unit: produced_unit,
			completed_facility: completed_facility,
			consumed_pops: consumed_pops,
		};
	},

	rollback: (e) => {
		if (#is_defined(e.applied.produced_unit)) {
			e.game.um.despawn_unit(e.applied.produced_unit);
		}
		if (#is_defined(e.applied.completed_facility)) {
			e.data.base.remove_facility(e.applied.completed_facility);
		}
		for (snapshot of e.applied.consumed_pops) {
			const pop = e.data.base.create_pop({type: snapshot.type});
			if (#is_defined(snapshot.worked_tile)) {
				e.data.base.work_pop_tile(pop, snapshot.worked_tile);
			}
		}
		e.data.base.set_production_queue(e.applied.old_queue);
		e.data.base.set_accumulated_minerals(e.applied.old_minerals);
	},

};
