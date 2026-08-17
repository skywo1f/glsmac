#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);
	const turn_rules = #include('../default/game/turn_rules');

	let finished = false;
	const fail = (message) => {
		if (!finished) {
			finished = true;
			#print('SDL_INPUT_RUNTIME_FAIL: ' + message);
			glsmac.exit();
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.set('f_ui_ready', (p) => {
			let phase = 'close_research';
			let phase_ticks = 0;
			let key_invoked = false;
			let enter_invoked = false;
			let original_start_goto = null;
			let original_request_turn_action = null;
			let original_bottom_bar_request_turn_action = null;
			let mouse_down = null;
			let mouse_up = null;
			let mouse_down_handler = 0;
			let mouse_up_handler = 0;

			#async(50, () => {
				if (finished) {
					return false;
				}
				phase_ticks++;
				if (phase_ticks >= 200) {
					fail('timed out in phase ' + phase);
					return false;
				}

				if (phase == 'close_research') {
					if (
						p.modules.popup.popup != null &&
						p.modules.popup.popup.id == 'research'
					) {
						p.modules.popup.popup_defs.research.begin_button.trigger('click');
						return true;
					}
					let unit = null;
					for (candidate of game.get_um().get_units()) {
						if (
							candidate.owner == game.get_player().id &&
							candidate.transport_id == 0 && candidate.movement > 0.0
						) {
							unit = candidate;
							break;
						}
					}
					if (unit == null) {
						fail('no active human unit was available');
						return false;
					}
					game.select_unit(unit);
					phase = 'select_unit';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'select_unit') {
					const preview = p.modules.bottom_bar.pp.sections.object_preview;
					if (preview.action_unit == null) {
						return true;
					}
					original_start_goto = preview.start_goto;
					preview.start_goto = () => {
						key_invoked = true;
						return true;
					};
					glsmac.test_push_key_event('G', true);
					glsmac.test_push_key_event('G', false);
					phase = 'key';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'key') {
					if (
						!key_invoked ||
						turn_rules.has_pending_owned_animation(game, game.get_player().id)
					) {
						return true;
					}
					p.modules.bottom_bar.pp.sections.object_preview.start_goto = original_start_goto;
					original_request_turn_action = p.request_turn_action;
					const bottom_bar = p.modules.bottom_bar.pp;
					original_bottom_bar_request_turn_action = bottom_bar.request_turn_action;
					const request_turn_action = () => {
						enter_invoked = true;
						return true;
					};
					p.request_turn_action = request_turn_action;
					bottom_bar.request_turn_action = request_turn_action;
					glsmac.test_push_key_event('Return', true);
					glsmac.test_push_key_event('Return', false);
					phase = 'enter';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'enter') {
					if (!enter_invoked) {
						return true;
					}
					p.request_turn_action = original_request_turn_action;
					p.modules.bottom_bar.pp.request_turn_action = original_bottom_bar_request_turn_action;
					mouse_down_handler = p.root.on('mousedown', (event) => {
						mouse_down = event;
						return true;
					});
					mouse_up_handler = p.root.on('mouseup', (event) => {
						mouse_up = event;
						return true;
					});
					glsmac.test_push_mouse_button_event(321, 234, 'left', true);
					glsmac.test_push_mouse_button_event(337, 246, 'left', false);
					phase = 'mouse';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'mouse') {
					if (mouse_down == null || mouse_up == null) {
						return true;
					}
					p.root.off('mousedown', mouse_down_handler);
					p.root.off('mouseup', mouse_up_handler);
					if (
						mouse_down.ax != 321 || mouse_down.ay != 234 ||
						mouse_up.ax != 337 || mouse_up.ay != 246 ||
						mouse_down.button != 'left' || mouse_up.button != 'left'
					) {
						fail(
							'mouse coordinates were corrupted: down=' +
							#to_string(mouse_down.ax) + ',' + #to_string(mouse_down.ay) +
							' up=' + #to_string(mouse_up.ax) + ',' + #to_string(mouse_up.ay)
						);
						return false;
					}
					glsmac.test_push_mouse_button_event(512, 200, 'left', true);
					phase = 'hold';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'hold') {
					if (phase_ticks < 8) {
						return true;
					}
					glsmac.test_push_mouse_button_event(512, 200, 'left', false);
					phase = 'hold_result';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'hold_result') {
					if (glsmac.test_get_last_map_input_purpose() != 'move') {
						return true;
					}
					finished = true;
					#print(
						'SDL_INPUT_RUNTIME_PASS: key=G enter=Return mouse=321,234->337,246 hold=move'
					);
					glsmac.exit();
					return false;
				}

				fail('unknown phase ' + phase);
				return false;
			});
		});
	});

	glsmac.run();

});
