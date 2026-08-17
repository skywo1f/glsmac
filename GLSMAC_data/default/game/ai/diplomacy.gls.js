const get_relative_strength = (own_power, other_power) => {
	const total = #max(1.0, own_power + other_power);
	return (other_power - own_power) / total;
};

const get_other_integrity_blemishes = (state) => {
	return #is_defined(state.other_integrity_blemishes)
		? state.other_integrity_blemishes
		: 0;
};

const get_acceptance_score = (state) => {
	const relative_strength = get_relative_strength(state.own_power, state.other_power);
	const base_pressure = #to_float(state.other_bases - state.own_bases) * 4.0;
	const integrity_blemishes = #to_float(get_other_integrity_blemishes(state));
	if (state.offer == 'treaty') {
		let score = 20.0 + relative_strength * 60.0 + base_pressure - integrity_blemishes * 8.0;
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
		return 5.0 + relative_strength * 35.0 + base_pressure - integrity_blemishes * 12.0;
	}
	return 0.0 - 100.0;
};

const should_accept = (state) => {
	return get_acceptance_score(state) >= 0.0;
};

const get_surrender_score = (state) => {
	if (state.relation != 'vendetta' || state.own_bases > 2 || state.other_bases <= 0) {
		return 0.0 - 100000.0;
	}
	const relative_strength = get_relative_strength(state.own_power, state.other_power);
	const base_pressure = #to_float(state.other_bases - state.own_bases) * 20.0;
	const last_colony_pressure = #to_float(#max(0, 2 - state.own_bases)) * 20.0;
	const integrity_penalty = #to_float(get_other_integrity_blemishes(state)) * 5.0;
	return relative_strength * 100.0 + base_pressure + last_colony_pressure -
		integrity_penalty - 70.0;
};

