const MOVEMENT_ACTION_DELAY = 200;
const MAX_ACTION_ATTEMPTS_PER_UNIT = 16;
const colonization = #include('ai/colonization');
const combat = #include('ai/combat');
const pathfinding = #include('ai/pathfinding');
const production = #include('ai/production');
const research = #include('ai/research');
const strategy = #include('ai/strategy');
const terraforming = #include('ai/terraforming');
const movement_rules = #include('movement_rules');

const owned_bases = (game, player) => {
	let result = [];
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			result :+base;
		}
	}
	return result;
};

const filter_owned_units = (units, player) => {
	let result = [];
	for (unit of units) {
		if (unit.owner == player.id) {
			result :+unit;
		}
	}
	return result;
};

const owned_units = (game, player) => {
	return filter_owned_units(game.get_um().get_units(), player);
};

const get_strategy_metrics = (game, player, bases, units) => {
	let former_count = 0;
	let colony_count = 0;
	let combat_count = 0;
	for (unit of units) {
		const def = unit.get_def();
		if (def.can_terraform) {
			former_count++;
		}
		if (def.can_found_base) {
			colony_count++;
		}
		if (def.offense > 0) {
			combat_count++;
		}
	}

	const tm = game.get_tm();
	const all_units = game.get_um().get_units();
	let underdefended_bases = 0;
	let growth_stalled_bases = 0;
	let unstable_bases = 0;
	let base_labs = 0;
	for (base of bases) {
		if (
			combat.get_garrison_count(base, player.id) <
			combat.get_required_garrison(tm, base, player.id, all_units)
		) {
			underdefended_bases++;
		}
		const intake = base.get_intake();
		const consumption = base.get_consumption();
		if (base.get_size() < 3 || intake.NUTRIENTS - consumption.NUTRIENTS <= 0) {
			growth_stalled_bases++;
		}
		const psych = game.get('f_economy_get_base_psych')(game, base);
		if (game.get('f_base_get_stable_worker_count')(base, psych) < base.get_size()) {
			unstable_bases++;
		}
		base_labs += game.get('f_technology_get_base_labs')(base).total;
	}
	return {
		base_count: #sizeof(bases),
		desired_base_count: strategy.get_desired_base_count(
			game.get_turn(),
			tm.get_map_width(),
			tm.get_map_height(),
			#sizeof(game.get_players())
		),
		former_count: former_count,
		colony_count: colony_count,
		combat_count: combat_count,
		underdefended_bases: underdefended_bases,
		growth_stalled_bases: growth_stalled_bases,
		unstable_bases: unstable_bases,
		base_labs: base_labs,
		energy_income: game.get('f_economy_get_player')(game, player),
	};
};

const get_strategy_priorities = (metrics, former_count, colony_count, combat_count) => {
	return strategy.get_priorities({
		base_count: metrics.base_count,
		desired_base_count: metrics.desired_base_count,
		former_count: former_count,
		colony_count: colony_count,
		combat_count: combat_count,
		underdefended_bases: metrics.underdefended_bases,
		growth_stalled_bases: metrics.growth_stalled_bases,
		unstable_bases: metrics.unstable_bases,
		energy_income: metrics.energy_income,
	});
};

const choose_tile = (tiles, score) => {
	let best = null;
	let best_score = 0;
	for (tile of tiles) {
		const value = score(tile);
		if (
			best == null ||
			value > best_score ||
			(value == best_score && (tile.y < best.y || (tile.y == best.y && tile.x < best.x)))
		) {
			best = tile;
			best_score = value;
		}
	}
	return best;
};

const can_enter = (unit, tile, source) => {
	if (unit.get_tile() == tile || tile.is_locked()) {
		return false;
	}
	if (unit.is_land && tile.is_water) {
		return false;
	}
	if (unit.is_water && tile.is_land) {
		return false;
	}
	for (other of tile.get_units()) {
		if (other.owner != unit.owner) {
			return false;
		}
	}
	const source_tile = #is_defined(source) ? source : unit.get_tile();
	if (movement_rules.is_zoc_move_blocked(unit, source_tile, tile)) {
		return false;
	}
	return true;
};

const has_other_active_former = (tile, unit) => {
	for (other of tile.get_units()) {
		if (other.id != unit.id && other.terraforming != 'none') {
			return true;
		}
	}
	return false;
};

const has_other_former = (tile, unit) => {
	for (other of tile.get_units()) {
		if (other.id != unit.id && other.get_def().can_terraform) {
			return true;
		}
	}
	return false;
};

