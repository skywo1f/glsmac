const MOVEMENT_ACTION_DELAY = 200;
const MAX_ACTION_ATTEMPTS_PER_UNIT = 16;
const combat = #include('ai/combat');
const pathfinding = #include('ai/pathfinding');
const production = #include('ai/production');
const strategy = #include('ai/strategy');
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

const owned_units = (game, player) => {
	let result = [];
	for (unit of game.get_um().get_units()) {
		if (unit.owner == player.id) {
			result :+unit;
		}
	}
	return result;
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

const attack_enemy_on_tile = (game, player, unit, tile) => {
	if (tile.is_locked()) {
		return false;
	}
	for (enemy of tile.get_units()) {
		if (enemy.owner != player.id) {
			game.event_as(player.id, 'attack_unit', {attacker: unit, defender: enemy});
			return true;
		}
	}
	return false;
};

const queue_production = (game, player, bases, units) => {
	let former_count = 0;
	let colony_count = 0;
	for (unit of units) {
		const id = unit.get_def().id;
		if (id == 'Former') {
			former_count++;
		} else if (id == 'ColonyPod') {
			colony_count++;
		}
	}

	const unit_defs = game.get_um().get_unit_defs();
	const facility_defs = game.get_bm().get_facility_defs();
	const available_energy = game.get('f_economy_get_player')(game, player);
	const tm = game.get_tm();
	const desired_base_count = strategy.get_desired_base_count(
		game.get_turn(),
		tm.get_map_width(),
		tm.get_map_height(),
		#sizeof(game.get_players())
	);
	for (base of bases) {
		let has_garrison = false;
		for (unit of base.get_tile().get_units()) {
			if (unit.owner == player.id && unit.get_def().offense > 0) {
				has_garrison = true;
				break;
			}
		}
		const psych = game.get('f_economy_get_base_psych')(game, base);
		const selected = production.choose(
			base,
			unit_defs,
			facility_defs,
			{
				needs_garrison: !has_garrison,
				needs_former: former_count < #sizeof(bases),
				needs_colony: #sizeof(bases) + colony_count < desired_base_count,
				needs_psych: game.get('f_base_get_stable_worker_count')(base, psych) < base.get_size(),
				available_energy: available_energy,
			}
		);
		if (selected != null && selected.kind == 'unit') {
			if (selected.def.can_terraform) {
				former_count++;
			}
			if (selected.def.can_found_base) {
				colony_count++;
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
	}
};

const site_is_valid = (tile, owner) => {
	if (tile.is_locked() || tile.is_water || tile.get_base() != null) {
		return false;
	}
	for (nearby of tile.get_surrounding_tiles()) {
		if (nearby.get_base() != null) {
			return false;
		}
	}
	for (unit of tile.get_units()) {
		if (unit.owner != owner) {
			return false;
		}
	}
	return true;
};

const move_colony = (game, player, unit, all_bases) => {
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		return false;
	}
	if (site_is_valid(tile, player.id)) {
		game.event_as(player.id, 'found_base', {unit: unit});
		return true;
	}
	const target = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
		if (!can_enter(unit, candidate)) {
			return 0 - 100000;
		}
		let min_distance = 1000;
		for (base of all_bases) {
			min_distance = #min(min_distance, game.get_tm().get_distance(candidate, base.get_tile()));
		}
		const resources = candidate.get_resources(player);
		return min_distance * 20 + resources.NUTRIENTS * 3 + resources.MINERALS * 2 + resources.ENERGY;
	});
	if (target != null && can_enter(unit, target)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: target});
		return true;
	}
	return false;
};

const move_former = (game, player, unit) => {
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		return false;
	}
	if (
		tile.get_base() == null &&
		!tile.is_water &&
		!tile.features.monolith &&
		!tile.features.xenofungus &&
		!has_other_active_former(tile, unit)
	) {
		if (!tile.terraforming.road) {
			game.event_as(player.id, 'terraform_tile', {unit: unit, type: 'road'});
			return true;
		}
		if (!tile.terraforming.forest && !tile.terraforming.farm) {
			const type = tile.moisture <= 1 || tile.rockiness >= 2 ? 'forest' : 'farm';
			game.event_as(player.id, 'terraform_tile', {unit: unit, type: type});
			return true;
		}
		if (tile.terraforming.farm && !tile.terraforming.mine && !tile.terraforming.solar) {
			game.event_as(player.id, 'terraform_tile', {unit: unit, type: 'solar'});
			return true;
		}
	}
	const is_candidate = (candidate) => {
		return can_enter(unit, candidate) &&
			candidate.get_base() == null &&
			!candidate.is_water &&
			!candidate.features.monolith &&
			!candidate.features.xenofungus &&
			!has_other_active_former(candidate, unit);
	};
	const target = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
		if (!is_candidate(candidate)) {
			return 0 - 100000;
		}
		const resources = candidate.get_resources(player);
		let score = resources.NUTRIENTS * 3 + resources.MINERALS * 2 + resources.ENERGY;
		if (!candidate.terraforming.road) {
			score += 12;
		}
		if (!candidate.terraforming.forest && !candidate.terraforming.farm) {
			score += 20;
		} else if (candidate.terraforming.farm && !candidate.terraforming.mine && !candidate.terraforming.solar) {
			score += 8;
		}
		return score;
	});
	if (target != null && is_candidate(target)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: target});
		return true;
	}
	return false;
};

const move_combat = (game, player, unit, all_bases) => {
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
	for (nearby of tile.get_surrounding_tiles()) {
		if (attack_enemy_on_tile(game, player, unit, nearby)) {
			return 1000;
		}
	}
	if (unit.get_def().id == 'SporeLauncher') {
		for (nearby of tile.get_surrounding_tiles()) {
			for (ranged of nearby.get_surrounding_tiles()) {
				if (
					game.get_tm().get_distance(tile, ranged) == 2 &&
					attack_enemy_on_tile(game, player, unit, ranged)
				) {
					return 1000;
				}
			}
		}
	}
	const current_base = tile.get_base();
	if (current_base != null && current_base.get_owner().id == player.id) {
		let defenders = 0;
		for (other of tile.get_units()) {
			if (other.owner == player.id && other.get_def().offense > 0) {
				defenders++;
			}
		}
		if (defenders <= 1) {
			return 0;
		}
	}
	let enemy_base = null;
	let enemy_distance = 100000;
	for (base of all_bases) {
		if (base.get_owner().id != player.id) {
			const distance = game.get_tm().get_distance(tile, base.get_tile());
			if (distance < enemy_distance) {
				enemy_base = base;
				enemy_distance = distance;
			}
		}
	}
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
	const play_next_action = () => {
		if (!game.is_master() || game.is_game_over() || game.is_turn_complete(player.id)) {
			done();
			return;
		}
		const current_units = owned_units(game, player);
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
					action_started = move_former(game, player, unit);
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
					const combat_delay = move_combat(game, player, unit, all_bases);
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
