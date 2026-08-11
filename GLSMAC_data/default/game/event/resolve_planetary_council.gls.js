const rules = #include('../council_rules');

const clear_session = (game, governor_id, global_trade_pact) => {
	for (player of game.get_players()) {
		const old = player.get_council_state();
		player.set_council_state({
			is_governor: governor_id < 0 ? old.is_governor : player.id == governor_id,
			last_session_turn: old.last_session_turn,
			proposal: '',
			caller_id: -1,
			candidate_a_id: -1,
			candidate_b_id: -1,
			vote_id: rules.vote_pending,
			global_trade_pact: #is_defined(global_trade_pact)
				? global_trade_pact
				: old.global_trade_pact,
		});
	}
};

return {
	validate: (e) => {
		if (e.caller != 0) {
			return 'Only the game master can resolve the Planetary Council';
		}
		if (e.game.is_game_over()) {
			return 'Game already has a winner';
		}
		const tally = rules.get_tally(e.game);
		if (tally == null) {
			return rules.has_active_session(e.game)
				? 'Planetary Council session state is inconsistent'
				: 'No Planetary Council vote is active';
		}
		if (!tally.all_voted) {
			return 'Planetary Council is still waiting for votes';
		}
	},

	apply: (e) => {
		const previous = rules.snapshot_states(e.game);
		const result = rules.get_result(e.game);
		if (result.proposal == 'governor') {
			clear_session(e.game, result.winner_id, #undefined);
			if (result.winner_id >= 0) {
				const winner = e.game.get_player(result.winner_id);
				e.game.message(
					winner.get_faction().name + ' has been elected Planetary Governor with ' +
					#to_string(result.winner_votes) + ' of ' +
					#to_string(result.total_votes) + ' votes.'
				);
			} else {
				e.game.message('The Planetary Governor proposal failed to win a majority.');
			}
			e.game.trigger('economy_updated', {});
		} else if (rules.is_policy_proposal(result.proposal)) {
			const passed = result.winner_id == rules.vote_yes;
			const active = rules.has_global_trade_pact(e.game);
			const updated = passed
				? result.proposal == 'trade_pact'
				: active;
			clear_session(e.game, (-1), updated);
			if (passed) {
				e.game.message(
					(result.proposal == 'trade_pact'
						? 'The Global Trade Pact has passed. Commerce rates are now doubled'
						: 'The Global Trade Pact has been repealed. Commerce rates have returned to normal') +
					' with ' + #to_string(result.winner_votes) + ' of ' +
					#to_string(result.total_votes) + ' votes.'
				);
			} else {
				e.game.message(
					(result.proposal == 'trade_pact'
						? 'The Global Trade Pact proposal'
						: 'The proposal to repeal the Global Trade Pact') +
					' failed to win a majority.'
				);
			}
			e.game.trigger('economy_updated', {});
		} else {
			clear_session(e.game, (-1), #undefined);
			if (result.winner_id >= 0) {
				const winner = e.game.get_player(result.winner_id);
				e.game.declare_victory('diplomatic', result.winner_id);
				e.game.message(
					winner.get_faction().name + ' has been elected Supreme Leader of Planet in M.Y. ' +
					#to_string(e.game.get_year()) + '.'
				);
			} else {
				e.game.message('The Supreme Leader proposal failed to win a three-quarters majority.');
			}
		}
		e.game.trigger('council_updated', {proposal: ''});
		return {states: previous, terminal: result.proposal == 'supreme' && result.winner_id >= 0};
	},

	rollback: (e) => {
		if (!e.applied.terminal) {
			rules.restore_states(e.applied.states);
			e.game.trigger('council_updated', {});
		}
		// Successful Supreme Leader resolutions are host-authored terminal events.
	},
};
