const diplomacy = #include('../default/game/ai/diplomacy');

const balanced = {
	offer: 'treaty',
	relation: 'neutral',
	own_power: 10.0,
	other_power: 10.0,
	own_bases: 2,
	other_bases: 2,
};
test.assert(diplomacy.should_accept(balanced));
balanced.other_integrity_blemishes = 3;
test.assert(!diplomacy.should_accept(balanced));
balanced.other_integrity_blemishes = 0;

const dominant_at_war = {
	offer: 'treaty',
	relation: 'vendetta',
	own_power: 30.0,
	other_power: 5.0,
	own_bases: 5,
	other_bases: 1,
};
test.assert(!diplomacy.should_accept(dominant_at_war));
test.assert(diplomacy.get_proposal(dominant_at_war) == null);

const losing_at_war = {
	offer: 'treaty',
	relation: 'vendetta',
	own_power: 5.0,
	other_power: 30.0,
	own_bases: 1,
	other_bases: 5,
};
test.assert(diplomacy.should_accept(losing_at_war));
test.assert(diplomacy.get_proposal(losing_at_war).relation == 'treaty');

const pact = {
	offer: 'pact',
	relation: 'treaty',
	own_power: 8.0,
	other_power: 20.0,
	own_bases: 2,
	other_bases: 4,
};
test.assert(diplomacy.should_accept(pact));
test.assert(diplomacy.get_proposal(pact).relation == 'pact');
pact.other_integrity_blemishes = 3;
test.assert(!diplomacy.should_accept(pact));
test.assert(diplomacy.get_proposal(pact) == null);
pact.other_integrity_blemishes = 0;

pact.relation = 'neutral';
test.assert(!diplomacy.should_accept(pact));

const military_terms = {
	offer_energy: 0,
	offer_technology: '',
	request_energy: 0,
	request_technology: '',
	request_vendetta_player: 3,
};
test.assert(diplomacy.is_military_request(military_terms));
const military_state = {
	relation: 'pact',
	own_power: 12.0,
	other_power: 8.0,
	target_power: 18.0,
	target_relation: 'neutral',
	other_integrity_blemishes: 0,
};
test.assert(diplomacy.get_military_request_acceptance_score(military_state) >= 0.0);
military_state.target_relation = 'treaty';
test.assert(diplomacy.get_military_request_acceptance_score(military_state) < 0.0);
military_state.target_relation = 'neutral';
military_state.other_integrity_blemishes = 3;
test.assert(diplomacy.get_military_request_acceptance_score(military_state) < 0.0);
military_state.other_integrity_blemishes = 0;
military_state.target_relation = 'vendetta';
test.assert(diplomacy.get_military_request_acceptance_score(military_state) < 0.0);

let military_proposal = diplomacy.get_military_request_proposal({
	relation: 'pact',
	own_power: 8.0,
	other_power: 12.0,
	other_integrity_blemishes: 0,
	targets: [
		{id: 3, power: 18.0, proposer_relation: 'vendetta', recipient_relation: 'neutral'},
		{id: 4, power: 4.0, proposer_relation: 'vendetta', recipient_relation: 'neutral'},
	],
});
test.assert(military_proposal != null);
test.assert(military_proposal.target_id == 3);
test.assert(military_proposal.terms.request_vendetta_player == 3);
test.assert(diplomacy.get_military_request_proposal({
	relation: 'treaty',
	own_power: 8.0,
	other_power: 12.0,
	targets: [],
}) == null);

const fair_swap = {
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	terms: {
		offer_energy: 0,
		offer_technology: 'CentauriEcology',
		request_energy: 0,
		request_technology: 'IndustrialBase',
		offer_contact: 0 - 1,
		request_contact: 0 - 1,
	},
	offer_technology_cost: 40,
	request_technology_cost: 50,
};
test.assert(diplomacy.get_trade_acceptance_score(fair_swap) >= 0.0);
fair_swap.relation = 'vendetta';
test.assert(diplomacy.get_trade_acceptance_score(fair_swap) < 0.0);
fair_swap.relation = 'treaty';
fair_swap.terms.offer_technology = '';
test.assert(diplomacy.get_trade_acceptance_score(fair_swap) < 0.0);

