#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let map_size_requested = false;
	let ready_requested = false;
	let game_configured = false;
	let exit_scheduled = false;

	glsmac.on('configure_state', (e) => {
		#async(100, () => {
			const game = glsmac.game;
			if (#sizeof(game.get_players()) != 2) {
				return true;
			}

			const map = game.get_settings().global.map;
			if (game.is_master() && !map_size_requested) {
				map_size_requested = true;
				game.event('game_settings', {
					changes: [
						['planet_size', '20x10'],
					],
				});
			}
			if (map.size_x != 20 || map.size_y != 10) {
				return true;
			}

			const me = game.get_player();
			if (!me.is_ready()) {
				if (!ready_requested) {
					ready_requested = true;
					game.event('ready_or_not', {
						ready: true,
					});
				}
			}
			else {
				ready_requested = false;
			}
			return !game_configured;
		});
	});

	glsmac.on('configure_game', (e) => {
		game_configured = true;
		const game = e.game;
		const role = game.is_master() ? 'HOST' : 'CLIENT';
		let handled_turns = {};

		let handle_turn = (turn_id) => {
			const turn_key = #to_string(turn_id);
			if (#is_defined(handled_turns[turn_key])) {
				return;
			}
			handled_turns[turn_key] = true;
			if (
				#sizeof(game.get_players()) != 2 ||
				#sizeof(game.get_bm().get_bases()) < 2 ||
				!game.get_um().has_unit(1)
			) {
				#print('RUNNING_RECONNECT_FAIL_' + role + ': synchronized state is incomplete');
				glsmac.exit();
				return;
			}

			if (turn_id == 1) {
				if (game.is_master()) {
					#print('RUNNING_RECONNECT_HOST_WAITING');
					game.event('complete_turn', {});
				}
				else {
					#print('RUNNING_RECONNECT_DROP_READY');
				}
			}
			else if (turn_id == 2 && game.is_master() && !exit_scheduled) {
				exit_scheduled = true;
				#print('RUNNING_RECONNECT_PASS_HOST');
				#async(2000, () => {
					glsmac.exit();
				});
			}
		};

		game.on('start_ui', (e) => {
			if (!game.is_master() && game.get_turn() > 0) {
				handle_turn(game.get_turn());
			}
		});

		game.on('turn', (e) => {
			handle_turn(e.year - 2100);
		});
	});

	glsmac.run();

});
