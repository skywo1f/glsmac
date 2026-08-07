#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let ai_id = 0 - 1;
	let initial_scout_tile = null;
	let ai_moved = false;
	let ui_started = false;
	let exit_scheduled = false;

	const fail = (message) => {
		#print('AI_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		game.on('start_ui', (e) => {
			ui_started = true;
			#async(500, () => { game.event('complete_turn', {}); });
		});

		game.on('turn', (e) => {
			if (!ui_started) {
				return;
			}
			const turn_id = e.year - 2100;
			const players = game.get_players();
			if (#sizeof(players) != 2) {
				fail('expected two players, found ' + #to_string(#sizeof(players)));
				return;
			}

			let ai = null;
			for (player of players) {
				if (player.type == 'ai') {
					ai = player;
				}
			}
			if (ai == null || ai.id == 0 || ai.is_master) {
				fail('AI player identity or authority is invalid');
				return;
			}
			ai_id = ai.id;

			let ai_bases = 0;
			let populated_ai_bases = 0;
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == ai_id) {
					ai_bases++;
					if (base.get_size() > 0) {
						populated_ai_bases++;
					}
				}
			}
			if (ai_bases < 1) {
				fail('AI has no base');
				return;
			}

			let scout = null;
			for (unit of game.get_um().get_units()) {
				if (unit.owner == ai_id && unit.get_def().id == 'ScoutPatrol') {
					scout = unit;
					break;
				}
			}
			if (scout == null) {
				fail('AI has no scout patrol');
				return;
			}
			if (initial_scout_tile == null) {
				initial_scout_tile = scout.get_tile();
			} else if (scout.get_tile() != initial_scout_tile) {
				ai_moved = true;
			}

			if (turn_id >= 4) {
				if (!ai_moved || populated_ai_bases != ai_bases || !ui_started) {
					fail('AI did not move, grow, and reach a stable UI state by turn four');
					return;
				}
				if (!exit_scheduled) {
					exit_scheduled = true;
					#print('AI_RUNTIME_PASS: AI moved, grew its base, and completed four synchronized turns');
					#async(500, () => { glsmac.exit(); });
				}
				return;
			}

			#async(750, () => { game.event('complete_turn', {}); });
		});
	});

	glsmac.run();

});
