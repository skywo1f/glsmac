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

pact.relation = 'neutral';
test.assert(!diplomacy.should_accept(pact));

const fair_swap = {
	relation: 'treaty',
	own_power: 10.0,
	other_power: 10.0,
	terms: {
		offer_energy: 0,
		offer_technology: 'CentauriEcology',
		request_energy: 0,
		request_technology: 'IndustrialBase',
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
	other_energy: 20,
	own_technologies: [],
	other_technologies: [{id: 'IndustrialBase', cost: 50}],
});
test.assert(trade_proposal != null);
test.assert(trade_proposal.terms.offer_energy == 100);
test.assert(trade_proposal.terms.request_technology == 'IndustrialBase');

test.assert(diplomacy.get_trade_proposal({
	relation: 'vendetta',
	own_power: 10.0,
	other_power: 10.0,
	own_energy: 200,
	other_energy: 200,
	own_technologies: [{id: 'CentauriEcology', cost: 40}],
	other_technologies: [{id: 'IndustrialBase', cost: 50}],
}) == null);
