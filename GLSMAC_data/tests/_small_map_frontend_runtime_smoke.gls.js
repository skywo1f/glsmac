#main((glsmac) => {

	let base_screen_completions = 0;
	let base_screen_total_ms = 0;
	let ui_state = null;
	const hurry_test_credits = 1000;

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	const fail = (message) => {
		#print('SMALL_MAP_FRONTEND_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.set('f_ui_ready', (state) => {
			ui_state = state;
		});
		game.register_event('frontend_runtime_seed_energy', {
			validate: (event) => {},
			apply: (event) => {
				const previous = event.data.player.energy_credits;
				event.data.player.set_energy_credits(event.data.energy_credits);
				event.game.trigger('economy_updated', {player: event.data.player});
				return {energy_credits: previous};
			},
			rollback: (event) => {
				event.data.player.set_energy_credits(event.applied.energy_credits);
				event.game.trigger('economy_updated', {player: event.data.player});
			},
		});
		game.set('f_base_screen_profile', (sample) => {
			#print(
				'BASE_SCREEN_PROFILE: phase=' + sample.phase +
				' elapsed_ms=' + #to_string(sample.elapsed_ms) +
				' total_ms=' + #to_string(sample.total_ms)
			);
			if (sample.phase == 'bottom_bar') {
				base_screen_completions++;
				base_screen_total_ms = sample.total_ms;
			}
		});
		game.on('start_ui', (event) => {
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
			let human_base = null;
			for (candidate of game.get_players()) {
				if (candidate.type == 'ai') {
					ai_count++;
				}
			}
			if (#sizeof(game.get_players()) != 7 || ai_count != 6) {
				fail('seven-player starting roster is invalid');
				return;
			}
			for (base of game.get_bm().get_bases()) {
				if (base.get_size() != 1) {
					fail('starting bases must begin at population one');
					return;
				}
				if (base.get_owner().id == player.id) {
					human_base = base;
				}
			}
			if (human_base == null) {
				fail('human starting base was not found');
				return;
			}
			const human_base_id = human_base.id;
			const get_live_base = () => {
				for (candidate of game.get_bm().get_bases()) {
					if (candidate.id == human_base_id) {
						return candidate;
					}
				}
				return null;
			};
			let base_screen_started = 0;
			let base_screen_wait_ticks = 0;
			let first_base_screen_set_ms = 0;
			let first_base_screen_observed_ms = 0;
			let refresh_started = 0;
			let refresh_observed_ms = 0;
			let hurry_funding = 0;
			let hurry_cost = 0;
			let hurry_production_cost = 0;
			let hurry_refresh_target = 0;
			let hurry_update_target = 0;
			let hurry_clicked_at = 0;
			let hurry_production_requested = false;
			#async(50, () => {
				base_screen_wait_ticks++;
				const live_base = get_live_base();
				if (live_base == null) {
					fail('human starting base disappeared during the UI scenario');
					return false;
				}
				if (base_screen_started == 0) {
					if (ui_state == null) {
						if (base_screen_wait_ticks >= 100) {
							fail('UI did not finish initializing before base-screen test');
							return false;
						}
						return true;
					}
					base_screen_wait_ticks = 0;
					base_screen_started = #monotonic_ms();
					game.select_base(live_base);
					return true;
				}
				if (base_screen_completions == 0) {
					if (base_screen_wait_ticks >= 100) {
						fail('base screen did not finish opening');
						return false;
					}
					return true;
				}
				if (refresh_started == 0) {
					first_base_screen_set_ms = base_screen_total_ms;
					first_base_screen_observed_ms = #monotonic_ms() - base_screen_started;
					refresh_started = #monotonic_ms();
					game.select_base(human_base);
					return true;
				}
				if (base_screen_completions < 2) {
					if (base_screen_wait_ticks >= 200) {
						fail('base screen did not finish refreshing');
						return false;
					}
					return true;
				}
				if (refresh_observed_ms == 0) {
					refresh_observed_ms = #monotonic_ms() - refresh_started;
				}
				if (ui_state == null) {
					if (base_screen_wait_ticks >= 200) {
						fail('UI state was not exposed after initialization');
						return false;
					}
					return true;
				}
				if (hurry_funding == 0) {
					const production = live_base.get_production();
					if (!#is_defined(production)) {
						fail('human starting base has no production to hurry');
						return false;
					}
					if (production.id != 'ColonyPod') {
						if (!hurry_production_requested) {
							hurry_production_requested = true;
							game.event('set_base_production', {
								base: live_base,
								kind: 'unit',
								id: 'ColonyPod',
							});
						}
						if (base_screen_wait_ticks >= 250) {
							fail('human base did not switch to hurryable production');
							return false;
						}
						return true;
					}
					hurry_cost = game.get('f_economy_get_hurry_cost')(live_base);
					if (hurry_cost <= 0) {
						fail('human starting production is already complete');
						return false;
					}
					hurry_production_cost = game.get('f_base_get_production_cost')(
						live_base,
						production
					);
					hurry_funding = hurry_test_credits;
					game.event('frontend_runtime_seed_energy', {
						player: game.get_player(),
						energy_credits: hurry_funding,
					});
					return true;
				}
				if (hurry_refresh_target == 0) {
					if (game.get_player().energy_credits != hurry_funding) {
						if (base_screen_wait_ticks >= 300) {
							fail('hurry-production funding was not applied');
							return false;
						}
						return true;
					}
					hurry_refresh_target = base_screen_completions + 1;
					game.select_base(live_base);
					return true;
				}
				if (hurry_clicked_at == 0) {
					if (base_screen_completions < hurry_refresh_target) {
						if (base_screen_wait_ticks >= 350) {
							fail('funded base screen did not finish refreshing');
							return false;
						}
						return true;
					}
					const base_screen = ui_state.modules.popup.popup_defs.base_screen;
					const hurry_button = base_screen.sections.buttons.btn_hurry;
					if (hurry_button.text != 'HURRY (' + #to_string(hurry_cost) + ')') {
						fail('live Hurry button did not show its authoritative cost');
						return false;
					}
					hurry_update_target = base_screen_completions + 1;
					hurry_clicked_at = #monotonic_ms();
					hurry_button.trigger('click');
					hurry_button.trigger('click');
					return true;
				}
				if (
					game.get_player().energy_credits != hurry_funding - hurry_cost ||
					live_base.get_accumulated_minerals() != hurry_production_cost ||
					base_screen_completions < hurry_update_target
				) {
					if (base_screen_wait_ticks >= 400) {
						fail('live Hurry click did not finish its authoritative base refresh');
						return false;
					}
					return true;
				}
				if (
					ui_state.modules.popup.popup == null ||
					ui_state.modules.popup.popup.id != 'base_screen'
				) {
					fail('base screen closed while applying live Hurry production');
					return false;
				}
				#print(
					'SMALL_MAP_FRONTEND_RUNTIME_PASS: first_set_ms=' +
					#to_string(first_base_screen_set_ms) + ' first_observed_ms=' +
					#to_string(first_base_screen_observed_ms) + ' refresh_set_ms=' +
					#to_string(base_screen_total_ms) + ' refresh_observed_ms=' +
					#to_string(refresh_observed_ms) + ' hurry_ms=' +
					#to_string(#monotonic_ms() - hurry_clicked_at)
				);
				glsmac.exit();
				return false;
			});
		});
	});

	glsmac.run();

});
