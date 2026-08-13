const rules = #include('council_rules');
const council_ai = #include('ai/council');

return (game) => {
	game.on('start', (e) => {
		let resolution_pending = false;
		let accession_resolution_pending = false;
		let defiance_victory_pending = false;
		let ai_votes_pending = {};
		let ai_supreme_responses_pending = {};

		const process_session = () => {
			if (!game.is_master() || game.is_game_over()) { return; }
			const session = rules.get_session(game);
			if (session == null) {
				resolution_pending = false;
				ai_votes_pending = {};
				return;
			}
			let still_pending = {};
			for (player of rules.get_voters(game)) {
				if (
					player.type == 'ai' &&
					player.get_council_state().vote_id == rules.vote_pending
				) {
					const key = 'p' + #to_string(player.id);
					still_pending[key] = true;
					if (!#is_defined(ai_votes_pending[key])) {
						game.event_as(player.id, 'cast_council_vote', {
							player: player,
							vote_id: council_ai.choose_vote(game, player, session),
						});
					}
				}
			}
			ai_votes_pending = still_pending;
			const tally = rules.get_tally(game);
			if (tally != null && tally.all_voted && !resolution_pending) {
				resolution_pending = true;
				game.event('resolve_planetary_council', {});
			}
		};

		const maybe_call_ai = () => {
			if (!game.is_master() || game.is_game_over() || rules.has_active_session(game)) {
				return;
			}
			const governor = rules.get_governor(game);
			for (player of rules.get_voters(game)) {
				if (
					player.type == 'ai' &&
					!#is_defined(rules.validate_call(game, player, 'supreme'))
				) {
					game.event_as(player.id, 'call_planetary_council', {
						player: player, proposal: 'supreme',
					});
					return;
				}
			}
			if (governor != null && governor.type == 'ai') {
				for (proposal of rules.get_available_policy_proposals(game, governor)) {
					if (
						council_ai.choose_policy_vote(game, governor, proposal) == rules.vote_yes
					) {
						game.event_as(governor.id, 'call_planetary_council', {
							player: governor, proposal: proposal,
						});
						return;
					}
				}
			}
			for (entry of rules.get_rankings(game)) {
				const player = entry.player;
				const should_challenge = governor == null || (
					governor.id != player.id &&
					player.get_diplomatic_relation(governor) == 'vendetta'
				);
				if (
					player.type == 'ai' && should_challenge &&
					!#is_defined(rules.validate_call(game, player, 'governor'))
				) {
					game.event_as(player.id, 'call_planetary_council', {
						player: player, proposal: 'governor',
					});
					return;
				}
			}
		};

		const process_supreme = () => {
			if (!game.is_master() || game.is_game_over()) { return; }
			const supreme = rules.get_supreme_state(game);
			if (supreme == null) {
				accession_resolution_pending = false;
				defiance_victory_pending = false;
				ai_supreme_responses_pending = {};
				return;
			}
			if (!supreme.resolved) {
				defiance_victory_pending = false;
				let still_pending = {};
				for (player of rules.get_pending_supreme_players(game)) {
					if (player.type == 'ai') {
						const key = 'p' + #to_string(player.id);
						still_pending[key] = true;
						if (!#is_defined(ai_supreme_responses_pending[key])) {
							game.event_as(player.id, 'respond_supreme_leader', {
								player: player,
								defy: council_ai.choose_supreme_defiance(player, supreme.leader),
							});
						}
					}
				}
				ai_supreme_responses_pending = still_pending;
				if (
					(!rules.has_surviving_faction(game, supreme.leader) ||
						#sizeof(rules.get_pending_supreme_players(game)) == 0) &&
					!accession_resolution_pending
				) {
					accession_resolution_pending = true;
					game.event('resolve_supreme_accession', {});
				}
				return;
			}

			accession_resolution_pending = false;
			ai_supreme_responses_pending = {};
			if (
				rules.get_supreme_defiance_winner(game) != null &&
				!defiance_victory_pending
			) {
				defiance_victory_pending = true;
				game.event('resolve_supreme_defiance', {});
			}
		};

		game.set('f_council_get_votes', (player) => { return rules.get_votes(game, player); });
		game.set('f_council_get_voters', () => { return rules.get_voters(game); });
		game.set('f_council_get_rankings', () => { return rules.get_rankings(game); });
		game.set('f_council_get_total_votes', () => { return rules.get_total_votes(game); });
		game.set('f_council_get_governor', () => { return rules.get_governor(game); });
		game.set('f_council_has_global_trade_pact', () => {
			return rules.has_global_trade_pact(game);
		});
		game.set('f_council_has_salvaged_unity_core', () => {
			return rules.has_salvaged_unity_core(game);
		});
		game.set('f_council_is_un_charter_repealed', () => {
			return rules.is_un_charter_repealed(game);
		});
		game.set('f_council_is_expelled', (player) => {
			return rules.is_expelled(player);
		});
		game.set('f_council_get_supreme_state', () => {
			return rules.get_supreme_state(game);
		});
		game.set('f_council_get_supreme_response', (player) => {
			return rules.get_supreme_response(player);
		});
		game.set('f_council_get_pending_supreme_players', () => {
			return rules.get_pending_supreme_players(game);
		});
		game.set('f_council_get_defiant_supreme_players', () => {
			return rules.get_defiant_supreme_players(game);
		});
		game.set('f_council_get_supreme_defiance_winner', () => {
			return rules.get_supreme_defiance_winner(game);
		});
		game.set('f_council_get_forced_relation', (player, other) => {
			return rules.get_forced_relation(game, player, other);
		});
		game.set('f_council_is_policy_proposal', (proposal) => {
			return rules.is_policy_proposal(proposal);
		});
		game.set('f_council_get_proposal_name', (proposal) => {
			return rules.get_proposal_name(proposal);
		});
		game.set('f_council_get_session', () => { return rules.get_session(game); });
		game.set('f_council_get_tally', () => { return rules.get_tally(game); });
		game.set('f_council_validate_call', (player, proposal) => {
			return rules.validate_call(game, player, proposal);
		});
		game.set('f_council_is_governor', (player) => {
			const governor = rules.get_governor(game);
			return governor != null && governor.id == player.id;
		});
		game.set('f_council_has_intelligence', (player, other) => {
			if (player.id == other.id) { return false; }
			if (player.has_infiltrated(other)) { return true; }
			const governor = rules.get_governor(game);
			return governor != null && governor.id == player.id && !other.get_faction().is_progenitor;
		});

		game.on('council_updated', (event) => {
			process_session();
			process_supreme();
		});
		game.on('player_update', (event) => {
			if (!game.is_master()) {
				game.trigger('council_updated', {player: event.player});
			}
		});
		game.on('submission_updated', (event) => { process_supreme(); });
		game.on('turn', (e) => {
			process_session();
			process_supreme();
			maybe_call_ai();
		});
		if (
			#typeof(game.get_um) == 'Callable' &&
			#typeof(game.get_um().on) == 'Callable'
		) {
			game.get_um().on('unit_despawn', (event) => { process_supreme(); });
		}
		if (
			#typeof(game.get_bm) == 'Callable' &&
			#typeof(game.get_bm().on) == 'Callable'
		) {
			game.get_bm().on('base_despawn', (event) => { process_supreme(); });
		}
		process_session();
		process_supreme();
	});
};