const should_offer_surrender = (state) => {
	return get_surrender_score(state) >= 0.0;
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
			other_integrity_blemishes: get_other_integrity_blemishes(state),
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
			other_integrity_blemishes: get_other_integrity_blemishes(state),
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

const get_contact_id = (terms, key) => {
	const value = terms[key];
	return #typeof(value) == 'Int' ? value : 0 - 1;
};

const get_contact_value = (state, key) => {
	const value = state[key];
	return #typeof(value) == 'Int' ? value : 0;
};

const get_shared_contact_multiplier = (relation) => {
	if (relation == 'pact') { return 1.0; }
	if (relation == 'treaty') { return 1.1; }
	return 1.25;
};

const has_map_term = (terms, key) => {
	return #typeof(terms[key]) == 'Bool' && terms[key];
};

const get_map_value = (state, key) => {
	const value = state[key];
	return #typeof(value) == 'Int' ? value : 0;
};

const get_base_id = (terms, key) => {
	const value = terms[key];
	return #typeof(value) == 'Int' ? value : 0 - 1;
};

const get_base_value = (state, key) => {
	const value = state[key];
	return #typeof(value) == 'Int' ? value : 0;
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
	if (get_contact_id(state.terms, 'offer_contact') >= 0) {
		received += #to_float(get_contact_value(state, 'offer_contact_value')) * 1.5;
	}
	if (get_contact_id(state.terms, 'request_contact') >= 0) {
		given += #to_float(get_contact_value(state, 'request_contact_value')) *
			get_shared_contact_multiplier(state.relation);
	}
	if (has_map_term(state.terms, 'offer_map')) {
		received += #to_float(get_map_value(state, 'offer_map_value')) * 1.5;
	}
	if (has_map_term(state.terms, 'request_map')) {
		given += #to_float(get_map_value(state, 'request_map_value')) *
			get_shared_contact_multiplier(state.relation);
	}
	if (get_base_id(state.terms, 'offer_base') >= 0) {
		received += #to_float(get_base_value(state, 'offer_base_value'));
	}
	if (get_base_id(state.terms, 'request_base') >= 0) {
		given += #to_float(get_base_value(state, 'request_base_value'));
	}
	return received - given - 5.0;
};

const is_ultimatum = (terms) => {
	return #typeof(terms.is_ultimatum) == 'Bool' && terms.is_ultimatum;
};

const is_military_request = (terms) => {
	return #typeof(terms.request_vendetta_player) == 'Int' &&
		terms.request_vendetta_player >= 0;
};

const get_military_request_acceptance_score = (state) => {
	if (
		state.relation != 'pact' ||
		state.target_relation == 'vendetta'
	) {
		return 0.0 - 100000.0;
	}
	const own_power = #max(0.0, state.own_power);
	const ally_power = #max(0.0, state.other_power);
	const target_power = #max(1.0, state.target_power);
	const coalition_power = own_power + ally_power;
	const coalition_edge = (coalition_power - target_power) /
		#max(1.0, coalition_power + target_power) * 100.0;
	const threat_pressure = (target_power - own_power) /
		#max(1.0, target_power + own_power) * 50.0;
	let relation_penalty = 0.0;
	if (state.target_relation == 'treaty') {
		relation_penalty = 45.0;
	} else if (state.target_relation == 'pact') {
		relation_penalty = 100.0;
	}
	const integrity_penalty = #to_float(get_other_integrity_blemishes(state)) * 8.0;
	return coalition_edge + threat_pressure - relation_penalty - integrity_penalty - 5.0;
};

const get_military_request_proposal = (state) => {
	if (state.relation != 'pact') {
		return null;
	}
	let best = null;
	for (target of state.targets) {
		if (target.proposer_relation != 'vendetta' || target.recipient_relation == 'vendetta') {
			continue;
		}
		const acceptance_score = get_military_request_acceptance_score({
			relation: state.relation,
			own_power: state.other_power,
			other_power: state.own_power,
			target_power: target.power,
			target_relation: target.recipient_relation,
			other_integrity_blemishes: get_other_integrity_blemishes(state),
		});
		if (acceptance_score < 0.0) {
			continue;
		}
		const reinforcement_value = #max(0.0, target.power - state.own_power) * 4.0;
		const score = acceptance_score + reinforcement_value;
		if (best == null || score > best.score || (score == best.score && target.id < best.target_id)) {
			best = {
				target_id: target.id,
				score: score,
				terms: {
					offer_energy: 0,
					offer_technology: '',
					request_energy: 0,
					request_technology: '',
					offer_contact: 0 - 1,
					request_contact: 0 - 1,
					offer_map: false,
					request_map: false,
					offer_base: 0 - 1,
					request_base: 0 - 1,
					request_vendetta_player: target.id,
					is_ultimatum: false,
				},
			};
		}
	}
	return best;
};

const get_ultimatum_compliance_score = (state) => {
	const withdrawal_request = #typeof(state.terms.request_withdrawal) == 'Bool' &&
		state.terms.request_withdrawal;
	if (
		!is_ultimatum(state.terms) ||
		(withdrawal_request
			? state.relation != 'treaty'
			: (state.relation != 'neutral' && state.relation != 'vendetta'))
	) {
		return 0.0 - 100000.0;
	}
	const relative_strength = get_relative_strength(state.own_power, state.other_power);
	const base_pressure = #to_float(state.other_bases - state.own_bases) * 7.0;
	const war_pressure = state.relation == 'vendetta' ? 28.0 : 0.0;
	const integrity_penalty = #to_float(get_other_integrity_blemishes(state)) * 7.0;
	if (withdrawal_request) {
		return 35.0 + relative_strength * 125.0 + base_pressure - integrity_penalty;
	}
	let demand_cost = #to_float(state.terms.request_energy);
	let reserve_pressure = 0.0;
	if (state.terms.request_energy > 0) {
		reserve_pressure = #to_float(#max(
			0,
			50 - (state.own_energy - state.terms.request_energy)
		)) * 1.5;
	} else {
		demand_cost = #to_float(state.request_technology_cost) * 2.5;
	}
	return relative_strength * 125.0 + base_pressure + war_pressure -
		demand_cost * 0.35 - reserve_pressure - integrity_penalty - 5.0;
};

