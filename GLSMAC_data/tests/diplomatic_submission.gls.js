const define_diplomacy = #include('../default/game/diplomacy');
const offer_surrender = #include('../default/game/event/offer_surrender');
const respond_surrender = #include('../default/game/event/respond_surrender');
const declare_vendetta = #include('../default/game/event/declare_vendetta');
const propose_relation = #include('../default/game/event/propose_diplomatic_relation');
const council_rules = #include('../default/game/council_rules');

const callbacks = {};
const values = {};
let players = [];
let triggers = [];
let messages = [];
let global_messages = [];
const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, value) => { values[name] = value; },
	get: (name) => { return values[name]; },
	get_players: () => { return players; },
	is_master: () => { return true; },
	is_turn_complete: (player_id) => { return false; },
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
	message: (text) => { global_messages :+text; },
};
values.f_message_to_players = (text, targets) => {
	messages :+{text: text, targets: targets};
};

const make_player = (id, name, type) => {
	let relations = {};
	let offers = {};
	let trades = {};
	let loan_offers = {};
	let loans = {};
	let contacts = {};
	let explored = [];
	let research = {technologies: [], target: '', progress: 0};
	let energy = 0;
	let submissive_to_id = -1;
	let surrender_offer_to_id = -1;
	const key = (other) => { return 'p' + #to_string(other.id); };
	return {
		id: id,
		name: name,
		type: type,
		get_diplomatic_relation: (other) => {
			const other_key = key(other);
			return #is_defined(relations[other_key]) ? relations[other_key] : 'neutral';
		},
		set_diplomatic_relation: (other, relation) => {
			const other_key = key(other);
			relations[other_key] = relation;
		},
		get_diplomatic_offer: (other) => {
			const other_key = key(other);
			return #is_defined(offers[other_key]) ? offers[other_key] : '';
		},
		set_diplomatic_offer: (other, offer) => {
			const other_key = key(other);
			offers[other_key] = offer;
		},
		get_diplomatic_trade: (other) => {
			const other_key = key(other);
			return #is_defined(trades[other_key]) ? #clone(trades[other_key]) : null;
		},
		set_diplomatic_trade: (other, trade) => {
			const other_key = key(other);
			trades[other_key] = #clone(trade);
		},
		clear_diplomatic_trade: (other) => {
			const other_key = key(other);
			trades[other_key] = #undefined;
		},
		get_diplomatic_loan_offer: (other) => {
			const other_key = key(other);
			return #is_defined(loan_offers[other_key]) ? #clone(loan_offers[other_key]) : null;
		},
		set_diplomatic_loan_offer: (other, offer) => {
			const other_key = key(other);
			loan_offers[other_key] = #clone(offer);
		},
		clear_diplomatic_loan_offer: (other) => {
			const other_key = key(other);
			loan_offers[other_key] = #undefined;
		},
		get_diplomatic_loan: (other) => {
			const other_key = key(other);
			return #is_defined(loans[other_key]) ? #clone(loans[other_key]) : null;
		},
		set_diplomatic_loan: (other, loan) => {
			const other_key = key(other);
			loans[other_key] = #clone(loan);
		},
		clear_diplomatic_loan: (other) => {
			const other_key = key(other);
			loans[other_key] = #undefined;
		},
		has_contact: (other) => {
			const other_key = key(other);
			return #is_defined(contacts[other_key]) && contacts[other_key];
		},
		set_contact: (other, contacted) => {
			const other_key = key(other);
			contacts[other_key] = contacted;
		},
		get_sanction_turns: () => { return 0; },
		set_sanction_turns: (turns) => {},
		get_integrity_blemishes: () => { return 0; },
		set_integrity_blemishes: (blemishes) => {},
		get_submissive_to_id: () => { return submissive_to_id; },
		set_submissive_to_id: (player_id) => { submissive_to_id = player_id; },
		get_surrender_offer_to_id: () => { return surrender_offer_to_id; },
		set_surrender_offer_to_id: (player_id) => { surrender_offer_to_id = player_id; },
		get_energy_credits: () => { return energy; },
		set_energy_credits: (value) => { energy = value; },
		get_research_state: () => { return #clone(research); },
		set_research_state: (value) => { research = #clone(value); },
		has_technology: (technology_id) => {
			for (known of research.technologies) {
				if (known == technology_id) { return true; }
			}
			return false;
		},
		get_explored_tiles: () => { return explored; },
		has_explored: (tile) => {
			for (known of explored) {
				if (known.x == tile.x && known.y == tile.y) { return true; }
			}
			return false;
		},
		set_explored: (tile, is_explored) => {
			let remaining = [];
			for (known of explored) {
				if (known.x != tile.x || known.y != tile.y) { remaining :+known; }
			}
			explored = remaining;
			if (is_explored) { explored :+tile; }
		},
	};
};

const victor = make_player(1, 'Victor', 'human');
const defeated = make_player(2, 'Defeated', 'ai');
players = [victor, defeated];
victor.set_contact(defeated, true);
defeated.set_contact(victor, true);
victor.set_diplomatic_relation(defeated, 'vendetta');
defeated.set_diplomatic_relation(victor, 'vendetta');
victor.set_energy_credits(25);
defeated.set_energy_credits(80);
victor.set_research_state({
	technologies: ['CentauriEcology'], target: 'IndustrialBase', progress: 12,
});
defeated.set_research_state({
	technologies: ['IndustrialBase', 'SecretsOfAlphaCentauri'],
	target: 'Biogenetics',
	progress: 9,
});
const victor_tile = {x: 2, y: 2};
const defeated_tile = {x: 4, y: 2};
const hidden_tile = {x: 6, y: 2};
victor.set_explored(victor_tile, true);
defeated.set_explored(defeated_tile, true);

values.f_technology_get_next_target = (known, player) => { return 'Biogenetics'; };
values.f_project_queue_planetary_datalinks = () => {};
values.f_exploration_get_all_tiles = () => {
	return [victor_tile, defeated_tile, hidden_tile];
};
values.f_exploration_apply_reveal = (player, tiles) => {
	let added = [];
	for (tile of tiles) {
		if (!player.has_explored(tile)) {
			player.set_explored(tile, true);
			added :+tile;
		}
	}
	return {player: player, tiles: added};
};
values.f_exploration_apply_map_share = (source, recipient) => {
	let added = [];
	for (tile of source.get_explored_tiles()) {
		if (!recipient.has_explored(tile)) {
			recipient.set_explored(tile, true);
			added :+tile;
		}
	}
	return {player: recipient, tiles: added};
};
values.f_exploration_rollback_reveal = (snapshot) => {
	for (tile of snapshot.tiles) { snapshot.player.set_explored(tile, false); }
};
let supreme_state = null;
let supreme_responses = {};
values.f_council_get_supreme_state = () => { return supreme_state; };
values.f_council_get_supreme_response = (player) => {
	const key = 'p' + #to_string(player.id);
	return #is_defined(supreme_responses[key]) ? supreme_responses[key] : 0;
};

define_diplomacy(game);
callbacks.start({});
values.f_council_get_forced_relation = (player, other) => {
	return council_rules.get_forced_relation(game, player, other);
};
defeated.set_diplomatic_loan(victor, {balance: 50, payment: 5});

let offer = {
	caller: defeated.id,
	game: game,
	data: {player: defeated, target: victor},
};
test.assert(!#is_defined(offer_surrender.validate(offer)));
offer.applied = offer_surrender.apply(offer);
test.assert(defeated.get_surrender_offer_to_id() == victor.id);
test.assert(#is_defined(offer_surrender.validate(offer)));

let response = {
	caller: victor.id,
	game: game,
	data: {player: victor, proposer: defeated, accept: true},
};
test.assert(!#is_defined(respond_surrender.validate(response)));
response.applied = respond_surrender.apply(response);
test.assert(defeated.get_surrender_offer_to_id() == -1);
test.assert(defeated.get_submissive_to_id() == victor.id);
test.assert(victor.get_diplomatic_relation(defeated) == 'pact');
test.assert(defeated.get_diplomatic_relation(victor) == 'pact');
test.assert(victor.get_energy_credits() == 105);
test.assert(defeated.get_energy_credits() == 0);
test.assert(victor.has_technology('IndustrialBase'));
test.assert(victor.has_technology('SecretsOfAlphaCentauri'));
test.assert(victor.has_explored(defeated_tile));
test.assert(victor.has_explored(hidden_tile));
test.assert(defeated.has_explored(victor_tile));
test.assert(defeated.has_explored(hidden_tile));
test.assert(defeated.get_diplomatic_loan(victor) == null);
test.assert(messages[#sizeof(messages) - 1].targets[0].id == victor.id);
test.assert(messages[#sizeof(messages) - 1].targets[1].id == defeated.id);
test.assert(global_messages == []);
test.assert(values.f_diplomacy_is_submission_pair(victor, defeated));
test.assert(values.f_diplomacy_get_submission_master(defeated) == victor);
test.assert(#sizeof(messages) == 1);
test.assert(#is_defined(declare_vendetta.validate({
	caller: victor.id,
	game: game,
	data: {player: victor, target: defeated},
})));
test.assert(#is_defined(propose_relation.validate({
	caller: victor.id,
	game: game,
	data: {player: victor, target: defeated, relation: 'treaty'},
})));

respond_surrender.rollback(response);
test.assert(defeated.get_surrender_offer_to_id() == victor.id);
test.assert(defeated.get_submissive_to_id() == -1);
test.assert(victor.get_diplomatic_relation(defeated) == 'vendetta');
test.assert(defeated.get_diplomatic_relation(victor) == 'vendetta');
test.assert(victor.get_energy_credits() == 25);
test.assert(defeated.get_energy_credits() == 80);
test.assert(!victor.has_technology('IndustrialBase'));
test.assert(!victor.has_technology('SecretsOfAlphaCentauri'));
test.assert(!victor.has_explored(defeated_tile));
test.assert(!victor.has_explored(hidden_tile));
test.assert(!defeated.has_explored(victor_tile));
test.assert(!defeated.has_explored(hidden_tile));
test.assert(defeated.get_diplomatic_loan(victor) == {balance: 50, payment: 5});

response.data.accept = false;
response.applied = respond_surrender.apply(response);
test.assert(defeated.get_surrender_offer_to_id() == -1);
test.assert(defeated.get_submissive_to_id() == -1);
test.assert(victor.get_diplomatic_relation(defeated) == 'vendetta');
respond_surrender.rollback(response);
test.assert(defeated.get_surrender_offer_to_id() == victor.id);

offer_surrender.rollback(offer);
test.assert(defeated.get_surrender_offer_to_id() == -1);

supreme_state = {leader: victor, resolved: true};
supreme_responses = {p1: 2, p2: 3};
victor.type = 'ai';
offer.data.player = victor;
offer.data.target = defeated;
offer.caller = victor.id;
test.assert(#is_defined(offer_surrender.validate(offer)));
victor.type = 'human';

offer.data.player = victor;
offer.data.target = defeated;
offer.caller = victor.id;
test.assert(#is_defined(offer_surrender.validate(offer)));

test.assert(#sizeof(triggers) >= 8);
