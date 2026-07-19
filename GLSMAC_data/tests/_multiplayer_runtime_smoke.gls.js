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
					game.event('complete_turn', {});
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

			if (turn_id == 1) {
				#print('MULTIPLAYER_SMOKE_' + role + ': synchronized turn 1');
				if (game.is_master()) {
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
				const client_base = find_base_for_player(
					game.is_master() ? 1 : game.get_player().id
				);
				if (
					accepted_event_count != 1 ||
					rejected_event_count != 0 ||
					(!game.is_master() && !client_event_probe_complete) ||
					(!game.is_master() && !client_worker_probe_complete) ||
					client_base == null ||
					#sizeof(client_base.get_worked_tiles()) != 0
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
