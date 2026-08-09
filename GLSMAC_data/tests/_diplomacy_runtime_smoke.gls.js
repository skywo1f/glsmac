#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let finished = false;
	const fail = (message) => {
		if (!finished) {
			finished = true;
			#print('DIPLOMACY_RUNTIME_FAIL: ' + message);
			glsmac.exit();
		}
	};
	const wait_for = (condition, failure, done) => {
		let ticks = 0;
		#async(50, () => {
			ticks++;
			if (condition()) {
				done();
				return false;
			}
			if (ticks >= 100) {
				fail(failure);
				return false;
			}
			return true;
		});
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.on('start_ui', (e) => {
			const player = game.get_player();
			let other = null;
			for (candidate of game.get_players()) {
				if (candidate.id != player.id) {
					other = candidate;
					break;
				}
			}
			if (other == null) {
				fail('quickstart did not create an opponent');
				return;
			}
			if (
				player.get_diplomatic_relation(other) != 'neutral' ||
				player.get_diplomatic_offer(other) != ''
			) {
				fail('initial diplomatic state is invalid');
				return;
			}

			game.event('propose_diplomatic_relation', {
				player: player,
				target: other,
				relation: 'treaty',
			});
			wait_for(
				() => { return other.get_diplomatic_offer(player) == 'treaty'; },
				'treaty proposal was not stored',
				() => {
					game.event_as(other.id, 'respond_diplomatic_proposal', {
						player: other,
						proposer: player,
						accept: true,
					});
					wait_for(
						() => {
							return (
								player.get_diplomatic_relation(other) == 'treaty' &&
								other.get_diplomatic_relation(player) == 'treaty'
							);
						},
						'accepted treaty did not become bilateral',
						() => {
							game.event('declare_vendetta', {player: player, target: other});
							wait_for(
								() => {
									return (
										player.get_diplomatic_relation(other) == 'vendetta' &&
										other.get_diplomatic_relation(player) == 'vendetta'
									);
								},
								'vendetta did not become bilateral',
								() => {
									finished = true;
									#print('DIPLOMACY_RUNTIME_PASS: persistent proposals, treaty, and vendetta');
									glsmac.exit();
								}
							);
						}
					);
				}
			);
		});
	});

	glsmac.run();

});
