const define_diplomacy = #include('../default/game/diplomacy');
const declare_vendetta = #include('../default/game/event/declare_vendetta');
const propose_relation = #include('../default/game/event/propose_diplomatic_relation');
const respond_proposal = #include('../default/game/event/respond_diplomatic_proposal');

const callbacks = {};
const values = {};
let triggers = [];
const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, value) => { values[name] = value; },
	get: (name) => { return values[name]; },
	is_turn_complete: (player_id) => { return false; },
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
};
define_diplomacy(game);
callbacks.start({});

const make_player = (id, name) => {
	let relations = {};
	let offers = {};
	return {
		id: id,
		name: name,
		get_diplomatic_relation: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(relations[key]) ? relations[key] : 'neutral';
		},
		set_diplomatic_relation: (other, relation) => {
			relations['p' + #to_string(other.id)] = relation;
		},
		get_diplomatic_offer: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(offers[key]) ? offers[key] : '';
		},
		set_diplomatic_offer: (other, offer) => {
			offers['p' + #to_string(other.id)] = offer;
		},
	};
};

const alpha = make_player(1, 'Alpha');
const beta = make_player(2, 'Beta');

let proposal = {
	caller: 1,
	game: game,
	data: {player: alpha, target: beta, relation: 'treaty'},
};
test.assert(!#is_defined(propose_relation.validate(proposal)));
proposal.applied = propose_relation.apply(proposal);
test.assert(beta.get_diplomatic_offer(alpha) == 'treaty');
test.assert(#is_defined(propose_relation.validate(proposal)));

let response = {
	caller: 2,
	game: game,
	data: {player: beta, proposer: alpha, accept: true},
};
test.assert(!#is_defined(respond_proposal.validate(response)));
response.applied = respond_proposal.apply(response);
test.assert(alpha.get_diplomatic_relation(beta) == 'treaty');
test.assert(beta.get_diplomatic_relation(alpha) == 'treaty');
test.assert(beta.get_diplomatic_offer(alpha) == '');

respond_proposal.rollback(response);
test.assert(alpha.get_diplomatic_relation(beta) == 'neutral');
test.assert(beta.get_diplomatic_relation(alpha) == 'neutral');
test.assert(beta.get_diplomatic_offer(alpha) == 'treaty');
response.applied = respond_proposal.apply(response);

let pact = {
	caller: 1,
	game: game,
	data: {player: alpha, target: beta, relation: 'pact'},
};
test.assert(!#is_defined(propose_relation.validate(pact)));
pact.applied = propose_relation.apply(pact);
let pact_response = {
	caller: 2,
	game: game,
	data: {player: beta, proposer: alpha, accept: true},
};
pact_response.applied = respond_proposal.apply(pact_response);
test.assert(alpha.get_diplomatic_relation(beta) == 'pact');
test.assert(beta.get_diplomatic_relation(alpha) == 'pact');

let vendetta = {
	caller: 1,
	game: game,
	data: {player: alpha, target: beta},
};
test.assert(!#is_defined(declare_vendetta.validate(vendetta)));
vendetta.applied = declare_vendetta.apply(vendetta);
test.assert(alpha.get_diplomatic_relation(beta) == 'vendetta');
test.assert(beta.get_diplomatic_relation(alpha) == 'vendetta');
declare_vendetta.rollback(vendetta);
test.assert(alpha.get_diplomatic_relation(beta) == 'pact');
test.assert(beta.get_diplomatic_relation(alpha) == 'pact');

proposal.data.relation = 'ceasefire';
test.assert(#is_defined(propose_relation.validate(proposal)));
proposal.data.relation = 'pact';
alpha.set_diplomatic_relation(beta, 'neutral');
beta.set_diplomatic_relation(alpha, 'neutral');
test.assert(#is_defined(propose_relation.validate(proposal)));

test.assert(#sizeof(triggers) >= 6);
