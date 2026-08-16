#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);
	const turn_rules = #include('../default/game/turn_rules');

	const FINAL_TURN = 20;
	let game = null;
	let ui_started = false;
	let exit_scheduled = false;
	let last_turn = 0;
	let stall_ticks = 0;

	const fail = (message) => {
		#print('DIPLOMACY_GC_STRESS_FAIL: ' + message);
		exit_scheduled = true;
		glsmac.exit();
	};

	const complete_human_turn = () => {
		if (!ui_started || exit_scheduled || game.is_game_over()) {
			return !exit_scheduled;
		}
		const player_id = game.get_player().id;
		if (
			!game.is_turn_complete(player_id) &&
			!turn_rules.has_pending_owned_animation(game, player_id)
		) {
			game.event('complete_turn', {});
		}
		return true;
	};

	const monitor_progress = () => {
		if (!ui_started || exit_scheduled || game.is_game_over()) {
			return !exit_scheduled;
		}
		const turn = game.get_turn();
		if (turn != last_turn) {
			last_turn = turn;
			stall_ticks = 0;
			return true;
		}
		stall_ticks++;
		if (stall_ticks >= 600) {
			fail('turn ' + #to_string(turn) + ' made no progress for 60 seconds');
			return false;
		}
		return true;
	};

	glsmac.on('configure_game', (e) => {
		game = e.game;
		game.get_settings().global.rules.random_events = false;
		game.set('f_ui_should_auto_open_diplomacy', () => { return false; });
		game.register_event('diplomacy_gc_stress_setup', {
			validate: (e) => {
				if (e.caller != 0) {
					return 'Only the local commander may prepare the diplomacy stress test';
				}
			},
			apply: (e) => {
				const players = e.game.get_players();
				for (let i = 0; i < #sizeof(players); i++) {
					for (let j = i + 1; j < #sizeof(players); j++) {
						players[i].set_contact(players[j], true);
						players[j].set_contact(players[i], true);
						players[i].set_diplomatic_relation(players[j], 'pact');
						players[j].set_diplomatic_relation(players[i], 'pact');
					}
				}
			},
			rollback: (e) => {},
		});

		game.on('start_ui', (e) => {
			if (game.get_settings().global.map.native_lifeforms != 0.0) {
				fail('native lifeforms are enabled in the diplomacy stress test');
				return;
			}
			game.event('diplomacy_gc_stress_setup', {});
			let setup_wait_ticks = 0;
			#async(50, () => {
				const players = game.get_players();
				if (#sizeof(players) != 7) {
					fail('expected seven players, got ' + #to_string(#sizeof(players)));
					return false;
				}
				for (let i = 0; i < #sizeof(players); i++) {
					for (let j = i + 1; j < #sizeof(players); j++) {
						if (
							!players[i].has_contact(players[j]) ||
							!players[j].has_contact(players[i]) ||
							players[i].get_diplomatic_relation(players[j]) != 'pact' ||
							players[j].get_diplomatic_relation(players[i]) != 'pact'
						) {
							setup_wait_ticks++;
							if (setup_wait_ticks >= 100) {
								fail('could not establish the all-contact pact fixture');
								return false;
							}
							return true;
						}
					}
				}
				ui_started = true;
				last_turn = game.get_turn();
				#async(100, monitor_progress);
				#async(250, complete_human_turn);
				return false;
			});
		});

		game.on('turn', (e) => {
			if (!ui_started || exit_scheduled) {
				return;
			}
			const turn = e.year - 2100;
			if (turn >= FINAL_TURN) {
				exit_scheduled = true;
				#print(
					'DIPLOMACY_GC_STRESS_PASS: completed ' + #to_string(turn) +
					' turns with all seven factions in mutual pacts'
				);
				#async(100, () => { glsmac.exit(); });
			}
		});
	});

	glsmac.run();

});
