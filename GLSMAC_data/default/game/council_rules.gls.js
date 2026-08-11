const MINIMUM_SESSION_INTERVAL = 20;
const VOTE_PENDING = -2;
const VOTE_ABSTAIN = -1;

const get_population = (game, player) => {
	let population = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			population += base.get_size();
		}
	}
	return population;
};

const owns_project = (game, player, project_id) => {
	const base = game.get_bm().get_project_base(project_id);
	return #is_defined(base) && base != null && base.get_owner().id == player.id;
};

const get_votes = (game, player) => {
	if (player.get_faction().is_progenitor) {
		return 0;
	}
	let votes = get_population(game, player);
	if (owns_project(game, player, 'TheEmpathGuild')) {
		votes += #floor(#to_float(votes) / 2.0);
	}
	if (owns_project(game, player, 'ClinicalImmortality')) {
		votes *= 2;
	}
	if (player.get_faction().id == 'PEACEKEEPERS') {
		votes *= 2;
	}
	return votes;
};

const get_voters = (game) => {
	let voters = [];
	for (player of game.get_players()) {
		if (get_population(game, player) > 0 && !player.get_faction().is_progenitor) {
			voters :+player;
		}
	}
	return voters;
};

const outranks = (left, right) => {
	return right == null || left.votes > right.votes ||
		(left.votes == right.votes && left.player.id < right.player.id);
};

const get_rankings = (game) => {
	let first = null;
	let second = null;
	for (player of get_voters(game)) {
		const entry = {player: player, votes: get_votes(game, player)};
		if (outranks(entry, first)) {
			second = first;
			first = entry;
		} else if (outranks(entry, second)) {
			second = entry;
		}
	}
	let result = [];
	if (first != null) { result :+first; }
	if (second != null) { result :+second; }
	return result;
};

const get_total_votes = (game) => {
	let total = 0;
	for (player of get_voters(game)) {
		total += get_votes(game, player);
	}
	return total;
};

const get_governor = (game) => {
	for (player of get_voters(game)) {
		if (player.get_council_state().is_governor) {
			return player;
		}
	}
	return null;
};

const same_session = (left, right) => {
	return
		left.proposal == right.proposal &&
		left.last_session_turn == right.last_session_turn &&
		left.caller_id == right.caller_id &&
		left.candidate_a_id == right.candidate_a_id &&
		left.candidate_b_id == right.candidate_b_id;
};

const has_active_session = (game) => {
	for (player of game.get_players()) {
		if (player.get_council_state().proposal != '') {
			return true;
		}
	}
	return false;
};

const get_session = (game) => {
	let session = null;
	for (player of game.get_players()) {
		const state = player.get_council_state();
		if (state.proposal != '' && session == null) {
			session = state;
		}
	}
	if (session == null) { return null; }
	for (player of game.get_players()) {
		const state = player.get_council_state();
		if (state.proposal == '' || !same_session(session, state)) {
			return null;
		}
	}
	return session;
};

const get_last_session_turn = (game) => {
	let result = 0;
	for (player of game.get_players()) {
		result = #max(result, player.get_council_state().last_session_turn);
	}
	return result;
};

const is_voter = (game, player) => {
	for (voter of get_voters(game)) {
		if (voter.id == player.id) { return true; }
	}
	return false;
};

const validate_call = (game, player, proposal) => {
	if (game.is_game_over()) {
		return 'Game already has a winner';
	}
	if (proposal != 'governor' && proposal != 'supreme') {
		return 'Unsupported Planetary Council proposal';
	}
	if (!is_voter(game, player)) {
		return 'Only a living human faction may convene the Planetary Council';
	}
	if (game.get_turn() <= 0) {
		return 'The Planetary Council cannot convene before the first mission year';
	}
	if (has_active_session(game)) {
		return 'A Planetary Council session is already active';
	}
	if (#sizeof(get_rankings(game)) < 2) {
		return 'At least two eligible factions are required for a Council election';
	}
	const last_turn = get_last_session_turn(game);
	if (last_turn > 0 && game.get_turn() - last_turn < MINIMUM_SESSION_INTERVAL) {
		return 'The Planetary Council may only meet once every 20 turns';
	}
	if (proposal == 'supreme') {
		if (!player.has_technology('MindMachineInterface')) {
			return 'Mind/Machine Interface is required to propose Supreme Leader';
		}
		if (get_votes(game, player) * 2 < get_total_votes(game)) {
			return 'A Supreme Leader proposal requires at least half of all Council votes';
		}
	}
};

