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
