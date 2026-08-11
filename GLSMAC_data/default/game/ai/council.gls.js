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

const get_policy_value = (game, voter) => {
	const get_commerce = game.get('f_economy_get_player_commerce');
	if (#is_defined(get_commerce)) {
		let value = get_commerce(game, voter) * 4;
		for (other of game.get_players()) {
			if (other.id == voter.id || other.get_faction().is_progenitor) { continue; }
			const benefit = get_commerce(game, other);
			const relation = voter.get_diplomatic_relation(other);
			if (relation == 'pact') {
				value += benefit * 2;
			} else if (relation == 'treaty') {
				value += benefit;
			} else if (relation == 'vendetta') {
				value -= benefit * 3;
			} else {
				value -= benefit;
			}
		}
		return value;
	}

	let value = 0;
	for (other of game.get_players()) {
		if (other.id == voter.id || other.get_faction().is_progenitor) { continue; }
		const relation = voter.get_diplomatic_relation(other);
		if (relation == 'pact') {
			value += 4;
		} else if (relation == 'treaty') {
			value += 2;
		} else if (relation == 'vendetta') {
			value -= 3;
		} else {
			value--;
		}
	}
	return value;
};

const choose_policy_vote = (game, voter, proposal) => {
	const value = get_policy_value(game, voter);
	if (value == 0) { return -1; }
	if (proposal == 'trade_pact') {
		return value > 0 ? 1 : 0;
	}
	return value < 0 ? 1 : 0;
};

const choose_vote = (game, voter, session) => {
	if (session.proposal == 'trade_pact' || session.proposal == 'repeal_trade_pact') {
		return choose_policy_vote(game, voter, session.proposal);
	}
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
	get_policy_value: get_policy_value,
	choose_policy_vote: choose_policy_vote,
	choose_vote: choose_vote,
};