const can_attempt_action = (unit, action_attempts) => {
	const unit_key = #to_string(unit.id);
	return (
		(!#is_defined(action_attempts[unit_key]) || action_attempts[unit_key] < MAX_ACTION_ATTEMPTS_PER_UNIT) &&
		unit.movement > 0.0 &&
		!unit.is_immovable &&
		unit.terraforming == 'none'
	);
};

const record_action_attempt = (unit, action_attempts) => {
	const unit_key = #to_string(unit.id);
	action_attempts[unit_key] = #is_defined(action_attempts[unit_key]) ? action_attempts[unit_key] + 1 : 1;
};

const attack_enemy_in_tiles = (game, player, unit, tiles) => {
	let available_tiles = [];
	for (tile of tiles) {
		if (!tile.is_locked()) {
			available_tiles :+tile;
		}
	}
	const target = combat.choose_attack_target(
		unit,
		player.id,
		available_tiles,
		game.get_tm(),
		game.get_um().get_units()
	);
	if (target == null) {
		return false;
	}
	game.event_as(player.id, 'attack_unit', {attacker: unit, defender: target});
	return true;
};

const queue_production = (game, player, bases, units) => {
	const metrics = get_strategy_metrics(game, player, bases, units);
	let former_count = metrics.former_count;
	let colony_count = metrics.colony_count;
	let combat_count = metrics.combat_count;
	const unit_defs = game.get_um().get_unit_defs();
	const facility_defs = game.get_bm().get_facility_defs();
	const available_energy = metrics.energy_income;
	const tm = game.get_tm();
	const all_units = game.get_um().get_units();
	let hurry_candidates = [];
	for (base of bases) {
		const garrison_count = combat.get_garrison_count(base, player.id);
		let supported_units = 0;
		for (unit of units) {
			if (unit.home_base_id == base.id) {
				supported_units++;
			}
		}
		const required_garrison = combat.get_required_garrison(tm, base, player.id, all_units);
		const psych = game.get('f_economy_get_base_psych')(game, base);
		const intake = base.get_intake();
		const consumption = base.get_consumption();
		const nutrient_surplus = intake.NUTRIENTS - consumption.NUTRIENTS;
		const mineral_surplus = intake.MINERALS - consumption.MINERALS;
		const priorities = get_strategy_priorities(
			metrics,
			former_count,
			colony_count,
			combat_count
		);
		const context = {
			needs_garrison: garrison_count < required_garrison,
			needs_former: former_count < #sizeof(bases),
			needs_colony: #sizeof(bases) + colony_count < metrics.desired_base_count,
			needs_military: combat_count < #sizeof(bases) * 2,
			needs_psych: game.get('f_base_get_stable_worker_count')(base, psych) < base.get_size(),
			needs_growth: base.get_size() < 3 || nutrient_surplus <= 0,
			can_expand: base.get_size() > 1,
			nutrient_surplus: nutrient_surplus,
			mineral_surplus: mineral_surplus,
			supported_units: supported_units,
			free_support: #max(base.get_size(), 1),
			base_labs: game.get('f_technology_get_base_labs')(base).total,
			available_energy: available_energy,
			priorities: priorities,
		};
		const selected = production.choose(
			base,
			unit_defs,
			facility_defs,
			context
		);
		if (selected != null && selected.kind == 'unit') {
			if (selected.def.can_terraform) {
				former_count++;
			}
			if (selected.def.can_found_base) {
				colony_count++;
			}
			if (selected.def.offense > 0) {
				combat_count++;
			}
		}
		const queue = base.get_production_queue();
		if (selected == null) {
			if (#sizeof(queue) > 0) {
				game.event_as(player.id, 'remove_base_production', {base: base, index: 0});
			}
		} else if (
			#sizeof(queue) == 0 ||
			queue[0].production_kind != selected.kind ||
			queue[0].id != selected.id
		) {
			game.event_as(player.id, 'set_base_production', {
				base: base,
				kind: selected.kind,
				id: selected.id,
			});
		}
		if (selected != null) {
			context.kind = selected.kind;
			context.hurry_cost = game.get('f_economy_get_hurry_cost')(base);
			context.energy_credits = player.energy_credits;
			context.energy_income = available_energy;
			context.accumulated_minerals = base.get_accumulated_minerals();
			context.production_score = selected.score;
			const hurry_score = production.score_hurry(selected.def, context);
			if (hurry_score != null) {
				hurry_candidates :+{base: base, score: hurry_score};
			}
		}
	}
	const hurry = production.choose_hurry(hurry_candidates);
	if (hurry != null) {
		const cost = game.get('f_economy_get_hurry_cost')(hurry.base);
		if (cost > 0 && player.energy_credits >= cost) {
			game.event_as(player.id, 'hurry_base_production', {base: hurry.base});
		}
	}
};

const choose_research_target = (game, player, available) => {
	const bases = owned_bases(game, player);
	const units = owned_units(game, player);
	const metrics = get_strategy_metrics(game, player, bases, units);
	const priorities = get_strategy_priorities(
		metrics,
		metrics.former_count,
		metrics.colony_count,
		metrics.combat_count
	);
	return research.choose_id(
		available,
		(id) => { return game.get('f_technology_get_definition')(id); },
		game.get_um().get_unit_defs(),
		game.get_bm().get_facility_defs(),
		{
			needs_colony: metrics.base_count + metrics.colony_count < metrics.desired_base_count,
			needs_former: metrics.former_count < metrics.base_count,
			needs_military: metrics.combat_count < metrics.base_count * 2,
			needs_growth: metrics.growth_stalled_bases > 0,
			needs_psych: metrics.unstable_bases > 0,
			base_labs: metrics.base_labs,
			priorities: priorities,
		}
	);
};

const move_colony = (game, player, unit, all_bases) => {
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		return false;
	}
	const tm = game.get_tm();
	const destination = pathfinding.find_best_reachable(tm, unit, (source, candidate) => {
		return can_enter(unit, candidate, source);
	}, (candidate, distance) => {
		return colonization.get_destination_score(tm, candidate, player, all_bases, distance);
	});
	if (destination == null) {
		return false;
	}
	if (destination.target == tile) {
		game.event_as(player.id, 'found_base', {unit: unit});
		return true;
	}
	if (destination.step != null && can_enter(unit, destination.step)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: destination.step});
		return true;
	}
	return false;
};

