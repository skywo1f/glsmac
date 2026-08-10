const get_relative_strength = (own_power, other_power) => {
	const total = #max(1.0, own_power + other_power);
	return (other_power - own_power) / total;
};

const get_acceptance_score = (state) => {
	const relative_strength = get_relative_strength(state.own_power, state.other_power);
	const base_pressure = #to_float(state.other_bases - state.own_bases) * 4.0;
	if (state.offer == 'treaty') {
		let score = 20.0 + relative_strength * 60.0 + base_pressure;
		if (state.relation == 'vendetta') {
			score -= 25.0;
		}
		if (state.relation == 'pact') {
			score -= 100.0;
		}
		return score;
	}
	if (state.offer == 'pact') {
		if (state.relation != 'treaty') {
			return 0.0 - 100.0;
		}
		return 5.0 + relative_strength * 35.0 + base_pressure;
	}
	return 0.0 - 100.0;
};

const should_accept = (state) => {
	return get_acceptance_score(state) >= 0.0;
};

const get_proposal = (state) => {
	if (state.relation == 'vendetta') {
		const treaty_state = {
			offer: 'treaty',
			relation: state.relation,
			own_power: state.own_power,
			other_power: state.other_power,
			own_bases: state.own_bases,
			other_bases: state.other_bases,
		};
		const score = get_acceptance_score(treaty_state);
		return score >= 0.0 ? {relation: 'treaty', score: score} : null;
	}
	if (state.relation == 'treaty') {
		const pact_state = {
			offer: 'pact',
			relation: state.relation,
			own_power: state.own_power,
			other_power: state.other_power,
			own_bases: state.own_bases,
			other_bases: state.other_bases,
		};
		const score = get_acceptance_score(pact_state);
		return score >= 10.0 ? {relation: 'pact', score: score} : null;
	}
	return null;
};

const get_shared_technology_multiplier = (relation, relative_strength) => {
	let multiplier = 2.0;
	if (relation == 'treaty') {
		multiplier = 1.6;
	} else if (relation == 'pact') {
		multiplier = 1.3;
	}
	return multiplier + #max(0.0, relative_strength) * 0.8;
};

const get_trade_acceptance_score = (state) => {
	if (state.relation == 'vendetta') {
		return 0.0 - 100000.0;
	}
	const relative_strength = get_relative_strength(state.own_power, state.other_power);
	const sharing_multiplier = get_shared_technology_multiplier(
		state.relation,
		relative_strength
	);
	let received = #to_float(state.terms.offer_energy);
	let given = #to_float(state.terms.request_energy);
	if (state.terms.offer_technology != '') {
		received += #to_float(state.offer_technology_cost) * 2.5;
	}
	if (state.terms.request_technology != '') {
		given += #to_float(state.request_technology_cost) * sharing_multiplier;
	}
	return received - given - 5.0;
};

const reverse_terms = (terms) => {
	return {
		offer_energy: terms.request_energy,
		offer_technology: terms.request_technology,
		request_energy: terms.offer_energy,
		request_technology: terms.offer_technology,
	};
};

const score_trade_proposal = (state, terms, offer_cost, request_cost) => {
	const recipient_score = get_trade_acceptance_score({
		relation: state.relation,
		own_power: state.other_power,
		other_power: state.own_power,
		terms: terms,
		offer_technology_cost: offer_cost,
		request_technology_cost: request_cost,
	});
	if (recipient_score < 0.0) {
		return null;
	}
	const proposer_score = get_trade_acceptance_score({
		relation: state.relation,
		own_power: state.own_power,
		other_power: state.other_power,
		terms: reverse_terms(terms),
		offer_technology_cost: request_cost,
		request_technology_cost: offer_cost,
	});
	if (proposer_score < 0.0) {
		return null;
	}
	return proposer_score + recipient_score * 0.25;
};

const get_trade_proposal = (state) => {
	if (state.relation == 'vendetta') {
		return null;
	}
	let best = null;
	const consider = (terms, offer_cost, request_cost) => {
		const score = score_trade_proposal(state, terms, offer_cost, request_cost);
		if (score != null && (best == null || score > best.score)) {
			best = {terms: terms, score: score};
		}
	};

	for (own_technology of state.own_technologies) {
		for (other_technology of state.other_technologies) {
			consider({
				offer_energy: 0,
				offer_technology: own_technology.id,
				request_energy: 0,
				request_technology: other_technology.id,
			}, own_technology.cost, other_technology.cost);
		}
	}

	for (other_technology of state.other_technologies) {
		const price = other_technology.cost * 2;
		if (price <= state.own_energy && state.own_energy - price >= 25) {
			consider({
				offer_energy: price,
				offer_technology: '',
				request_energy: 0,
				request_technology: other_technology.id,
			}, 0, other_technology.cost);
		}
	}

	for (own_technology of state.own_technologies) {
		const price = own_technology.cost * 2;
		if (price <= state.other_energy && state.other_energy - price >= 25) {
			consider({
				offer_energy: 0,
				offer_technology: own_technology.id,
				request_energy: price,
				request_technology: '',
			}, own_technology.cost, 0);
		}
	}

	return best;
};

return {
	get_acceptance_score: get_acceptance_score,
	should_accept: should_accept,
	get_proposal: get_proposal,
	get_trade_acceptance_score: get_trade_acceptance_score,
	get_trade_proposal: get_trade_proposal,
};