const base_purchase = {
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	terms: {
		offer_energy: 0,
		offer_technology: '',
		request_energy: 200,
		request_technology: '',
		offer_base: 11,
		request_base: 0 - 1,
	},
	offer_base_value: 300,
	request_base_value: 0,
};
test.assert(diplomacy.get_trade_acceptance_score(base_purchase) >= 0.0);
base_purchase.terms.request_energy = 325;
test.assert(diplomacy.get_trade_acceptance_score(base_purchase) < 0.0);
base_purchase.terms.request_energy = 0;
base_purchase.terms.offer_base = 0 - 1;
base_purchase.terms.offer_energy = 100;
base_purchase.terms.request_base = 21;
base_purchase.request_base_value = 300;
test.assert(diplomacy.get_trade_acceptance_score(base_purchase) < 0.0);

let trade_proposal = diplomacy.get_trade_proposal({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 200,
	other_energy: 200,
	own_technologies: [{id: 'CentauriEcology', cost: 40}],
	other_technologies: [{id: 'IndustrialBase', cost: 50}],
});
test.assert(trade_proposal != null);
test.assert(trade_proposal.terms.offer_technology == 'CentauriEcology');
test.assert(trade_proposal.terms.request_technology == 'IndustrialBase');

trade_proposal = diplomacy.get_trade_proposal({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 200,
	other_energy: 200,
	own_technologies: [],
	other_technologies: [],
	own_contacts: [{id: 3, value: 55}],
	other_contacts: [{id: 4, value: 50}],
});
test.assert(trade_proposal != null);
test.assert(trade_proposal.terms.offer_contact == 3);
test.assert(trade_proposal.terms.request_contact == 4);

trade_proposal = diplomacy.get_trade_proposal({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 200,
	other_energy: 200,
	own_technologies: [],
	other_technologies: [],
	own_map_value: 80,
	other_map_value: 75,
});
test.assert(trade_proposal != null);
test.assert(trade_proposal.terms.offer_map && trade_proposal.terms.request_map);

trade_proposal = diplomacy.get_trade_proposal({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 200,
	other_energy: 20,
	own_technologies: [],
	other_technologies: [{id: 'IndustrialBase', cost: 50}],
});
test.assert(trade_proposal != null);
test.assert(trade_proposal.terms.offer_energy == 100);
test.assert(trade_proposal.terms.request_technology == 'IndustrialBase');

trade_proposal = diplomacy.get_trade_proposal({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 600,
	other_energy: 100,
	own_technologies: [],
	other_technologies: [],
	own_base_trades: [],
	other_base_trades: [{id: 21, owner_value: 200, recipient_value: 350}],
});
test.assert(trade_proposal != null);
test.assert(trade_proposal.terms.offer_energy == 275);
test.assert(trade_proposal.terms.request_base == 21);
test.assert(trade_proposal.terms.offer_base < 0);

trade_proposal = diplomacy.get_trade_proposal({
	relation: 'pact',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 100,
	other_energy: 600,
	own_technologies: [],
	other_technologies: [],
	own_base_trades: [{id: 11, owner_value: 200, recipient_value: 350}],
	other_base_trades: [],
});
test.assert(trade_proposal != null);
test.assert(trade_proposal.terms.offer_base == 11);
test.assert(trade_proposal.terms.request_energy == 275);
test.assert(trade_proposal.terms.request_base < 0);

