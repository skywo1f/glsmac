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

const get_energy_credits = (player) => {
	return #typeof(player.get_energy_credits) == 'Callable'
		? player.get_energy_credits()
		: player.energy_credits;
};

const get_major_atrocities = (player) => {
	return #typeof(player.get_major_atrocities) == 'Callable'
		? player.get_major_atrocities()
		: 0;
};

const get_sanction_turns = (player) => {
	return #typeof(player.get_sanction_turns) == 'Callable'
		? player.get_sanction_turns()
		: 0;
};

const get_unity_core_value = (game, voter) => {
	let value = 400 + #floor(
		#to_float(#min(600, #max(0, 1000 - get_energy_credits(voter)))) / 2.0
	);
	for (other of game.get_players()) {
		if (other.id == voter.id || other.get_faction().is_progenitor) { continue; }
		const relation = voter.get_diplomatic_relation(other);
		if (relation == 'pact') {
			value += 60;
		} else if (relation == 'treaty') {
			value += 20;
		} else if (relation == 'vendetta') {
			value -= 140;
		} else {
			value -= 40;
		}
	}
	return value;
};

const get_un_charter_value = (game, voter) => {
	let value = 250;
	value -= get_major_atrocities(voter) * 180;
	value -= get_sanction_turns(voter) * 10;
	const can_launch_planet_busters = voter.has_technology('OrbitalSpaceflight');
	for (other of game.get_players()) {
		if (other.id == voter.id || other.get_faction().is_progenitor) { continue; }
		const relation = voter.get_diplomatic_relation(other);
		if (relation == 'pact') {
			value += 60;
		} else if (relation == 'treaty') {
			value += 30;
		} else if (relation == 'vendetta') {
			value += 60 + get_major_atrocities(other) * 120;
			if (other.has_technology('OrbitalSpaceflight')) { value += 220; }
			if (can_launch_planet_busters) { value -= 180; }
		}
	}
	return value;
};

const choose_policy_vote = (game, voter, proposal) => {
	let value = 0;
	if (proposal == 'salvage_unity_core') {
		value = get_unity_core_value(game, voter);
	} else if (proposal == 'repeal_un_charter' || proposal == 'reinstate_un_charter') {
		value = get_un_charter_value(game, voter);
	} else {
		value = get_policy_value(game, voter);
	}
	if (value == 0) { return -1; }
	if (
		proposal == 'trade_pact' || proposal == 'salvage_unity_core' ||
		proposal == 'reinstate_un_charter'
	) {
		return value > 0 ? 1 : 0;
	}
	return value < 0 ? 1 : 0;
};

const choose_vote = (game, voter, session) => {
	if (
		session.proposal == 'trade_pact' || session.proposal == 'repeal_trade_pact' ||
		session.proposal == 'salvage_unity_core' ||
		session.proposal == 'repeal_un_charter' ||
		session.proposal == 'reinstate_un_charter'
	) {
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
	get_unity_core_value: get_unity_core_value,
	get_un_charter_value: get_un_charter_value,
	choose_policy_vote: choose_policy_vote,
	choose_vote: choose_vote,
};
