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
		if (#is_defined(e.data.counter_terms)) {
			if (ultimatum) {
				return 'An ultimatum cannot be countered';
			}
			if (e.data.accept) {
				return 'A diplomatic trade cannot be accepted and countered';
			}
			if (e.data.proposer.get_diplomatic_trade(e.data.player) != null) {
				return 'A diplomatic counteroffer is already pending';
			}
			return e.game.get('f_diplomacy_validate_trade')(
				e.data.player,
				e.data.proposer,
				e.data.counter_terms
			);
		}
		if (e.data.accept) {
			return e.game.get('f_diplomacy_validate_trade')(
				e.data.proposer,
				e.data.player,
				terms
			);
		}
	},

	apply: (e) => {
		const player = e.data.player;
		const proposer = e.data.proposer;
		const terms = player.get_diplomatic_trade(proposer);
		const snapshot = {
			terms: terms,
			player_energy: player.get_energy_credits(),
			proposer_energy: proposer.get_energy_credits(),
			player_research: player.get_research_state(),
			proposer_research: proposer.get_research_state(),
			previous_counter: proposer.get_diplomatic_trade(player),
			pair: e.game.get('f_diplomacy_snapshot_pair')(player, proposer),
			contacts: [],
			maps: [],
			bases: [],
		};
		const ultimatum = e.game.get('f_diplomacy_is_ultimatum')(terms);
		player.clear_diplomatic_trade(proposer);
		if (e.data.accept) {
			proposer.set_energy_credits(
				proposer.get_energy_credits() - terms.offer_energy + terms.request_energy
			);
			player.set_energy_credits(
				player.get_energy_credits() - terms.request_energy + terms.offer_energy
			);
			e.game.get('f_diplomacy_grant_technology')(player, terms.offer_technology);
			e.game.get('f_diplomacy_grant_technology')(proposer, terms.request_technology);
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
			if (ultimatum && proposer.get_diplomatic_relation(player) == 'vendetta') {
				e.game.get('f_diplomacy_set_bilateral_relation')(
					proposer,
					player,
					'neutral',
					true
				);
			}
			e.game.message(ultimatum
				? player.name + ' complied with ' + proposer.name + '\'s ultimatum.'
				: proposer.name + ' and ' + player.name + ' completed a diplomatic trade.');
		} else if (#is_defined(e.data.counter_terms)) {
			proposer.set_diplomatic_trade(player, e.data.counter_terms);
			e.game.message(player.name + ' made a diplomatic counteroffer to ' + proposer.name + '.');
		} else if (ultimatum) {
			if (proposer.get_diplomatic_relation(player) == 'neutral') {
				e.game.get('f_diplomacy_set_bilateral_relation')(
					proposer,
					player,
					'vendetta',
					false
				);
			}
			e.game.message(player.name + ' refused ' + proposer.name + '\'s ultimatum.');
		}
		e.game.trigger(ultimatum ? 'diplomatic_ultimatum_resolved' : 'diplomatic_trade_resolved', {
			player: player,
			proposer: proposer,
			terms: terms,
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
		player.set_energy_credits(e.applied.player_energy);
		proposer.set_energy_credits(e.applied.proposer_energy);
		player.set_research_state(e.applied.player_research);
		proposer.set_research_state(e.applied.proposer_research);
		if (ultimatum) {
			e.game.get('f_diplomacy_restore_pair')(player, proposer, e.applied.pair);
			e.game.trigger('economy_updated', {player: player});
			e.game.trigger('economy_updated', {player: proposer});
			e.game.trigger('research_updated', {player: player});
			e.game.trigger('research_updated', {player: proposer});
			e.game.trigger('diplomatic_ultimatum_updated', {
				player: proposer,
				target: player,
			});
			return;
		}
		for (let i = #sizeof(e.applied.contacts) - 1; i >= 0; i--) {
			e.game.get('f_diplomacy_restore_contact')(e.applied.contacts[i]);
		}
		for (let map_index = #sizeof(e.applied.maps) - 1; map_index >= 0; map_index--) {
			e.game.get('f_exploration_rollback_reveal')(e.applied.maps[map_index]);
		}
		for (let base_index = #sizeof(e.applied.bases) - 1; base_index >= 0; base_index--) {
			e.game.get('f_diplomacy_restore_base_transfer')(e.applied.bases[base_index]);
		}
		if (e.applied.previous_counter == null) {
			proposer.clear_diplomatic_trade(player);
		} else {
			proposer.set_diplomatic_trade(player, e.applied.previous_counter);
		}
		player.set_diplomatic_trade(proposer, e.applied.terms);
		e.game.trigger('economy_updated', {player: player});
		e.game.trigger('economy_updated', {player: proposer});
		e.game.trigger('research_updated', {player: player});
		e.game.trigger('research_updated', {player: proposer});
		e.game.trigger('diplomatic_trade_updated', {
			player: proposer,
			target: player,
		});
		if (#is_defined(e.data.counter_terms)) {
			e.game.trigger('diplomatic_trade_updated', {
				player: player,
				target: proposer,
			});
		}
	},

};