const get_ultimatum_proposal = (state) => {
	if (state.relation != 'neutral' && state.relation != 'vendetta') {
		return null;
	}
	const strength_advantage = 0.0 - get_relative_strength(
		state.own_power,
		state.other_power
	);
	const minimum_advantage = state.relation == 'vendetta' ? 0.1 : 0.2;
	if (strength_advantage < minimum_advantage) {
		return null;
	}
	let best = null;
	const consider = (terms, technology_cost, value) => {
		const compliance_score = get_ultimatum_compliance_score({
			relation: state.relation,
			own_power: state.other_power,
			other_power: state.own_power,
			own_bases: state.other_bases,
			other_bases: state.own_bases,
			own_energy: state.other_energy,
			other_integrity_blemishes: #is_defined(state.own_integrity_blemishes)
				? state.own_integrity_blemishes
				: 0,
			request_technology_cost: technology_cost,
			terms: terms,
		});
		if (compliance_score < 0.0) {
			return;
		}
		const score = #to_float(value) + compliance_score * 0.1;
		if (best == null || score > best.score) {
			best = {terms: terms, score: score};
		}
	};
	const make_terms = (energy, technology) => {
		return {
			offer_energy: 0,
			offer_technology: '',
			request_energy: energy,
			request_technology: technology,
			offer_contact: 0 - 1,
			request_contact: 0 - 1,
			offer_map: false,
			request_map: false,
			offer_base: 0 - 1,
			request_base: 0 - 1,
			is_ultimatum: true,
		};
	};
	const available_energy = #min(200, #max(0, state.other_energy - 50));
	for (let energy = 25; energy <= available_energy; energy += 25) {
		consider(make_terms(energy, ''), 0, energy);
	}
	for (technology of state.other_technologies) {
		consider(
			make_terms(0, technology.id),
			technology.cost,
			#to_float(technology.cost) * 2.5
		);
	}
	return best;
};

const reverse_terms = (terms) => {
	return {
		offer_energy: terms.request_energy,
		offer_technology: terms.request_technology,
		request_energy: terms.offer_energy,
		request_technology: terms.offer_technology,
		offer_contact: get_contact_id(terms, 'request_contact'),
		request_contact: get_contact_id(terms, 'offer_contact'),
		offer_map: has_map_term(terms, 'request_map'),
		request_map: has_map_term(terms, 'offer_map'),
		offer_base: get_base_id(terms, 'request_base'),
		request_base: get_base_id(terms, 'offer_base'),
	};
};

