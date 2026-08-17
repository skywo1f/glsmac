const rules = #include('../default/game/economic_victory_rules');
const corner_market = #include('../default/game/event/corner_global_energy_market');
const base_capture = #include('../default/game/base_capture');
const headquarters_evacuation = #include('../default/game/headquarters_evacuation');
const respond_evacuation = #include(
	'../default/game/event/respond_headquarters_evacuation'
);

const make_player = (id, faction_name, energy, commerce) => {
	let current_energy = energy;
	let technologies = [];
	let relations = {};
	const player = {
		id: id,
		name: faction_name,
		type: 'human',
		commerce: commerce,
		get_energy_credits: () => { return current_energy; },
		set_energy_credits: (value) => { current_energy = value; },
		has_technology: (technology_id) => {
			for (known of technologies) {
				if (known == technology_id) { return true; }
			}
			return false;
		},
		add_technology: (technology_id) => { technologies :+technology_id; },
		get_diplomatic_relation: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(relations[key]) ? relations[key] : 'neutral';
		},
		set_relation: (other, relation) => {
			relations['p' + #to_string(other.id)] = relation;
		},
		get_faction: () => {
			return {
				id: faction_name == 'The University' ? 'UNIVERSITY' : 'HIVE',
				name: faction_name,
			};
		},
		energy_credits: energy,
	};
	return player;
};

