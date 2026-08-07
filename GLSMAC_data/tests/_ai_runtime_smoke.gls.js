#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let ai_id = 0 - 1;
	let initial_scout_tile = null;
	let ai_moved = false;
	let ai_expanded = false;
	let ai_built_former = false;
	let ai_terraformed = false;
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
					if (turn_id <= 8) {
						base.set_accumulated_minerals(100);
					}
					if (base.get_size() > 0) {
						populated_ai_bases++;
					}
				}
			}
			if (ai_bases < 1) {
				fail('AI has no base');
				return;
			}
			if (ai_bases >= 2) {
				ai_expanded = true;
			}

			let scout = null;
			for (unit of game.get_um().get_units()) {
				if (unit.owner == ai_id && unit.get_def().id == 'Former') {
					ai_built_former = true;
					const former_tile = unit.get_tile();
					if (unit.terraforming != 'none' || former_tile.terraforming.farm || former_tile.terraforming.mine) {
						ai_terraformed = true;
					}
				}
				if (scout == null && unit.owner == ai_id && unit.get_def().id == 'ScoutPatrol') {
					scout = unit;
				}
			}
			if (scout == null && initial_scout_tile == null) {
				fail('AI has no scout patrol');
				return;
			}
			if (scout != null && initial_scout_tile == null) {
				initial_scout_tile = scout.get_tile();
			} else if (scout != null && scout.get_tile() != initial_scout_tile) {
				ai_moved = true;
			}

			if (turn_id >= 16) {
				if (
					!ai_moved ||
					!ai_expanded ||
					!ai_built_former ||
					!ai_terraformed ||
					populated_ai_bases != ai_bases ||
					!ui_started
				) {
					#print('AI_RUNTIME_TRACE: moved=' + #to_string(ai_moved) + ' expanded=' + #to_string(ai_expanded) + ' former=' + #to_string(ai_built_former) + ' terraformed=' + #to_string(ai_terraformed) + ' bases=' + #to_string(ai_bases));
					fail('AI did not complete movement, growth, expansion, Former production, and terraforming by turn sixteen');
					return;
				}
				if (!exit_scheduled) {
					exit_scheduled = true;
					#print('AI_RUNTIME_PASS: AI moved, grew, expanded, built a Former, terraformed, and completed sixteen synchronized turns');
					#async(500, () => { glsmac.exit(); });
				}
				return;
			}

			#async(750, () => { game.event('complete_turn', {}); });
		});
	});

	glsmac.run();

});