const move_former = (game, player, unit, all_bases) => {
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		return false;
	}
	const tm = game.get_tm();
	let strategic_targets = {};
	const consider_target = (candidate, pending_growth, prioritize_nutrients, is_worked) => {
		if (has_other_former(candidate, unit)) {
			return;
		}
		const order = terraforming.get_order(candidate, prioritize_nutrients);
		if (order == null) {
			return;
		}
		const key = #to_string(candidate.x) + '_' + #to_string(candidate.y);
		const worked = is_worked || candidate.has('working_pop');
		const score = terraforming.get_target_score(candidate, player, pending_growth, 0, worked);
		if (!#is_defined(strategic_targets[key]) || score > strategic_targets[key].score) {
			strategic_targets[key] = {
				order: order,
				pending_growth: pending_growth,
				is_worked: worked,
				score: score,
			};
		}
	};
	for (base of all_bases) {
		if (base.get_owner().id != player.id) {
			continue;
		}
		const pending_growth = game.get('f_base_get_pending_growth')(base);
		const prioritize_nutrients = pending_growth <= 0;
		for (worked_tile of base.get_worked_tiles()) {
			consider_target(worked_tile, pending_growth, prioritize_nutrients, true);
		}
		for (unworked_tile of base.get_unworked_tiles()) {
			consider_target(unworked_tile, pending_growth, prioritize_nutrients, false);
		}
	}
	const destination = pathfinding.find_best_reachable(tm, unit, (source, candidate) => {
		return can_enter(unit, candidate, source);
	}, (candidate, distance) => {
		const key = #to_string(candidate.x) + '_' + #to_string(candidate.y);
		if (!#is_defined(strategic_targets[key])) {
			return null;
		}
		const target = strategic_targets[key];
		return terraforming.get_target_score(
			candidate,
			player,
			target.pending_growth,
			distance,
			target.is_worked
		);
	});
	if (destination != null) {
		const key = #to_string(destination.target.x) + '_' + #to_string(destination.target.y);
		const target = strategic_targets[key];
		if (destination.target == tile && !has_other_active_former(tile, unit)) {
			game.event_as(player.id, 'terraform_tile', {unit: unit, type: target.order});
			return true;
		}
		if (destination.step != null && can_enter(unit, destination.step)) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: destination.step});
			return true;
		}
	}
	const local_order = terraforming.get_order(tile, false);
	if (local_order != null && !has_other_active_former(tile, unit)) {
		game.event_as(player.id, 'terraform_tile', {unit: unit, type: local_order});
		return true;
	}
	const is_candidate = (candidate) => {
		return can_enter(unit, candidate) &&
			terraforming.get_order(candidate, false) != null &&
			!has_other_former(candidate, unit);
	};
	const target = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
		if (!is_candidate(candidate)) {
			return 0 - 100000;
		}
		return terraforming.get_target_score(candidate, player, 1, 1);
	});
	if (target != null && is_candidate(target)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: target});
		return true;
	}
	return false;
};