trade_proposal = diplomacy.get_trade_proposal({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 100,
	other_energy: 100,
	own_technologies: [],
	other_technologies: [],
	own_base_trades: [{id: 11, owner_value: 225, recipient_value: 375}],
	other_base_trades: [{id: 21, owner_value: 250, recipient_value: 400}],
});
test.assert(trade_proposal != null);
test.assert(trade_proposal.terms.offer_base == 11);
test.assert(trade_proposal.terms.request_base == 21);
test.assert(trade_proposal.terms.offer_energy == 0);
test.assert(trade_proposal.terms.request_energy == 0);

test.assert(diplomacy.get_trade_proposal({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 300,
	other_energy: 100,
	own_technologies: [],
	other_technologies: [],
	own_base_trades: [],
	other_base_trades: [{id: 21, owner_value: 200, recipient_value: 350}],
}) == null);
test.assert(diplomacy.get_trade_proposal({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 600,
	other_energy: 600,
	own_technologies: [],
	other_technologies: [],
	own_base_trades: [{id: 11, owner_value: 325, recipient_value: 300}],
	other_base_trades: [{id: 21, owner_value: 325, recipient_value: 300}],
}) == null);

test.assert(diplomacy.get_trade_proposal({
	relation: 'vendetta',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 200,
	other_energy: 200,
	own_technologies: [{id: 'CentauriEcology', cost: 40}],
	other_technologies: [{id: 'IndustrialBase', cost: 50}],
}) == null);

const small_energy_ultimatum = {
	relation: 'vendetta',
	own_power: 5.0,
	other_power: 30.0,
	own_bases: 1,
	other_bases: 5,
	own_energy: 150,
	other_integrity_blemishes: 0,
	request_technology_cost: 0,
	terms: {
		offer_energy: 0,
		offer_technology: '',
		request_energy: 25,
		request_technology: '',
		is_ultimatum: true,
	},
};
test.assert(diplomacy.is_ultimatum(small_energy_ultimatum.terms));
const funded_compliance_score =
	diplomacy.get_ultimatum_compliance_score(small_energy_ultimatum);
test.assert(funded_compliance_score >= 0.0);
small_energy_ultimatum.own_power = 30.0;
small_energy_ultimatum.other_power = 5.0;
small_energy_ultimatum.own_bases = 5;
small_energy_ultimatum.other_bases = 1;
test.assert(diplomacy.get_ultimatum_compliance_score(small_energy_ultimatum) < 0.0);
small_energy_ultimatum.own_power = 5.0;
small_energy_ultimatum.other_power = 30.0;
small_energy_ultimatum.own_bases = 1;
small_energy_ultimatum.other_bases = 5;
small_energy_ultimatum.own_energy = 55;
test.assert(
	diplomacy.get_ultimatum_compliance_score(small_energy_ultimatum) <
	funded_compliance_score
);
small_energy_ultimatum.own_energy = 150;
small_energy_ultimatum.other_integrity_blemishes = 20;
test.assert(diplomacy.get_ultimatum_compliance_score(small_energy_ultimatum) < 0.0);

let ultimatum_proposal = diplomacy.get_ultimatum_proposal({
	relation: 'neutral',
	own_power: 30.0,
	other_power: 5.0,
	own_bases: 5,
	other_bases: 1,
	own_energy: 100,
	other_energy: 250,
	own_integrity_blemishes: 0,
	other_technologies: [],
});
test.assert(ultimatum_proposal != null);
test.assert(ultimatum_proposal.terms.is_ultimatum);
test.assert(ultimatum_proposal.terms.request_energy > 0);
test.assert(ultimatum_proposal.terms.request_technology == '');

ultimatum_proposal = diplomacy.get_ultimatum_proposal({
	relation: 'vendetta',
	own_power: 30.0,
	other_power: 5.0,
	own_bases: 5,
	other_bases: 1,
	own_energy: 100,
	other_energy: 50,
	own_integrity_blemishes: 0,
	other_technologies: [{id: 'IndustrialBase', cost: 30}],
});
test.assert(ultimatum_proposal != null);
test.assert(ultimatum_proposal.terms.request_technology == 'IndustrialBase');

