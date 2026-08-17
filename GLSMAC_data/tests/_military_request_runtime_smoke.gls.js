#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let finished = false;
	const fail = (message) => {
		if (!finished) {
			finished = true;
			#print('MILITARY_REQUEST_RUNTIME_FAIL: ' + message);
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
			if (ticks >= 120) {
				fail(failure);
				return false;
			}
			return true;
		});
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.set('f_ui_should_auto_open_diplomacy', () => { return false; });
		game.register_event('military_request_runtime_setup', {
			validate: (e) => {
				if (e.caller != 0 && e.caller != e.data.player.id) {
					return 'Only the runtime player may prepare military diplomacy';
				}
			},
			apply: (e) => {
				for (pair of [
					[e.data.player, e.data.ally, 'pact'],
					[e.data.player, e.data.target, 'vendetta'],
					[e.data.ally, e.data.target, 'neutral'],
				]) {
					pair[0].set_contact(pair[1], true);
					pair[1].set_contact(pair[0], true);
					pair[0].set_diplomatic_relation(pair[1], pair[2]);
					pair[1].set_diplomatic_relation(pair[0], pair[2]);
				}
			},
			rollback: (e) => {},
		});
		game.register_event('peace_request_runtime_setup', {
			validate: (e) => {
				if (e.caller != 0 && e.caller != e.data.player.id) {
					return 'Only the runtime player may prepare peace mediation';
				}
			},
			apply: (e) => {
				e.data.player.set_diplomatic_relation(e.data.target, 'pact');
				e.data.target.set_diplomatic_relation(e.data.player, 'pact');
			},
			rollback: (e) => {},
		});

		let resolved = false;
		let peace_resolved = false;
		game.on('diplomatic_military_request_resolved', (event) => {
			resolved = event.accepted;
		});
		game.on('diplomatic_peace_request_resolved', (event) => {
			peace_resolved = event.accepted;
		});
		game.on('start_ui', (event) => {
			const player = game.get_player();
			let ally = null;
			let target = null;
			for (candidate of game.get_players()) {
				if (candidate.id == player.id) {
					continue;
				}
				if (ally == null) {
					ally = candidate;
				} else if (target == null) {
					target = candidate;
					break;
				}
			}
			if (ally == null || target == null) {
				fail('quickstart did not create two opponents');
				return;
			}
			game.event('military_request_runtime_setup', {
				player: player,
				ally: ally,
				target: target,
			});
			wait_for(
				() => {
					return player.get_diplomatic_relation(ally) == 'pact' &&
						player.get_diplomatic_relation(target) == 'vendetta' &&
						ally.get_diplomatic_relation(target) == 'neutral';
				},
				'could not prepare three-faction diplomatic state',
				() => {
					game.event('propose_diplomatic_trade', {
						player: player,
						target: ally,
						terms: {
							offer_energy: 0,
							offer_technology: '',
							request_energy: 0,
							request_technology: '',
							offer_contact: 0 - 1,
							request_contact: 0 - 1,
							offer_map: false,
							request_map: false,
							offer_base: 0 - 1,
							request_base: 0 - 1,
							request_vendetta_player: target.id,
							is_ultimatum: false,
						},
					});
					wait_for(
						() => {
							const pending = ally.get_diplomatic_trade(player);
							return pending != null &&
								pending.request_vendetta_player == target.id;
						},
						'joint vendetta request was not stored',
						() => {
							game.event_as(ally.id, 'respond_diplomatic_trade', {
								player: ally,
								proposer: player,
								accept: true,
							});
							wait_for(
								() => {
									return resolved && ally.get_diplomatic_trade(player) == null &&
										player.get_diplomatic_relation(ally) == 'pact' &&
										ally.get_diplomatic_relation(target) == 'vendetta' &&
										target.get_diplomatic_relation(ally) == 'vendetta';
								},
							'accepted joint vendetta request did not create bilateral war',
							() => {
								game.event('peace_request_runtime_setup', {
									player: player,
									target: target,
								});
								wait_for(
									() => {
										return player.get_diplomatic_relation(target) == 'pact' &&
											ally.get_diplomatic_relation(target) == 'vendetta';
									},
									'could not prepare peace mediation state',
									() => {
										game.event('propose_diplomatic_trade', {
											player: player,
											target: ally,
											terms: {
												offer_energy: 0,
												offer_technology: '',
												request_energy: 0,
												request_technology: '',
												offer_contact: 0 - 1,
												request_contact: 0 - 1,
												offer_map: false,
												request_map: false,
												offer_base: 0 - 1,
												request_base: 0 - 1,
												request_vendetta_player: 0 - 1,
												is_ultimatum: false,
												request_peace_player: target.id,
											},
										});
										wait_for(
											() => {
												const pending = ally.get_diplomatic_trade(player);
												return pending != null &&
													pending.request_peace_player == target.id;
											},
											'peace request was not stored',
											() => {
												game.event_as(ally.id, 'respond_diplomatic_trade', {
													player: ally,
													proposer: player,
													accept: true,
												});
												wait_for(
													() => {
														return peace_resolved &&
															ally.get_diplomatic_trade(player) == null &&
															player.get_diplomatic_relation(ally) == 'pact' &&
															ally.get_diplomatic_relation(target) == 'neutral' &&
															target.get_diplomatic_relation(ally) == 'neutral';
													},
													'accepted peace request did not end the third-party vendetta',
													() => {
														finished = true;
														#print(
															'MILITARY_REQUEST_RUNTIME_PASS: joint vendetta and mediated peace accepted'
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
				}
			);
		});
	});

	glsmac.run();

});