const move_combat = (game, player, unit, all_bases, all_units, reinforcement_assignments) => {
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		return 0;
	}
	const repair_base = combat.get_repair_destination(game.get_tm(), unit, player.id, all_bases);
	if (repair_base != null) {
		const destination = repair_base.get_tile();
		if (tile == destination) {
			return 0;
		}
		const current_distance = game.get_tm().get_distance(tile, destination);
		let repair_step = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
			if (!can_enter(unit, candidate)) {
				return 0 - 100000;
			}
			return 10000 - game.get_tm().get_distance(candidate, destination) * 100;
		});
		if (
			repair_step == null ||
			game.get_tm().get_distance(repair_step, destination) >= current_distance
		) {
			repair_step = pathfinding.find_path_step(game.get_tm(), unit, destination, (source, candidate) => {
				return can_enter(unit, candidate, source);
			});
		}
		if (repair_step != null && can_enter(unit, repair_step)) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: repair_step});
			return 100;
		}
	}
	const current_base = tile.get_base();
	if (current_base != null && current_base.get_owner().id == player.id) {
		const defenders = combat.get_garrison_count(current_base, player.id);
		const required_garrison = combat.get_required_garrison(
			game.get_tm(),
			current_base,
			player.id,
			all_units
		);
		if (defenders <= required_garrison) {
			return 0;
		}
	}
	if (attack_enemy_in_tiles(game, player, unit, tile.get_surrounding_tiles())) {
		return 1000;
	}
	if (unit.get_def().id == 'SporeLauncher') {
		let ranged_tiles = [];
		for (nearby of tile.get_surrounding_tiles()) {
			for (ranged of nearby.get_surrounding_tiles()) {
				if (game.get_tm().get_distance(tile, ranged) == 2) {
					ranged_tiles :+ranged;
				}
			}
		}
		if (attack_enemy_in_tiles(game, player, unit, ranged_tiles)) {
			return 1000;
		}
	}
	const unit_key = #to_string(unit.id);
	let reinforcement_base = null;
	if (#is_defined(reinforcement_assignments[unit_key])) {
		for (base of all_bases) {
			if (
				base.id == reinforcement_assignments[unit_key] &&
				base.get_owner().id == player.id &&
				base.get_tile() != tile
			) {
				reinforcement_base = base;
				break;
			}
		}
		if (reinforcement_base == null) {
			reinforcement_assignments[unit_key] = #undefined;
		}
	}
	if (reinforcement_base == null) {
		let reservations = {};
		for (other of all_units) {
			if (other.owner != player.id) {
				continue;
			}
			const other_key = #to_string(other.id);
			if (#is_defined(reinforcement_assignments[other_key])) {
				const base_key = #to_string(reinforcement_assignments[other_key]);
				reservations[base_key] = #is_defined(reservations[base_key])
					? reservations[base_key] + 1
					: 1;
			}
		}
		reinforcement_base = combat.choose_reinforcement_target(
			game.get_tm(),
			unit,
			player.id,
			all_bases,
			all_units,
			reservations
		);
		if (reinforcement_base != null) {
			reinforcement_assignments[unit_key] = reinforcement_base.id;
		}
	}
	if (reinforcement_base != null) {
		const destination = reinforcement_base.get_tile();
		const current_distance = game.get_tm().get_distance(tile, destination);
		let reinforcement_step = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
			if (!can_enter(unit, candidate)) {
				return 0 - 100000;
			}
			return 10000 - game.get_tm().get_distance(candidate, destination) * 100;
		});
		if (
			reinforcement_step == null ||
			game.get_tm().get_distance(reinforcement_step, destination) >= current_distance
		) {
			reinforcement_step = pathfinding.find_path_step(game.get_tm(), unit, destination, (source, candidate) => {
				return can_enter(unit, candidate, source);
			});
		}
		if (reinforcement_step != null && can_enter(unit, reinforcement_step)) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: reinforcement_step});
			return 100;
		}
		reinforcement_assignments[unit_key] = #undefined;
	}
	const enemy_base = combat.choose_assault_target(
		game.get_tm(),
		unit,
		player.id,
		all_bases,
		all_units
	);
	const enemy_distance = enemy_base == null
		? 100000
		: game.get_tm().get_distance(tile, enemy_base.get_tile());
	const target = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
		if (!can_enter(unit, candidate)) {
			return 0 - 100000;
		}
		if (enemy_base != null) {
			return 10000 - game.get_tm().get_distance(candidate, enemy_base.get_tile()) * 100;
		}
		const resources = candidate.get_resources(player);
		return resources.NUTRIENTS * 3 + resources.MINERALS * 2 + resources.ENERGY;
	});
	if (
		enemy_base != null &&
		(target == null || game.get_tm().get_distance(target, enemy_base.get_tile()) >= enemy_distance)
	) {
		const path_step = pathfinding.find_path_step(game.get_tm(), unit, enemy_base.get_tile(), (source, candidate) => {
			return can_enter(unit, candidate, source);
		});
		if (path_step != null) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: path_step});
			return 100;
		}
	}
	if (target != null && can_enter(unit, target)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: target});
		return 100;
	}
	return 0;
};