const validate_vote = (game, player, vote_id) => {
	if (game.is_game_over()) {
		return 'Game already has a winner';
	}
	const session = get_session(game);
	if (session == null) {
		return has_active_session(game)
			? 'Planetary Council session state is inconsistent'
			: 'No Planetary Council vote is active';
	}
	if (!is_voter(game, player)) {
		return 'Faction is not eligible to vote in the Planetary Council';
	}
	const state = player.get_council_state();
	if (state.vote_id != VOTE_PENDING) {
		return 'Faction has already cast its Planetary Council vote';
	}
	if (
		vote_id != VOTE_ABSTAIN && vote_id != session.candidate_a_id &&
		vote_id != session.candidate_b_id
	) {
		return 'Planetary Council vote must select a candidate or abstain';
	}
};

const get_required_votes = (proposal, total) => {
	if (proposal == 'supreme') {
		return #ceil(#to_float(total * 3) / 4.0);
	}
	return #floor(#to_float(total) / 2.0) + 1;
};

const get_tally = (game) => {
	const session = get_session(game);
	if (session == null) { return null; }
	let result = {
		proposal: session.proposal,
		candidate_a_id: session.candidate_a_id,
		candidate_b_id: session.candidate_b_id,
		candidate_a_votes: 0,
		candidate_b_votes: 0,
		total_votes: 0,
		required_votes: 0,
		all_voted: true,
	};
	for (player of get_voters(game)) {
		const votes = get_votes(game, player);
		result.total_votes = result.total_votes + votes;
		const vote_id = player.get_council_state().vote_id;
		if (vote_id == VOTE_PENDING) {
			result.all_voted = false;
		} else if (vote_id == session.candidate_a_id) {
			result.candidate_a_votes = result.candidate_a_votes + votes;
		} else if (vote_id == session.candidate_b_id) {
			result.candidate_b_votes = result.candidate_b_votes + votes;
		}
	}
	result.required_votes = get_required_votes(session.proposal, result.total_votes);
	return result;
};

const get_result = (game) => {
	const tally = get_tally(game);
	if (tally == null || !tally.all_voted) { return null; }
	let winner_id = -1;
	let winner_votes = 0;
	if (tally.candidate_a_votes > tally.candidate_b_votes) {
		winner_id = tally.candidate_a_id;
		winner_votes = tally.candidate_a_votes;
	} else if (tally.candidate_b_votes > tally.candidate_a_votes) {
		winner_id = tally.candidate_b_id;
		winner_votes = tally.candidate_b_votes;
	}
	return {
		proposal: tally.proposal,
		winner_id: winner_votes >= tally.required_votes ? winner_id : -1,
		winner_votes: winner_votes,
		required_votes: tally.required_votes,
		total_votes: tally.total_votes,
	};
};

const snapshot_states = (game) => {
	let result = [];
	for (player of game.get_players()) {
		result :+{player: player, state: player.get_council_state()};
	}
	return result;
};

const restore_states = (snapshot) => {
	for (entry of snapshot) {
		entry.player.set_council_state(entry.state);
	}
};

return {
	minimum_session_interval: MINIMUM_SESSION_INTERVAL,
	vote_pending: VOTE_PENDING,
	vote_abstain: VOTE_ABSTAIN,
	get_population: get_population,
	get_votes: get_votes,
	get_voters: get_voters,
	get_rankings: get_rankings,
	get_total_votes: get_total_votes,
	get_governor: get_governor,
	has_active_session: has_active_session,
	get_session: get_session,
	get_last_session_turn: get_last_session_turn,
	validate_call: validate_call,
	validate_vote: validate_vote,
	get_required_votes: get_required_votes,
	get_tally: get_tally,
	get_result: get_result,
	snapshot_states: snapshot_states,
	restore_states: restore_states,
};
