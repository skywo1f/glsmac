const define_diplomacy = #include('../default/game/diplomacy');
const declare_vendetta = #include('../default/game/event/declare_vendetta');
const respond_excuse = #include('../default/game/event/respond_diplomatic_excuse');
const propose_relation = #include('../default/game/event/propose_diplomatic_relation');
const respond_proposal = #include('../default/game/event/respond_diplomatic_proposal');
const propose_trade = #include('../default/game/event/propose_diplomatic_trade');
const respond_trade = #include('../default/game/event/respond_diplomatic_trade');
const establish_contact = #include('../default/game/event/establish_diplomatic_contact');
const diplomacy_popup = #include('../default/ui/parts/game/popup/diplomacy');

test.assert(#typeof(diplomacy_popup.init) == 'Callable');
test.assert(#typeof(diplomacy_popup.propose_trade) == 'Callable');
test.assert(#typeof(diplomacy_popup.begin_counter_trade) == 'Callable');
test.assert(#typeof(diplomacy_popup.propose_military_request) == 'Callable');
test.assert(#typeof(diplomacy_popup.respond_excuse) == 'Callable');

const callbacks = {};
const values = {};
let triggers = [];
let messages = [];
let global_messages = [];
let datalinks_queues = 0;
let players = [];
let bases = [];
let units = [];
let event_calls = [];
let turn = 40;
const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, value) => { values[name] = value; },
	get: (name) => { return values[name]; },
	is_turn_complete: (player_id) => { return false; },
	is_master: () => { return true; },
	get_players: () => { return players; },
	get_bm: () => { return {get_bases: () => { return bases; }}; },
	get_um: () => { return {get_units: () => { return units; }}; },
	get_tm: () => {
		return {get_distance: (first, second) => {
			return #abs(first.x - second.x) + #abs(first.y - second.y);
		}};
	},
	get_turn: () => { return turn; },
	event: (name, data) => { event_calls :+{name: name, data: data}; },
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
	message: (text) => { global_messages :+text; },
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
values.f_project_queue_planetary_datalinks = () => { datalinks_queues++; };
values.f_message_to_players = (text, targets) => {
	messages :+{kind: 'players', text: text, targets: targets};
};
values.f_message_to_contacts = (target, text) => {
	messages :+{kind: 'contacts', text: text, target: target};
};

const make_player = (id, name) => {
	let relations = {};
	let offers = {};
	let trades = {};
	let loan_offers = {};
	let loans = {};
	let contacts = {};
	let excuses = {};
	let grievances = {};
	let sanction_turns = 0;
	let integrity_blemishes = 0;
	let research_state = {technologies: [], target: '', progress: 0};
	let explored_tiles = [];
	let player = null;
	player = {
		id: id,
		name: name,
		energy_credits: 0,
		has_contact: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(contacts[key]) && contacts[key];
		},
		set_contact: (other, contacted) => {
			contacts['p' + #to_string(other.id)] = contacted;
		},
		get_diplomatic_relation: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(relations[key]) ? relations[key] : 'neutral';
		},
		set_diplomatic_relation: (other, relation) => {
			relations['p' + #to_string(other.id)] = relation;
		},
		get_diplomatic_excuse_turn: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(excuses[key]) ? excuses[key] : 0 - 1;
		},
		set_diplomatic_excuse_turn: (other, expiry_turn) => {
			excuses['p' + #to_string(other.id)] = expiry_turn < 0
				? #undefined : expiry_turn;
		},
		get_diplomatic_grievance: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(grievances[key]) ? #clone(grievances[key]) : {
				wants_revenge: false,
				atrocity_victim: false,
				major_atrocity_victim: false,
			};
		},
		set_diplomatic_grievance: (other, grievance) => {
			grievances['p' + #to_string(other.id)] = #clone(grievance);
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
		get_sanction_turns: () => { return sanction_turns; },
		set_sanction_turns: (turns) => { sanction_turns = turns; },
		get_integrity_blemishes: () => { return integrity_blemishes; },
		set_integrity_blemishes: (blemishes) => { integrity_blemishes = blemishes; },
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
		has_explored: (tile) => {
			for (explored of explored_tiles) {
				if (explored.x == tile.x && explored.y == tile.y) {
					return true;
				}
			}
			return false;
		},
		set_explored: (tile, explored) => {
			let remaining = [];
			for (known of explored_tiles) {
				if (known.x != tile.x || known.y != tile.y) {
					remaining :+known;
				}
			}
			explored_tiles = remaining;
			if (explored) {
				explored_tiles :+tile;
			}
		},
		get_explored_tiles: () => { return explored_tiles; },
	};
	return player;
};

const alpha = make_player(1, 'Alpha');
const beta = make_player(2, 'Beta');
const gamma = make_player(3, 'Gamma');
const delta = make_player(4, 'Delta');
players = [alpha, beta, gamma, delta];

const make_base = (id, name, owner, x, facilities, production_ids) => {
	let current_owner = owner;
	let queue = [];
	for (production_id of production_ids) {
		queue :+{production_kind: 'unit', id: production_id};
	}
	const tile = {x: x, y: 0};
	const base = {
		id: id,
		name: name,
		get_owner: () => { return current_owner; },
		set_owner: (new_owner) => { current_owner = new_owner; },
		get_size: () => { return 3; },
		get_tile: () => { return tile; },
		get_facilities: () => { return facilities; },
		has_facility: (facility_id) => {
			for (facility of facilities) {
				if (facility.id == facility_id) { return true; }
			}
			return false;
		},
		get_production_queue: () => { return queue; },
		can_produce: (kind, production_id) => {
			return production_id != 'AlphaOnly' || current_owner.id == alpha.id;
		},
		set_production_queue: (specs) => {
			queue = [];
			for (spec of specs) {
				queue :+{production_kind: spec.kind, id: spec.id};
			}
		},
	};
	tile.get_base = () => { return base; };
	return base;
};

const headquarters = {id: 'Headquarters', mineral_cost: 0, is_project: false};
const alpha_headquarters = make_base(10, 'Alpha Prime', alpha, 0, [headquarters], ['Scout']);
const alpha_trade_base = make_base(11, 'Alpha Annex', alpha, 4, [], ['AlphaOnly', 'Scout']);
const beta_headquarters = make_base(20, 'Beta Prime', beta, 20, [headquarters], ['Scout']);
const beta_trade_base = make_base(21, 'Beta Annex', beta, 16, [], ['Scout']);
bases = [alpha_headquarters, alpha_trade_base, beta_headquarters, beta_trade_base];

const make_supported_unit = (id, owner, home_base, tile) => {
	let unit = null;
	unit = {
		id: id,
		owner: owner.id,
		home_base_id: home_base.id,
		get_tile: () => { return tile; },
		get_def: () => { return {mineral_cost: 20}; },
		set_home_base_id: (base_id) => { unit.home_base_id = base_id; },
	};
	return unit;
};
const alpha_supported = make_supported_unit(100, alpha, alpha_trade_base, alpha_trade_base.get_tile());
const beta_supported = make_supported_unit(101, beta, beta_trade_base, beta_trade_base.get_tile());
units = [alpha_supported, beta_supported];
values.f_exploration_count_shareable_tiles = (sender, recipient) => {
	let count = 0;
	for (tile of sender.get_explored_tiles()) {
		if (!recipient.has_explored(tile)) {
			count++;
		}
	}
	return count;
};
values.f_exploration_apply_map_share = (sender, recipient) => {
	let added = [];
	for (tile of sender.get_explored_tiles()) {
		if (!recipient.has_explored(tile)) {
			recipient.set_explored(tile, true);
			added :+tile;
		}
	}
	return {player: recipient, tiles: added};
};
values.f_exploration_rollback_reveal = (snapshot) => {
	for (tile of snapshot.tiles) {
		snapshot.player.set_explored(tile, false);
	}
};
const contact_tile = {
	get_units: () => { return [{owner: beta.id}]; },
	get_base: () => { return null; },
	get_surrounding_tiles: () => { return []; },
};
values.f_diplomacy_queue_contacts_at_tile(alpha, contact_tile);
test.assert(#sizeof(event_calls) == 1);
test.assert(event_calls[0].name == 'establish_diplomatic_contact');
test.assert(event_calls[0].data.player == alpha && event_calls[0].data.target == beta);
test.assert(values.f_diplomacy_get_integrity_name(0) == 'Noble');
test.assert(values.f_diplomacy_get_integrity_name(7) == 'Infamous');
test.assert(values.f_diplomacy_get_betrayal_penalty('neutral') == 0);
test.assert(values.f_diplomacy_get_betrayal_penalty('treaty') == 1);
test.assert(values.f_diplomacy_get_betrayal_penalty('pact') == 2);

let proposal = {
	caller: 1,
	game: game,
	data: {player: alpha, target: beta, relation: 'treaty'},
};
test.assert(#is_defined(propose_relation.validate(proposal)));
let contact = {
	caller: 0,
	game: game,
	data: {player: alpha, target: beta},
};
test.assert(!#is_defined(establish_contact.validate(contact)));
contact.applied = establish_contact.apply(contact);
test.assert(alpha.has_contact(beta) && beta.has_contact(alpha));
test.assert(messages == [{
	kind: 'players',
	text: 'Alpha established contact with Beta.',
	targets: [alpha, beta],
}]);
test.assert(global_messages == []);
establish_contact.rollback(contact);
test.assert(!alpha.has_contact(beta) && !beta.has_contact(alpha));
contact.applied = establish_contact.apply(contact);
messages = [];
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

const alpha_pact_tile = {x: 8, y: 2};
const beta_pact_tile = {x: 10, y: 2};
alpha.set_explored(alpha_pact_tile, true);
beta.set_explored(beta_pact_tile, true);
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
test.assert(alpha.has_explored(beta_pact_tile) && beta.has_explored(alpha_pact_tile));
respond_proposal.rollback(pact_response);
test.assert(alpha.get_diplomatic_relation(beta) == 'treaty');
test.assert(beta.get_diplomatic_relation(alpha) == 'treaty');
test.assert(!alpha.has_explored(beta_pact_tile) && !beta.has_explored(alpha_pact_tile));
pact_response.applied = respond_proposal.apply(pact_response);

let vendetta = {
	caller: 1,
	game: game,
	data: {player: alpha, target: beta},
};
test.assert(!#is_defined(declare_vendetta.validate(vendetta)));
vendetta.applied = declare_vendetta.apply(vendetta);
test.assert(alpha.get_diplomatic_relation(beta) == 'vendetta');
test.assert(beta.get_diplomatic_relation(alpha) == 'vendetta');
test.assert(alpha.get_integrity_blemishes() == 2);
test.assert(beta.get_integrity_blemishes() == 0);
test.assert(beta.get_diplomatic_grievance(alpha).wants_revenge);
test.assert(!beta.get_diplomatic_grievance(alpha).atrocity_victim);
declare_vendetta.rollback(vendetta);
test.assert(alpha.get_diplomatic_relation(beta) == 'pact');
test.assert(beta.get_diplomatic_relation(alpha) == 'pact');
test.assert(alpha.get_integrity_blemishes() == 0);
test.assert(!beta.get_diplomatic_grievance(alpha).wants_revenge);

const grievance_snapshot = values.f_diplomacy_snapshot_pair(alpha, beta);
values.f_diplomacy_add_grievance(beta, alpha, false, true, false);
let grievance = beta.get_diplomatic_grievance(alpha);
test.assert(grievance.wants_revenge && grievance.atrocity_victim);
test.assert(!grievance.major_atrocity_victim);
values.f_diplomacy_add_grievance(beta, alpha, false, false, true);
grievance = beta.get_diplomatic_grievance(alpha);
test.assert(
	grievance.wants_revenge && grievance.atrocity_victim &&
	grievance.major_atrocity_victim
);
values.f_diplomacy_restore_pair(alpha, beta, grievance_snapshot);
test.assert(!beta.get_diplomatic_grievance(alpha).wants_revenge);

alpha.set_diplomatic_relation(beta, 'treaty');
beta.set_diplomatic_relation(alpha, 'treaty');
vendetta.applied = declare_vendetta.apply(vendetta);
test.assert(alpha.get_integrity_blemishes() == 1);
declare_vendetta.rollback(vendetta);
test.assert(alpha.get_integrity_blemishes() == 0);
test.assert(#sizeof(messages) == 2);

alpha.set_integrity_blemishes(7);
alpha.set_diplomatic_relation(beta, 'pact');
beta.set_diplomatic_relation(alpha, 'pact');
vendetta.applied = declare_vendetta.apply(vendetta);
test.assert(alpha.get_integrity_blemishes() == 7);
declare_vendetta.rollback(vendetta);
test.assert(alpha.get_integrity_blemishes() == 7);
alpha.set_integrity_blemishes(0);

alpha.set_diplomatic_excuse_turn(beta, turn + 1);
vendetta.applied = declare_vendetta.apply(vendetta);
test.assert(alpha.get_diplomatic_relation(beta) == 'vendetta');
test.assert(alpha.get_integrity_blemishes() == 0);
test.assert(alpha.get_diplomatic_excuse_turn(beta) == 0 - 1);
declare_vendetta.rollback(vendetta);
test.assert(alpha.get_diplomatic_relation(beta) == 'pact');
test.assert(alpha.get_diplomatic_excuse_turn(beta) == turn + 1);

let excuse_response = {
	caller: 1,
	game: game,
	data: {player: alpha, target: beta, use_excuse: true},
};
test.assert(!#is_defined(respond_excuse.validate(excuse_response)));
excuse_response.applied = respond_excuse.apply(excuse_response);
test.assert(alpha.get_diplomatic_relation(beta) == 'neutral');
test.assert(beta.get_diplomatic_relation(alpha) == 'neutral');
test.assert(alpha.get_integrity_blemishes() == 0);
test.assert(alpha.get_diplomatic_excuse_turn(beta) == 0 - 1);
test.assert(messages[#sizeof(messages) - 1].kind == 'players');
test.assert(messages[#sizeof(messages) - 1].targets[0].id == alpha.id);
test.assert(messages[#sizeof(messages) - 1].targets[1].id == beta.id);
test.assert(global_messages == []);
respond_excuse.rollback(excuse_response);
test.assert(alpha.get_diplomatic_relation(beta) == 'pact');
test.assert(beta.get_diplomatic_relation(alpha) == 'pact');
test.assert(alpha.get_diplomatic_excuse_turn(beta) == turn + 1);

excuse_response.data.use_excuse = false;
excuse_response.applied = respond_excuse.apply(excuse_response);
test.assert(alpha.get_diplomatic_relation(beta) == 'pact');
test.assert(alpha.get_diplomatic_excuse_turn(beta) == 0 - 1);
respond_excuse.rollback(excuse_response);
test.assert(alpha.get_diplomatic_excuse_turn(beta) == turn + 1);

alpha.set_diplomatic_relation(beta, 'neutral');
beta.set_diplomatic_relation(alpha, 'neutral');
excuse_response.data.use_excuse = true;
excuse_response.applied = respond_excuse.apply(excuse_response);
test.assert(alpha.get_diplomatic_relation(beta) == 'vendetta');
test.assert(alpha.get_integrity_blemishes() == 0);
respond_excuse.rollback(excuse_response);
turn += 2;
test.assert(
	respond_excuse.validate(excuse_response) ==
	'No current diplomatic excuse exists against this faction'
);
turn -= 2;

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
alpha.set_contact(gamma, true);
gamma.set_contact(alpha, true);
beta.set_contact(delta, true);
delta.set_contact(beta, true);
const alpha_map_tile = {x: 2, y: 2};
const beta_map_tile = {x: 4, y: 2};
alpha.set_explored(alpha_map_tile, true);
beta.set_explored(beta_map_tile, true);

diplomacy_popup.p = {game: game};
let base_items = diplomacy_popup.get_base_items(beta, alpha, 0 - 1);
test.assert(#sizeof(base_items) == 1);
base_items = diplomacy_popup.get_base_items(beta, alpha, beta_trade_base.id);
test.assert(#sizeof(base_items) == 2 && base_items[1][0] == #to_string(beta_trade_base.id));
alpha.set_explored(beta_trade_base.get_tile(), true);
base_items = diplomacy_popup.get_base_items(beta, alpha, 0 - 1);
test.assert(#sizeof(base_items) == 2 && base_items[1][0] == #to_string(beta_trade_base.id));
alpha.set_explored(beta_trade_base.get_tile(), false);

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
			offer_contact: gamma.id,
			request_contact: delta.id,
			offer_map: true,
			request_map: true,
			offer_base: alpha_trade_base.id,
			request_base: beta_trade_base.id,
		},
	},
};
test.assert(!#is_defined(propose_trade.validate(trade)));
trade.applied = propose_trade.apply(trade);
test.assert(beta.get_diplomatic_trade(alpha).offer_energy == 20);
test.assert(beta.get_diplomatic_trade(alpha).offer_base == alpha_trade_base.id);
test.assert(#is_defined(propose_trade.validate(trade)));

let trade_response = {
	caller: 2,
	game: game,
	data: {player: beta, proposer: alpha, accept: true},
};
test.assert(!#is_defined(respond_trade.validate(trade_response)));
trade_response.applied = respond_trade.apply(trade_response);
test.assert(beta.get_diplomatic_trade(alpha) == null);
test.assert(messages[#sizeof(messages) - 1].kind == 'players');
test.assert(messages[#sizeof(messages) - 1].targets[0].id == beta.id);
test.assert(messages[#sizeof(messages) - 1].targets[1].id == alpha.id);
test.assert(global_messages == []);
test.assert(#sizeof(trade_response.applied.bases) == 2);
test.assert(alpha.energy_credits == 80);
test.assert(beta.energy_credits == 70);
test.assert(alpha.has_technology('IndustrialBase'));
test.assert(beta.has_technology('CentauriEcology'));
test.assert(beta.has_contact(gamma) && gamma.has_contact(beta));
test.assert(alpha.has_contact(delta) && delta.has_contact(alpha));
test.assert(beta.has_explored(alpha_map_tile));
test.assert(alpha.has_explored(beta_map_tile));
test.assert(alpha_trade_base.get_owner().id == beta.id);
test.assert(beta_trade_base.get_owner().id == alpha.id);
test.assert(alpha_supported.home_base_id == alpha_headquarters.id);
test.assert(beta_supported.home_base_id == beta_headquarters.id);
const transferred_alpha_queue = alpha_trade_base.get_production_queue();
test.assert(#sizeof(transferred_alpha_queue) == 1);
test.assert(transferred_alpha_queue[0].id == 'Scout');
test.assert(alpha.get_research_state().target == 'Biogenetics');
test.assert(alpha.get_research_state().progress == 12);
test.assert(beta.get_research_state().target == 'Biogenetics');
test.assert(beta.get_research_state().progress == 7);
test.assert(datalinks_queues == 2);

respond_trade.rollback(trade_response);
test.assert(beta.get_diplomatic_trade(alpha).request_technology == 'IndustrialBase');
test.assert(alpha.energy_credits == 100);
test.assert(beta.energy_credits == 50);
test.assert(!alpha.has_technology('IndustrialBase'));
test.assert(!beta.has_technology('CentauriEcology'));
test.assert(!beta.has_contact(gamma) && !gamma.has_contact(beta));
test.assert(!alpha.has_contact(delta) && !delta.has_contact(alpha));
test.assert(!beta.has_explored(alpha_map_tile));
test.assert(!alpha.has_explored(beta_map_tile));
test.assert(alpha_trade_base.get_owner().id == alpha.id);
test.assert(beta_trade_base.get_owner().id == beta.id);
test.assert(alpha_supported.home_base_id == alpha_trade_base.id);
test.assert(beta_supported.home_base_id == beta_trade_base.id);
test.assert(#sizeof(alpha_trade_base.get_production_queue()) == 2);

trade_response.data.accept = false;
trade_response.applied = respond_trade.apply(trade_response);
test.assert(beta.get_diplomatic_trade(alpha) == null);
respond_trade.rollback(trade_response);

trade_response.data.counter_terms = {
	offer_energy: 0,
	offer_technology: 'IndustrialBase',
	request_energy: 20,
	request_technology: 'CentauriEcology',
	offer_contact: delta.id,
	request_contact: gamma.id,
	offer_map: true,
	request_map: true,
	offer_base: beta_trade_base.id,
	request_base: alpha_trade_base.id,
};
trade_response.data.accept = true;
test.assert(#is_defined(respond_trade.validate(trade_response)));
trade_response.data.accept = false;
test.assert(!#is_defined(respond_trade.validate(trade_response)));
trade_response.applied = respond_trade.apply(trade_response);
test.assert(beta.get_diplomatic_trade(alpha) == null);
test.assert(alpha.get_diplomatic_trade(beta).request_energy == 20);
test.assert(alpha.get_diplomatic_trade(beta).offer_technology == 'IndustrialBase');
test.assert(alpha.energy_credits == 100 && beta.energy_credits == 50);
respond_trade.rollback(trade_response);
test.assert(alpha.get_diplomatic_trade(beta) == null);
test.assert(beta.get_diplomatic_trade(alpha).offer_energy == 20);
trade_response.data.counter_terms = #undefined;

const popup_refresh = diplomacy_popup.refresh;
diplomacy_popup.refresh = () => {};
diplomacy_popup.p = {game: game};
diplomacy_popup.player = beta;
diplomacy_popup.target = alpha;
diplomacy_popup.offer_energy = {value: ''};
diplomacy_popup.offer_technology = {value: ''};
diplomacy_popup.offer_contact = {value: ''};
diplomacy_popup.offer_map = {value: ''};
diplomacy_popup.offer_base = {value: ''};
diplomacy_popup.request_energy = {value: ''};
diplomacy_popup.request_technology = {value: ''};
diplomacy_popup.request_contact = {value: ''};
diplomacy_popup.request_map = {value: ''};
diplomacy_popup.request_base = {value: ''};
diplomacy_popup.trade_error = {text: ''};
diplomacy_popup.begin_counter_trade();
test.assert(diplomacy_popup.countering_trade);
test.assert(diplomacy_popup.offer_energy.value == '0');
test.assert(diplomacy_popup.offer_technology.value == 'IndustrialBase');
test.assert(diplomacy_popup.offer_contact.value == #to_string(delta.id));
test.assert(diplomacy_popup.offer_map.value == '1');
test.assert(diplomacy_popup.offer_base.value == #to_string(beta_trade_base.id));
test.assert(diplomacy_popup.request_energy.value == '20');
test.assert(diplomacy_popup.request_technology.value == 'CentauriEcology');
test.assert(diplomacy_popup.request_contact.value == #to_string(gamma.id));
test.assert(diplomacy_popup.request_map.value == '1');
test.assert(diplomacy_popup.request_base.value == #to_string(alpha_trade_base.id));
diplomacy_popup.request_energy.value = '25';
const popup_action = diplomacy_popup.get_trade_action(beta, alpha, {
	offer_energy: 0,
	offer_technology: diplomacy_popup.offer_technology.value,
	request_energy: 25,
	request_technology: diplomacy_popup.request_technology.value,
	offer_contact: #to_int(diplomacy_popup.offer_contact.value),
	request_contact: #to_int(diplomacy_popup.request_contact.value),
	offer_map: diplomacy_popup.offer_map.value == '1',
	request_map: diplomacy_popup.request_map.value == '1',
	offer_base: #to_int(diplomacy_popup.offer_base.value),
	request_base: #to_int(diplomacy_popup.request_base.value),
}, true);
test.assert(popup_action.name == 'respond_diplomatic_trade');
test.assert(popup_action.data.player == beta && popup_action.data.proposer == alpha);
test.assert(!popup_action.data.accept);
test.assert(popup_action.data.counter_terms.request_energy == 25);
diplomacy_popup.refresh = popup_refresh;

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

const base_only_terms = {
	offer_energy: 0,
	offer_technology: '',
	request_energy: 0,
	request_technology: '',
	offer_base: alpha_headquarters.id,
	request_base: 0 - 1,
};
test.assert(
	values.f_diplomacy_validate_trade(alpha, beta, base_only_terms) ==
	'A faction cannot cede its Headquarters'
);
base_only_terms.offer_base = 999999;
test.assert(
	values.f_diplomacy_validate_trade(alpha, beta, base_only_terms) ==
	'The offered base does not exist'
);
base_only_terms.offer_base = alpha_trade_base.id;
const all_bases = bases;
bases = [alpha_trade_base, beta_headquarters, beta_trade_base];
test.assert(
	values.f_diplomacy_validate_trade(alpha, beta, base_only_terms) ==
	'A faction cannot cede its last base'
);
bases = all_bases;

beta.clear_diplomatic_trade(alpha);
alpha.clear_diplomatic_trade(beta);
alpha.set_diplomatic_relation(beta, 'neutral');
beta.set_diplomatic_relation(alpha, 'neutral');
alpha.energy_credits = 100;
beta.energy_credits = 80;
let ultimatum = {
	caller: alpha.id,
	game: game,
	data: {
		player: alpha,
		target: beta,
		terms: {
			offer_energy: 0,
			offer_technology: '',
			request_energy: 25,
			request_technology: '',
			offer_contact: 0 - 1,
			request_contact: 0 - 1,
			offer_map: false,
			request_map: false,
			offer_base: 0 - 1,
			request_base: 0 - 1,
			is_ultimatum: true,
		},
	},
};
const bundled_ultimatum = #clone(ultimatum.data.terms);
bundled_ultimatum.offer_energy = 5;
test.assert(#is_defined(
	values.f_diplomacy_validate_trade(alpha, beta, bundled_ultimatum)
));
alpha.set_sanction_turns(10);
test.assert(!#is_defined(propose_trade.validate(ultimatum)));
alpha.set_sanction_turns(0);
ultimatum.applied = propose_trade.apply(ultimatum);
test.assert(beta.get_diplomatic_trade(alpha).is_ultimatum);
test.assert(triggers[#sizeof(triggers) - 1].name == 'diplomatic_ultimatum_proposed');
const conflicting_ultimatum = {
	caller: beta.id,
	game: game,
	data: {player: beta, target: alpha, terms: #clone(ultimatum.data.terms)},
};
test.assert(#is_defined(propose_trade.validate(conflicting_ultimatum)));

let ultimatum_response = {
	caller: beta.id,
	game: game,
	data: {
		player: beta,
		proposer: alpha,
		accept: false,
		counter_terms: #clone(trade.data.terms),
	},
};
test.assert(
	respond_trade.validate(ultimatum_response) == 'An ultimatum cannot be countered'
);
ultimatum_response.data.counter_terms = #undefined;
test.assert(!#is_defined(respond_trade.validate(ultimatum_response)));
ultimatum_response.applied = respond_trade.apply(ultimatum_response);
test.assert(alpha.get_diplomatic_relation(beta) == 'vendetta');
test.assert(beta.get_diplomatic_relation(alpha) == 'vendetta');
test.assert(alpha.energy_credits == 100 && beta.energy_credits == 80);
test.assert(beta.get_diplomatic_trade(alpha) == null);
respond_trade.rollback(ultimatum_response);
test.assert(alpha.get_diplomatic_relation(beta) == 'neutral');
test.assert(beta.get_diplomatic_relation(alpha) == 'neutral');
test.assert(beta.get_diplomatic_trade(alpha).is_ultimatum);
propose_trade.rollback(ultimatum);
test.assert(beta.get_diplomatic_trade(alpha) == null);

alpha.set_diplomatic_relation(beta, 'vendetta');
beta.set_diplomatic_relation(alpha, 'vendetta');
alpha.set_research_state({
	technologies: ['CentauriEcology'], target: 'Biogenetics', progress: 3,
});
beta.set_research_state({
	technologies: ['IndustrialBase'], target: 'CentauriEcology', progress: 7,
});
let technology_ultimatum = {
	caller: alpha.id,
	game: game,
	data: {
		player: alpha,
		target: beta,
		terms: #clone(ultimatum.data.terms),
	},
};
technology_ultimatum.data.terms.request_energy = 0;
technology_ultimatum.data.terms.request_technology = 'IndustrialBase';
test.assert(!#is_defined(propose_trade.validate(technology_ultimatum)));
technology_ultimatum.applied = propose_trade.apply(technology_ultimatum);
let technology_response = {
	caller: beta.id,
	game: game,
	data: {player: beta, proposer: alpha, accept: true},
};
test.assert(!#is_defined(respond_trade.validate(technology_response)));
technology_response.applied = respond_trade.apply(technology_response);
test.assert(alpha.has_technology('IndustrialBase'));
test.assert(beta.has_technology('IndustrialBase'));
test.assert(alpha.get_diplomatic_relation(beta) == 'neutral');
test.assert(beta.get_diplomatic_relation(alpha) == 'neutral');
test.assert(triggers[#sizeof(triggers) - 1].name == 'diplomatic_ultimatum_resolved');
respond_trade.rollback(technology_response);
test.assert(!alpha.has_technology('IndustrialBase'));
test.assert(alpha.get_diplomatic_relation(beta) == 'vendetta');
test.assert(beta.get_diplomatic_relation(alpha) == 'vendetta');
test.assert(beta.get_diplomatic_trade(alpha).request_technology == 'IndustrialBase');
propose_trade.rollback(technology_ultimatum);
alpha.set_diplomatic_relation(beta, 'neutral');
beta.set_diplomatic_relation(alpha, 'neutral');

const ultimatum_action = diplomacy_popup.get_trade_action(
	alpha,
	beta,
	{
		offer_energy: 0,
		offer_technology: '',
		request_energy: 30,
		request_technology: '',
		offer_contact: 0 - 1,
		request_contact: 0 - 1,
		offer_map: false,
		request_map: false,
		offer_base: 0 - 1,
		request_base: 0 - 1,
		is_ultimatum: true,
	},
	false
);
test.assert(ultimatum_action.name == 'propose_diplomatic_trade');
test.assert(ultimatum_action.data.terms.is_ultimatum);
test.assert(ultimatum_action.data.terms.request_energy == 30);

alpha.set_diplomatic_relation(beta, 'pact');
beta.set_diplomatic_relation(alpha, 'pact');
alpha.set_diplomatic_relation(gamma, 'vendetta');
gamma.set_diplomatic_relation(alpha, 'vendetta');
beta.set_diplomatic_relation(gamma, 'neutral');
gamma.set_diplomatic_relation(beta, 'neutral');
beta.set_contact(gamma, true);
gamma.set_contact(beta, true);
let military_request = {
	caller: alpha.id,
	game: game,
	data: {
		player: alpha,
		target: beta,
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
			request_vendetta_player: gamma.id,
			is_ultimatum: false,
		},
	},
};
test.assert(!#is_defined(propose_trade.validate(military_request)));
const bundled_military_request = #clone(military_request.data.terms);
bundled_military_request.offer_energy = 5;
test.assert(
	values.f_diplomacy_validate_trade(alpha, beta, bundled_military_request) ==
	'A military request cannot contain trade terms'
);
let military_items = diplomacy_popup.get_military_target_items(alpha, beta);
test.assert(#sizeof(military_items) == 1 && military_items[0][0] == #to_string(gamma.id));
diplomacy_popup.player = alpha;
diplomacy_popup.target = beta;
diplomacy_popup.military_target = {value: #to_string(gamma.id)};
diplomacy_popup.propose_military_request();
test.assert(event_calls[#sizeof(event_calls) - 1].name == 'propose_diplomatic_trade');
test.assert(
	event_calls[#sizeof(event_calls) - 1].data.terms.request_vendetta_player == gamma.id
);
military_request.applied = propose_trade.apply(military_request);
test.assert(beta.get_diplomatic_trade(alpha).request_vendetta_player == gamma.id);
test.assert(
	triggers[#sizeof(triggers) - 1].name == 'diplomatic_military_request_proposed'
);
let military_response = {
	caller: beta.id,
	game: game,
	data: {
		player: beta,
		proposer: alpha,
		accept: true,
		counter_terms: #clone(trade.data.terms),
	},
};
test.assert(
	respond_trade.validate(military_response) ==
	'A joint vendetta request cannot be countered'
);
military_response.data.counter_terms = #undefined;
test.assert(!#is_defined(respond_trade.validate(military_response)));
military_response.applied = respond_trade.apply(military_response);
test.assert(beta.get_diplomatic_relation(gamma) == 'vendetta');
test.assert(gamma.get_diplomatic_relation(beta) == 'vendetta');
test.assert(alpha.get_diplomatic_relation(beta) == 'pact');
test.assert(beta.get_diplomatic_trade(alpha) == null);
test.assert(
	triggers[#sizeof(triggers) - 1].name == 'diplomatic_military_request_resolved'
);
respond_trade.rollback(military_response);
test.assert(beta.get_diplomatic_relation(gamma) == 'neutral');
test.assert(gamma.get_diplomatic_relation(beta) == 'neutral');
test.assert(beta.get_diplomatic_trade(alpha).request_vendetta_player == gamma.id);
military_response.data.accept = false;
military_response.applied = respond_trade.apply(military_response);
test.assert(beta.get_diplomatic_relation(gamma) == 'neutral');
respond_trade.rollback(military_response);
propose_trade.rollback(military_request);
test.assert(beta.get_diplomatic_trade(alpha) == null);
alpha.set_diplomatic_relation(beta, 'neutral');
beta.set_diplomatic_relation(alpha, 'neutral');
test.assert(#is_defined(propose_trade.validate(military_request)));

beta.clear_diplomatic_trade(alpha);
alpha.set_sanction_turns(10);
test.assert(#is_defined(propose_trade.validate(trade)));
alpha.set_sanction_turns(0);
trade.applied = propose_trade.apply(trade);

vendetta.applied = declare_vendetta.apply(vendetta);
test.assert(beta.get_diplomatic_trade(alpha) == null);
declare_vendetta.rollback(vendetta);
test.assert(beta.get_diplomatic_trade(alpha).offer_technology == 'CentauriEcology');

test.assert(#sizeof(triggers) >= 6);
