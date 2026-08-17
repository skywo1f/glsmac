const technology_effects = #include('../technology_effects');
const message_rules = #include('../message_rules');

return {

	validate: (e) => {
		const error = e.game.get('f_diplomacy_validate_pair')(e.data.player, e.data.proposer);
		if (#is_defined(error)) {
			return error;
		}
		if (e.caller != 0 && e.data.player.id != e.caller) {
			return 'Players may only answer their own diplomatic trades';
		}
		if (e.game.is_turn_complete(e.data.player.id)) {
			return 'Player has already completed this turn';
		}
		if (#typeof(e.data.accept) != 'Bool') {
			return 'Diplomatic trade response must accept or reject the proposal';
		}
		const terms = e.data.player.get_diplomatic_trade(e.data.proposer);
		if (terms == null) {
			return 'No diplomatic trade is pending';
		}
		const ultimatum = e.game.get('f_diplomacy_is_ultimatum')(terms);
		const military_request = e.game.get('f_diplomacy_is_military_request')(terms);
		const peace_request = e.game.get('f_diplomacy_is_peace_request')(terms);
		const withdrawal_request = e.game.get('f_diplomacy_is_withdrawal_request')(terms);
		if (#is_defined(e.data.counter_terms)) {
			if (ultimatum || military_request || peace_request || withdrawal_request) {
				if (withdrawal_request) {
					return 'A withdrawal demand cannot be countered';
				}
				if (military_request) {
					return 'A joint vendetta request cannot be countered';
				}
				if (peace_request) {
					return 'A peace request cannot be countered';
				}
				return 'An ultimatum cannot be countered';
			}
			if (e.data.accept) {
				return 'A diplomatic trade cannot be accepted and countered';
			}
			if (e.data.proposer.get_diplomatic_trade(e.data.player) != null) {
				return 'A diplomatic counteroffer is already pending';
			}
			if (e.data.proposer.get_diplomatic_offer(e.data.player) != '') {
				return 'A diplomatic counteroffer is already pending';
			}
			return e.game.get('f_diplomacy_validate_trade')(
				e.data.player,
				e.data.proposer,
				e.data.counter_terms
			);
		}
		if (e.data.accept) {
			const accepted_terms = #clone(terms);
			accepted_terms.proposed_relation =
				e.data.player.get_diplomatic_offer(e.data.proposer);
			return e.game.get('f_diplomacy_validate_trade')(
				e.data.proposer,
				e.data.player,
				accepted_terms
			);
		}
	},

	apply: (e) => {
		const player = e.data.player;
		const proposer = e.data.proposer;
		const terms = player.get_diplomatic_trade(proposer);
		const proposed_relation = player.get_diplomatic_offer(proposer);
		const military_request = e.game.get('f_diplomacy_is_military_request')(terms);
		const peace_request = e.game.get('f_diplomacy_is_peace_request')(terms);
		const withdrawal_request = e.game.get('f_diplomacy_is_withdrawal_request')(terms);
		const military_target = military_request
			? e.game.get('f_diplomacy_find_player')(
				e.game.get('f_diplomacy_get_request_vendetta_player')(terms)
			)
			: null;
		const peace_target = peace_request
			? e.game.get('f_diplomacy_find_player')(
				e.game.get('f_diplomacy_get_request_peace_player')(terms)
			)
			: null;
		const snapshot = {
			terms: terms,
			player_energy: player.get_energy_credits(),
			proposer_energy: proposer.get_energy_credits(),
			player_research: player.get_research_state(),
			proposer_research: proposer.get_research_state(),
			previous_counter: proposer.get_diplomatic_trade(player),
			pair: e.game.get('f_diplomacy_snapshot_pair')(player, proposer),
			military_target: military_target,
			military_pair: military_target == null
				? null : e.game.get('f_diplomacy_snapshot_pair')(player, military_target),
			peace_target: peace_target,
			peace_pair: peace_target == null
				? null : e.game.get('f_diplomacy_snapshot_pair')(player, peace_target),
			contacts: [],
			maps: [],
			specialist_updates: [],
			bases: [],
			withdrawal: [],
		};
		const ultimatum = e.game.get('f_diplomacy_is_ultimatum')(terms);
		player.clear_diplomatic_trade(proposer);
		player.set_diplomatic_offer(proposer, '');
		if (e.data.accept) {
			if (withdrawal_request) {
				snapshot.withdrawal = e.game.get('f_diplomacy_apply_withdrawal')(
					proposer,
					player
				);
			}
			proposer.set_energy_credits(
				proposer.get_energy_credits() - terms.offer_energy + terms.request_energy
			);
			player.set_energy_credits(
				player.get_energy_credits() - terms.request_energy + terms.offer_energy
			);
			for (grant of [
				e.game.get('f_diplomacy_grant_technology')(player, terms.offer_technology),
				e.game.get('f_diplomacy_grant_technology')(
					proposer,
					terms.request_technology
				),
			]) {
				if (#typeof(grant) == 'Object') {
					for (map_reveal of grant.map_reveals) {
						snapshot.maps :+map_reveal;
					}
					if (#is_defined(grant.specialist_updates)) {
						for (specialist_update of grant.specialist_updates) {
							snapshot.specialist_updates :+specialist_update;
						}
					}
				}
			}
			for (contact of [
				e.game.get('f_diplomacy_grant_contact')(player, terms.offer_contact),
				e.game.get('f_diplomacy_grant_contact')(proposer, terms.request_contact),
			]) {
				if (#is_defined(contact)) {
					snapshot.contacts :+contact;
				}
			}
			if (#is_defined(terms.offer_map) && terms.offer_map) {
				snapshot.maps :+e.game.get('f_exploration_apply_map_share')(proposer, player);
			}
			if (#is_defined(terms.request_map) && terms.request_map) {
				snapshot.maps :+e.game.get('f_exploration_apply_map_share')(player, proposer);
			}
			const offer_base_id = e.game.get('f_diplomacy_get_offer_base')(terms);
			if (offer_base_id >= 0) {
				snapshot.bases :+e.game.get('f_diplomacy_transfer_base')(
					e.game.get('f_diplomacy_find_base')(offer_base_id),
					player
				);
			}
			const request_base_id = e.game.get('f_diplomacy_get_request_base')(terms);
			if (request_base_id >= 0) {
				snapshot.bases :+e.game.get('f_diplomacy_transfer_base')(
					e.game.get('f_diplomacy_find_base')(request_base_id),
					proposer
				);
			}
			if (terms.offer_energy > 0 || terms.request_energy > 0) {
				e.game.trigger('economy_updated', {player: player});
				e.game.trigger('economy_updated', {player: proposer});
			}
			if (terms.offer_technology != '') {
				e.game.trigger('research_updated', {player: player});
			}
			if (terms.request_technology != '') {
				e.game.trigger('research_updated', {player: proposer});
			}
			if (proposed_relation != '') {
				e.game.get('f_diplomacy_set_bilateral_relation')(
					player,
					proposer,
					proposed_relation,
					true
				);
				e.game.get('f_diplomacy_clear_relation_offers')(player, proposer);
				if (proposed_relation == 'pact') {
					snapshot.maps :+e.game.get('f_exploration_apply_map_share')(
						player,
						proposer
					);
					snapshot.maps :+e.game.get('f_exploration_apply_map_share')(
						proposer,
						player
					);
				}
				e.game.trigger('diplomacy_updated', {
					player: player,
					target: proposer,
					relation: proposed_relation,
				});
			}
			if (military_request) {
				e.game.get('f_diplomacy_set_bilateral_relation')(
					player,
					military_target,
					'vendetta',
					false
				);
				e.game.get('f_diplomacy_clear_offers')(player, military_target);
				e.game.trigger('diplomacy_updated', {
					player: player,
					target: military_target,
					relation: 'vendetta',
				});
			} else if (peace_request) {
				e.game.get('f_diplomacy_set_bilateral_relation')(
					player,
					peace_target,
					'neutral',
					true
				);
				e.game.get('f_diplomacy_clear_offers')(player, peace_target);
				e.game.trigger('diplomacy_updated', {
					player: player,
					target: peace_target,
					relation: 'neutral',
				});
			} else if (ultimatum && proposer.get_diplomatic_relation(player) == 'vendetta') {
				e.game.get('f_diplomacy_set_bilateral_relation')(
					proposer,
					player,
					'neutral',
					true
				);
			}
			let message = proposer.name + ' and ' + player.name +
				' completed a diplomatic trade.';
			if (proposed_relation != '') {
				let relation_name = 'Treaty';
				if (proposed_relation == 'pact') {
					relation_name = 'Pact';
				}
				message = proposer.name + ' and ' + player.name +
					' completed a diplomatic trade and established a ' + relation_name + '.';
			}
			if (ultimatum) {
				message = player.name + ' complied with ' + proposer.name + '\'s ultimatum.';
			}
			if (military_request) {
				message = player.name + ' joined ' + proposer.name + '\'s vendetta against ' +
					military_target.name + '.';
			}
			if (peace_request) {
				message = player.name + ' called off the vendetta against ' +
					peace_target.name + ' at ' + proposer.name + '\'s request.';
			}
			if (withdrawal_request) {
				let unit_label = ' units';
				if (#sizeof(snapshot.withdrawal) == 1) {
					unit_label = ' unit';
				}
				message = player.name + ' withdrew ' + #to_string(#sizeof(snapshot.withdrawal)) +
					unit_label + ' from ' + proposer.name + '\'s territory.';
			}
			if (peace_request) {
				message_rules.to_players(e.game, [player, proposer, peace_target], message);
			} else {
				message_rules.to_players(e.game, [player, proposer], message);
			}
		} else if (#is_defined(e.data.counter_terms)) {
			proposer.set_diplomatic_trade(player, e.data.counter_terms);
			proposer.set_diplomatic_offer(
				player,
				e.game.get('f_diplomacy_get_proposed_relation')(e.data.counter_terms)
			);
			message_rules.to_players(
				e.game,
				[player, proposer],
				player.name + ' made a diplomatic counteroffer to ' + proposer.name + '.'
			);
		} else if (ultimatum) {
			if (
				withdrawal_request ||
				proposer.get_diplomatic_relation(player) == 'neutral'
			) {
				e.game.get('f_diplomacy_set_bilateral_relation')(
					proposer,
					player,
					'vendetta',
					withdrawal_request
				);
				e.game.get('f_diplomacy_clear_offers')(proposer, player);
				e.game.trigger('diplomacy_updated', {
					player: proposer,
					target: player,
					relation: 'vendetta',
				});
			}
			let message = player.name + ' refused ' + proposer.name + '\'s ultimatum.';
			if (withdrawal_request) {
				message = player.name + ' refused to withdraw units from ' +
					proposer.name + '\'s territory.';
			}
			message_rules.to_players(e.game, [player, proposer], message);
		} else if (military_request) {
			message_rules.to_players(
				e.game,
				[player, proposer],
				player.name + ' declined ' + proposer.name + '\'s joint vendetta request.'
			);
		} else if (peace_request) {
			message_rules.to_players(
				e.game,
				[player, proposer],
				player.name + ' refused to call off the vendetta against ' +
					peace_target.name + '.'
			);
		}
		let resolved_event_name = 'diplomatic_trade_resolved';
		if (ultimatum) {
			resolved_event_name = 'diplomatic_ultimatum_resolved';
		}
		if (military_request) {
			resolved_event_name = 'diplomatic_military_request_resolved';
		}
		if (peace_request) {
			resolved_event_name = 'diplomatic_peace_request_resolved';
		}
		if (withdrawal_request) {
			resolved_event_name = 'diplomatic_withdrawal_resolved';
		}
		const resolved_terms = #clone(terms);
		resolved_terms.proposed_relation = proposed_relation;
		e.game.trigger(resolved_event_name, {
			player: player,
			proposer: proposer,
			terms: resolved_terms,
			accepted: e.data.accept,
		});
		if (#is_defined(e.data.counter_terms)) {
			e.game.trigger('diplomatic_trade_proposed', {
				player: player,
				target: proposer,
				terms: e.data.counter_terms,
			});
		}
		return snapshot;
	},

	rollback: (e) => {
		const player = e.data.player;
		const proposer = e.data.proposer;
		const ultimatum = e.game.get('f_diplomacy_is_ultimatum')(e.applied.terms);
		const military_request = e.game.get('f_diplomacy_is_military_request')(e.applied.terms);
		const peace_request = e.game.get('f_diplomacy_is_peace_request')(e.applied.terms);
		const withdrawal_request = e.game.get('f_diplomacy_is_withdrawal_request')(
			e.applied.terms
		);
		player.set_energy_credits(e.applied.player_energy);
		proposer.set_energy_credits(e.applied.proposer_energy);
		technology_effects.rollback_specialist_updates(e.applied.specialist_updates);
		player.set_research_state(e.applied.player_research);
		proposer.set_research_state(e.applied.proposer_research);
		for (let map_index = #sizeof(e.applied.maps) - 1; map_index >= 0; map_index--) {
			e.game.get('f_exploration_rollback_reveal')(e.applied.maps[map_index]);
		}
		if (military_request) {
			e.game.get('f_diplomacy_restore_pair')(player, proposer, e.applied.pair);
			if (e.applied.military_target != null && e.applied.military_pair != null) {
				e.game.get('f_diplomacy_restore_pair')(
					player,
					e.applied.military_target,
					e.applied.military_pair
				);
				e.game.trigger('diplomacy_updated', {
					player: player,
					target: e.applied.military_target,
					relation: e.applied.military_pair.player_relation,
				});
			}
			e.game.trigger('diplomatic_military_request_updated', {
				player: proposer,
				target: player,
			});
			return;
		}
		if (peace_request) {
			e.game.get('f_diplomacy_restore_pair')(player, proposer, e.applied.pair);
			if (e.applied.peace_target != null && e.applied.peace_pair != null) {
				e.game.get('f_diplomacy_restore_pair')(
					player,
					e.applied.peace_target,
					e.applied.peace_pair
				);
				e.game.trigger('diplomacy_updated', {
					player: player,
					target: e.applied.peace_target,
					relation: e.applied.peace_pair.player_relation,
				});
			}
			e.game.trigger('diplomatic_peace_request_updated', {
				player: proposer,
				target: player,
			});
			return;
		}
		if (ultimatum) {
			if (withdrawal_request) {
				e.game.get('f_diplomacy_rollback_withdrawal')(e.applied.withdrawal);
			}
			e.game.get('f_diplomacy_restore_pair')(player, proposer, e.applied.pair);
			e.game.trigger('economy_updated', {player: player});
			e.game.trigger('economy_updated', {player: proposer});
			e.game.trigger('research_updated', {player: player});
			e.game.trigger('research_updated', {player: proposer});
			let event_name = 'diplomatic_ultimatum_updated';
			if (withdrawal_request) {
				event_name = 'diplomatic_withdrawal_updated';
			}
			e.game.trigger(event_name, {
				player: proposer,
				target: player,
			});
			return;
		}
		for (let i = #sizeof(e.applied.contacts) - 1; i >= 0; i--) {
			e.game.get('f_diplomacy_restore_contact')(e.applied.contacts[i]);
		}
		for (let base_index = #sizeof(e.applied.bases) - 1; base_index >= 0; base_index--) {
			e.game.get('f_diplomacy_restore_base_transfer')(e.applied.bases[base_index]);
		}
		e.game.get('f_diplomacy_restore_pair')(player, proposer, e.applied.pair);
		e.game.trigger('economy_updated', {player: player});
		e.game.trigger('economy_updated', {player: proposer});
		e.game.trigger('research_updated', {player: player});
		e.game.trigger('research_updated', {player: proposer});
		e.game.trigger('diplomatic_trade_updated', {
			player: proposer,
			target: player,
		});
		if (e.applied.pair.player_offer != '') {
			e.game.trigger('diplomacy_updated', {
				player: player,
				target: proposer,
				relation: e.applied.pair.player_relation,
			});
		}
		if (#is_defined(e.data.counter_terms)) {
			e.game.trigger('diplomatic_trade_updated', {
				player: player,
				target: proposer,
			});
		}
	},

};
