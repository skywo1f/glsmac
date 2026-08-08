const pops = #include('pops');

const globals = {};
const CONTENT_CITIZENS = 3;
const PSYCH_PER_IMPROVEMENT = 2;
const DOCTOR_PSYCH = 2;
const FREE_SUPPORTED_UNITS_PER_POP = 1;

const is_rioting = (base) => {
	let talents = 0;
	let drones = 0;
	for (pop of base.get_pops()) {
		const type = pop.get_type();
		if (type == 'TALENT') {
			talents++;
		} else if (type == 'DRONE') {
			drones++;
		} else if (type == 'DRONEPLUS') {
			drones += 2;
		}
	}
	return drones > talents;
};

const get_psych_state = (game, base) => {
	let result = {
		talents: 0,
		drones: 0,
		workers: 0,
		specialists: 0,
		psych: game.get('f_economy_get_base_psych')(game, base),
		is_rioting: false,
	};
	for (pop of base.get_pops()) {
		const type = pop.get_type();
		if (type == 'TALENT') {
			result.talents = result.talents + 1;
		} else if (type == 'DRONE') {
			result.drones = result.drones + 1;
		} else if (type == 'DRONEPLUS') {
			result.drones = result.drones + 2;
		} else if (pop.has('worked_tile')) {
			result.workers = result.workers + 1;
		} else {
			result.specialists = result.specialists + 1;
		}
	}
	result.is_rioting = is_rioting(base);
	return result;
};

const process_psych = (game, base, allocated_psych) => {
	let laborer_count = 0;
	let psych = allocated_psych;
	for (pop of base.get_pops()) {
		if (pop.has('worked_tile')) {
			const type = laborer_count < CONTENT_CITIZENS ? 'WORKER' : 'DRONE';
			pop.set_type(type);
			laborer_count++;
		} else if (pop.get_type() == 'DOCTOR') {
			psych += DOCTOR_PSYCH;
		}
	}
	for (pop of base.get_pops()) {
		if (psych < PSYCH_PER_IMPROVEMENT) {
			break;
		}
		if (pop.has('worked_tile') && pop.get_type() == 'DRONE') {
			pop.set_type('WORKER');
			psych -= PSYCH_PER_IMPROVEMENT;
		}
	}
	for (pop of base.get_pops()) {
		if (psych < PSYCH_PER_IMPROVEMENT) {
			break;
		}
		if (pop.has('worked_tile') && pop.get_type() == 'WORKER') {
			pop.set_type('TALENT');
			psych -= PSYCH_PER_IMPROVEMENT;
		}
	}
};

const get_nutrients_for_growth = (game, base) => {
	return globals.map_growth_base * (base.get_size() + 1);
};

const get_pending_growth = (base) => {
	const intake = base.get_intake();
	const consumption = base.get_consumption();
	return intake.NUTRIENTS - consumption.NUTRIENTS;
};

const reset_nutrients = (game, base) => {
	const nfg = get_nutrients_for_growth(game, base);
	let accumulated = base.get('accumulated_nutrients');
	if (!#is_defined(accumulated)) {
		accumulated = 0;
	}
	let updated = accumulated - nfg;
	if (updated < 0) {
		updated = 0;
	}
	base.set('accumulated_nutrients', updated);
};

const get_tile_score = (base, tile, projected_size) => {
	const resources = tile.get_resources(base.get_owner());
	let score = resources.NUTRIENTS * 3 + resources.MINERALS * 2 + resources.ENERGY;
	if (#is_defined(projected_size)) {
		const is_growth = projected_size > base.get_size();
		const nutrient_change = is_growth ? resources.NUTRIENTS : 0 - resources.NUTRIENTS;
		const projected_nutrients = base.get_intake().NUTRIENTS + nutrient_change;
		const nutrient_deficit = #max(projected_size * 2 - projected_nutrients, 0);
		// Avoid starvation first, then gain or preserve the highest-value tile.
		score = (0 - nutrient_deficit * 1000) + (is_growth ? score : 0 - score);
	}
	return score;
};

