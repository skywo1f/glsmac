#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let finished = false;
	let invalidated = false;
	let selected_target = '';

	const fail = (message) => {
		if (!finished) {
			finished = true;
			#print('RESEARCH_UI_RUNTIME_FAIL: ' + message);
			glsmac.exit();
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.register_event('research_ui_runtime_invalidate', {
			validate: (event) => {
				if (event.caller != event.data.player.id) {
					return 'Only the player may refresh its projected state';
				}
			},
			apply: (event) => {
				const previous = event.data.player.get_energy_credits();
				event.data.player.set_energy_credits(previous + 1);
				event.game.trigger('economy_updated', {player: event.data.player});
				return {energy_credits: previous};
			},
			rollback: (event) => {
				event.data.player.set_energy_credits(event.applied.energy_credits);
				event.game.trigger('economy_updated', {player: event.data.player});
			},
		});
		game.register_event('research_ui_runtime_discovery', {
			validate: (event) => {
				if (event.caller != event.data.player.id) {
					return 'Only the player may request its discovery presentation';
				}
			},
			apply: (event) => {
				event.game.trigger('research_selection_requested', {
					player: event.data.player,
					technology_id: 'Biogenetics',
					technology_name: 'Biogenetics',
				});
				return {};
			},
			rollback: (event) => {},
		});
		game.on('economy_updated', (event) => {
			invalidated = true;
		});
		game.set('f_ui_ready', (p) => {
			const player = game.get_player();
			let technology_count = 0;
			for (technology_id of game.get('f_technology_get_order')()) {
				const definition = game.get('f_technology_get_definition')(technology_id);
				if (definition == null || #typeof(definition.source_index) != 'Int') {
					fail('technology source index is missing: ' + technology_id);
					return;
				}
				const technology_text = glsmac.get_technology_text(definition.source_index);
				if (
					technology_text.short_description == '' ||
					technology_text.long_description == '' || technology_text.quote == '' ||
					#sizeof(technology_text.description_lines) < 2 ||
					#sizeof(technology_text.quote_lines) < 2
				) {
					fail('installed technology text did not load: ' + technology_id);
					return;
				}
				technology_count++;
			}
			if (technology_count != 77) {
				fail('installed technology text count is ' + #to_string(technology_count));
				return;
			}
			const state = player.get_research_state();
			for (target of game.get('f_technology_get_available_targets')(
				state.technologies
			)) {
				if (target != state.target && selected_target == '') {
					selected_target = target;
				}
			}
			if (selected_target == '') {
				fail('no alternate research target is available');
				return;
			}

			let discovery_requested = false;
			if (
				p.modules.popup.popup != null &&
				p.modules.popup.popup.id == 'research'
			) {
				p.modules.popup.popup_defs.research.begin_button.trigger('click');
			}
			let discovery_open_ticks = 0;
			#async(50, () => {
				if (!discovery_requested) {
					if (p.modules.popup.is_shown()) {
						return true;
					}
					discovery_requested = true;
					game.event('research_ui_runtime_discovery', {player: player});
					return true;
				}
				if (
					p.modules.popup.popup == null ||
					p.modules.popup.popup.id != 'technology_discovery'
				) {
					discovery_open_ticks++;
					if (discovery_open_ticks >= 100) {
						fail('technology discovery popup did not open');
						return false;
					}
					return true;
				}
				const discovery = p.modules.popup.popup_defs.technology_discovery;
				if (discovery.line_count < 6) {
					fail('technology discovery popup did not display its datalinks text');
					return false;
				}
				discovery.continue_button.trigger('click');

				let discovery_wait_ticks = 0;
				#async(50, () => {
					discovery_wait_ticks++;
					if (
						p.modules.popup.popup == null ||
						p.modules.popup.popup.id != 'research'
					) {
						if (discovery_wait_ticks >= 100) {
							fail('technology discovery did not hand off to the research chooser');
							return false;
						}
						return true;
					}
					const research = p.modules.popup.popup_defs.research;
					if (research.available_count < 2) {
						fail('research chooser did not expose multiple legal technologies');
						return false;
					}
					research.select_target(selected_target);
					game.event('research_ui_runtime_invalidate', {player: game.get_player()});

					let wait_ticks = 0;
					#async(50, () => {
						wait_ticks++;
						if (!invalidated) {
							if (wait_ticks >= 100) {
								fail('backend projection refresh timed out');
								return false;
							}
							return true;
						}
						research.begin_button.trigger('click');
						let target_ticks = 0;
						#async(50, () => {
							target_ticks++;
							if (
								game.get_player().get_research_state().target != selected_target ||
								p.modules.popup.popup != null
							) {
								if (target_ticks >= 100) {
									fail('live research selection did not finish');
									return false;
								}
								return true;
							}
							finished = true;
							#print('RESEARCH_UI_RUNTIME_PASS: target=' + selected_target);
							glsmac.exit();
							return false;
						});
						return false;
					});
					return false;
				});
				return false;
			});
		});
	});

	glsmac.run();

});