let next_base_id = 1;
const make_base = (owner, x, size, facility_ids) => {
	let current_owner = owner;
	let current_facilities = facility_ids;
	let custom = {};
	let queue = [];
	const tile = {x: x, y: 0};
	return {
		id: next_base_id++,
		name: 'Test Base ' + #to_string(next_base_id),
		get_owner: () => { return current_owner; },
		set_owner: (value) => { current_owner = value; },
		get_tile: () => { return tile; },
		get_size: () => { return size; },
		has_facility: (id) => {
			for (facility_id of current_facilities) {
				if (facility_id == id) { return true; }
			}
			return false;
		},
		get_facilities: () => {
			let result = [];
			for (id of current_facilities) {
				result :+{id: id, is_project: false};
			}
			return result;
		},
		set_facilities: (value) => { current_facilities = value; },
		add_facility: (id) => { current_facilities :+id; },
		remove_facility: (id) => {
			let remaining = [];
			for (facility_id of current_facilities) {
				if (facility_id != id) { remaining :+facility_id; }
			}
			current_facilities = remaining;
		},
		has: (key) => { return #is_defined(custom[key]); },
		get: (key) => { return custom[key]; },
		set: (key, value) => { custom[key] = value; },
		unset: (key) => { custom[key] = #undefined; },
		get_production_queue: () => { return queue; },
		set_production_queue: (value) => { queue = value; },
		can_produce: (kind, id) => { return true; },
	};
};

const actor = make_player(1, 'The University', 5000, 2);
const target = make_player(2, 'The Hive', 300, 1);
const actor_headquarters = make_base(actor, 10, 2, ['Headquarters']);
const target_headquarters = make_base(target, 0, 1, ['Headquarters']);
const target_base = make_base(target, 4, 4, []);
let bases = [actor_headquarters, target_headquarters, target_base];
const garrison = {
	owner: target.id,
	get_tile: () => { return target_base.get_tile(); },
	get_def: () => { return {mineral_cost: 20}; },
};
let current_turn = 5;
let game_over = false;
let messages = [];
let triggers = [];
const values = {
	f_economy_get_commerce_technology: (player) => { return player.commerce; },
};
let game = null;
game = {
	get_bm: () => { return game.bm; },
	get_um: () => { return game.um; },
	get_tm: () => { return game.tm; },
	get_players: () => { return [actor, target]; },
	get: (key) => { return values[key]; },
	set: (key, value) => { values[key] = value; },
	get_turn: () => { return current_turn; },
	is_game_over: () => { return game_over; },
	is_turn_complete: (player_id) => { return false; },
	message: (text) => { messages :+text; },
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
	bm: {get_bases: () => { return bases; }},
	um: {get_units: () => { return [garrison]; }},
	tm: {
		get_distance: (first, second) => { return #abs(first.x - second.x); },
	},
};

test.assert(rules.get_headquarters(game, actor) == actor_headquarters);
test.assert(rules.get_market_base_cost(game, actor, target_base) == 450);
target_base.set_facilities(['GenejackFactory']);
test.assert(rules.get_market_base_cost(game, actor, target_base) == 300);
target_base.set_facilities(['ChildrenSCreche']);
test.assert(rules.get_market_base_cost(game, actor, target_base) == 600);
target_base.set_facilities(['PunishmentSphere']);
test.assert(rules.get_market_base_cost(game, actor, target_base) == 600);
target_base.set_facilities([]);
actor.set_relation(target, 'treaty');
test.assert(rules.get_market_base_cost(game, actor, target_base) == 225);
actor.set_relation(target, 'neutral');
test.assert(rules.get_cost(game, actor) == 1000);

const event = {caller: actor.id, game: game, data: {player: actor}};
test.assert(#is_defined(corner_market.validate(event)));
actor.add_technology('PlanetaryEconomics');
actor.set_energy_credits(999);
test.assert(#is_defined(corner_market.validate(event)));
actor.set_energy_credits(5000);
event.caller = target.id;
test.assert(#is_defined(corner_market.validate(event)));
event.caller = actor.id;
test.assert(!#is_defined(corner_market.validate(event)));

event.applied = corner_market.apply(event);
test.assert(actor.get_energy_credits() == 4000);
let state = rules.get_state(game, actor);
test.assert(state.base == actor_headquarters);
test.assert(state.turn == 25);
test.assert(state.cost == 1000);
test.assert(#sizeof(triggers) == 2);
test.assert(#sizeof(messages) == 1);
test.assert(#is_defined(corner_market.validate(event)));
current_turn = 24;
test.assert(rules.get_winner(game) == null);
current_turn = 25;
test.assert(rules.get_winner(game) == actor);

actor_headquarters.set('probe_research_data_stolen', true);
actor_headquarters.set('probe_energy_reserves_drained', true);
actor_headquarters.set('probe_genetic_plague_introduced', true);
const capture = base_capture.capture_base(game, actor_headquarters, target);
test.assert(actor_headquarters.get_owner() == target);
test.assert(!actor_headquarters.has_facility('Headquarters'));
test.assert(actor_headquarters.has_facility('NetworkNode'));
test.assert(actor_headquarters.has_facility('PerimeterDefense'));
test.assert(!actor_headquarters.has('probe_research_data_stolen'));
test.assert(actor_headquarters.get('probe_energy_reserves_drained') == true);
test.assert(actor_headquarters.get('probe_genetic_plague_introduced') == true);
test.assert(rules.get_base_state(actor_headquarters) == null);
test.assert(actor.get_energy_credits() == 4500);
test.assert(target.get_energy_credits() == 800);
test.assert(#is_defined(capture.economic_victory_capture));
base_capture.restore_base(game, actor_headquarters, capture);
test.assert(actor_headquarters.get_owner() == actor);
test.assert(actor_headquarters.has_facility('Headquarters'));
test.assert(actor_headquarters.has_facility('NetworkNode'));
test.assert(!actor_headquarters.has_facility('PerimeterDefense'));
test.assert(actor_headquarters.get('probe_research_data_stolen') == true);
test.assert(actor_headquarters.get('probe_energy_reserves_drained') == true);
test.assert(actor_headquarters.get('probe_genetic_plague_introduced') == true);
test.assert(actor.get_energy_credits() == 4000);
test.assert(target.get_energy_credits() == 300);
test.assert(rules.get_state(game, actor).turn == 25);
actor_headquarters.unset('probe_research_data_stolen');
actor_headquarters.unset('probe_energy_reserves_drained');
actor_headquarters.unset('probe_genetic_plague_introduced');

const actor_fallback = make_base(actor, 12, 2, []);
bases :+actor_fallback;
const evacuated_capture = base_capture.capture_base(game, actor_headquarters, target);
test.assert(actor_headquarters.get_owner() == target);
test.assert(!actor_headquarters.has_facility('Headquarters'));
test.assert(actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 3000);
test.assert(target.get_energy_credits() == 300);
test.assert(rules.get_base_state(actor_headquarters) == null);
test.assert(rules.get_base_state(actor_fallback).turn == 25);
test.assert(evacuated_capture.headquarters_evacuation.destination == actor_fallback);
test.assert(!#is_defined(evacuated_capture.economic_victory_capture));
base_capture.restore_base(game, actor_headquarters, evacuated_capture);
test.assert(actor_headquarters.get_owner() == actor);
test.assert(actor_headquarters.has_facility('Headquarters'));
test.assert(!actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 4000);
test.assert(rules.get_state(game, actor).base == actor_headquarters);

headquarters_evacuation(game);
test.assert(#is_defined(game.get('f_headquarters_offer_evacuation')));
test.assert(!#is_defined(game.get('f_base_should_evacuate_headquarters')));
const prompted_capture = base_capture.capture_base(game, actor_headquarters, target);
test.assert(actor_headquarters.get_owner() == target);
test.assert(!actor_headquarters.has_facility('Headquarters'));
test.assert(!actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 4500);
test.assert(target.get_energy_credits() == 800);
test.assert(#is_defined(prompted_capture.headquarters_evacuation_offer));
headquarters_evacuation(game);
const restored_offer = values.f_headquarters_get_evacuation(actor_headquarters);
test.assert(restored_offer != null);
test.assert(restored_offer.base == actor_headquarters);
test.assert(restored_offer.player == actor);
test.assert(restored_offer.new_owner == target);
test.assert(restored_offer.destination == actor_fallback);
test.assert(restored_offer.cost == 1000);
test.assert(restored_offer.economic_victory_state.turn == 25);
test.assert(restored_offer.economic_victory_state.cost == 1000);
test.assert(restored_offer.owner_capture_delta == 500);
test.assert(restored_offer.conqueror_capture_delta == 500);

let response = {
	caller: target.id,
	game: game,
	data: {base: actor_headquarters, action: 'evacuate'},
};
test.assert(#is_defined(respond_evacuation.validate(response)));
response.caller = actor.id;
test.assert(!#is_defined(respond_evacuation.validate(response)));
response.data.action = 'wait';
test.assert(#is_defined(respond_evacuation.validate(response)));
response.data.action = 'evacuate';
response.resolved = respond_evacuation.resolve(response);
response.applied = respond_evacuation.apply(response);
test.assert(actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 3000);
test.assert(target.get_energy_credits() == 300);
test.assert(rules.get_state(game, actor).base == actor_fallback);
test.assert(values.f_headquarters_get_evacuation(actor_headquarters) == null);

respond_evacuation.rollback(response);
test.assert(!actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 4500);
test.assert(target.get_energy_credits() == 800);
test.assert(rules.get_state(game, actor) == null);
test.assert(values.f_headquarters_get_evacuation(actor_headquarters) != null);
headquarters_evacuation(game);
test.assert(
	values.f_headquarters_get_evacuation(actor_headquarters).owner_capture_delta == 500
);
test.assert(
	values.f_headquarters_get_evacuation(actor_headquarters).conqueror_capture_delta == 500
);

response.data.action = 'abandon';
response.resolved = respond_evacuation.resolve(response);
response.applied = respond_evacuation.apply(response);
test.assert(!actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 4500);
test.assert(target.get_energy_credits() == 800);
test.assert(values.f_headquarters_get_evacuation(actor_headquarters) == null);

base_capture.restore_base(game, actor_headquarters, prompted_capture);
test.assert(actor_headquarters.get_owner() == actor);
test.assert(actor_headquarters.has_facility('Headquarters'));
test.assert(!actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 4000);
test.assert(target.get_energy_credits() == 300);
test.assert(rules.get_state(game, actor).base == actor_headquarters);

corner_market.rollback(event);
test.assert(actor.get_energy_credits() == 5000);
test.assert(rules.get_state(game, actor) == null);

const ordinary_capture = base_capture.capture_base(game, actor_headquarters, target);
test.assert(#is_defined(ordinary_capture.headquarters_evacuation_offer));
test.assert(actor.get_energy_credits() == 5000);
test.assert(target.get_energy_credits() == 300);
response.data.action = 'evacuate';
test.assert(!#is_defined(respond_evacuation.validate(response)));
response.resolved = respond_evacuation.resolve(response);
response.applied = respond_evacuation.apply(response);
test.assert(actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 4000);
test.assert(target.get_energy_credits() == 300);
test.assert(rules.get_state(game, actor) == null);
respond_evacuation.rollback(response);
base_capture.restore_base(game, actor_headquarters, ordinary_capture);
test.assert(actor_headquarters.has_facility('Headquarters'));
test.assert(!actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 5000);

actor.type = 'ai';
actor_headquarters.set_owner(actor);
test.assert(actor.type == 'ai');
test.assert(actor_headquarters.get_owner().type == 'ai');
test.assert(#typeof(game.get('f_base_should_evacuate_headquarters')) != 'Callable');
test.assert(actor_fallback.get_owner() == actor);
test.assert(#typeof(actor.set_energy_credits) == 'Callable');
test.assert(actor.get_energy_credits() == 5000);
test.assert(
	base_capture.get_headquarters_destination(game, actor_headquarters, actor) ==
		actor_fallback
);
const ai_capture = base_capture.capture_base(game, actor_headquarters, target);
test.assert(ai_capture.headquarters_evacuation.destination == actor_fallback);
test.assert(actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 4000);
base_capture.restore_base(game, actor_headquarters, ai_capture);
test.assert(actor_headquarters.has_facility('Headquarters'));
test.assert(!actor_fallback.has_facility('Headquarters'));
test.assert(actor.get_energy_credits() == 5000);

game_over = true;
test.assert(#is_defined(corner_market.validate(event)));