const find_best_or_worst_tiles = (base, tiles, count, modifier, projected_size, require_available, excluded_keys) => { // modifier 1 to find best tiles, -1 to find worst tiles
	let keys = {};
	let result = [];
	for (let i = 0; i < count; i++) {
		if (i >= #sizeof(tiles)) {
			break;
		}
		let best = null;
		for (tile of tiles) {
			const key = #to_string(tile.x) + '_' + #to_string(tile.y);
			if (
				(#is_defined(excluded_keys) && #is_defined(excluded_keys[key])) ||
				(
					#is_defined(require_available) &&
					require_available &&
					(tile.get_base() != null || tile.has('working_pop'))
				)
			) {
				continue;
			}
			if (#is_defined(keys[key])) {
				continue;
			}
			const score = get_tile_score(base, tile, projected_size) * modifier;
			if (best == null || score > best.score) {
				best = {
					tile: tile,
					key: key,
					score: score,
				};
			}
		}
		if (best != null) {
			keys[best.key] = true;
			const selected_tile = best.tile;
			result :+selected_tile;
		} else {
			break;
		}
	}
	return result;
};

const get_assignable_worker_tiles = (base) => {
	const pops = base.get_pops();
	let result = [];
	for (tile of base.get_workable_tiles()) {
		if (tile.get_base() != null) {
			continue;
		}
		if (tile.has('working_pop')) {
			const working_pop = tile.get('working_pop');
			let belongs_to_base = false;
			for (pop of pops) {
				if (pop == working_pop) {
					belongs_to_base = true;
					break;
				}
			}
			if (!belongs_to_base) {
				continue;
			}
		}
		result :+tile;
	}
	return result;
};

const select_worker_tiles = (base, candidates, count) => {
	let selected = [];
	let selected_keys = {};
	let fixed_nutrients = base.get_intake().NUTRIENTS;
	let worked_tile = null;
	for (worked_tile of base.get_worked_tiles()) {
		fixed_nutrients -= worked_tile.get_resources(base.get_owner()).NUTRIENTS;
	}
	let selected_nutrients = fixed_nutrients;
	const required_nutrients = base.get_consumption().NUTRIENTS;
	for (let i = 0; i < count; i++) {
		let best = null;
		let candidate_tile = null;
		for (candidate_tile of candidates) {
			const key = #to_string(candidate_tile.x) + '_' + #to_string(candidate_tile.y);
			if (#is_defined(selected_keys[key])) {
				continue;
			}
			const resources = candidate_tile.get_resources(base.get_owner());
			const needed = #max(required_nutrients - selected_nutrients, 0);
			const food = #min(resources.NUTRIENTS, needed);
			const score = food * 1000 + get_tile_score(base, candidate_tile);
			if (
				best == null ||
				score > best.score ||
				(score == best.score && (candidate_tile.y < best.tile.y || (candidate_tile.y == best.tile.y && candidate_tile.x < best.tile.x)))
			) {
				best = {tile: candidate_tile, key: key, score: score, nutrients: resources.NUTRIENTS};
			}
		}
		if (best == null) {
			break;
		}
		const selected_tile = best.tile;
		selected :+selected_tile;
		selected_keys[best.key] = true;
		selected_nutrients += best.nutrients;
	}
	return selected;
};

const get_stable_worker_count = (base, allocated_psych) => {
	const population = #sizeof(base.get_pops());
	let result = 0;
	for (let workers = population; workers >= 0; workers--) {
		const doctors = population - workers;
		let improvements = #floor(
			#to_float(allocated_psych + doctors * DOCTOR_PSYCH) /
			#to_float(PSYCH_PER_IMPROVEMENT)
		);
		let drones = #max(workers - CONTENT_CITIZENS, 0);
		const pacified = #min(drones, improvements);
		drones -= pacified;
		improvements -= pacified;
		const talents = #min(workers - drones, improvements);
		if (drones <= talents) {
			result = workers;
			break;
		}
	}
	return result;
};

