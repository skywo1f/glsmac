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
		#async(25, () => {
			ticks++;
			if (condition()) {
				done();
				return false;
			}
			if (ticks >= 200) {
				fail(#typeof(failure) == 'Callable' ? failure() : failure);
				return false;
			}
			return true;
		});
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.register_event('diplomacy_runtime_seed_energy', {
			validate: (e) => {
				if (e.caller != 0 && e.caller != e.data.player.id) {
					return 'Only the runtime test player may seed loan balances';
				}
			},
			apply: (e) => {
				const snapshot = {
					player_energy: e.data.player.energy_credits,
					target_energy: e.data.target.energy_credits,
				};
				e.data.player.set_energy_credits(200);
				e.data.target.set_energy_credits(20);
				e.game.trigger('economy_updated', {player: e.data.player});
				e.game.trigger('economy_updated', {player: e.data.target});
				return snapshot;
			},
			rollback: (e) => {
				e.data.player.set_energy_credits(e.applied.player_energy);
				e.data.target.set_energy_credits(e.applied.target_energy);
				e.game.trigger('economy_updated', {player: e.data.player});
				e.game.trigger('economy_updated', {player: e.data.target});
			},
		});
		game.register_event('diplomacy_runtime_process_loan', {
			validate: (e) => {
				if (e.caller != 0 && e.caller != e.data.player.id) {
					return 'Only the runtime test player may request loan processing';
				}
			},
			apply: (e) => {
				if (e.game.is_master()) {
					e.game.event('process_diplomatic_loan_payment', {
						borrower: e.data.borrower,
						lender: e.data.lender,
					});
				}
			},
			rollback: (e) => {},
		});
		game.register_event('diplomacy_runtime_seed_loan', {
			validate: (e) => {
				if (e.caller != 0 && e.caller != e.data.lender.id) {
					return 'Only the runtime test lender may seed a loan';
				}
			},
			apply: (e) => {
				const snapshot = {
					loan: e.data.borrower.get_diplomatic_loan(e.data.lender),
				};
				e.data.borrower.set_diplomatic_loan(e.data.lender, {balance: 120, payment: 6});
				return snapshot;
			},
			rollback: (e) => {
				if (e.applied.loan == null) {
					e.data.borrower.clear_diplomatic_loan(e.data.lender);
				} else {
					e.data.borrower.set_diplomatic_loan(e.data.lender, e.applied.loan);
				}
			},
		});
		game.register_event('diplomacy_runtime_prepare_contacts', {
			validate: (e) => {
				if (e.caller != 0 && e.caller != e.data.player.id) {
					return 'Only the runtime test player may prepare contacts';
				}
			},
			apply: (e) => {
				const snapshot = {
					player_target: e.data.player.has_contact(e.data.target),
					target_player: e.data.target.has_contact(e.data.player),
				};
				e.data.player.set_contact(e.data.target, true);
				e.data.target.set_contact(e.data.player, true);
				return snapshot;
			},
			rollback: (e) => {
				e.data.player.set_contact(e.data.target, e.applied.player_target);
				e.data.target.set_contact(e.data.player, e.applied.target_player);
			},
		});
		game.register_event('diplomacy_runtime_prepare_surrender', {
			validate: (e) => {
				if (e.caller != 0 && e.caller != e.data.player.id) {
					return 'Only the runtime test player may prepare surrender state';
				}
			},
			apply: (e) => {
				const previous = e.data.proposer.get_surrender_offer_to_id();
				e.data.proposer.set_surrender_offer_to_id(e.data.player.id);
				return previous;
			},
			rollback: (e) => {
				e.data.proposer.set_surrender_offer_to_id(e.applied);
			},
		});
		game.on('start_ui', (e) => {
			let player = game.get_player();
			let debt_before_vendetta = 0;
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
			const exercise_diplomacy = () => {
			if (
				!player.has_contact(other) || !other.has_contact(player) ||
				player.get_diplomatic_relation(other) != 'neutral' ||
				player.get_diplomatic_offer(other) != '' ||
				player.get_diplomatic_trade(other) != null ||
				player.get_diplomatic_loan_offer(other) != null ||
				player.get_diplomatic_loan(other) != null ||
				player.get_submissive_to_id() != -1 ||
				other.get_submissive_to_id() != -1 ||
				player.get_surrender_offer_to_id() != -1 ||
				other.get_surrender_offer_to_id() != -1 ||
				player.get_integrity_blemishes() != 0 ||
				other.get_integrity_blemishes() != 0
			) {
				fail('initial diplomatic state is invalid');
				return;
			}
			const exercise_submission = () => {
				const make_offer = () => {
					game.event('diplomacy_runtime_prepare_surrender', {
						player: player,
						proposer: other,
					});
				};
				const await_offer = () => { wait_for(
					() => { return other.get_surrender_offer_to_id() == player.id; },
					'AI surrender offer was not stored',
					() => {
						game.event('respond_surrender', {
							player: player,
							proposer: other,
							accept: true,
						});
						wait_for(
							() => {
								const winner = game.get_conquest_winner();
								const victory = game.get_victory_state();
								return (
									other.get_submissive_to_id() == player.id &&
									other.get_surrender_offer_to_id() == -1 &&
									player.get_diplomatic_relation(other) == 'pact' &&
									other.get_diplomatic_relation(player) == 'pact' &&
									winner != null && winner.id == player.id &&
									game.is_game_over() && victory.type == 'conquest' &&
									victory.winner == player.id
								);
							},
							'accepted surrender did not establish submission or conquest eligibility',
							() => {
								finished = true;
								#print(
									'DIPLOMACY_RUNTIME_PASS: contact-gated treaty commerce, reciprocal technology and world-map trade, loan repayment, betrayal integrity, vendetta debt, and AI submission conquest'
								);
								glsmac.exit();
							}
						);
					}
				); };
				make_offer();
				await_offer();
			};
			const exercise_vendetta = () => {
				game.event('declare_vendetta', {player: player, target: other});
				wait_for(
					() => {
						return (
							player.get_diplomatic_relation(other) == 'vendetta' &&
							other.get_diplomatic_relation(player) == 'vendetta' &&
							player.get_integrity_blemishes() == 1 &&
							other.get_integrity_blemishes() == 0
						);
					},
					'vendetta did not become bilateral',
					() => {
						const ended_commerce = game.get('f_economy_get_base_commerce')(
							game,
							get_owned_base(player)
						);
						const debt = other.get_diplomatic_loan(player);
						if (
							ended_commerce.total != 0 ||
							#sizeof(ended_commerce.partners) != 0 ||
							debt == null || debt.balance != debt_before_vendetta
						) {
							fail('vendetta did not end commerce while preserving debt');
							return;
						}
						game.event('diplomacy_runtime_process_loan', {
							player: player,
							borrower: other,
							lender: player,
						});
						wait_for(
							() => {
								const wartime_debt = other.get_diplomatic_loan(player);
								return wartime_debt != null &&
									wartime_debt.balance == debt_before_vendetta + 6;
							},
							'wartime missed payment did not increase loan balance',
							() => { exercise_submission(); }
						);
					}
				);
			};
			const exercise_loan = () => {
				game.event('diplomacy_runtime_seed_energy', {
					player: player,
					target: other,
				});
				wait_for(
					() => {
						return (
							game.get_player(player.id).energy_credits == 200 &&
							game.get_player(other.id).energy_credits == 20
						);
					},
					'could not seed deterministic loan balances',
					() => {
						player = game.get_player(player.id);
						other = game.get_player(other.id);
						game.event('diplomacy_runtime_seed_loan', {
							lender: player,
							borrower: other,
						});
						wait_for(
							() => {
								const debt = other.get_diplomatic_loan(player);
								return debt != null && debt.balance == 120 && debt.payment == 6;
							},
							() => {
								const debt = other.get_diplomatic_loan(player);
								return 'could not seed deterministic active loan state: lender=' +
									#to_string(player.energy_credits) + ', borrower=' +
									#to_string(other.energy_credits) + ', debt=' +
									(debt == null ? 'none' : #to_string(debt.balance));
							},
							() => {
								const debt = other.get_diplomatic_loan(player);
								const balance_before_payment = debt.balance;
								const lender_energy_before_payment = player.energy_credits;
								const borrower_energy_before_payment = other.energy_credits;
								game.event('diplomacy_runtime_process_loan', {
									player: player,
									borrower: other,
									lender: player,
								});
								wait_for(
									() => {
										const current_player = game.get_player(player.id);
										const current_other = game.get_player(other.id);
										const current_debt = current_other.get_diplomatic_loan(current_player);
										return (
											current_debt != null && current_debt.balance == balance_before_payment - 6 &&
											current_player.energy_credits == lender_energy_before_payment + 6 &&
											current_other.energy_credits == borrower_energy_before_payment - 6
										);
									},
									'peaceful loan payment did not transfer and reduce debt',
									() => {
										player = game.get_player(player.id);
										other = game.get_player(other.id);
										debt_before_vendetta = other.get_diplomatic_loan(player).balance;
										exercise_vendetta();
									}
								);
							}
						);
					}
				);
			};

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
							let player_map_tile = null;
							for (tile of player.get_explored_tiles()) {
								if (!other.has_explored(tile)) {
									player_map_tile = tile;
									break;
								}
							}
							let other_map_tile = null;
							for (tile of other.get_explored_tiles()) {
								if (!player.has_explored(tile)) {
									other_map_tile = tile;
									break;
								}
							}
							if (player_map_tile == null || other_map_tile == null) {
								fail('players did not start with tradeable exploration data');
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
									offer_map: true,
									request_map: true,
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
												other.has_technology(offered_technology) &&
												player.has_explored(other_map_tile) &&
												other.has_explored(player_map_tile)
											);
										},
									'accepted trade did not transfer its technologies and world maps',
									() => { exercise_loan(); }
									);
								}
							);
						}
					);
				}
			);
			};
			game.event('diplomacy_runtime_prepare_contacts', {
				player: player,
				target: other,
			});
			wait_for(
				() => {
					return player.has_contact(other) && other.has_contact(player);
				},
				'could not prepare deterministic commlink state',
				exercise_diplomacy
			);
		});
	});

	glsmac.run();

});
