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
		if (#sizeof(base.get_production_queue()) > 0) {
			continue;
		}
		let kind = 'unit';
		let id = 'ScoutPatrol';
		if (player.has_technology('CentauriEcology') && former_count < #sizeof(bases)) {
			id = 'Former';
			former_count++;
		} else if (#sizeof(bases) + colony_count < 3) {
			id = 'ColonyPod';
			colony_count++;
		} else if (base.can_set_production('facility', 'RecyclingTanks')) {
			kind = 'facility';
			id = 'RecyclingTanks';
		}
		game.event_as(player.id, 'set_base_production', {base: base, kind: kind, id: id});
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
	if (site_is_valid(tile, player.id)) {
		game.event_as(player.id, 'found_base', {unit: unit});
		return;
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
	}
};

const move_former = (game, player, unit) => {
	const tile = unit.get_tile();
	if (tile.get_base() == null && !tile.is_water && !tile.features.monolith && !tile.features.xenofungus) {
		if (!tile.terraforming.farm) {
			game.event_as(player.id, 'terraform_tile', {unit: unit, type: 'farm'});
			return;
		}
		if (!tile.terraforming.mine && !tile.terraforming.solar) {
			game.event_as(player.id, 'terraform_tile', {unit: unit, type: 'mine'});
			return;
		}
	}
	const target = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
		if (!can_enter(unit, candidate) || candidate.get_base() != null) {
			return 0 - 100000;
		}
		const resources = candidate.get_resources(player);
		let score = resources.NUTRIENTS * 3 + resources.MINERALS * 2 + resources.ENERGY;
		if (!candidate.terraforming.farm) {
			score += 10;
		}
		return score;
	});
	if (target != null && can_enter(unit, target)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: target});
	}
};

const move_combat = (game, player, unit, all_bases) => {
	const tile = unit.get_tile();
	for (nearby of tile.get_surrounding_tiles()) {
		for (enemy of nearby.get_units()) {
			if (enemy.owner != player.id) {
				game.event_as(player.id, 'attack_unit', {attacker: unit, defender: enemy});
				return;
			}
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
	}
};

const play_turn = (game, player) => {
	const bases = owned_bases(game, player);
	const units = owned_units(game, player);
	const all_bases = game.get_bm().get_bases();
	queue_production(game, player, bases, units);
	for (unit of units) {
		if (unit.movement <= 0.0 || unit.is_immovable || unit.terraforming != 'none') {
			continue;
		}
		const def = unit.get_def();
		if (def.can_found_base) {
			move_colony(game, player, unit, all_bases);
		} else if (def.can_terraform) {
			move_former(game, player, unit);
		} else if (def.offense > 0) {
			move_combat(game, player, unit, all_bases);
		}
	}
	game.event_as(player.id, 'complete_turn', {});
};

return (game) => {
	game.on('start', (e) => {
		let ui_started = false;
		const play_ai_players = () => {
			if (!game.is_master() || game.is_game_over()) {
				return;
			}
			for (player of game.get_players()) {
				if (player.type == 'ai' && !game.is_turn_complete(player.id)) {
					play_turn(game, player);
				}
			}
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