const rebalance_workers = (base, target_worker_count) => {
	let workers = [];
	let population = [];
	let candidates = [];
	let candidate_keys = {};
	const add_candidate = (candidate_tile) => {
		const key = #to_string(candidate_tile.x) + '_' + #to_string(candidate_tile.y);
		if (!#is_defined(candidate_keys[key])) {
			candidate_keys[key] = true;
			candidates :+candidate_tile;
		}
	};
	let base_pop = null;
	for (base_pop of base.get_pops()) {
		population :+base_pop;
		if (base_pop.has('worked_tile')) {
			workers :+base_pop;
		}
	}
	let desired_workers = #sizeof(workers);
	if (#is_defined(target_worker_count)) {
		desired_workers = #max(0, #min(target_worker_count, #sizeof(population)));
	}
	let worked_tile = null;
	for (worked_tile of base.get_worked_tiles()) {
		add_candidate(worked_tile);
	}
	let available_tile = null;
	for (available_tile of base.get_unworked_tiles()) {
		if (available_tile.get_base() == null && !available_tile.has('working_pop')) {
			add_candidate(available_tile);
		}
	}
	const selected = select_worker_tiles(base, candidates, desired_workers);
	let selected_keys = {};
	let selected_tile = null;
	for (selected_tile of selected) {
		const key = #to_string(selected_tile.x) + '_' + #to_string(selected_tile.y);
		selected_keys[key] = true;
	}
	let displaced = [];
	let specialists = [];
	for (base_pop of population) {
		if (base_pop.has('worked_tile')) {
			const worker_tile = base_pop.get('worked_tile');
			const key = #to_string(worker_tile.x) + '_' + #to_string(worker_tile.y);
			if (!#is_defined(selected_keys[key])) {
				displaced :+base_pop;
			}
		} else {
			specialists :+base_pop;
		}
	}
	let new_tiles = [];
	for (selected_tile of selected) {
		if (!base.is_tile_worked(selected_tile)) {
			new_tiles :+selected_tile;
		}
	}
	let tile_index = 0;
	for (base_pop of displaced) {
		if (tile_index < #sizeof(new_tiles)) {
			pop_work_tile(base, base_pop, new_tiles[tile_index]);
			tile_index++;
		} else {
			pop_unwork(base, base_pop, 'DOCTOR');
		}
	}
	for (base_pop of specialists) {
		if (tile_index < #sizeof(new_tiles)) {
			pop_work_tile(base, base_pop, new_tiles[tile_index]);
			tile_index++;
		} else {
			base_pop.set_type('DOCTOR');
		}
	}
};

const select_population_for_reduction = (base) => {
	for (pop of base.get_pops()) {
		if (!pop.has('worked_tile')) {
			return pop;
		}
	}
	const worst_tiles = find_best_or_worst_tiles(
		base,
		base.get_worked_tiles(),
		1,
		1,
		base.get_size() - 1
	);
	if (#sizeof(worst_tiles) == 0) {
		return null;
	}
	const pop = worst_tiles[0].get('working_pop');
	return #is_defined(pop) ? pop : null;
};

const rebalance_ai_workers = (base, allocated_psych) => {
	if (base.get_owner().type == 'ai') {
		rebalance_workers(base, get_stable_worker_count(base, allocated_psych));
	}
};

