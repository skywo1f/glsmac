#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	const energy_stamp = 4321;
	const nutrient_stamp = 37;
	const mineral_stamp = 23;
	let loading_quicksave = false;
	let mutation_requested = false;
	let resume_turn_requested = false;
	let resume_save_requested = false;
	let exit_scheduled = false;

	const fail = (message) => {
		#print('SAVE_LOAD_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const find_local_base = (game) => {
		for (base of game.get_bm().get_bases()) {
			if (base.get_owner().id == game.get_player().id) {
				return base;
			}
		}
		return null;
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		game.register_event('save_load_runtime_stamp', {
			validate: (e) => {
				if (e.caller != 0) {
					return 'Only the local commander can stamp the quicksave fixture';
				}
			},
			apply: (e) => {
				const player = e.game.get_player(e.caller);
				let base = null;
				for (candidate of e.game.get_bm().get_bases()) {
					if (candidate.get_owner().id == player.id) {
						base = candidate;
						break;
					}
				}
				if (base == null) {
					throw Error('Local base is missing');
				}
				const previous = {
					energy: player.energy_credits,
					nutrients: base.get('accumulated_nutrients'),
					minerals: base.get_accumulated_minerals(),
				};
				player.set_energy_credits(energy_stamp);
				base.set('accumulated_nutrients', nutrient_stamp);
				base.set_accumulated_minerals(mineral_stamp);
				base.set('network_node_artifact_linked', true);
				return previous;
			},
			rollback: (e) => {
				const player = e.game.get_player(e.caller);
				const base = find_local_base(e.game);
				player.set_energy_credits(e.applied.energy);
				base.set('accumulated_nutrients', e.applied.nutrients);
				base.set_accumulated_minerals(e.applied.minerals);
				base.set('network_node_artifact_linked', false);
			},
		});

		const verify_state = (expected_turn, expected_energy, expected_nutrients, expected_minerals) => {
			const base = find_local_base(game);
			if (base == null) {
				return 'local base is missing';
			}
			if (game.get_player().get_faction().id != 'GAIANS') {
				return 'explicit single-player faction was not preserved';
			}
			if (game.get_turn() != expected_turn) {
				return 'turn was not restored';
			}
			if (#sizeof(game.get_players()) != 2) {
				return 'player roster was not restored';
			}
			if (game.get_tm().get_map_width() != 20 || game.get_tm().get_map_height() != 10) {
				return 'map dimensions were not restored';
			}
			if (expected_energy != null && game.get_player().energy_credits != expected_energy) {
				return 'player economy was not restored (expected ' + #to_string(expected_energy) +
					', got ' + #to_string(game.get_player().energy_credits) + ')';
			}
			if (
				(expected_nutrients != null && base.get('accumulated_nutrients') != expected_nutrients) ||
				(expected_minerals != null && base.get_accumulated_minerals() != expected_minerals) ||
				!base.get('network_node_artifact_linked')
			) {
				return 'base state was not restored';
			}
			return '';
		};

		game.on('turn', (e) => {
			const turn_id = e.year - 2100;
			if (!loading_quicksave || turn_id != 2 || resume_save_requested || exit_scheduled) {
				return;
			}
			resume_save_requested = true;
			#async(500, () => {
				const error = verify_state(2, null, null, null);
				if (error != '') {
					fail(error);
					return;
				}
				try {
					glsmac.save_game();
				} catch {
					: (save_error) => {
						fail(save_error.message);
					}
				}
				#print('SAVE_LOAD_RUNTIME_RESUME_PASS');
				exit_scheduled = true;
				#async(0, () => { glsmac.exit(); });
			});
		});

		game.on('start_ui', (e) => {
			if (exit_scheduled) {
				return;
			}
			if (loading_quicksave) {
				const expected_turn = game.get_turn();
				const error = expected_turn == 1
					? verify_state(1, energy_stamp, nutrient_stamp, mineral_stamp)
					: verify_state(2, null, null, null);
				if (error != '') {
					fail(error);
					return;
				}
				if (expected_turn == 1) {
					resume_turn_requested = true;
					#async(50, () => {
						game.event('complete_turn', {});
					});
					let ticks = 0;
					#async(100, () => {
						ticks++;
						if (game.get_turn() >= 2 || exit_scheduled) {
							return false;
						}
						if (ticks >= 200) {
							fail('restored game did not advance to turn two');
							return false;
						}
						return resume_turn_requested;
					});
				}
				else if (expected_turn == 2) {
					#print('SAVE_LOAD_RUNTIME_LOAD_PASS');
					#print('SAVE_LOAD_RUNTIME_RANDOM_' + #to_string(game.random.get_int(0, 1000000)));
					exit_scheduled = true;
					#async(0, () => { glsmac.exit(); });
				}
				else {
					fail('saved game restored an unexpected turn');
				}
				return;
			}

			game.event('save_load_runtime_stamp', {});
			mutation_requested = true;
			let ticks = 0;
			#async(10, () => {
				ticks++;
				const error = verify_state(1, energy_stamp, nutrient_stamp, mineral_stamp);
				if (error == '') {
					let save_failed = false;
					try {
						glsmac.save_game();
					} catch {
						: (e) => {
							save_failed = true;
							fail(e.message);
						}
					}
					if (save_failed) {
						return false;
					}
					if (!glsmac.has_quicksave()) {
						fail('quicksave file was not created');
						return false;
					}
					#print('SAVE_LOAD_RUNTIME_SAVE_PASS');
					exit_scheduled = true;
					#async(0, () => { glsmac.exit(); });
					return false;
				}
				if (ticks >= 200) {
					fail(error);
					return false;
				}
				return mutation_requested;
			});
		});
	});

	glsmac.on('mainmenu_show', (e) => {
		loading_quicksave = glsmac.has_quicksave();
		try {
			glsmac.init();
			e.settings.local.game_mode = 'single';
			if (loading_quicksave) {
				glsmac.load_game();
			}
			else {
				e.settings.global.map.size_x = 20;
				e.settings.global.map.size_y = 10;
				e.settings.global.map.native_lifeforms = 0.0;
				glsmac.add_single_player('GAIANS');
				glsmac.add_ai_player();
				glsmac.start_game();
			}
		} catch {
			: (e) => {
				fail(e.message);
			}
		}
	});

	glsmac.run();

});
