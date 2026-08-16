#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let finished = false;
	const fail = (message) => {
		if (!finished) {
			finished = true;
			#print('COOPERATIVE_VICTORY_RUNTIME_FAIL: ' + message);
			glsmac.exit();
		}
	};
	const wait_for = (condition, failure, done) => {
		let ticks = 0;
		#async(25, () => {
			ticks++;
			if (condition()) {
				done();
				return false;
			}
			if (ticks >= 200) {
				fail(failure);
				return false;
			}
			return true;
		});
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.get_settings().global.rules.allow_cooperative_victory = true;
		game.register_event('cooperative_victory_form_pact', {
			validate: (e) => {
				if (e.caller != 0 && e.caller != e.data.player.id) {
					return 'Only the runtime player may form the test pacts';
				}
			},
			apply: (e) => {
				e.game.get('f_diplomacy_set_bilateral_relation')(
					e.data.player,
					e.data.target_a,
					'pact'
				);
				e.game.get('f_diplomacy_set_bilateral_relation')(
					e.data.player,
					e.data.target_b,
					'pact'
				);
				e.game.trigger('diplomacy_updated', {
					player: e.data.player,
					target: e.data.target_b,
					relation: 'pact',
				});
			},
			rollback: (e) => {},
		});

		game.on('start_ui', (event) => {
			if (finished) {
				return;
			}
			const players = game.get_players();
			if (#sizeof(players) != 3) {
				fail('quickstart did not create exactly three factions');
				return;
			}
			const player = game.get_player();
			let target_a = null;
			let target_b = null;
			for (candidate of players) {
				if (candidate.id != player.id) {
					if (target_a == null) {
						target_a = candidate;
					} else {
						target_b = candidate;
					}
				}
			}
			if (
				game.is_game_over() || game.get_conquest_winner() != null ||
				!game.get_settings().global.rules.allow_cooperative_victory ||
				target_a.get_diplomatic_relation(target_b) == 'pact' ||
				target_b.get_diplomatic_relation(target_a) == 'pact'
			) {
				fail('cooperative victory preconditions are invalid');
				return;
			}
			game.event('cooperative_victory_form_pact', {
				player: player,
				target_a: target_a,
				target_b: target_b,
			});
			wait_for(
				() => { return game.is_game_over(); },
				'forming the final pact did not declare cooperative conquest',
				() => {
					const victory = game.get_victory_state();
					const winner = game.get_conquest_winner();
					if (
						victory.type != 'conquest' || victory.winner != player.id ||
						winner == null || winner.id != player.id
					) {
						fail('cooperative conquest selected the wrong primary winner');
						return;
					}
					const get_score = game.get('f_score_get_breakdown');
					const player_score = get_score(player);
					const target_a_score = get_score(target_a);
					const target_b_score = get_score(target_b);
					const available_bonus = #max(0, 1000 - victory.turn * 2);
					const shared_bonus = player_score.victory_bonus +
						target_a_score.victory_bonus + target_b_score.victory_bonus;
					if (
						!player_score.is_victory_winner || !target_a_score.is_victory_winner ||
						!target_b_score.is_victory_winner || shared_bonus > available_bonus ||
						shared_bonus < available_bonus - 2
					) {
						fail('cooperative conquest score was not split between all factions');
						return;
					}
					finished = true;
					#print('COOPERATIVE_VICTORY_RUNTIME_PASS');
					glsmac.exit();
				}
			);
		});
	});

	glsmac.run();

});