const score_trade_proposal = (
	state,
	terms,
	offer_cost,
	request_cost,
	offer_contact_value,
	request_contact_value,
	offer_base_recipient_value,
	request_base_recipient_value,
	offer_base_proposer_value,
	request_base_proposer_value
) => {
	const recipient_offer_base_value = #is_defined(offer_base_recipient_value)
		? offer_base_recipient_value : get_base_value(state, 'offer_base_value');
	const recipient_request_base_value = #is_defined(request_base_recipient_value)
		? request_base_recipient_value : get_base_value(state, 'request_base_value');
	const proposer_offer_base_value = #is_defined(offer_base_proposer_value)
		? offer_base_proposer_value : get_base_value(state, 'offer_base_value');
	const proposer_request_base_value = #is_defined(request_base_proposer_value)
		? request_base_proposer_value : get_base_value(state, 'request_base_value');
	const recipient_score = get_trade_acceptance_score({
		relation: state.relation,
		own_power: state.other_power,
		other_power: state.own_power,
		terms: terms,
		offer_technology_cost: offer_cost,
		request_technology_cost: request_cost,
		offer_contact_value: offer_contact_value,
		request_contact_value: request_contact_value,
		offer_map_value: get_map_value(state, 'own_map_value'),
		request_map_value: get_map_value(state, 'other_map_value'),
		offer_base_value: recipient_offer_base_value,
		request_base_value: recipient_request_base_value,
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
		offer_contact_value: request_contact_value,
		request_contact_value: offer_contact_value,
		offer_map_value: get_map_value(state, 'other_map_value'),
		request_map_value: get_map_value(state, 'own_map_value'),
		offer_base_value: proposer_request_base_value,
		request_base_value: proposer_offer_base_value,
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
	const consider = (
		terms,
		offer_cost,
		request_cost,
		offer_contact_value,
		request_contact_value,
		offer_base_recipient_value,
		request_base_recipient_value,
		offer_base_proposer_value,
		request_base_proposer_value
	) => {
		const score = score_trade_proposal(
			state,
			terms,
			offer_cost,
			request_cost,
			offer_contact_value,
			request_contact_value,
			offer_base_recipient_value,
			request_base_recipient_value,
			offer_base_proposer_value,
			request_base_proposer_value
		);
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
				offer_contact: 0 - 1,
				request_contact: 0 - 1,
			}, own_technology.cost, other_technology.cost, 0, 0);
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
				offer_contact: 0 - 1,
				request_contact: 0 - 1,
			}, 0, other_technology.cost, 0, 0);
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
				offer_contact: 0 - 1,
				request_contact: 0 - 1,
			}, own_technology.cost, 0, 0, 0);
		}
	}

	const own_contacts = #is_defined(state.own_contacts) ? state.own_contacts : [];
	const other_contacts = #is_defined(state.other_contacts) ? state.other_contacts : [];
	for (own_contact of own_contacts) {
		for (other_contact of other_contacts) {
			consider({
				offer_energy: 0,
				offer_technology: '',
				request_energy: 0,
				request_technology: '',
				offer_contact: own_contact.id,
				request_contact: other_contact.id,
			}, 0, 0, own_contact.value, other_contact.value);
		}
	}
	for (other_contact of other_contacts) {
		const price = #ceil(#to_float(other_contact.value) * 1.25 / 5.0) * 5;
		if (price <= state.own_energy && state.own_energy - price >= 25) {
			consider({
				offer_energy: price,
				offer_technology: '',
				request_energy: 0,
				request_technology: '',
				offer_contact: 0 - 1,
				request_contact: other_contact.id,
			}, 0, 0, 0, other_contact.value);
		}
	}
	for (own_contact of own_contacts) {
		const price = #ceil(#to_float(own_contact.value) * 1.25 / 5.0) * 5;
		if (price <= state.other_energy && state.other_energy - price >= 25) {
			consider({
				offer_energy: 0,
				offer_technology: '',
				request_energy: price,
				request_technology: '',
				offer_contact: own_contact.id,
				request_contact: 0 - 1,
			}, 0, 0, own_contact.value, 0);
		}
	}

	const own_map_value = get_map_value(state, 'own_map_value');
	const other_map_value = get_map_value(state, 'other_map_value');
	if (own_map_value > 0 && other_map_value > 0) {
		consider({
			offer_energy: 0,
			offer_technology: '',
			request_energy: 0,
			request_technology: '',
			offer_contact: 0 - 1,
			request_contact: 0 - 1,
			offer_map: true,
			request_map: true,
		}, 0, 0, 0, 0);
	}
	if (own_map_value > 0) {
		for (other_technology of state.other_technologies) {
			consider({
				offer_energy: 0,
				offer_technology: '',
				request_energy: 0,
				request_technology: other_technology.id,
				offer_contact: 0 - 1,
				request_contact: 0 - 1,
				offer_map: true,
				request_map: false,
			}, 0, other_technology.cost, 0, 0);
		}
	}
	if (other_map_value > 0) {
		for (own_technology of state.own_technologies) {
			consider({
				offer_energy: 0,
				offer_technology: own_technology.id,
				request_energy: 0,
				request_technology: '',
				offer_contact: 0 - 1,
				request_contact: 0 - 1,
				offer_map: false,
				request_map: true,
			}, own_technology.cost, 0, 0, 0);
		}
	}

	const own_base_trades = #is_defined(state.own_base_trades)
		? state.own_base_trades : [];
	const other_base_trades = #is_defined(state.other_base_trades)
		? state.other_base_trades : [];
	const make_base_terms = (offer_energy, request_energy, offer_base, request_base) => {
		return {
			offer_energy: offer_energy,
			offer_technology: '',
			request_energy: request_energy,
			request_technology: '',
			offer_contact: 0 - 1,
			request_contact: 0 - 1,
			offer_map: false,
			request_map: false,
			offer_base: offer_base,
			request_base: request_base,
		};
	};
	const get_base_price = (seller_value, buyer_value) => {
		if (buyer_value - seller_value < 50) {
			return 0;
		}
		return #ceil(#to_float(seller_value + buyer_value) / 50.0) * 25;
	};

	for (other_base of other_base_trades) {
		const price = get_base_price(other_base.owner_value, other_base.recipient_value);
		if (price > 0 && price <= state.own_energy && state.own_energy - price >= 50) {
			consider(
				make_base_terms(price, 0, 0 - 1, other_base.id),
				0,
				0,
				0,
				0,
				0,
				other_base.owner_value,
				0,
				other_base.recipient_value
			);
		}
	}
	for (own_base of own_base_trades) {
		const price = get_base_price(own_base.owner_value, own_base.recipient_value);
		if (price > 0 && price <= state.other_energy && state.other_energy - price >= 50) {
			consider(
				make_base_terms(0, price, own_base.id, 0 - 1),
				0,
				0,
				0,
				0,
				own_base.recipient_value,
				0,
				own_base.owner_value,
				0
			);
		}
	}
	for (own_base of own_base_trades) {
		for (other_base of other_base_trades) {
			consider(
				make_base_terms(0, 0, own_base.id, other_base.id),
				0,
				0,
				0,
				0,
				own_base.recipient_value,
				other_base.owner_value,
				own_base.owner_value,
				other_base.recipient_value
			);
		}
	}

	return best;
};