const play_turn = (game, player, done) => {
	const bases = owned_bases(game, player);
	const units = owned_units(game, player);
	queue_production(game, player, bases, units);

	let steps = 0;
	let action_attempts = {};
	let reinforcement_assignments = {};
	const play_next_action = () => {
		if (!game.is_master() || game.is_game_over() || game.is_turn_complete(player.id)) {
			done();
			return;
		}
		const all_units = game.get_um().get_units();
		const current_units = filter_owned_units(all_units, player);
		const all_bases = game.get_bm().get_bases();
		let action_started = false;
		let action_delay = MOVEMENT_ACTION_DELAY;
		let waiting_for_animation = false;
		for (unit of current_units) {
			if (can_attempt_action(unit, action_attempts) && unit.get_tile().is_locked()) {
				waiting_for_animation = true;
				break;
			}
		}
		for (unit of current_units) {
			if (!can_attempt_action(unit, action_attempts)) {
				continue;
			}
			const def = unit.get_def();
			if (def.can_found_base) {
				action_started = move_colony(game, player, unit, all_bases);
			}
			if (action_started) {
				record_action_attempt(unit, action_attempts);
				break;
			}
		}
		if (!action_started) {
			for (unit of current_units) {
				if (!can_attempt_action(unit, action_attempts)) {
					continue;
				}
				const def = unit.get_def();
				if (def.can_terraform) {
						action_started = move_former(game, player, unit, all_bases);
				}
				if (action_started) {
					record_action_attempt(unit, action_attempts);
					break;
				}
			}
		}
		if (!action_started) {
			for (unit of current_units) {
				if (!can_attempt_action(unit, action_attempts)) {
					continue;
				}
				if (unit.get_def().offense > 0) {
					const combat_delay = move_combat(
						game,
						player,
						unit,
						all_bases,
						all_units,
						reinforcement_assignments
					);
					if (combat_delay > 0) {
						action_started = true;
						action_delay = combat_delay;
					}
				}
				if (action_started) {
					record_action_attempt(unit, action_attempts);
					break;
				}
			}
		}
		steps++;
		if (action_started && steps < 1000) {
			#async(action_delay, play_next_action);
			return;
		}
		if (waiting_for_animation && steps < 1000) {
			#async(MOVEMENT_ACTION_DELAY, play_next_action);
			return;
		}
		game.event_as(player.id, 'complete_turn', {});
		#async(100, done);
	};
	#async(100, play_next_action);
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_ai_choose_research_target', (player, available) => {
			return choose_research_target(game, player, available);
		});
		let ui_started = false;
		let ai_running = false;
		const play_ai_players = () => {
			if (ai_running || !game.is_master() || game.is_game_over()) {
				return;
			}
			let players = [];
			for (player of game.get_players()) {
				if (player.type == 'ai' && !game.is_turn_complete(player.id)) {
					players :+player;
				}
			}
			if (#sizeof(players) == 0) {
				return;
			}
			ai_running = true;
			let index = 0;
			const play_next_player = () => {
				if (index >= #sizeof(players)) {
					ai_running = false;
					return;
				}
				const player = players[index];
				index++;
				play_turn(game, player, play_next_player);
			};
			play_next_player();
		};
		game.on('start_ui', (e) => {
			ui_started = true;
			#async(500, play_ai_players);
		});
		game.on('turn', (e) => {
			if (ui_started) {
				#async(500, play_ai_players);
			}
		});
	});
};
