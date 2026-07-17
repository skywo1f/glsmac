#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let exit_scheduled = false;

	glsmac.on('configure_game', (e) => {
		const game = e.game;
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
				#print('RUNNING_RECONNECT_FAIL_CLIENT: restored state is incomplete');
				glsmac.exit();
				return;
			}

			if (turn_id == 1) {
				#print('RUNNING_RECONNECT_RESUMED_CLIENT');
				game.event('complete_turn', {});
			}
			else if (turn_id == 2 && !exit_scheduled) {
				exit_scheduled = true;
				#print('RUNNING_RECONNECT_PASS_CLIENT');
				#async(750, () => {
					glsmac.exit();
				});
			}
		};

		game.on('start_ui', (e) => {
			if (game.get_turn() > 0) {
				handle_turn(game.get_turn());
			}
		});

		game.on('turn', (e) => {
			handle_turn(e.year - 2100);
		});
	});

	glsmac.run();

});
