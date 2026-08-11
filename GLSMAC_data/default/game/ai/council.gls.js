const score_candidate = (voter, candidate, proposal) => {
	if (voter.id == candidate.id) {
		return 100000;
	}
	const relation = voter.get_diplomatic_relation(candidate);
	let score = 0;
	if (relation == 'pact') {
		score = 800;
	} else if (relation == 'treaty') {
		score = 250;
	} else if (relation == 'vendetta') {
		score = 0 - 1000;
	}
	score -= candidate.get_integrity_blemishes() * 80;
	if (candidate.get_council_state().is_governor) {
		score += 40;
	}
	if (proposal == 'supreme') {
		score -= relation == 'pact' ? 0 : 300;
	}
	return score;
};

const choose_vote = (game, voter, session) => {
	const first = game.get_player(session.candidate_a_id);
	const second = game.get_player(session.candidate_b_id);
	const first_score = score_candidate(voter, first, session.proposal);
	const second_score = score_candidate(voter, second, session.proposal);
	const minimum = session.proposal == 'supreme' ? 200 : -400;
	if (#max(first_score, second_score) < minimum) {
		return -1;
	}
	if (first_score == second_score) {
		return first.id < second.id ? first.id : second.id;
	}
	return first_score > second_score ? first.id : second.id;
};

return {
	score_candidate: score_candidate,
	choose_vote: choose_vote,
};
