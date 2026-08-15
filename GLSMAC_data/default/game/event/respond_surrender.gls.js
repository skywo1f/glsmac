return {

	validate: (e) => {
		const player = e.data.player;
		const proposer = e.data.proposer;
		const error = e.game.get('f_diplomacy_validate_pair')(player, proposer);
		if (#is_defined(error)) { return error; }
		if (e.caller != 0 && player.id != e.caller) {
			return 'Factions may only answer surrender offers made to them';
		}
		if (e.game.is_turn_complete(player.id)) {
			return 'Player has already completed this turn';
		}
		if (#typeof(e.data.accept) != 'Bool') {
			return 'Surrender response must accept or reject the offer';
		}
		if (proposer.get_surrender_offer_to_id() != player.id) {
			return 'No surrender offer is pending';
		}
		const direction_error = e.game.get('f_diplomacy_validate_surrender_direction')(
			proposer,
			player
		);
		if (#is_defined(direction_error)) { return direction_error; }
		if (proposer.get_submissive_to_id() >= 0 || player.get_submissive_to_id() >= 0) {
			return 'Surrender participants must be independent factions';
		}
		if (proposer.get_diplomatic_relation(player) != 'vendetta') {
			return 'Surrender requires an active vendetta';
		}
	},

	apply: (e) => {
		const player = e.data.player;
		const proposer = e.data.proposer;
		const snapshot = {
			diplomacy: e.game.get('f_diplomacy_snapshot_pair')(player, proposer),
			player_energy: player.get_energy_credits(),
			proposer_energy: proposer.get_energy_credits(),
			player_research: player.get_research_state(),
			proposer_research: proposer.get_research_state(),
			player_loan: player.get_diplomatic_loan(proposer),
			proposer_loan: proposer.get_diplomatic_loan(player),
			maps: [],
		};
		proposer.set_surrender_offer_to_id(-1);
		if (e.data.accept) {
			proposer.set_submissive_to_id(player.id);
			player.set_energy_credits(#min(
				1000000000,
				player.get_energy_credits() + proposer.get_energy_credits()
			));
			proposer.set_energy_credits(0);
			for (technology_id of proposer.get_research_state().technologies) {
				if (!player.has_technology(technology_id)) {
					const grant = e.game.get('f_diplomacy_grant_technology')(
						player,
						technology_id
					);
					if (#typeof(grant) == 'Object') {
						for (map_reveal of grant.map_reveals) {
							snapshot.maps :+map_reveal;
						}
					}
				}
			}
			e.game.get('f_diplomacy_set_bilateral_relation')(player, proposer, 'pact');
			e.game.get('f_diplomacy_clear_offers')(player, proposer);
			player.clear_diplomatic_loan(proposer);
			proposer.clear_diplomatic_loan(player);
			const share_map = e.game.get('f_exploration_apply_map_share');
			if (#is_defined(share_map)) {
				snapshot.maps :+share_map(player, proposer);
				snapshot.maps :+share_map(proposer, player);
			}
			e.game.trigger('economy_updated', {player: player});
			e.game.trigger('economy_updated', {player: proposer});
			e.game.trigger('research_updated', {player: player});
			e.game.trigger('diplomacy_updated', {
				player: player,
				target: proposer,
				relation: 'pact',
			});
			e.game.trigger('submission_updated', {player: proposer, master: player});
			e.game.message(
				proposer.name + ' surrendered to ' + player.name +
				' and swore a permanent Pact of Submission.'
			);
		}
		e.game.trigger('diplomatic_surrender_resolved', {
			player: player,
			proposer: proposer,
			accepted: e.data.accept,
		});
		return snapshot;
	},

	rollback: (e) => {
		const player = e.data.player;
		const proposer = e.data.proposer;
		for (let i = #sizeof(e.applied.maps) - 1; i >= 0; i--) {
			e.game.get('f_exploration_rollback_reveal')(e.applied.maps[i]);
		}
		player.set_energy_credits(e.applied.player_energy);
		proposer.set_energy_credits(e.applied.proposer_energy);
		player.set_research_state(e.applied.player_research);
		proposer.set_research_state(e.applied.proposer_research);
		if (e.applied.player_loan == null) {
			player.clear_diplomatic_loan(proposer);
		} else {
			player.set_diplomatic_loan(proposer, e.applied.player_loan);
		}
		if (e.applied.proposer_loan == null) {
			proposer.clear_diplomatic_loan(player);
		} else {
			proposer.set_diplomatic_loan(player, e.applied.proposer_loan);
		}
		e.game.get('f_diplomacy_restore_pair')(player, proposer, e.applied.diplomacy);
		e.game.trigger('economy_updated', {player: player});
		e.game.trigger('economy_updated', {player: proposer});
		e.game.trigger('research_updated', {player: player});
		e.game.trigger('diplomacy_updated', {
			player: player,
			target: proposer,
			relation: e.applied.diplomacy.player_relation,
		});
		e.game.trigger('diplomatic_surrender_updated', {
			player: proposer,
			target: player,
		});
	},

};
