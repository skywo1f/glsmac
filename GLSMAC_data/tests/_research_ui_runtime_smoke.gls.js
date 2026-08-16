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
		game.on('economy_updated', (event) => {
			invalidated = true;
		});
		game.set('f_ui_ready', (p) => {
			const player = game.get_player();
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

			p.modules.popup.show('research');
			const research = p.modules.popup.popup_defs.research;
			if (research.available_count < 2) {
				fail('research chooser did not expose multiple legal technologies');
				return;
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
					if (game.get_player().get_research_state().target != selected_target) {
						if (target_ticks >= 100) {
							fail('live Begin Research click did not set the selected target');
							return false;
						}
						return true;
					}
					if (p.modules.popup.popup != null) {
						fail('research popup stayed open after selecting a target');
						return false;
					}
					finished = true;
					#print('RESEARCH_UI_RUNTIME_PASS: target=' + selected_target);
					glsmac.exit();
					return false;
				});
				return false;
			});
		});
	});

	glsmac.run();

});
