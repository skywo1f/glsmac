#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let lobby_timer_started = false;
	let map_size_requested = false;
	let ready_requested = false;
	let game_configured = false;
	let exit_scheduled = false;

	glsmac.on('configure_state', (e) => {
		if (lobby_timer_started) {
			return;
		}
		lobby_timer_started = true;

		#async(100, () => {
			const game = glsmac.game;
			const players = game.get_players();
			if (#sizeof(players) != 2) {
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
					#print('MULTIPLAYER_SMOKE_READY_REQUESTED');
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
		#print('MULTIPLAYER_SMOKE_CONFIGURE_' + role);

		let handle_turn = (turn_id) => {
			const turn_key = #to_string(turn_id);
			if (#is_defined(handled_turns[turn_key])) {
				return;
			}
			handled_turns[turn_key] = true;
			#print('MULTIPLAYER_SMOKE_TURN_' + role + ': ' + #to_string(turn_id));
			const players = game.get_players();
			const bases = game.get_bm().get_bases();
			if (
				#sizeof(players) != 2 ||
				#sizeof(bases) < 2 ||
				!game.get_um().has_unit(1)
			) {
				#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': synchronized game state is incomplete');
				glsmac.exit();
				return;
			}

			if (turn_id == 1) {
				#print('MULTIPLAYER_SMOKE_' + role + ': synchronized turn 1');
				game.event('complete_turn', {});
			}
			else if (turn_id == 2 && !exit_scheduled) {
				exit_scheduled = true;
				#print('MULTIPLAYER_SMOKE_PASS_' + role + ': reached synchronized turn 2 with two players');
				#async(game.is_master() ? 2500 : 1000, () => {
					glsmac.exit();
				});
			}
		};

		game.on('start_ui', (e) => {
			#print('MULTIPLAYER_SMOKE_UI_' + role);
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