test.assert(diplomacy.get_ultimatum_proposal({
	relation: 'neutral',
	own_power: 10.0,
	other_power: 10.0,
	own_bases: 2,
	other_bases: 2,
	own_energy: 100,
	other_energy: 250,
	own_integrity_blemishes: 0,
	other_technologies: [],
}) == null);
test.assert(diplomacy.get_ultimatum_proposal({
	relation: 'treaty',
	own_power: 30.0,
	other_power: 5.0,
	own_bases: 5,
	other_bases: 1,
	own_energy: 100,
	other_energy: 250,
	own_integrity_blemishes: 0,
	other_technologies: [],
}) == null);
test.assert(diplomacy.get_ultimatum_proposal({
	relation: 'vendetta',
	own_power: 30.0,
	other_power: 5.0,
	own_bases: 5,
	other_bases: 1,
	own_energy: 100,
	other_energy: 250,
	own_integrity_blemishes: 20,
	other_technologies: [],
}) == null);

const fair_loan = {
	proposer_is_lender: false,
	principal: 100,
	payment: 7,
	turns: 20,
};
test.assert(diplomacy.get_loan_acceptance_score({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 300,
	own_is_lender: true,
	terms: fair_loan,
}) >= 0.0);
test.assert(diplomacy.get_loan_acceptance_score({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 300,
	own_is_lender: true,
	other_integrity_blemishes: 7,
	terms: fair_loan,
}) < 0.0);
test.assert(diplomacy.get_loan_acceptance_score({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 20,
	own_is_lender: false,
	terms: fair_loan,
}) >= 0.0);
test.assert(diplomacy.get_loan_acceptance_score({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 20,
	own_is_lender: false,
	terms: {
		proposer_is_lender: true,
		principal: 100,
		payment: 20,
		turns: 20,
	},
}) < 0.0);
test.assert(diplomacy.get_loan_acceptance_score({
	relation: 'vendetta',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 300,
	own_is_lender: true,
	terms: fair_loan,
}) < 0.0);

let loan_proposal = diplomacy.get_loan_proposal({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 20,
	other_energy: 300,
});
test.assert(loan_proposal != null);
test.assert(!loan_proposal.terms.proposer_is_lender);
test.assert(loan_proposal.terms.principal > 0);
test.assert(loan_proposal.terms.payment * loan_proposal.terms.turns >= loan_proposal.terms.principal);

loan_proposal = diplomacy.get_loan_proposal({
	relation: 'pact',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 300,
	other_energy: 20,
});
test.assert(loan_proposal != null);
test.assert(loan_proposal.terms.proposer_is_lender);

test.assert(diplomacy.get_loan_proposal({
	relation: 'pact',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 300,
	other_energy: 20,
	own_integrity_blemishes: 0,
	other_integrity_blemishes: 7,
}) == null);

test.assert(diplomacy.get_loan_proposal({
	relation: 'neutral',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 20,
	other_energy: 300,
}) == null);
test.assert(diplomacy.get_loan_proposal({
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 150,
	other_energy: 160,
}) == null);

test.assert(diplomacy.should_offer_surrender({
	relation: 'vendetta',
	own_power: 3.0,
	other_power: 18.0,
	own_bases: 1,
	other_bases: 4,
	other_integrity_blemishes: 0,
}));
test.assert(!diplomacy.should_offer_surrender({
	relation: 'vendetta',
	own_power: 12.0,
	other_power: 14.0,
	own_bases: 3,
	other_bases: 4,
	other_integrity_blemishes: 0,
}));
test.assert(!diplomacy.should_offer_surrender({
	relation: 'treaty',
	own_power: 1.0,
	other_power: 30.0,
	own_bases: 1,
	other_bases: 6,
	other_integrity_blemishes: 0,
}));
