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
			const get_owned_base = (owner) => {
				for (base of game.get_bm().get_bases()) {
					if (base.get_owner().id == owner.id) {
						return base;
					}
				}
				return null;
			};
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
				player.get_diplomatic_offer(other) != '' ||
				player.get_diplomatic_trade(other) != null
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
							const commerce_base = get_owned_base(player);
							const commerce = commerce_base == null
								? null
								: game.get('f_economy_get_base_commerce')(game, commerce_base);
							if (
								commerce == null || #sizeof(commerce.partners) != 1 ||
								commerce.partners[0].player_id != other.id ||
								commerce.partners[0].relation != 'treaty'
							) {
								fail('accepted treaty did not establish base commerce');
								return;
							}
							let offered_technology = '';
							for (id of player.get_research_state().technologies) {
								if (!other.has_technology(id)) {
									offered_technology = id;
									break;
								}
							}
							let requested_technology = '';
							for (id of other.get_research_state().technologies) {
								if (!player.has_technology(id)) {
									requested_technology = id;
									break;
								}
							}
							if (offered_technology == '' || requested_technology == '') {
								fail('players did not start with tradeable technologies');
								return;
							}
							game.event('propose_diplomatic_trade', {
								player: player,
								target: other,
								terms: {
									offer_energy: 0,
									offer_technology: offered_technology,
									request_energy: 0,
									request_technology: requested_technology,
								},
							});
							wait_for(
								() => { return other.get_diplomatic_trade(player) != null; },
								'trade proposal was not stored',
								() => {
									game.event_as(other.id, 'respond_diplomatic_trade', {
										player: other,
										proposer: player,
										accept: true,
									});
									wait_for(
										() => {
											return (
												other.get_diplomatic_trade(player) == null &&
												player.has_technology(requested_technology) &&
												other.has_technology(offered_technology)
											);
										},
										'accepted trade did not transfer its technologies',
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
													const ended_commerce = game.get(
														'f_economy_get_base_commerce'
													)(game, get_owned_base(player));
													if (
														ended_commerce.total != 0 ||
														#sizeof(ended_commerce.partners) != 0
													) {
														fail('vendetta did not end base commerce');
														return;
													}
													finished = true;
													#print(
														'DIPLOMACY_RUNTIME_PASS: treaty commerce, reciprocal trade, and vendetta'
													);
													glsmac.exit();
												}
											);
										}
									);
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
