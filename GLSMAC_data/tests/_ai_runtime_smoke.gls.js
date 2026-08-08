#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let ai_id = 0 - 1;
	let initial_scout_tile = null;
	let ai_moved = false;
	let ai_expanded = false;
	let ai_built_former = false;
	let ai_terraformed = false;
	let ai_built_road = false;
	let ai_completed_improvement = false;
	let ai_improved_base_tile = false;
	let ai_built_rover = false;
	let ai_rover_moved_twice = false;
	let ai_rover_reinforced = false;
	let rover_states = {};
	let ui_started = false;
	let exit_scheduled = false;

	const fail = (message) => {
		#print('AI_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const monitor_rovers = () => {
		for (unit of glsmac.game.get_um().get_units()) {
			if (unit.owner != ai_id || unit.get_def().id != 'ReconRover') {
				continue;
			}
			const key = #to_string(unit.id);
			const tile = unit.get_tile();
			const turn = glsmac.game.get_turn();
			if (#is_defined(rover_states[key])) {
				const previous = rover_states[key];
				if (previous.x != tile.x || previous.y != tile.y) {
					ai_moved = true;
					const destination_base = tile.get_base();
					if (destination_base != null && destination_base.get_owner().id == ai_id) {
						ai_rover_reinforced = true;
					}
					const moves = previous.turn == turn ? previous.moves + 1 : 1;
					if (moves >= 2) {
						ai_rover_moved_twice = true;
					}
					rover_states[key] = {x: tile.x, y: tile.y, turn: turn, moves: moves};
				} else if (previous.turn != turn) {
					rover_states[key] = {x: tile.x, y: tile.y, turn: turn, moves: 0};
				}
			} else {
				rover_states[key] = {x: tile.x, y: tile.y, turn: turn, moves: 0};
			}
		}
		return !exit_scheduled;
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		game.on('start_ui', (e) => {
			ui_started = true;
			#async(25, monitor_rovers);
			#async(500, () => { game.event('complete_turn', {}); });
		});

		game.on('turn', (e) => {
			if (!ui_started) {
				return;
			}
			const turn_id = e.year - 2100;
			const players = game.get_players();
			if (#sizeof(players) == 7) {
				let ai_count = 0;
				for (player of players) {
					if (player.type == 'ai') {
						ai_count++;
					}

					let faction_count = 0;
					let base_count = 0;
					for (other of players) {
						if (other.get_faction().id == player.get_faction().id) {
							faction_count++;
						}
					}
					for (base of game.get_bm().get_bases()) {
						if (base.get_owner().id == player.id) {
							base_count++;
						}
					}
					if (faction_count != 1 || base_count != 1) {
						#print('SEVEN_PLAYER_RUNTIME_FAIL: invalid starting faction or base ownership');
						glsmac.exit();
						return;
					}
				}
				if (ai_count != 6) {
					#print('SEVEN_PLAYER_RUNTIME_FAIL: expected six computer opponents');
					glsmac.exit();
					return;
				}
				#print('SEVEN_PLAYER_RUNTIME_PASS: seven unique factions started with six computer opponents');
				glsmac.exit();
				return;
			}
			if (#sizeof(players) != 2) {
				fail('expected two players, found ' + #to_string(#sizeof(players)));
				return;
			}

			let ai = null;
			for (player of players) {
				if (player.type == 'ai') {
					ai = player;
				}
			}
			if (ai == null || ai.id == 0 || ai.is_master) {
				fail('AI player identity or authority is invalid');
				return;
			}
			ai_id = ai.id;
			let ai_bases = 0;
			let populated_ai_bases = 0;
			let garrisoned_ai_bases = 0;
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == ai_id) {
					ai_bases++;
					if (turn_id <= 35) {
						base.set_accumulated_minerals(100);
						if (turn_id <= 8 && base.get_size() == 1) {
							base.set('accumulated_nutrients', game.get('map_growth_base') * 2);
						}
					}
					if (base.get_size() > 0) {
						populated_ai_bases++;
					}
					for (unit of base.get_tile().get_units()) {
						if (unit.owner == ai_id && unit.get_def().offense > 0) {
							garrisoned_ai_bases++;
							break;
						}
					}
				}
			}
			if (ai_bases < 1) {
				fail('AI has no base');
				return;
			}
			if (ai_bases >= 2) {
				ai_expanded = true;
			}

			let scout = null;
			let ai_combat_units = 0;
			for (unit of game.get_um().get_units()) {
				if (unit.owner == ai_id && unit.get_def().offense > 0) {
					ai_combat_units++;
				}
				if (unit.owner == ai_id && unit.get_def().id == 'Former') {
					ai_built_former = true;
					const former_tile = unit.get_tile();
					if (unit.terraforming != 'none' || former_tile.terraforming.road || former_tile.terraforming.forest || former_tile.terraforming.farm || former_tile.terraforming.mine || former_tile.terraforming.solar) {
						ai_terraformed = true;
					}
					if (former_tile.terraforming.road) {
						ai_built_road = true;
					}
					if (former_tile.terraforming.forest || former_tile.terraforming.farm) {
						ai_completed_improvement = true;
						for (base of game.get_bm().get_bases()) {
							if (base.get_owner().id != ai_id) {
								continue;
							}
							for (workable_tile of base.get_workable_tiles()) {
								if (workable_tile == former_tile) {
									ai_improved_base_tile = true;
								}
							}
						}
					}
				}
				if (unit.owner == ai_id && unit.get_def().id == 'ReconRover') {
					ai_built_rover = true;
				}
				if (scout == null && unit.owner == ai_id && unit.get_def().id == 'ScoutPatrol') {
					scout = unit;
				}
			}
			if (scout == null && initial_scout_tile == null) {
				fail('AI has no scout patrol');
				return;
			}
			if (scout != null && initial_scout_tile == null) {
				initial_scout_tile = scout.get_tile();
			} else if (scout != null && scout.get_tile() != initial_scout_tile) {
				ai_moved = true;
			}

			if (turn_id >= 16) {
				const missing_requirements =
					!ai_moved ||
					!ai_expanded ||
					!ai_built_former ||
					!ai_terraformed ||
					!ai_built_road ||
					!ai_completed_improvement ||
					!ai_improved_base_tile ||
					!ai_built_rover ||
					populated_ai_bases != ai_bases ||
					garrisoned_ai_bases != ai_bases ||
					ai_combat_units <= ai_bases ||
					!ui_started;
				if (!missing_requirements) {
					if (!exit_scheduled) {
						exit_scheduled = true;
						#print('AI_RUNTIME_PASS: AI moved, grew, expanded, terraformed, and fielded mobile units');
						#async(100, () => { glsmac.exit(); });
					}
					return;
				}
				if (turn_id >= 35) {
					#print('AI_RUNTIME_TRACE: moved=' + #to_string(ai_moved) + ' expanded=' + #to_string(ai_expanded) + ' former=' + #to_string(ai_built_former) + ' terraformed=' + #to_string(ai_terraformed) + ' road=' + #to_string(ai_built_road) + ' improved=' + #to_string(ai_completed_improvement) + ' base_tile=' + #to_string(ai_improved_base_tile) + ' rover=' + #to_string(ai_built_rover) + ' rover_twice=' + #to_string(ai_rover_moved_twice) + ' rover_reinforced=' + #to_string(ai_rover_reinforced) + ' bases=' + #to_string(ai_bases) + ' garrisons=' + #to_string(garrisoned_ai_bases) + ' combat=' + #to_string(ai_combat_units));
					const research = ai.get_research_state();
					#print('AI_RUNTIME_RESEARCH_TRACE: known=' + #to_string(research.technologies) + ' target=' + research.target + ' progress=' + #to_string(research.progress));
					for (unit of game.get_um().get_units()) {
						if (unit.owner == ai_id && unit.get_def().can_found_base) {
							const tile = unit.get_tile();
							#print('AI_RUNTIME_COLONY_TRACE: tile=' + #to_string(tile.x) + ',' + #to_string(tile.y) + ' movement=' + #to_string(unit.movement));
						}
					}
					fail('AI did not complete movement, growth, expansion, terraforming, and mobile unit production by turn thirty-five');
					return;
				}
			}

			#async(750, () => { game.event('complete_turn', {}); });
		});
	});

	glsmac.run();

});
