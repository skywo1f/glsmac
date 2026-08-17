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
			let space_unit = null;
			let held_movement = 0.0;
			let move_target = null;
			let move_start_turn = 0;
			let economy_credits_before = 0;
			let economy_income_before = 0;
			let economy_credits_after = 0;
			let economy_update_count = 0;
			game.on('economy_updated', (event) => {
				if (event.player.id == player.id) {
					economy_update_count++;
				}
			});

			#async(50, () => {
				if (finished) {
					return false;
				}
				phase_ticks++;
				if (phase_ticks >= 300) {
					if (phase == 'goto_first_leg' && moving_unit != null) {
						const live_unit = game.get_um().get_unit(moving_unit.id);
						const tile = live_unit.get_tile();
						const target = live_unit.get_move_target();
						fail(
							'timed out in phase ' + phase + '; unit=' +
							#to_string(tile.x) + ',' + #to_string(tile.y) +
							' movement=' + #to_string(live_unit.movement) +
							' pending=' + (target == null ? 'none' :
								#to_string(target.x) + ',' + #to_string(target.y))
						);
					} else {
						fail('timed out in phase ' + phase);
					}
					return false;
				}

				if (phase == 'close_research') {
					if (
						p.modules.popup.popup != null &&
						p.modules.popup.popup.id == 'research'
					) {
						p.modules.popup.popup_defs.research.begin_button.trigger('click');
						phase = 'open_technology_report';
						phase_ticks = 0;
						return true;
					}
					return true;
				}

				if (phase == 'open_technology_report') {
					if (p.modules.popup.popup != null) {
						return true;
					}
					p.root.trigger('keydown', {code: 'F2', modifiers: {}});
					phase = 'technology_report';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'technology_report') {
					if (
						p.modules.popup.popup == null ||
						p.modules.popup.popup.id != 'technology_report'
					) {
						return true;
					}
					const report = p.modules.popup.popup_defs.technology_report;
					if (
						report.total_count != 77 || #sizeof(report.visible_ids) != 77 ||
						report.known_count < 1 || report.available_count < 6 ||
						!#is_defined(report.known.CentauriEcology)
					) {
						fail(
							'technology report omitted the full tree or Gaian starting research (' +
							#to_string(report.known_count) + '/' +
							#to_string(report.total_count) + ', available=' +
							#to_string(report.available_count) + ')'
						);
						return false;
					}
					report.close_button.trigger('click');
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
					preview.action_button.trigger('click');
					if (!preview.actions_menu_open || preview.actions_menu.height < 54) {
						fail('unit actions menu did not expose go-to, hold, and skip commands');
						return false;
					}
					preview.action_button.trigger('click');
					held_movement = moving_unit.movement + 0.0;
					p.root.trigger('keydown', {code: 'H', modifiers: {}});
					phase = 'unit_held';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'unit_held') {
					const live_unit = game.get_um().get_unit(moving_unit.id);
					if (live_unit.order != 'hold') {
						return true;
					}
					if (live_unit.movement != held_movement) {
						fail('Hold Position consumed the unit\'s remaining movement');
						return false;
					}
					const preview = p.modules.bottom_bar.pp.sections.object_preview;
					preview.show(live_unit);
					preview.action_button.trigger('click');
					if (!preview.actions_menu_open || preview.actions_menu.height != 18) {
						fail('held unit actions menu did not expose only Activate');
						return false;
					}
					preview.action_button.trigger('click');
					p.root.trigger('keydown', {code: 'A', modifiers: {}});
					phase = 'unit_activated';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'unit_activated') {
					const live_unit = game.get_um().get_unit(moving_unit.id);
					if (live_unit.order != 'none') {
						return true;
					}
					if (live_unit.movement != held_movement) {
						fail('Activate changed the unit\'s remaining movement');
						return false;
					}
					p.modules.bottom_bar.pp.sections.objects_list.frame.trigger(
						'keydown',
						{code: 'ENTER', modifiers: {}}
					);
					phase = 'turn_confirmation';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'turn_confirmation') {
					if (
						p.modules.popup.popup != null &&
						p.modules.popup.popup.id != 'turn_confirmation'
					) {
						fail('Enter opened ' + p.modules.popup.popup.id + ' instead of end-turn confirmation');
						return false;
					}
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
					const source = moving_unit.get_tile();
					for (first of source.get_surrounding_tiles()) {
						if (
							!first.is_land || first.is_locked() ||
							first.features.xenofungus
						) {
							continue;
						}
						for (candidate of first.get_surrounding_tiles()) {
							if (
								!candidate.is_land || candidate.is_locked() ||
								candidate.features.xenofungus ||
								game.get_tm().get_distance(source, candidate) <= 1
							) {
								continue;
							}
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
						if (move_target != null) {
							break;
						}
					}
					if (move_target == null) {
						fail('no legal two-step go-to destination was found');
						return false;
					}
					moving_unit.movement = 1.0;
					move_start_turn = game.get_turn();
					game.select_tile(move_target);
					phase = 'goto_first_leg';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'goto_first_leg') {
					const live_unit = game.get_um().get_unit(moving_unit.id);
					const tile = live_unit.get_tile();
					const pending_target = live_unit.get_move_target();
					if (
						phase_ticks >= 20 && live_unit.movement > 0.0 &&
						pending_target == null
					) {
						fail(
							'go-to order was not accepted or no route was found; unit=' +
							#to_string(tile.x) + ',' + #to_string(tile.y) + ' target=' +
							#to_string(move_target.x) + ',' + #to_string(move_target.y) +
							' movement=' + #to_string(live_unit.movement)
						);
						return false;
					}
					if (
						turn_rules.has_pending_owned_animation(game, player.id) ||
						live_unit.movement > 0.0
					) {
						return true;
					}
					if (tile.x == move_target.x && tile.y == move_target.y) {
						fail('go-to ignored the forced one-step movement limit');
						return false;
					}
					const persisted = moving_unit.get_move_target();
					if (
						persisted == null || persisted.x != move_target.x ||
						persisted.y != move_target.y
					) {
						fail('go-to destination was not retained after movement ran out');
						return false;
					}
					const live_player = game.get_player();
					economy_credits_before = live_player.get_energy_credits();
					economy_income_before = game.get('f_economy_get_player')(
						game,
						live_player
					);
					economy_update_count = 0;
					game.event('complete_turn', {});
					phase = 'goto_next_turn';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'goto_next_turn') {
					if (
						game.get_turn() <= move_start_turn ||
						turn_rules.has_pending_owned_animation(game, player.id)
					) {
						return true;
					}
					const live_unit = game.get_um().get_unit(moving_unit.id);
					const tile = live_unit.get_tile();
					if (tile.x != move_target.x || tile.y != move_target.y) {
						return true;
					}
					if (live_unit.get_move_target() != null) {
						fail('completed go-to retained a stale destination');
						return false;
					}
					const expected_credits = #min(
						1000000000,
						#max(0, economy_credits_before + economy_income_before)
					);
					const actual_credits = game.get_player().get_energy_credits();
					economy_credits_after = actual_credits;
					if (economy_update_count == 0) {
						fail('turn advance did not settle the human economy');
						return false;
					}
					if (actual_credits != expected_credits) {
						fail(
							'economy settlement mismatch; before=' +
							#to_string(economy_credits_before) + ' income=' +
							#to_string(economy_income_before) + ' actual=' +
							#to_string(actual_credits)
						);
						return false;
					}
					phase = 'space_prepare';
					phase_ticks = 0;
					return true;
				}

				if (phase == 'space_prepare') {
					if (p.modules.popup.popup != null) {
						if (p.modules.popup.popup.id != 'research') {
							fail('Space hotkey setup was blocked by ' + p.modules.popup.popup.id);
							return false;
						}
						p.modules.popup.popup_defs.research.begin_button.trigger('click');
						return true;
					}
					for (candidate of game.get_um().get_units()) {
						if (
							candidate.owner == player.id && candidate.transport_id == 0 &&
							candidate.movement > 0.0 && candidate.order == 'none'
						) {
							space_unit = candidate;
							break;
						}
					}
					if (space_unit == null) {
						fail('no active unit was available for the Space hotkey check');
						return false;
					}
					const preview = p.modules.bottom_bar.pp.sections.object_preview;
					preview.show(space_unit);
					const skip_unit = preview.skip_unit;
					let space_hotkey_invoked = false;
					preview.skip_unit = () => {
						space_hotkey_invoked = true;
						return true;
					};
					p.root.trigger('keydown', {code: 'SPACE', modifiers: {}});
					preview.skip_unit = skip_unit;
					if (!space_hotkey_invoked) {
						fail('Space hotkey did not dispatch Skip Turn');
						return false;
					}
					finished = true;
					#print(
						'GAMEPLAY_CONTROLS_UI_RUNTIME_PASS: production=' +
						#to_string(p.modules.popup.popup_defs.base_production.available_count) +
						' worker=' + #to_string(worker_target.x) + ',' +
						#to_string(worker_target.y) + ' goto=' + #to_string(move_target.x) +
						',' + #to_string(move_target.y) + ' credits=' +
						#to_string(economy_credits_before) + '+' +
						#to_string(economy_income_before) + '=' +
						#to_string(economy_credits_after) + ' space=skip'
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