const get_loan_acceptance_score = (state) => {
	if (state.relation == 'vendetta') {
		return 0.0 - 100000.0;
	}
	const principal = #to_float(state.terms.principal);
	const total_repayment = #to_float(state.terms.payment * state.terms.turns);
	const discounted_repayment = total_repayment /
		(1.0 + #to_float(state.terms.turns) * 0.004);
	let relation_bonus = 0.0 - 10.0;
	if (state.relation == 'treaty') {
		relation_bonus = 5.0;
	} else if (state.relation == 'pact') {
		relation_bonus = 12.0;
	}
	const relative_strength = get_relative_strength(state.own_power, state.other_power);
	if (state.own_is_lender) {
		if (state.own_energy - state.terms.principal < 50) {
			return 0.0 - 100000.0;
		}
		const default_risk = #max(0.0, relative_strength) * principal * 0.15;
		const integrity_risk =
			#to_float(get_other_integrity_blemishes(state)) * principal * 0.06;
		return discounted_repayment - principal + relation_bonus - default_risk - integrity_risk;
	}
	const liquidity_value = #to_float(#max(0, 100 - state.own_energy)) * 0.4;
	const payment_pressure = #to_float(#max(
		0,
		state.terms.payment - #max(2, (state.own_energy + state.terms.principal) / 10)
	)) * 2.0;
	return principal - discounted_repayment + liquidity_value + relation_bonus - payment_pressure;
};

const get_loan_proposal = (state) => {
	if (state.relation != 'treaty' && state.relation != 'pact') {
		return null;
	}
	let proposer_is_lender = false;
	let lender_energy = state.other_energy;
	let borrower_energy = state.own_energy;
	if (state.own_energy >= 250 && state.other_energy <= 80) {
		proposer_is_lender = true;
		lender_energy = state.own_energy;
		borrower_energy = state.other_energy;
	} else if (!(state.own_energy <= 80 && state.other_energy >= 250)) {
		return null;
	}
	const available = lender_energy - 100;
	const need = #max(40, 120 - borrower_energy);
	const principal = #floor(#to_float(#min(100, #min(available, need))) / 10.0) * 10;
	if (principal < 20) {
		return null;
	}
	const turns = 20;
	const payment = #ceil(#to_float(principal) * 1.25 / #to_float(turns));
	const terms = {
		proposer_is_lender: proposer_is_lender,
		principal: principal,
		payment: payment,
		turns: turns,
	};
	const proposer_score = get_loan_acceptance_score({
		relation: state.relation,
		own_power: state.own_power,
		other_power: state.other_power,
		own_energy: state.own_energy,
		own_is_lender: proposer_is_lender,
		other_integrity_blemishes: #is_defined(state.other_integrity_blemishes)
			? state.other_integrity_blemishes
			: 0,
		terms: terms,
	});
	const recipient_score = get_loan_acceptance_score({
		relation: state.relation,
		own_power: state.other_power,
		other_power: state.own_power,
		own_energy: state.other_energy,
		own_is_lender: !proposer_is_lender,
		other_integrity_blemishes: #is_defined(state.own_integrity_blemishes)
			? state.own_integrity_blemishes
			: 0,
		terms: terms,
	});
	if (proposer_score < 0.0 || recipient_score < 0.0) {
		return null;
	}
	return {terms: terms, score: proposer_score + recipient_score * 0.25};
};

return {
	get_acceptance_score: get_acceptance_score,
	should_accept: should_accept,
	get_surrender_score: get_surrender_score,
	should_offer_surrender: should_offer_surrender,
	get_proposal: get_proposal,
	get_trade_acceptance_score: get_trade_acceptance_score,
	get_trade_proposal: get_trade_proposal,
	is_ultimatum: is_ultimatum,
	is_military_request: is_military_request,
	get_military_request_acceptance_score: get_military_request_acceptance_score,
	get_military_request_proposal: get_military_request_proposal,
	get_ultimatum_compliance_score: get_ultimatum_compliance_score,
	get_ultimatum_proposal: get_ultimatum_proposal,
	get_loan_acceptance_score: get_loan_acceptance_score,
	get_loan_proposal: get_loan_proposal,
};
