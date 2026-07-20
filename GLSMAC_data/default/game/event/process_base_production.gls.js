return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master is allowed to process base production';
		}
	},

	apply: (e) => {
		const base = e.data.base;
		const old_minerals = base.get_accumulated_minerals();
		const production = base.get_production();
		let produced_unit = #undefined;

		if (#is_defined(production)) {
			let updated_minerals = old_minerals + e.game.get('f_base_get_pending_production')(base);
			if (updated_minerals >= production.mineral_cost) {
				updated_minerals -= production.mineral_cost;
				produced_unit = e.game.um.spawn_unit({
					def: production.id,
					owner: base.get_owner(),
					tile: base.get_tile(),
					morale: 1,
					health: 1.0,
				});
			}
			base.set_accumulated_minerals(updated_minerals);
		}

		return {
			old_minerals: old_minerals,
			produced_unit: produced_unit,
		};
	},

	rollback: (e) => {
		if (#is_defined(e.applied.produced_unit)) {
			e.game.um.despawn_unit(e.applied.produced_unit);
		}
		e.data.base.set_accumulated_minerals(e.applied.old_minerals);
	},

};
