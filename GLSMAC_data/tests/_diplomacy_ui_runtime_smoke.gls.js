#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.register_event('diplomacy_ui_runtime_prepare', {
			validate: (e) => {},
			apply: (e) => {
				e.data.player.set_contact(e.data.target, true);
				e.data.target.set_contact(e.data.player, true);
				e.data.player.set_diplomatic_relation(e.data.target, 'treaty');
				e.data.target.set_diplomatic_relation(e.data.player, 'treaty');
				e.data.player.set_diplomatic_trade(e.data.target, {
					offer_energy: 0,
					offer_technology: '',
					request_energy: 0,
					request_technology: '',
					offer_contact: 0 - 1,
					request_contact: 0 - 1,
					offer_map: false,
					request_map: false,
					offer_base: 0 - 1,
					request_base: 0 - 1,
					is_ultimatum: true,
					request_vendetta_player: 0 - 1,
					request_withdrawal: true,
				});
				const player_id = e.data.player.id + 0;
				const target_id = e.data.target.id + 0;
				#async(0, () => {
					game.trigger('diplomatic_withdrawal_proposed', {
						player: game.get_player(target_id),
						target: game.get_player(player_id),
					});
					return false;
				});
			},
			rollback: (e) => {
				e.data.player.clear_diplomatic_trade(e.data.target);
			},
		});
		game.set('f_ui_ready', (p) => {
			const player = game.get_player();
			let target = null;
			for (candidate of game.get_players()) {
				if (candidate.id != player.id && candidate.type != 'native') {
					target = candidate;
				}
			}
			if (target == null) {
				#print('DIPLOMACY_UI_RUNTIME_FAIL: no opponent');
				glsmac.exit();
				return;
			}
			let prepared = false;
			let startup_ticks = 0;
			let wait_ticks = 0;
			let refresh_triggered = false;
			#async(25, () => {
				const definition = p.modules.popup.popup_defs.diplomacy;
				if (!prepared) {
					// f_ui_ready runs immediately before native frontend slots are defined.
					startup_ticks++;
					if (startup_ticks < 20) {
						return true;
					}
					prepared = true;
					game.event('diplomacy_ui_runtime_prepare', {
						player: player,
						target: target,
					});
					return true;
				}
				if (!player.has_contact(target) || !target.has_contact(player)) {
					return true;
				}
				const popup = p.modules.popup.popup;
				const pending = player.get_diplomatic_trade(target);
				if (
					pending == null || !pending.request_withdrawal ||
					popup == null || popup.id != 'diplomacy' ||
					definition.target == null || definition.target.id != target.id
				) {
					wait_ticks++;
					if (wait_ticks >= 100) {
						#print('DIPLOMACY_UI_RUNTIME_FAIL: projected withdrawal did not open its sender');
						glsmac.exit();
						return false;
					}
					return true;
				}
				if (!refresh_triggered) {
					refresh_triggered = true;
					game.trigger('diplomatic_sanctions_updated', {
						player: player,
						target: target,
					});
					return true;
				}
				#print('DIPLOMACY_UI_RUNTIME_PASS: native withdrawal projection opened its sender');
				#async(250, () => { glsmac.exit(); });
				return false;
			});
		});
	});

	glsmac.run();

});
