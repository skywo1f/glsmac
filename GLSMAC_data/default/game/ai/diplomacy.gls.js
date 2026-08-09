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

return {
	get_acceptance_score: get_acceptance_score,
	should_accept: should_accept,
	get_proposal: get_proposal,
};
