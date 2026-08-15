#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.set('f_ui_should_auto_open_diplomacy', () => { return false; });
		game.register_event('diplomacy_ui_runtime_prepare', {
			validate: (e) => {},
			apply: (e) => {
				e.data.player.set_contact(e.data.target, true);
				e.data.target.set_contact(e.data.player, true);
			},
			rollback: (e) => {},
		});
		game.set('f_ui_ready', (p) => {
			const player = game.get_player();
			let target = null;
			for (candidate of game.get_players()) {
				if (candidate.id != player.id && candidate.type != 'native') {
					target = candidate;
					break;
				}
			}
			if (target == null) {
				#print('DIPLOMACY_UI_RUNTIME_FAIL: no opponent');
				glsmac.exit();
				return;
			}
			game.event('diplomacy_ui_runtime_prepare', {
				player: player,
				target: target,
			});
			#async(25, () => {
				if (!player.has_contact(target) || !target.has_contact(player)) {
					return true;
				}
				p.modules.popup.show('diplomacy');
				#async(250, () => {
					#print('DIPLOMACY_UI_RUNTIME_PASS');
					glsmac.exit();
					return false;
				});
				return false;
			});
		});
	});

	glsmac.run();

});
