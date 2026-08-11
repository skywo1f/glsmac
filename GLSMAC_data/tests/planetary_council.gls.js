const rules = #include('../default/game/council_rules');
const call_council = #include('../default/game/event/call_planetary_council');
const cast_vote = #include('../default/game/event/cast_council_vote');
const resolve_council = #include('../default/game/event/resolve_planetary_council');
const council_ai = #include('../default/game/ai/council');
const define_council = #include('../default/game/council');
const council_popup = #include('../default/ui/parts/game/popup/planetary_council');


test.assert(#typeof(council_popup.init) == 'Callable');
test.assert(rules.minimum_session_interval == 20);

const make_player = (id, name, faction_id, role, progenitor) => {
	let state = {
		is_governor: false,
		last_session_turn: 0,
		proposal: '',
		caller_id: -1,
		candidate_a_id: -1,
		candidate_b_id: -1,
		vote_id: -2,
		global_trade_pact: false,
	};
	let technologies = [];
	let relations = {};
	let infiltrated = {};
	let integrity = 0;
	const faction = {id: faction_id, name: name, is_progenitor: progenitor};
	return {
		id: id,
		name: name,
		type: role,
		get_faction: () => { return faction; },
		get_council_state: () => { return #clone(state); },
		set_council_state: (value) => { state = #clone(value); },
		has_technology: (id) => {
			for (known of technologies) { if (known == id) { return true; } }
			return false;
		},
		add_technology: (id) => { technologies :+id; },
		get_diplomatic_relation: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(relations[key]) ? relations[key] : 'neutral';
		},
		set_relation: (other, relation) => {
			relations['p' + #to_string(other.id)] = relation;
		},
		get_integrity_blemishes: () => { return integrity; },
		set_integrity_blemishes: (value) => { integrity = value; },
		has_infiltrated: (other) => {
			return infiltrated['p' + #to_string(other.id)] == true;
		},
		set_infiltrated: (other, value) => {
			infiltrated['p' + #to_string(other.id)] = value;
		},
	};
};

const make_base = (id, owner, initial_size) => {
	let size = initial_size;
	return {
		id: id,
		get_owner: () => { return owner; },
		get_size: () => { return size; },
		set_size: (value) => { size = value; },
	};
};

const peacekeepers = make_player(1, 'Peacekeepers', 'PEACEKEEPERS', 'human', false);
const empath = make_player(2, 'Gaians', 'GAIANS', 'ai', false);
const clinical = make_player(3, 'University', 'UNIVERSITY', 'ai', false);
const progenitor = make_player(4, 'Caretakers', 'CARETAKERS', 'ai', true);
const players = [peacekeepers, empath, clinical, progenitor];
const peace_base = make_base(1, peacekeepers, 4);
const empath_base = make_base(2, empath, 6);
const clinical_base = make_base(3, clinical, 5);
const progenitor_base = make_base(4, progenitor, 20);
const bases = [peace_base, empath_base, clinical_base, progenitor_base];
let projects = {
	TheEmpathGuild: empath_base,
	ClinicalImmortality: clinical_base,
};
let current_turn = 5;
let game_over = false;
let victory = null;
let messages = [];
let triggers = [];
let callbacks = {};
let values = {};
let master = true;

let game = null;
game = {
	get_bm: () => { return game.bm; },
	get_players: () => { return players; },
	get_player: (id) => {
		for (player of players) { if (player.id == id) { return player; } }
		return null;
	},
	get_turn: () => { return current_turn; },
	get_year: () => { return current_turn + 2100; },
	is_game_over: () => { return game_over; },
	is_turn_complete: (id) => { return false; },
	is_master: () => { return master; },
	declare_victory: (type, winner_id) => {
		game_over = true;
		victory = {type: type, winner_id: winner_id};
	},
	message: (text) => { messages :+text; },
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, value) => { values[name] = value; },
	get: (name) => { return values[name]; },
	event: (name, data) => {},
	event_as: (id, name, data) => {},
	bm: {
		get_bases: () => { return bases; },
		get_project_base: (id) => {
			return #is_defined(projects[id]) ? projects[id] : null;
		},
	},
};


test.assert(rules.get_population(game, peacekeepers) == 4);
test.assert(rules.get_votes(game, peacekeepers) == 8);
test.assert(rules.get_votes(game, empath) == 9);
test.assert(rules.get_votes(game, clinical) == 10);
test.assert(rules.get_votes(game, progenitor) == 0);
test.assert(rules.get_total_votes(game) == 27);
const initial_rankings = rules.get_rankings(game);
test.assert(initial_rankings[0].player == clinical);
test.assert(initial_rankings[1].player == empath);
test.assert(rules.get_required_votes('governor', 27) == 14);
test.assert(rules.get_required_votes('supreme', 27) == 21);
test.assert(#is_defined(rules.validate_call(game, clinical, 'supreme')));
test.assert(!#is_defined(rules.validate_call(game, peacekeepers, 'governor')));


let call = {
	caller: peacekeepers.id,
	game: game,
	data: {player: peacekeepers, proposal: 'governor'},
};
test.assert(!#is_defined(call_council.validate(call)));
call.caller = empath.id;
test.assert(#is_defined(call_council.validate(call)));
call.caller = peacekeepers.id;
call.applied = call_council.apply(call);

test.assert(rules.get_session(game).candidate_a_id == clinical.id);
test.assert(peacekeepers.get_council_state().vote_id == -2);
test.assert(progenitor.get_council_state().vote_id == -1);
call_council.rollback(call);
test.assert(rules.get_session(game) == null);
test.assert(peacekeepers.get_council_state().last_session_turn == 0);
call.applied = call_council.apply(call);

const submit_vote = (player, candidate_id) => {
	let event = {
		caller: player.id,
		game: game,
		data: {player: player, vote_id: candidate_id},
	};
	test.assert(!#is_defined(cast_vote.validate(event)));
	event.applied = cast_vote.apply(event);
	return event;
};

let peace_vote = submit_vote(peacekeepers, clinical.id);
cast_vote.rollback(peace_vote);
test.assert(peacekeepers.get_council_state().vote_id == -2);
peace_vote = submit_vote(peacekeepers, clinical.id);
submit_vote(empath, clinical.id);
submit_vote(clinical, clinical.id);
const governor_tally = rules.get_tally(game);
test.assert(governor_tally.all_voted);
test.assert(governor_tally.candidate_a_votes == 27);

let resolution = {caller: 0, game: game, data: {}};
test.assert(!#is_defined(resolve_council.validate(resolution)));
resolution.applied = resolve_council.apply(resolution);

test.assert(rules.get_governor(game) == clinical);
test.assert(rules.get_session(game) == null);
resolve_council.rollback(resolution);
test.assert(rules.get_session(game) != null);
resolution.applied = resolve_council.apply(resolution);
test.assert(rules.get_governor(game) == clinical);
test.assert(#is_defined(rules.validate_call(game, peacekeepers, 'governor')));

peacekeepers.set_relation(clinical, 'pact');
test.assert(council_ai.choose_vote(game, peacekeepers, {
	proposal: 'governor', candidate_a_id: clinical.id, candidate_b_id: empath.id,
}) == clinical.id);
empath.set_relation(clinical, 'vendetta');
test.assert(council_ai.choose_vote(game, empath, {
	proposal: 'governor', candidate_a_id: clinical.id, candidate_b_id: empath.id,
}) == empath.id);
peacekeepers.set_relation(clinical, 'neutral');
test.assert(council_ai.choose_vote(game, peacekeepers, {
	proposal: 'supreme', candidate_a_id: clinical.id, candidate_b_id: empath.id,
}) == -1);


current_turn = 25;
peacekeepers.add_technology('PlanetaryEconomics');
test.assert(!rules.has_global_trade_pact(game));
test.assert(#is_defined(rules.validate_call(game, peacekeepers, 'repeal_trade_pact')));
test.assert(!#is_defined(rules.validate_call(game, peacekeepers, 'trade_pact')));
let trade_call = {
	caller: peacekeepers.id,
	game: game,
	data: {player: peacekeepers, proposal: 'trade_pact'},
};
trade_call.applied = call_council.apply(trade_call);
test.assert(rules.get_session(game).candidate_a_id == rules.vote_yes);
test.assert(rules.get_session(game).candidate_b_id == rules.vote_no);
submit_vote(peacekeepers, rules.vote_yes);
submit_vote(empath, rules.vote_yes);
submit_vote(clinical, rules.vote_yes);
let trade_resolution = {caller: 0, game: game, data: {}};
test.assert(!#is_defined(resolve_council.validate(trade_resolution)));
trade_resolution.applied = resolve_council.apply(trade_resolution);
test.assert(rules.has_global_trade_pact(game));
test.assert(rules.get_governor(game) == clinical);
resolve_council.rollback(trade_resolution);
test.assert(!rules.has_global_trade_pact(game));
test.assert(rules.get_session(game).proposal == 'trade_pact');
trade_resolution.applied = resolve_council.apply(trade_resolution);
test.assert(rules.has_global_trade_pact(game));

peacekeepers.set_relation(clinical, 'pact');
test.assert(council_ai.choose_policy_vote(game, peacekeepers, 'trade_pact') == rules.vote_yes);
test.assert(council_ai.choose_policy_vote(game, peacekeepers, 'repeal_trade_pact') == rules.vote_no);
peacekeepers.set_relation(clinical, 'neutral');

current_turn = 45;
test.assert(#is_defined(rules.validate_call(game, peacekeepers, 'trade_pact')));
test.assert(!#is_defined(rules.validate_call(game, peacekeepers, 'repeal_trade_pact')));
let repeal_call = {
	caller: peacekeepers.id,
	game: game,
	data: {player: peacekeepers, proposal: 'repeal_trade_pact'},
};
repeal_call.applied = call_council.apply(repeal_call);
submit_vote(peacekeepers, rules.vote_no);
submit_vote(empath, rules.vote_no);
submit_vote(clinical, rules.vote_no);
let repeal_resolution = {caller: 0, game: game, data: {}};
repeal_resolution.applied = resolve_council.apply(repeal_resolution);
test.assert(rules.has_global_trade_pact(game));
resolve_council.rollback(repeal_resolution);
call_council.rollback(repeal_call);

repeal_call.applied = call_council.apply(repeal_call);
submit_vote(peacekeepers, rules.vote_yes);
submit_vote(empath, rules.vote_yes);
submit_vote(clinical, rules.vote_yes);
repeal_resolution.applied = resolve_council.apply(repeal_resolution);
test.assert(!rules.has_global_trade_pact(game));


current_turn = 65;
clinical_base.set_size(20);
clinical.add_technology('MindMachineInterface');
test.assert(rules.get_votes(game, clinical) == 40);
test.assert(rules.get_total_votes(game) == 57);
test.assert(!#is_defined(rules.validate_call(game, clinical, 'supreme')));
let supreme_call = {
	caller: clinical.id,
	game: game,
	data: {player: clinical, proposal: 'supreme'},
};
test.assert(!#is_defined(call_council.validate(supreme_call)));
supreme_call.applied = call_council.apply(supreme_call);
submit_vote(peacekeepers, clinical.id);
submit_vote(empath, clinical.id);
submit_vote(clinical, clinical.id);
test.assert(rules.get_tally(game).required_votes == 43);
let supreme_resolution = {caller: 0, game: game, data: {}};
test.assert(!#is_defined(resolve_council.validate(supreme_resolution)));
supreme_resolution.applied = resolve_council.apply(supreme_resolution);

test.assert(game_over);
test.assert(victory == {type: 'diplomatic', winner_id: clinical.id});
test.assert(supreme_resolution.applied.terminal);

define_council(game);
callbacks.start({});
test.assert(values.f_council_is_governor(clinical));
test.assert(!values.f_council_has_global_trade_pact());
test.assert(values.f_council_has_intelligence(clinical, peacekeepers));
test.assert(!values.f_council_has_intelligence(clinical, progenitor));
clinical.set_infiltrated(progenitor, true);
test.assert(values.f_council_has_intelligence(clinical, progenitor));
test.assert(#sizeof(messages) >= 8);
test.assert(#sizeof(triggers) >= 18);
