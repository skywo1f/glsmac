const define_diplomacy = #include('../default/game/diplomacy');
const declare_vendetta = #include('../default/game/event/declare_vendetta');
const propose_relation = #include('../default/game/event/propose_diplomatic_relation');
const respond_proposal = #include('../default/game/event/respond_diplomatic_proposal');
const propose_trade = #include('../default/game/event/propose_diplomatic_trade');
const respond_trade = #include('../default/game/event/respond_diplomatic_trade');
const diplomacy_popup = #include('../default/ui/parts/game/popup/diplomacy');

test.assert(#typeof(diplomacy_popup.init) == 'Callable');
test.assert(#typeof(diplomacy_popup.propose_trade) == 'Callable');

const callbacks = {};
const values = {};
let triggers = [];
const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, value) => { values[name] = value; },
	get: (name) => { return values[name]; },
	is_turn_complete: (player_id) => { return false; },
	is_master: () => { return true; },
	get_players: () => { return []; },
	event: (name, data) => {},
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
	message: (text) => {},
};
define_diplomacy(game);
callbacks.start({});

const technology_ids = ['CentauriEcology', 'IndustrialBase', 'Biogenetics'];
values.f_technology_get_definition = (id) => {
	for (technology_id of technology_ids) {
		if (technology_id == id) {
			return {id: id, name: id, cost: 40};
		}
	}
	return null;
};
values.f_technology_get_next_target = (known, player) => {
	for (id of technology_ids) {
		let is_known = false;
		for (known_id of known) {
			if (known_id == id) {
				is_known = true;
				break;
			}
		}
		if (!is_known) {
			return id;
		}
	}
	return '';
};

const make_player = (id, name) => {
	let relations = {};
	let offers = {};
	let trades = {};
	let loan_offers = {};
	let loans = {};
	let research_state = {technologies: [], target: '', progress: 0};
	let player = null;
	player = {
		id: id,
		name: name,
		energy_credits: 0,
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
		get_diplomatic_trade: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(trades[key]) ? trades[key] : null;
		},
		set_diplomatic_trade: (other, trade) => {
			trades['p' + #to_string(other.id)] = #clone(trade);
		},
		clear_diplomatic_trade: (other) => {
			trades['p' + #to_string(other.id)] = #undefined;
		},
		get_diplomatic_loan_offer: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(loan_offers[key]) ? #clone(loan_offers[key]) : null;
		},
		set_diplomatic_loan_offer: (other, terms) => {
			loan_offers['p' + #to_string(other.id)] = #clone(terms);
		},
		clear_diplomatic_loan_offer: (other) => {
			loan_offers['p' + #to_string(other.id)] = #undefined;
		},
		get_diplomatic_loan: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(loans[key]) ? #clone(loans[key]) : null;
		},
		set_diplomatic_loan: (other, terms) => {
			loans['p' + #to_string(other.id)] = #clone(terms);
		},
		clear_diplomatic_loan: (other) => {
			loans['p' + #to_string(other.id)] = #undefined;
		},
		get_research_state: () => { return #clone(research_state); },
		set_research_state: (state) => { research_state = #clone(state); },
		has_technology: (technology_id) => {
			for (known_id of research_state.technologies) {
				if (known_id == technology_id) {
					return true;
				}
			}
			return false;
		},
		get_energy_credits: () => { return player.energy_credits; },
		set_energy_credits: (energy) => { player.energy_credits = energy; },
	};
	return player;
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

alpha.energy_credits = 100;
beta.energy_credits = 50;
alpha.set_research_state({
	technologies: ['CentauriEcology'],
	target: 'IndustrialBase',
	progress: 12,
});
beta.set_research_state({
	technologies: ['IndustrialBase'],
	target: 'CentauriEcology',
	progress: 7,
});

let trade = {
	caller: 1,
	game: game,
	data: {
		player: alpha,
		target: beta,
		terms: {
			offer_energy: 20,
			offer_technology: 'CentauriEcology',
			request_energy: 0,
			request_technology: 'IndustrialBase',
		},
	},
};
test.assert(!#is_defined(propose_trade.validate(trade)));
trade.applied = propose_trade.apply(trade);
test.assert(beta.get_diplomatic_trade(alpha).offer_energy == 20);
test.assert(#is_defined(propose_trade.validate(trade)));

let trade_response = {
	caller: 2,
	game: game,
	data: {player: beta, proposer: alpha, accept: true},
};
test.assert(!#is_defined(respond_trade.validate(trade_response)));
trade_response.applied = respond_trade.apply(trade_response);
test.assert(beta.get_diplomatic_trade(alpha) == null);
test.assert(alpha.energy_credits == 80);
test.assert(beta.energy_credits == 70);
test.assert(alpha.has_technology('IndustrialBase'));
test.assert(beta.has_technology('CentauriEcology'));
test.assert(alpha.get_research_state().target == 'Biogenetics');
test.assert(alpha.get_research_state().progress == 12);
test.assert(beta.get_research_state().target == 'Biogenetics');
test.assert(beta.get_research_state().progress == 7);

respond_trade.rollback(trade_response);
test.assert(beta.get_diplomatic_trade(alpha).request_technology == 'IndustrialBase');
test.assert(alpha.energy_credits == 100);
test.assert(beta.energy_credits == 50);
test.assert(!alpha.has_technology('IndustrialBase'));
test.assert(!beta.has_technology('CentauriEcology'));

trade_response.data.accept = false;
trade_response.applied = respond_trade.apply(trade_response);
test.assert(beta.get_diplomatic_trade(alpha) == null);
respond_trade.rollback(trade_response);

alpha.set_research_state({technologies: [], target: 'CentauriEcology', progress: 0});
trade_response.data.accept = true;
test.assert(#is_defined(respond_trade.validate(trade_response)));
alpha.set_research_state({
	technologies: ['CentauriEcology'], target: 'IndustrialBase', progress: 12,
});

trade.data.terms.offer_energy = 1000000001;
test.assert(#is_defined(propose_trade.validate(trade)));
trade.data.terms.offer_energy = 20;
trade.data.terms.request_energy = 10;
test.assert(#is_defined(propose_trade.validate(trade)));
trade.data.terms.request_energy = 0;

vendetta.applied = declare_vendetta.apply(vendetta);
test.assert(beta.get_diplomatic_trade(alpha) == null);
declare_vendetta.rollback(vendetta);
test.assert(beta.get_diplomatic_trade(alpha).offer_technology == 'CentauriEcology');

test.assert(#sizeof(triggers) >= 6);
