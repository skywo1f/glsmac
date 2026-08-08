#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let game = null;
	let ai_id = 0 - 1;
	let human_base_id = 0;
	let defender_id = 0;
	let setup_complete = false;
	let wait_ticks = 0;

	const fail = (message) => {
		#print('AI_CONQUEST_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const complete_human_turn = () => {
		if (!game.is_game_over() && !game.is_turn_complete(game.get_player().id)) {
			game.event('complete_turn', {});
		}
	};

	const check_result = () => {
		wait_ticks++;
		if (game.is_game_over()) {
			let captured_base = null;
			for (base of game.get_bm().get_bases()) {
				if (base.id == human_base_id) {
					captured_base = base;
				}
			}
			if (captured_base == null) {
				fail('captured base is missing');
				return false;
			}
			const victory = game.get_victory_state();
			let ai_occupies_base = false;
			let promoted_ai_occupies_base = false;
			for (unit of captured_base.get_tile().get_units()) {
				if (unit.owner == ai_id) {
					ai_occupies_base = true;
					if (unit.morale == 6) {
						promoted_ai_occupies_base = true;
					}
				}
			}
			if (
				victory.type != 'conquest' ||
				victory.winner != ai_id ||
				captured_base.get_owner().id != ai_id ||
				game.get_um().has_unit(defender_id) ||
				!ai_occupies_base ||
				!promoted_ai_occupies_base
			) {
				fail('AI conquest state is inconsistent');
				return false;
			}
			#print('AI_CONQUEST_RUNTIME_PASS: AI attacked, captured the final base, and won by conquest');
			#async(500, () => { glsmac.exit(); });
			return false;
		}
		if (wait_ticks >= 200) {
			fail('AI did not capture the adjacent defended base within twenty seconds');
			return false;
		}
		return true;
	};

	glsmac.on('configure_game', (e) => {
		game = e.game;

		game.on('start_ui', (e) => {
			let ai = null;
			const human = game.get_player();
			for (player of game.get_players()) {
				if (player.type == 'ai') {
					ai = player;
				}
			}
			if (ai == null) {
				fail('computer player is missing');
				return;
			}
			ai_id = ai.id;
			let human_base = null;
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == human.id) {
					human_base = base;
					break;
				}
			}
			if (human_base == null) {
				fail('human base is missing');
				return;
			}
			human_base_id = human_base.id;

			let defender = null;
			for (unit of human_base.get_tile().get_units()) {
				if (unit.owner == human.id && unit.get_def().offense > 0) {
					defender = unit;
					break;
				}
			}
			if (defender == null) {
				fail('human base defender is missing');
				return;
			}

			let staging_tile = null;
			for (candidate of human_base.get_tile().get_surrounding_tiles()) {
				if (candidate.is_land && !candidate.is_locked() && candidate.get_base() == null && #sizeof(candidate.get_units()) == 0) {
					staging_tile = candidate;
					break;
				}
			}
			if (staging_tile == null) {
				fail('no legal adjacent staging tile is available');
				return;
			}

			defender_id = defender.id;
			defender.health = 0.01;
			game.event('spawn_unit', {
				owner: ai,
				tile: staging_tile,
				type: 'ReconRover',
				morale: 5,
				health: 1.0,
			});
			setup_complete = true;
			#async(100, complete_human_turn);
			#async(100, check_result);
		});

		game.on('turn', (e) => {
			if (setup_complete) {
				#async(100, complete_human_turn);
			}
		});
	});

	glsmac.run();

});
