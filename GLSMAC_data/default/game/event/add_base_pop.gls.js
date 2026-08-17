return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master is allowed to add base pop';
		}
	},

	apply: (e) => {

		const base = e.data.base;
		let pop_type = e.data.type;
		let worked_tile = #is_defined(e.data.worked_tile)
			? e.data.worked_tile
			: #undefined;
		const requested_worked_tile = #is_defined(worked_tile);
		if (
			requested_worked_tile &&
			(worked_tile.get_base() != null || worked_tile.has('working_pop'))
		) {
			const select_tiles = e.game.get('f_base_find_best_or_worst_tiles');
			const replacements = #typeof(select_tiles) == 'Callable'
				? select_tiles(
					base,
					base.get_unworked_tiles(),
					1,
					1,
					base.get_size() + 1,
					true,
					{}
				)
				: [];
			worked_tile = #sizeof(replacements) > 0
				? replacements[0]
				: #undefined;
		}
		if (requested_worked_tile && !#is_defined(worked_tile) && pop_type == 'WORKER') {
			const get_default_specialist = e.game.get('f_base_get_default_specialist');
			if (#typeof(get_default_specialist) == 'Callable') {
				const specialist = get_default_specialist(base.get_owner());
				if (specialist != null) {
					pop_type = specialist.id;
				}
			}
		}

		// reset nutrients
		const old_nutrients = base.get('accumulated_nutrients');
		e.game.get('f_base_reset_nutrients')(e.game, base);

		// spawn population
		const pop = base.create_pop({
			type: pop_type,
		});

		if (#is_defined(worked_tile)) {
			e.game.get('f_base_pop_work_tile')(base, pop, worked_tile);
		}
		const refresh_snapshot = e.game.get('f_base_refresh_turn_resource_snapshot');
		if (#is_defined(refresh_snapshot)) {
			refresh_snapshot(base);
		}

		return {
			base: base,
			pop: pop,
			old_nutrients: old_nutrients,
			worked_tile: worked_tile,
		};
	},

	rollback: (e) => {
		if (#is_defined(e.applied.worked_tile)) {
			e.game.get('f_base_pop_unwork_tile')(e.applied.base, e.applied.pop);
		}
		e.applied.base.destroy_pop(e.applied.pop);
		e.applied.base.set('accumulated_nutrients', e.applied.old_nutrients);
		const refresh_snapshot = e.game.get('f_base_refresh_turn_resource_snapshot');
		if (#is_defined(refresh_snapshot)) {
			refresh_snapshot(e.applied.base);
		}
	},

};
