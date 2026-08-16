#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);
	const turn_rules = #include('../default/game/turn_rules');

	let finished = false;
	const fail = (message) => {
		if (!finished) {
			finished = true;
			#print('GAMEPLAY_CONTROLS_UI_RUNTIME_FAIL: ' + message);
			glsmac.exit();
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.set('f_ui_ready', (p) => {
			const player = game.get_player();
			let base_id = 0;
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == player.id) {
					base_id = base.id;
					break;
				}
			}
			if (base_id == 0) {
				fail('human starting base was not found');
				return;
			}
			const get_live_base = () => {
				for (base of game.get_bm().get_bases()) {
					if (base.id == base_id) {
						return base;
					}
				}
				return null;
			};
			let phase = 'close_research';
			let phase_ticks = 0;
			let worker_target = null;
			let moving_unit = null;
			let move_target = null;

			#async(50, () => {
				if (finished) {
					return false;
				}
				phase_ticks++;
				if (phase_ticks >= 160) {
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
					const base = get_live_base();
					if (base == null) {
						fail('human base disappeared');
						return false;
					}
					game.select_base(base);
					phase = 'open_base';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'open_base') {
					if (
						p.modules.popup.popup == null ||
						p.modules.popup.popup.id != 'base_screen'
					) {
						return true;
					}
					const base_screen = p.modules.popup.popup_defs.base_screen;
					const buttons = base_screen.sections.buttons;
					let has_former = false;
					let has_weather = false;
					for (candidate of buttons.production_data) {
						if (candidate.production_kind == 'unit' && candidate.id == 'Former') {
							has_former = true;
						}
						if (
							candidate.production_kind == 'project' &&
							candidate.id == 'TheWeatherParadigm'
						) {
							has_weather = true;
						}
					}
					if (!has_former || !has_weather) {
						fail('Gaian production omitted Former or The Weather Paradigm');
						return false;
					}
					buttons.change_production.trigger('click');
					phase = 'production_popup';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'production_popup') {
					if (
						p.modules.popup.popup == null ||
						p.modules.popup.popup.id != 'base_production'
					) {
						return true;
					}
					const production = p.modules.popup.popup_defs.base_production;
					if (production.available_count < 3) {
						fail('production chooser did not expose the legal catalog');
						return false;
					}
					production.return_to_base_screen();
					phase = 'worker';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'worker') {
					if (
						p.modules.popup.popup == null ||
						p.modules.popup.popup.id != 'base_screen'
					) {
						return true;
					}
					const base = get_live_base();
					const resource =
						p.modules.popup.popup_defs.base_screen.sections.middle_area.pages.resource;
					const assignable = game.get('f_base_get_assignable_worker_tiles')(base);
					for (candidate of assignable) {
						let already_worked = false;
						for (worked of base.get_worked_tiles()) {
							if (worked.x == candidate.x && worked.y == candidate.y) {
								already_worked = true;
							}
						}
						if (!already_worked) {
							worker_target = candidate;
							break;
						}
					}
					if (worker_target == null) {
						fail('no alternate worker tile was available');
						return false;
					}
					let click_tile = null;
					for (candidate of resource.click_context.existing_tiles) {
						if (
							candidate.tile.x == worker_target.x &&
							candidate.tile.y == worker_target.y
						) {
							click_tile = candidate;
							break;
						}
					}
					if (click_tile == null) {
						fail('alternate worker tile was not rendered');
						return false;
					}
					resource._handle_tile(click_tile);
					phase = 'worker_applied';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'worker_applied') {
					const base = get_live_base();
					let is_worked = false;
					for (worked of base.get_worked_tiles()) {
						if (worked.x == worker_target.x && worked.y == worker_target.y) {
							is_worked = true;
						}
					}
					if (!is_worked) {
						return true;
					}
					const info = p.modules.bottom_bar.pp.sections.middle_area.pp.pages.info_panels;
					info.button.trigger('on');
					if (
						info.energy_credits == null || info.energy_income == null ||
						info.energy_credits.text == '' || info.energy_income.text == ''
					) {
						fail('economy panel did not expose credits and per-turn income');
						return false;
					}
					p.modules.popup.popup_defs.base_screen.sections.buttons.btn_ok.trigger('click');
					phase = 'select_unit';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'select_unit') {
					if (p.modules.popup.popup != null) {
						return true;
					}
					for (unit of game.get_um().get_units()) {
						if (
							unit.owner == player.id && unit.transport_id == 0 &&
							!unit.is_immovable && unit.movement > 0.0
						) {
							moving_unit = unit;
							break;
						}
					}
					if (moving_unit == null) {
						fail('no movable human unit was available');
						return false;
					}
					game.select_unit(moving_unit);
					phase = 'unit_controls';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'unit_controls') {
					const preview = p.modules.bottom_bar.pp.sections.object_preview;
					if (
						preview.action_unit == null ||
						turn_rules.has_pending_owned_animation(game, player.id)
					) {
						return true;
					}
					p.root.trigger('keydown', {code: 'A', modifiers: {}});
					if (!preview.actions_menu_open || preview.actions_menu.height < 36) {
						fail('unit actions menu did not open from the A hotkey');
						return false;
					}
					p.root.trigger('keydown', {code: 'A', modifiers: {}});
					p.root.trigger('keydown', {code: 'ENTER', modifiers: {}});
					phase = 'turn_confirmation';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'turn_confirmation') {
					if (
						p.modules.popup.popup == null ||
						p.modules.popup.popup.id != 'turn_confirmation'
					) {
						return true;
					}
					p.modules.popup.hide('turn_confirmation');
					phase = 'goto';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'goto') {
					if (p.modules.popup.popup != null) {
						return true;
					}
					const preview = p.modules.bottom_bar.pp.sections.object_preview;
					game.select_unit(moving_unit);
					p.root.trigger('keydown', {code: 'G', modifiers: {}});
					if (preview.goto_unit == null) {
						fail('G hotkey did not start destination selection');
						return false;
					}
					for (candidate of moving_unit.get_tile().get_surrounding_tiles()) {
						if (candidate.is_land && !candidate.is_locked()) {
							let has_foreign = false;
							for (other of candidate.get_units()) {
								if (other.owner != player.id) {
									has_foreign = true;
								}
							}
							if (!has_foreign) {
								move_target = candidate;
								break;
							}
						}
					}
					if (move_target == null) {
						fail('no legal adjacent go-to destination was found');
						return false;
					}
					game.select_tile(move_target);
					phase = 'moved';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'moved') {
					const tile = moving_unit.get_tile();
					if (tile.x != move_target.x || tile.y != move_target.y) {
						return true;
					}
					finished = true;
					#print(
						'GAMEPLAY_CONTROLS_UI_RUNTIME_PASS: production=' +
						#to_string(p.modules.popup.popup_defs.base_production.available_count) +
						' worker=' + #to_string(worker_target.x) + ',' +
						#to_string(worker_target.y) + ' goto=' + #to_string(move_target.x) +
						',' + #to_string(move_target.y)
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
