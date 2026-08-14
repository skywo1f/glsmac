#main((glsmac) => {

	const runtime_started = #monotonic_ms();
	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let game = null;
	let ui_started = false;
	let exit_scheduled = false;
	let initial_council_verified = false;

	const fail = (message) => {
		if (exit_scheduled) {
			return;
		}
		exit_scheduled = true;
		#print('SMALL_MAP_STARTUP_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const verify_no_early_council = (phase) => {
		const session = game.get('f_council_get_session')();
		if (session != null) {
			fail('Planetary Council convened during ' + phase);
			return false;
		}
		for (player of game.get_players()) {
			if (player.get_council_state().proposal != '') {
				fail('Planetary Council state became active during ' + phase);
				return false;
			}
		}
		return true;
	};

	glsmac.on('configure_game', (e) => {
		game = e.game;
		#print(
			'STARTUP_PROFILE: configure_game_ms=' +
			#to_string(#monotonic_ms() - runtime_started)
		);
		game.on('create_world', (event) => {
			#print(
				'STARTUP_PROFILE: create_world_begin_ms=' +
				#to_string(#monotonic_ms() - runtime_started)
			);
		});
		game.on('start', (event) => {
			#print(
				'STARTUP_PROFILE: start_begin_ms=' +
				#to_string(#monotonic_ms() - runtime_started)
			);
		});
		game.on('configure', (event) => {
			#print(
				'STARTUP_PROFILE: configure_complete_ms=' +
				#to_string(#monotonic_ms() - runtime_started)
			);
			game.on('create_world', (world_event) => {
				#print(
					'STARTUP_PROFILE: create_world_complete_ms=' +
					#to_string(#monotonic_ms() - runtime_started)
				);
			});
			game.on('start', (start_event) => {
				#print(
					'STARTUP_PROFILE: start_callbacks_complete_ms=' +
					#to_string(#monotonic_ms() - runtime_started)
				);
			});
		});
		game.set('f_ai_profile', (sample) => {
			#print(
				'AI_PROFILE: faction=' + sample.faction_id +
				' since_start_ms=' + #to_string(#monotonic_ms() - runtime_started) +
				' total_ms=' + #to_string(sample.total_ms) +
				' setup_ms=' + #to_string(sample.setup_ms) +
				' ownership_ms=' + #to_string(sample.ownership_ms) +
				' strategy_ms=' + #to_string(sample.strategy_ms) +
				' diplomacy_ms=' + #to_string(sample.diplomacy_ms) +
				' social_ms=' + #to_string(sample.social_ms) +
				' nerve_ms=' + #to_string(sample.nerve_ms) +
				' economic_ms=' + #to_string(sample.economic_ms) +
				' production_ms=' + #to_string(sample.production_ms) +
				' action_ms=' + #to_string(sample.action_ms) +
				' steps=' + #to_string(sample.steps) +
				' actions=' + #to_string(sample.actions_started) +
				' action_waits=' + #to_string(sample.action_wait_checks) +
				' animation_waits=' + #to_string(sample.animation_wait_checks) +
				' action_state_ms=' + #to_string(sample.action_state_ms) +
				' orbital_ms=' + #to_string(sample.orbital_ms) +
				' upgrade_ms=' + #to_string(sample.upgrade_ms) +
				' artifact_ms=' + #to_string(sample.artifact_ms) +
				' supply_ms=' + #to_string(sample.supply_ms) +
				' colony_ms=' + #to_string(sample.colony_ms) +
				' probe_ms=' + #to_string(sample.probe_ms) +
				' former_ms=' + #to_string(sample.former_ms) +
				' combat_ms=' + #to_string(sample.combat_ms) +
				' completion_check_ms=' + #to_string(sample.completion_check_ms) +
				' completion_ack_ms=' + #to_string(sample.completion_ack_ms) +
				' reason=' + sample.reason
			);
		});
		game.set('f_ui_profile', (sample) => {
			#print(
				'UI_PROFILE: phase=' + sample.phase +
				' elapsed_ms=' + #to_string(sample.elapsed_ms) +
				' total_ms=' + #to_string(sample.total_ms)
			);
		});
		game.set('f_turn_profile', (sample) => {
			#print(
				'TURN_PROFILE: phase=' + sample.phase +
				' elapsed_ms=' + #to_string(sample.elapsed_ms)
			);
		});

		game.on('start_ui', (event) => {
			if (exit_scheduled) {
				return;
			}
			ui_started = true;
			#async(0, () => {
				game.on('turn', (turn_event) => {
					#print(
						'TURN_CALLBACKS_COMPLETE: year=' + #to_string(turn_event.year) +
						' since_start_ms=' + #to_string(#monotonic_ms() - runtime_started)
					);
				});
			});
			const player = game.get_player();
			if (player.get_faction().id != 'GAIANS') {
				fail('requested Gaians faction was not assigned');
				return;
			}
			if (game.get_tm().get_map_width() != 88 || game.get_tm().get_map_height() != 44) {
				fail('small map dimensions were not preserved');
				return;
			}

			let ai_count = 0;
			let human_base_count = 0;
			let seen_factions = {};
			for (candidate of game.get_players()) {
				if (#is_defined(seen_factions[candidate.get_faction().id])) {
					fail('duplicate playable faction was assigned');
					return;
				}
				seen_factions[candidate.get_faction().id] = true;
				if (candidate.type == 'ai') {
					ai_count++;
				}
			}
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == player.id) {
					human_base_count++;
				}
			}
			if (#sizeof(game.get_players()) != 7 || ai_count != 6 || human_base_count != 1) {
				fail('seven-player starting roster or human base is invalid');
				return;
			}
			if (!verify_no_early_council('initial mission year')) {
				return;
			}
			initial_council_verified = true;
			for (crossfire_id of [
				'CONSCIOUSNESS', 'PIRATES', 'DRONES', 'ANGELS',
				'PLANETCULT', 'CARETAKERS', 'USURPERS'
			]) {
				if (#is_defined(seen_factions[crossfire_id])) {
					fail('unsupported Crossfire faction was assigned: ' + crossfire_id);
					return;
				}
			}

			#print(
				'SMALL_MAP_STARTUP_RUNTIME_READY: startup_ms=' +
				#to_string(#monotonic_ms() - runtime_started)
			);
			#async(3000, () => {
				if (!exit_scheduled && !game.is_turn_complete(player.id)) {
					game.event('complete_turn', {});
				}
			});
		});

		game.on('turn', (event) => {
			if (!ui_started || exit_scheduled || event.year - 2100 < 2) {
				return;
			}
			if (!initial_council_verified || !verify_no_early_council('first completed turn')) {
				return;
			}
			exit_scheduled = true;
			#print('SMALL_MAP_STARTUP_RUNTIME_PASS');
			#async(500, () => { glsmac.exit(); });
		});
	});

	glsmac.run();

});