const process_growth = (game, base, allocated_psych) => {
	rebalance_ai_workers(base, allocated_psych);
	let grow = false;

	let accumulated = base.get('accumulated_nutrients');
	if (!#is_defined(accumulated)) {
		accumulated = 0;
	}
	accumulated += get_pending_growth(base);
	if (accumulated < 0) {
		if (base.get_size() <= 1) {
			base.set('accumulated_nutrients', 0);
			return;
		}
		if (!game.is_master()) {
			return;
		}
		const pop = select_population_for_reduction(base);
		if (pop == null) {
			throw Error('Could not select population for starvation');
		}
		game.event('remove_base_pop', {
			base: base,
			pop: pop,
		});
		return;
	}
	base.set('accumulated_nutrients', accumulated);
	if (base.get_size() == 0) {
		grow = true; // always grow new bases to 1
	}

	if (!grow) {
		if (accumulated >= get_nutrients_for_growth(game, base)) {
			grow = true; // growth from nutrients
		}
	}

	if (grow) {
		if (!game.is_master()) {
			return;
		}
		if (!#is_defined(globals.reserved_growth_tiles)) {
			globals.reserved_growth_tiles = {};
		}
		const best_tile = (find_best_or_worst_tiles(
			base,
			base.get_unworked_tiles(),
			1,
			1,
			base.get_size() + 1,
			true,
			globals.reserved_growth_tiles
		))[0];
		if (best_tile != null) {
			globals.reserved_growth_tiles[#to_string(best_tile.x) + '_' + #to_string(best_tile.y)] = true;
			// found tile to work, spawn worker
			game.event('add_base_pop', {
				base: base,
				type: 'WORKER',
				worked_tile: best_tile,
			});
		} else {
			// all tiles already worked, spawn doctor
			game.event('add_base_pop', {
				base: base,
				type: 'DOCTOR',
			});
		}
	}
};

const calculate_growth_base = (game) => {
	const tm = game.get_tm();
	let w = tm.get_map_width();
	let h = tm.get_map_height();

	let map_size = w * h;

	// rough approximations similar to SMAC's standard/small/tiny logic but using GLSMAC wider map ratio
	// used for base growth calculations
	let map_growth_base = 0;
	if (map_size > 5500) {
		map_growth_base = 15; // standard map
	} else if (map_size > 4000) {
		map_growth_base = 14; // between standard and small map, SMAC skips it but makes sense imo
	} else if (map_size > 3000) {
		map_growth_base = 13; // small map
	} else if (map_size > 1800) {
		map_growth_base = 12; // tiny map
	} else if (map_size > 1000) {
		map_growth_base = 11; // below tiny (SMAC doesn't have it but let's do)
	} else {
		map_growth_base = 10; // below tiny (SMAC doesn't have it but let's do)
	}
	globals.map_growth_base = map_growth_base;
	game.set('map_growth_base', map_growth_base);
};

const pop_work_tile = (base, pop, tile) => {
	pop_unwork(base, pop);
	pop.set_type('WORKER');
	base.work_pop_tile(pop, tile);
};

const get_pending_production = (game, base) => {
	if (is_rioting(base)) {
		return 0;
	}
	const intake = base.get_intake();
	const consumption = base.get_consumption();
	return #max(intake.MINERALS - consumption.MINERALS, 0);
};

const pop_unwork = (base, pop, new_type) => {
	const tile = pop.get('worked_tile');
	if (#is_defined(tile)) {
		base.unwork_pop_tile(pop, tile);
		if (#is_defined(new_type)) {
			pop.set_type(new_type);
		}
	}
};

return (game) => {

	const bm = game.get_bm();

	bm.on('get_base_intake', (e) => {
		let result = {
			NUTRIENTS: 0,
			MINERALS: 0,
			ENERGY: 0,
		};

		const f_add_tile = (tile) => {
			const r = tile.get_resources(e.base.get_owner());
			result.NUTRIENTS = result.NUTRIENTS + r.NUTRIENTS;
			result.MINERALS = result.MINERALS + r.MINERALS;
			result.ENERGY = result.ENERGY + r.ENERGY;
		};

		f_add_tile(e.base.get_tile());
		for (tile of e.base.get_worked_tiles()) {
			f_add_tile(tile);
		}
		for (facility of e.base.get_facilities()) {
			result.NUTRIENTS = result.NUTRIENTS + facility.nutrient_bonus;
			result.MINERALS = result.MINERALS + facility.mineral_bonus;
			result.ENERGY = result.ENERGY + facility.energy_bonus;
		}
		let mineral_multiplier = 0.0;
		for (facility of e.base.get_facilities()) {
			mineral_multiplier += #is_defined(facility.mineral_multiplier)
				? facility.mineral_multiplier
				: 0.0;
		}
		result.MINERALS = result.MINERALS + #ceil(
			#to_float(result.MINERALS) * mineral_multiplier
		);

		return result;
	});

	bm.on('get_base_consumption', (e) => {
		let result = {
			NUTRIENTS: e.base.get_size() * 2, // 2 nutrients per pop
			MINERALS: 0,
			ENERGY: 0,
		};

		let supported_units = 0;
		for (unit of game.get_um().get_units()) {
			if (unit.owner == e.base.get_owner().id && unit.home_base_id == e.base.id) {
				supported_units++;
			}
		}
		const free_support = #max(e.base.get_size(), 1) * FREE_SUPPORTED_UNITS_PER_POP;
		result.MINERALS = #max(supported_units - free_support, 0);
		for (facility of e.base.get_facilities()) {
			result.ENERGY = result.ENERGY + facility.energy_maintenance;
		}

		return result;
	});

	bm.on('get_base_workable_tiles', (e) => {
		let result = [];
		const t_center = e.base.get_tile();
		let added_tiles = {};
		const f_add = (tile) => {
			const key = #to_string(tile.x) + '_' + #to_string(tile.y);
			if (tile != t_center && !#is_defined(added_tiles[key])) {
				added_tiles[key] = true;
				result :+tile;
			}
			return tile;
		};
		const t_n = f_add(t_center.get_N());
		const t_ne = f_add(t_center.get_NE());
		const t_e = f_add(t_center.get_E());
		const t_se = f_add(t_center.get_SE());
		const t_s = f_add(t_center.get_S());
		const t_sw = f_add(t_center.get_SW());
		const t_w = f_add(t_center.get_W());
		const t_nw = f_add(t_center.get_NW());
		const t_n_nw = f_add(t_n.get_NW());
		const t_n_ne = f_add(t_n.get_NE());
		const t_ne_ne = f_add(t_ne.get_NE());
		const t_e_ne = f_add(t_e.get_NE());
		const t_e_se = f_add(t_e.get_SE());
		const t_se_se = f_add(t_se.get_SE());
		const t_s_se = f_add(t_s.get_SE());
		const t_s_sw = f_add(t_s.get_SW());
		const t_sw_sw = f_add(t_sw.get_SW());
		const t_w_sw = f_add(t_w.get_SW());
		const t_w_nw = f_add(t_w.get_NW());
		const t_nw_nw = f_add(t_nw.get_NW());
		return result;
	});

	pops.define(game);

	game.on('start', (e) => {

		calculate_growth_base(game);

		const bm = game.get_bm();

		// set bases-related globals
		// TODO: prettier way to do this? needs to be callable from events
		game.set('f_base_get_pending_growth', get_pending_growth);
		game.set('f_base_get_pending_production', (base) => { return get_pending_production(game, base); });
		game.set('f_base_reset_nutrients', reset_nutrients);
		game.set('f_base_process_growth', process_growth);
		game.set('f_base_process_psych', process_psych);
		game.set('f_base_get_psych', (base) => { return get_psych_state(game, base); });
		game.set('f_base_pop_work_tile', pop_work_tile);
		game.set('f_base_pop_unwork_tile', pop_unwork);
		game.set('f_base_find_best_or_worst_tiles', find_best_or_worst_tiles);
		game.set('f_base_get_assignable_worker_tiles', get_assignable_worker_tiles);
		game.set('f_base_rebalance_workers', rebalance_workers);
		game.set('f_base_get_stable_worker_count', get_stable_worker_count);
		game.set('f_base_select_population_for_reduction', select_population_for_reduction);

		// new turn, process all bases
		game.on('turn', (e) => {
			if (game.is_master()) {
				globals.reserved_growth_tiles = {};
				for (base of bm.get_bases()) {
					const psych = game.get('f_economy_get_base_psych')(game, base);
					game.event('process_base_growth', {
						base: base,
						psych: psych,
					});
					game.event('process_base_production', {
						base: base,
					});
				}
			}
		});

	});
};
