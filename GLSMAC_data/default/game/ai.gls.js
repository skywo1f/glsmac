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

const can_enter = (unit, tile) => {
	if (tile.is_locked()) {
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
	return true;
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

	for (base of bases) {
		let kind = null;
		let id = null;
		let has_garrison = false;
		for (unit of base.get_tile().get_units()) {
			if (unit.owner == player.id && unit.get_def().offense > 0) {
				has_garrison = true;
				break;
			}
		}
		if (!has_garrison) {
			kind = 'unit';
			id = 'ScoutPatrol';
		} else if (player.has_technology('CentauriEcology') && former_count < #sizeof(bases)) {
			kind = 'unit';
			id = 'Former';
			former_count++;
		} else if (#sizeof(bases) + colony_count < 3) {
			kind = 'unit';
			id = 'ColonyPod';
			colony_count++;
		} else if (base.can_set_production('facility', 'RecyclingTanks')) {
			kind = 'facility';
			id = 'RecyclingTanks';
		} else {
			kind = 'unit';
			id = base.can_set_production('unit', 'ReconRover') ? 'ReconRover' : 'ScoutPatrol';
		}
		const queue = base.get_production_queue();
		if (id == null) {
			if (#sizeof(queue) > 0) {
				game.event_as(player.id, 'remove_base_production', {base: base, index: 0});
			}
		} else if (
			#sizeof(queue) == 0 ||
			queue[0].production_kind != kind ||
			queue[0].id != id
		) {
			game.event_as(player.id, 'set_base_production', {base: base, kind: kind, id: id});
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
	if (tile.get_base() == null && !tile.is_water && !tile.features.monolith && !tile.features.xenofungus) {
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
			!candidate.features.xenofungus;
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
	for (nearby of tile.get_surrounding_tiles()) {
		for (enemy of nearby.get_units()) {
			if (enemy.owner != player.id) {
				game.event_as(player.id, 'attack_unit', {attacker: unit, defender: enemy});
				return 1000;
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
	let acted_units = {};
	const play_next_action = () => {
		if (!game.is_master() || game.is_game_over() || game.is_turn_complete(player.id)) {
			done();
			return;
		}
		const current_units = owned_units(game, player);
		const all_bases = game.get_bm().get_bases();
		let action_started = false;
		let action_delay = 100;
		for (unit of current_units) {
			const unit_key = #to_string(unit.id);
			if (#is_defined(acted_units[unit_key]) || unit.movement <= 0.0 || unit.is_immovable || unit.terraforming != 'none') {
				continue;
			}
			const def = unit.get_def();
			if (def.can_found_base) {
				action_started = move_colony(game, player, unit, all_bases);
			}
			if (action_started) {
				acted_units[unit_key] = true;
				break;
			}
		}
		if (!action_started) {
			for (unit of current_units) {
				const unit_key = #to_string(unit.id);
				if (#is_defined(acted_units[unit_key]) || unit.movement <= 0.0 || unit.is_immovable || unit.terraforming != 'none') {
					continue;
				}
				const def = unit.get_def();
				if (def.can_terraform) {
				action_started = move_former(game, player, unit);
				}
				if (action_started) {
					acted_units[unit_key] = true;
					break;
				}
			}
		}
		if (!action_started) {
			for (unit of current_units) {
				const unit_key = #to_string(unit.id);
				if (#is_defined(acted_units[unit_key]) || unit.movement <= 0.0 || unit.is_immovable || unit.terraforming != 'none') {
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
					acted_units[unit_key] = true;
					break;
				}
			}
		}
		steps++;
		if (action_started && steps < 100) {
			#async(action_delay, play_next_action);
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
