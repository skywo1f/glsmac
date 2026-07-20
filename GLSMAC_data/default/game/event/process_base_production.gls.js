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

		if (#is_defined(production)) {
			let updated_minerals = old_minerals + e.game.get('f_base_get_pending_production')(base);
			if (updated_minerals >= production.mineral_cost) {
				updated_minerals -= production.mineral_cost;
				const queue_size = #sizeof(base.get_production_queue());
				if (production.production_kind == 'unit') {
					produced_unit = e.game.um.spawn_unit({
						def: production.id,
						owner: base.get_owner(),
						tile: base.get_tile(),
						morale: 1,
						health: 1.0,
					});
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
		};
	},

	rollback: (e) => {
		if (#is_defined(e.applied.produced_unit)) {
			e.game.um.despawn_unit(e.applied.produced_unit);
		}
		if (#is_defined(e.applied.completed_facility)) {
			e.data.base.remove_facility(e.applied.completed_facility);
		}
		e.data.base.set_production_queue(e.applied.old_queue);
		e.data.base.set_accumulated_minerals(e.applied.old_minerals);
	},

};
