#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let lobby_timer_started = false;
	let map_size_requested = false;
	let ready_requested = false;
	let game_configured = false;
	let exit_scheduled = false;
	let accepted_event_count = 0;
	let rejected_event_count = 0;
	let client_event_probe_complete = false;
	let client_worker_probe_complete = false;
	let client_movement_probe_complete = false;
	let client_combat_probe_complete = false;
	let client_immediate_combat_probe_complete = false;
	let client_movement_unit_id = 0;
	let client_movement_target_x = 0;
	let client_movement_target_y = 0;
	let client_combat_target_x = 0;
	let client_combat_target_y = 0;
	let combat_defender_id = 0;
	let combat_defender_spawn_requested = false;

	glsmac.on('configure_state', (e) => {
		if (lobby_timer_started) {
			return;
		}
		lobby_timer_started = true;

		#async(100, () => {
			const game = glsmac.game;
			const players = game.get_players();
			if (#sizeof(players) != 2) {
				return true;
			}

			const map = game.get_settings().global.map;
			if (game.is_master() && !map_size_requested) {
				map_size_requested = true;
				game.event('game_settings', {
					changes: [
						['planet_size', '20x10'],
					],
				});
			}
			if (map.size_x != 20 || map.size_y != 10) {
				return true;
			}

			const me = game.get_player();
			if (!me.is_ready()) {
				if (!ready_requested) {
					ready_requested = true;
					#print('MULTIPLAYER_SMOKE_READY_REQUESTED');
					game.event('ready_or_not', {
						ready: true,
					});
				}
			}
			else {
				ready_requested = false;
			}
			return !game_configured;
		});
	});

	glsmac.on('configure_game', (e) => {
		game_configured = true;
		const game = e.game;
		const role = game.is_master() ? 'HOST' : 'CLIENT';
		let handled_turns = {};
		#print('MULTIPLAYER_SMOKE_CONFIGURE_' + role);

		const find_base_for_player = (player_id) => {
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == player_id) {
					return base;
				}
			}
			return null;
		};

		const get_client_player_id = () => {
			return game.is_master() ? 1 : game.get_player().id;
		};

		const find_starting_unit = (player_id) => {
			const base = find_base_for_player(player_id);
			if (base == null) {
				return null;
			}
			for (unit of base.get_tile().get_units()) {
				if (unit.owner == player_id) {
					return unit;
				}
			}
			return null;
		};

		const find_movement_target = (unit) => {
			const source = unit.get_tile();
			const candidates = [
				source.get_N(),
				source.get_NE(),
				source.get_E(),
				source.get_SE(),
				source.get_S(),
				source.get_SW(),
				source.get_W(),
				source.get_NW(),
			];
			for (tile of candidates) {
				if (tile == source) {
					continue;
				}
				if (tile.is_locked()) {
					continue;
				}
				if (unit.is_land && tile.is_water) {
					continue;
				}
				if (unit.is_water && tile.is_land) {
					continue;
				}
				let has_foreign_unit = false;
				for (other of tile.get_units()) {
					if (other.owner != unit.owner) {
						has_foreign_unit = true;
						break;
					}
				}
				if (!has_foreign_unit) {
					return tile;
				}
			}
			return null;
		};

		const find_combat_target = (unit, source, movement_target) => {
			let first_empty_tile = null;
			const candidates = [
				movement_target.get_N(),
				movement_target.get_NE(),
				movement_target.get_E(),
				movement_target.get_SE(),
				movement_target.get_S(),
				movement_target.get_SW(),
				movement_target.get_W(),
				movement_target.get_NW(),
			];
			for (tile of candidates) {
				if (tile == source || tile == movement_target || tile.is_locked()) {
					continue;
				}
				if (unit.is_land && tile.is_water) {
					continue;
				}
				if (unit.is_water && tile.is_land) {
					continue;
				}
				const occupants = tile.get_units();
				for (occupant of occupants) {
					if (occupant.owner != unit.owner) {
						return tile;
					}
				}
				if (#sizeof(occupants) == 0 && first_empty_tile == null) {
					first_empty_tile = tile;
				}
			}
			return first_empty_tile;
		};

		const prepare_client_movement_probe = () => {
			if (client_movement_unit_id != 0) {
				return true;
			}
			const unit = find_starting_unit(get_client_player_id());
			if (unit == null) {
				return false;
			}
			const target = find_movement_target(unit);
			if (target == null) {
				return false;
			}
			const combat_target = find_combat_target(unit, unit.get_tile(), target);
			if (combat_target == null) {
				return false;
			}
			client_movement_unit_id = unit.id;
			client_movement_target_x = target.x;
			client_movement_target_y = target.y;
			client_combat_target_x = combat_target.x;
			client_combat_target_y = combat_target.y;
			return true;
		};

		const find_combat_defender = () => {
			if (combat_defender_id != 0) {
				if (game.get_um().has_unit(combat_defender_id)) {
					return game.get_um().get_unit(combat_defender_id);
				}
				return null;
			}
			const target = game.get_tm().get_tile(
				client_combat_target_x,
				client_combat_target_y
			);
			for (unit of target.get_units()) {
				if (unit.owner != get_client_player_id()) {
					combat_defender_id = unit.id;
					return unit;
				}
			}
			return null;
		};

		const spawn_combat_defender = () => {
			if (combat_defender_spawn_requested) {
				return true;
			}
			if (!prepare_client_movement_probe()) {
				return false;
			}
			const attacker = game.get_um().get_unit(client_movement_unit_id);
			game.event('multiplayer_smoke_set_unit_movement', {
				unit: attacker,
				movement: 3.0,
			});
			game.event('spawn_unit', {
				owner: game.get_player(0),
				tile: game.get_tm().get_tile(
					client_combat_target_x,
					client_combat_target_y
				),
				type: attacker.def,
				health: 0.1,
				morale: 0,
			});
			combat_defender_spawn_requested = true;
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				return find_combat_defender() == null && wait_ticks < 100;
			});
			return true;
		};

		game.register_event('multiplayer_smoke_accept_once', {
			validate: (e) => {
				if (e.caller == 0) {
					return 'Probe must be submitted by a client';
				}
			},
			apply: (e) => {
				const previous = accepted_event_count;
				accepted_event_count++;
				return {previous: previous};
			},
			rollback: (e) => {
				accepted_event_count = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_reject_and_rollback', {
			validate: (e) => {
				if (e.caller == 0) {
					return 'Probe must be submitted by a client';
				}
				if (e.game.is_master()) {
					return 'Intentional server rejection for rollback coverage';
				}
			},
			apply: (e) => {
				const previous = rejected_event_count;
				rejected_event_count++;
				return {previous: previous};
			},
			rollback: (e) => {
				rejected_event_count = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_set_unit_movement', {
			validate: (e) => {
				if (e.caller != 0) {
					return 'Only the host can prepare movement coverage';
				}
			},
			apply: (e) => {
				const previous = e.data.unit.movement;
				e.data.unit.movement = e.data.movement;
				return {previous: previous};
			},
			rollback: (e) => {
				e.data.unit.movement = e.applied.previous;
			},
		});

		const run_client_combat_probe = () => {
			let phase = 'wait_for_defender';
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (phase == 'wait_for_defender') {
					const attacker = game.get_um().get_unit(client_movement_unit_id);
					const defender = find_combat_defender();
					if (defender != null) {
						game.event('attack_unit', {
							attacker: attacker,
							defender: defender,
						});
						phase = 'wait_for_combat_apply';
					}
				}
				else if (phase == 'wait_for_combat_apply') {
					if (
						!game.get_um().has_unit(client_movement_unit_id) ||
						!game.get_um().has_unit(combat_defender_id)
					) {
						client_immediate_combat_probe_complete = true;
						client_combat_probe_complete = true;
						#print('MULTIPLAYER_SMOKE_IMMEDIATE_COMBAT_PASS_CLIENT');
						#print('MULTIPLAYER_SMOKE_COMBAT_PASS_CLIENT');
						game.event('complete_turn', {});
						return false;
					}
					const attacker = game.get_um().get_unit(client_movement_unit_id);
					const defender = game.get_um().get_unit(combat_defender_id);
					if (attacker.movement == 0.0) {
						if (attacker.health > 0.0 && defender.health > 0.0) {
							#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: combat state waited for animation completion');
							glsmac.exit();
							return false;
						}
						client_immediate_combat_probe_complete = true;
						#print('MULTIPLAYER_SMOKE_IMMEDIATE_COMBAT_PASS_CLIENT');
						phase = 'combat';
					}
				}
				else if (
					!game.get_um().has_unit(client_movement_unit_id) ||
					!game.get_um().has_unit(combat_defender_id)
				) {
					client_combat_probe_complete = true;
					#print('MULTIPLAYER_SMOKE_COMBAT_PASS_CLIENT');
					game.event('complete_turn', {});
					return false;
				}
				if (wait_ticks >= 200) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: combat probe timed out in ' + phase);
					glsmac.exit();
					return false;
				}
				return true;
			});
			return true;
		};

		const run_client_movement_probe = () => {
			if (!prepare_client_movement_probe()) {
				return false;
			}
			const unit = game.get_um().get_unit(client_movement_unit_id);
			const target = game.get_tm().get_tile(
				client_movement_target_x,
				client_movement_target_y
			);

			let phase = 'wait_for_movement';
			let movement_before = 0.0;
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (phase == 'wait_for_movement' && unit.movement >= 3.0) {
					movement_before = unit.movement;
					game.event('move_unit', {
						unit: unit,
						tile: target,
					});
					phase = 'movement';
				}
				else if (phase == 'movement' && unit.get_tile() == target) {
					if (!unit.moved_this_turn || unit.movement >= movement_before) {
						#print(
							'MULTIPLAYER_SMOKE_FAIL_CLIENT: movement state was not consumed (' +
							#to_string(movement_before) + ' -> ' + #to_string(unit.movement) +
							', moved=' + #to_string(unit.moved_this_turn) + ')'
						);
						glsmac.exit();
						return false;
					}
					client_movement_probe_complete = true;
					#print('MULTIPLAYER_SMOKE_MOVEMENT_PASS_CLIENT');
					if (!run_client_combat_probe()) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: combat probe could not start');
						glsmac.exit();
					}
					return false;
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: movement probe timed out in ' + phase);
					glsmac.exit();
					return false;
				}
				return true;
			});
			return true;
		};

		const run_client_worker_probe = () => {
			const player_id = game.get_player().id;
			const base = find_base_for_player(player_id);
			if (base == null) {
				return false;
			}
			const pops = base.get_pops();
			if (#sizeof(pops) == 0) {
				return false;
			}
			const unworked_tiles = base.get_unworked_tiles();
			if (#sizeof(unworked_tiles) == 0) {
				return false;
			}

			const pop = pops[0];
			const target_tile = unworked_tiles[0];
			game.event('work_base_tile', {
				base: base,
				pop: pop,
				tile: target_tile,
			});

			let phase = 'work';
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (phase == 'work' && target_tile.has('working_pop')) {
					const working_pop = target_tile.get('working_pop');
					if (working_pop != pop || working_pop.get_base() != base) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: worker assignment is inconsistent');
						glsmac.exit();
						return false;
					}
					phase = 'unwork';
					game.event('unwork_base_tile', {
						base: base,
						tile: target_tile,
					});
				}
				else if (phase == 'unwork' && !target_tile.has('working_pop')) {
					if (#sizeof(base.get_worked_tiles()) != 0 || pop.get_type() != 'DOCTOR') {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: worker unassignment is inconsistent');
						glsmac.exit();
						return false;
					}
					client_worker_probe_complete = true;
					#print('MULTIPLAYER_SMOKE_WORKER_REASSIGN_PASS_CLIENT');
					if (!run_client_movement_probe()) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: movement probe could not start');
						glsmac.exit();
					}
					return false;
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: worker probe timed out in ' + phase);
					glsmac.exit();
					return false;
				}
				return true;
			});
			return true;
		};

		let handle_turn = (turn_id) => {
			const turn_key = #to_string(turn_id);
			if (#is_defined(handled_turns[turn_key])) {
				return;
			}
			handled_turns[turn_key] = true;
			#print('MULTIPLAYER_SMOKE_TURN_' + role + ': ' + #to_string(turn_id));
			const players = game.get_players();
			const bases = game.get_bm().get_bases();
			if (
				#sizeof(players) != 2 ||
				#sizeof(bases) < 2 ||
				!game.get_um().has_unit(1)
			) {
				#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': synchronized game state is incomplete');
				glsmac.exit();
				return;
			}
			if (!prepare_client_movement_probe()) {
				#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': client movement probe could not be prepared');
				glsmac.exit();
				return;
			}

			if (turn_id == 1) {
				#print('MULTIPLAYER_SMOKE_' + role + ': synchronized turn 1');
				if (game.is_master()) {
					if (!spawn_combat_defender()) {
						#print('MULTIPLAYER_SMOKE_FAIL_HOST: combat defender could not be spawned');
						glsmac.exit();
						return;
					}
					game.event('complete_turn', {});
				}
				else {
					game.event('multiplayer_smoke_accept_once', {});
					game.event('multiplayer_smoke_reject_and_rollback', {});
					let wait_ticks = 0;
					#async(100, () => {
						wait_ticks++;
						if (accepted_event_count == 1 && rejected_event_count == 0) {
							if (!client_event_probe_complete) {
								client_event_probe_complete = true;
								#print('MULTIPLAYER_SMOKE_EVENT_RESPONSE_PASS_CLIENT');
							}
							if (run_client_worker_probe()) {
								return false;
							}
						}
						if (accepted_event_count > 1 || wait_ticks >= 100) {
							#print(
								'MULTIPLAYER_SMOKE_FAIL_CLIENT: event response counts are ' +
								#to_string(accepted_event_count) + '/' +
								#to_string(rejected_event_count)
							);
							glsmac.exit();
							return false;
						}
						return true;
					});
				}
			}
			else if (turn_id == 2 && !exit_scheduled) {
				const client_player_id = get_client_player_id();
				const client_base = find_base_for_player(client_player_id);
				let client_unit = null;
				if (game.get_um().has_unit(client_movement_unit_id)) {
					client_unit = game.get_um().get_unit(client_movement_unit_id);
				}
				let combat_defender = null;
				if (combat_defender_id != 0 && game.get_um().has_unit(combat_defender_id)) {
					combat_defender = game.get_um().get_unit(combat_defender_id);
				}
				let client_unit_invalid = false;
				if (client_unit != null) {
					client_unit_invalid =
						client_unit.owner != client_player_id ||
						client_unit.get_tile().x != client_movement_target_x ||
						client_unit.get_tile().y != client_movement_target_y;
				}
				let combat_defender_invalid = false;
				if (combat_defender != null) {
					combat_defender_invalid =
						combat_defender.owner == client_player_id ||
						combat_defender.get_tile().x != client_combat_target_x ||
						combat_defender.get_tile().y != client_combat_target_y;
				}
				if (
					accepted_event_count != 1 ||
					rejected_event_count != 0 ||
					(!game.is_master() && !client_event_probe_complete) ||
					(!game.is_master() && !client_worker_probe_complete) ||
					(!game.is_master() && !client_movement_probe_complete) ||
					(!game.is_master() && !client_immediate_combat_probe_complete) ||
					(!game.is_master() && !client_combat_probe_complete) ||
					client_base == null ||
					#sizeof(client_base.get_worked_tiles()) != 0 ||
					combat_defender_id == 0 ||
					(client_unit != null && combat_defender != null) ||
					client_unit_invalid ||
					combat_defender_invalid
				) {
					#print(
						'MULTIPLAYER_SMOKE_FAIL_' + role + ': event response state is ' +
						#to_string(accepted_event_count) + '/' +
						#to_string(rejected_event_count)
					);
					glsmac.exit();
					return;
				}
				exit_scheduled = true;
				#print('MULTIPLAYER_SMOKE_PASS_' + role + ': reached synchronized turn 2 with two players');
				#async(game.is_master() ? 2500 : 1000, () => {
					glsmac.exit();
				});
			}
		};

		game.on('start_ui', (e) => {
			#print('MULTIPLAYER_SMOKE_UI_' + role);
			if (!game.is_master() && game.get_turn() > 0) {
				handle_turn(game.get_turn());
			}
		});

		game.on('turn', (e) => {
			handle_turn(e.year - 2100);
		});
	});

	glsmac.run();

});
