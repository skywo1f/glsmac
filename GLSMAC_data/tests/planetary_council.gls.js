const rules = #include('../default/game/council_rules');
const call_council = #include('../default/game/event/call_planetary_council');
const cast_vote = #include('../default/game/event/cast_council_vote');
const resolve_council = #include('../default/game/event/resolve_planetary_council');
const respond_supreme = #include('../default/game/event/respond_supreme_leader');
const resolve_accession = #include('../default/game/event/resolve_supreme_accession');
const resolve_defiance = #include('../default/game/event/resolve_supreme_defiance');
const declare_vendetta = #include('../default/game/event/declare_vendetta');
const propose_relation = #include('../default/game/event/propose_diplomatic_relation');
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
		unity_core_salvaged: false,
		un_charter_repealed: false,
		is_expelled: false,
		supreme_leader_id: -1,
		supreme_response: 0,
		supreme_resolved: false,
	};
	let technologies = [];
	let relations = {};
	let contacts = {};
	let offers = {};
	let infiltrated = {};
	let integrity = 0;
	let energy_credits = 100;
	let major_atrocities = 0;
	let sanction_turns = 0;
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
		has_contact: (other) => {
			return contacts['p' + #to_string(other.id)] == true;
		},
		set_contact: (other, value) => {
			contacts['p' + #to_string(other.id)] = value;
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
		get_integrity_blemishes: () => { return integrity; },
		set_integrity_blemishes: (value) => { integrity = value; },
		get_energy_credits: () => { return energy_credits; },
		set_energy_credits: (value) => { energy_credits = value; },
		get_major_atrocities: () => { return major_atrocities; },
		set_major_atrocities: (value) => { major_atrocities = value; },
		get_sanction_turns: () => { return sanction_turns; },
		set_sanction_turns: (value) => { sanction_turns = value; },
		has_infiltrated: (other) => {
			return infiltrated['p' + #to_string(other.id)] == true;
		},
		set_infiltrated: (other, value) => {
			infiltrated['p' + #to_string(other.id)] = value;
		},
	};
};

const make_base = (id, owner, initial_size, initial_elevation) => {
	let size = initial_size;
	let facilities = {};
	const tile = {
		is_water: false,
		elevation: #is_defined(initial_elevation) ? initial_elevation : 1000,
		sea_level: 0,
	};
	return {
		id: id,
		get_owner: () => { return owner; },
		get_size: () => { return size; },
		set_size: (value) => { size = value; },
		get_tile: () => { return tile; },
		has_facility: (facility_id) => { return facilities[facility_id] == true; },
		add_facility: (facility_id) => { facilities[facility_id] = true; },
	};
};

const peacekeepers = make_player(1, 'Peacekeepers', 'PEACEKEEPERS', 'human', false);
const empath = make_player(2, 'Gaians', 'GAIANS', 'ai', false);
const clinical = make_player(3, 'University', 'UNIVERSITY', 'ai', false);
const progenitor = make_player(4, 'Caretakers', 'CARETAKERS', 'ai', true);
const players = [peacekeepers, empath, clinical, progenitor];
for (player of players) {
	for (other of players) {
		if (player.id != other.id) { player.set_contact(other, true); }
	}
}
const peace_base = make_base(1, peacekeepers, 4, 100);
const empath_base = make_base(2, empath, 6, 100);
const clinical_base = make_base(3, clinical, 5, 900);
const progenitor_base = make_base(4, progenitor, 20, 100);
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
let climate_state = {level: 0, future_change: 0, progress: 0};

test.assert(!rules.can_automatically_convene({get_turn: () => { return 1; }}));
test.assert(!rules.can_automatically_convene({get_turn: () => { return 19; }}));
test.assert(rules.can_automatically_convene({get_turn: () => { return 20; }}));

let game = null;
game = {
	get_bm: () => { return game.bm; },
	get_tm: () => { return game.tm; },
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
	tm: {
		get_climate_state: () => { return #clone(climate_state); },
		set_climate_state: (level, future_change, progress) => {
			climate_state = {
				level: level, future_change: future_change, progress: progress,
			};
		},
	},
};

values.f_diplomacy_validate_pair = (player, other) => {
	if (player.id == other.id) { return 'A player cannot conduct diplomacy with itself'; }
};
values.f_diplomacy_snapshot_pair = (player, other) => {
	return {
		player_relation: player.get_diplomatic_relation(other),
		other_relation: other.get_diplomatic_relation(player),
		player_offer: player.get_diplomatic_offer(other),
		other_offer: other.get_diplomatic_offer(player),
	};
};
values.f_diplomacy_restore_pair = (player, other, state) => {
	player.set_diplomatic_relation(other, state.player_relation);
	other.set_diplomatic_relation(player, state.other_relation);
	player.set_diplomatic_offer(other, state.player_offer);
	other.set_diplomatic_offer(player, state.other_offer);
};
values.f_diplomacy_set_bilateral_relation = (player, other, relation) => {
	player.set_diplomatic_relation(other, relation);
	other.set_diplomatic_relation(player, relation);
};
values.f_diplomacy_clear_offers = (player, other) => {
	player.set_diplomatic_offer(other, '');
	other.set_diplomatic_offer(player, '');
};
values.f_council_get_forced_relation = (player, other) => {
	return rules.get_forced_relation(game, player, other);
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
clinical.set_contact(peacekeepers, false);
test.assert(#is_defined(rules.validate_call(game, peacekeepers, 'governor')));
clinical.set_contact(peacekeepers, true);

let expelled_state = empath.get_council_state();
expelled_state.is_expelled = true;
empath.set_council_state(expelled_state);
test.assert(rules.is_expelled(empath));
test.assert(rules.get_votes(game, empath) == 0);
test.assert(rules.get_total_votes(game) == 18);
test.assert(#sizeof(rules.get_voters(game)) == 2);
test.assert(#is_defined(rules.validate_call(game, empath, 'governor')));
expelled_state.is_expelled = false;
empath.set_council_state(expelled_state);


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
let expelled_candidate_state = clinical.get_council_state();
expelled_candidate_state.is_governor = false;
expelled_candidate_state.is_expelled = true;
clinical.set_council_state(expelled_candidate_state);
for (voter of [peacekeepers, empath]) {
	let voter_state = voter.get_council_state();
	voter_state.vote_id = clinical.id;
	voter.set_council_state(voter_state);
}
test.assert(rules.get_tally(game).all_voted);
test.assert(rules.get_result(game).winner_id == -1);
call_council.rollback(call);

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
peacekeepers.add_technology('OrbitalSpaceflight');
peacekeepers.set_energy_credits(100);
empath.set_energy_credits(200);
clinical.set_energy_credits(999999800);
progenitor.set_energy_credits(300);
test.assert(!rules.has_salvaged_unity_core(game));
test.assert(!#is_defined(rules.validate_call(game, peacekeepers, 'salvage_unity_core')));
test.assert(
	rules.get_available_policy_proposals(game, peacekeepers) ==
	['salvage_unity_core', 'trade_pact', 'launch_solar_shade']
);
test.assert(
	council_ai.choose_policy_vote(game, peacekeepers, 'salvage_unity_core') == rules.vote_yes
);
let unity_call = {
	caller: peacekeepers.id,
	game: game,
	data: {player: peacekeepers, proposal: 'salvage_unity_core'},
};
unity_call.applied = call_council.apply(unity_call);
submit_vote(peacekeepers, rules.vote_yes);
submit_vote(empath, rules.vote_yes);
submit_vote(clinical, rules.vote_yes);
let unity_resolution = {caller: 0, game: game, data: {}};
unity_resolution.applied = resolve_council.apply(unity_resolution);
test.assert(rules.has_salvaged_unity_core(game));
test.assert(peacekeepers.get_energy_credits() == 600);
test.assert(empath.get_energy_credits() == 700);
test.assert(clinical.get_energy_credits() == 1000000000);
test.assert(progenitor.get_energy_credits() == 800);
resolve_council.rollback(unity_resolution);
test.assert(!rules.has_salvaged_unity_core(game));
test.assert(peacekeepers.get_energy_credits() == 100);
test.assert(clinical.get_energy_credits() == 999999800);
test.assert(rules.get_session(game).proposal == 'salvage_unity_core');
unity_resolution.applied = resolve_council.apply(unity_resolution);
test.assert(rules.has_salvaged_unity_core(game));
test.assert(#is_defined(rules.validate_call(game, peacekeepers, 'salvage_unity_core')));


current_turn = 85;
peacekeepers.add_technology('AdvancedMilitaryAlgorithms');
test.assert(!rules.is_un_charter_repealed(game));
test.assert(#is_defined(rules.validate_call(game, peacekeepers, 'reinstate_un_charter')));
test.assert(!#is_defined(rules.validate_call(game, peacekeepers, 'repeal_un_charter')));
peacekeepers.set_major_atrocities(3);
peacekeepers.set_sanction_turns(20);
test.assert(
	council_ai.choose_policy_vote(game, peacekeepers, 'repeal_un_charter') == rules.vote_yes
);
let charter_call = {
	caller: peacekeepers.id,
	game: game,
	data: {player: peacekeepers, proposal: 'repeal_un_charter'},
};
charter_call.applied = call_council.apply(charter_call);
submit_vote(peacekeepers, rules.vote_yes);
submit_vote(empath, rules.vote_yes);
submit_vote(clinical, rules.vote_yes);
let charter_resolution = {caller: 0, game: game, data: {}};
charter_resolution.applied = resolve_council.apply(charter_resolution);
test.assert(rules.is_un_charter_repealed(game));
resolve_council.rollback(charter_resolution);
test.assert(!rules.is_un_charter_repealed(game));
test.assert(rules.get_session(game).proposal == 'repeal_un_charter');
charter_resolution.applied = resolve_council.apply(charter_resolution);
test.assert(rules.is_un_charter_repealed(game));


current_turn = 105;
charter_call = {
	caller: peacekeepers.id,
	game: game,
	data: {player: peacekeepers, proposal: 'reinstate_un_charter'},
};
charter_call.applied = call_council.apply(charter_call);
submit_vote(peacekeepers, rules.vote_yes);
submit_vote(empath, rules.vote_yes);
submit_vote(clinical, rules.vote_yes);
charter_resolution.applied = resolve_council.apply(charter_resolution);
test.assert(!rules.is_un_charter_repealed(game));
peacekeepers.set_major_atrocities(0);
peacekeepers.set_sanction_turns(0);
clinical.add_technology('OrbitalSpaceflight');
peacekeepers.set_relation(clinical, 'vendetta');
test.assert(
	council_ai.choose_policy_vote(game, peacekeepers, 'reinstate_un_charter') == rules.vote_yes
);
test.assert(
	council_ai.choose_policy_vote(game, peacekeepers, 'repeal_un_charter') == rules.vote_no
);
peacekeepers.set_relation(clinical, 'neutral');


current_turn = 125;
peacekeepers.add_technology('AdvancedEcologicalEngineering');
test.assert(!#is_defined(rules.validate_call(game, peacekeepers, 'launch_solar_shade')));
test.assert(!#is_defined(rules.validate_call(game, peacekeepers, 'melt_polar_caps')));
test.assert(
	rules.get_available_policy_proposals(game, peacekeepers) ==
	['trade_pact', 'repeal_un_charter', 'launch_solar_shade', 'melt_polar_caps']
);
game.tm.set_climate_state(4, 3500, 7);
test.assert(#is_defined(rules.validate_call(game, peacekeepers, 'melt_polar_caps')));
game.tm.set_climate_state(4, 0 - 3500, 7);
test.assert(#is_defined(rules.validate_call(game, peacekeepers, 'launch_solar_shade')));
game.tm.set_climate_state(4, 0, 7);

let melt_call = {
	caller: peacekeepers.id,
	game: game,
	data: {player: peacekeepers, proposal: 'melt_polar_caps'},
};
melt_call.applied = call_council.apply(melt_call);
submit_vote(peacekeepers, rules.vote_yes);
submit_vote(empath, rules.vote_yes);
submit_vote(clinical, rules.vote_yes);
let melt_resolution = {caller: 0, game: game, data: {}};
melt_resolution.applied = resolve_council.apply(melt_resolution);
test.assert(game.tm.get_climate_state() == {level: 4, future_change: 300, progress: 7});
resolve_council.rollback(melt_resolution);
test.assert(game.tm.get_climate_state() == {level: 4, future_change: 0, progress: 7});
test.assert(rules.get_session(game).proposal == 'melt_polar_caps');
melt_resolution.applied = resolve_council.apply(melt_resolution);
test.assert(game.tm.get_climate_state().future_change == 300);
test.assert(
	council_ai.choose_policy_vote(game, peacekeepers, 'launch_solar_shade') == rules.vote_yes
);
test.assert(
	council_ai.choose_policy_vote(game, peacekeepers, 'melt_polar_caps') == rules.vote_no
);

current_turn = 145;
let shade_call = {
	caller: peacekeepers.id,
	game: game,
	data: {player: peacekeepers, proposal: 'launch_solar_shade'},
};
shade_call.applied = call_council.apply(shade_call);
submit_vote(peacekeepers, rules.vote_yes);
submit_vote(empath, rules.vote_yes);
submit_vote(clinical, rules.vote_yes);
let shade_resolution = {caller: 0, game: game, data: {}};
shade_resolution.applied = resolve_council.apply(shade_resolution);
test.assert(game.tm.get_climate_state() == {level: 4, future_change: 0, progress: 7});
resolve_council.rollback(shade_resolution);
test.assert(game.tm.get_climate_state().future_change == 300);
shade_resolution.applied = resolve_council.apply(shade_resolution);
test.assert(game.tm.get_climate_state().future_change == 0);

peace_base.add_facility('PressureDome');
peacekeepers.set_relation(empath, 'vendetta');
test.assert(council_ai.get_climate_policy_value(game, peacekeepers) < 0);
test.assert(
	council_ai.choose_policy_vote(game, peacekeepers, 'melt_polar_caps') == rules.vote_yes
);
test.assert(
	council_ai.choose_policy_vote(game, peacekeepers, 'launch_solar_shade') == rules.vote_no
);
peacekeepers.set_relation(empath, 'neutral');


current_turn = 165;
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

test.assert(!game_over);
test.assert(!supreme_resolution.applied.terminal);
test.assert(rules.get_session(game) == null);
test.assert(rules.get_supreme_state(game) == {leader: clinical, resolved: false});
test.assert(rules.get_supreme_response(clinical) == rules.supreme_response_accede);
test.assert(rules.get_supreme_response(peacekeepers) == rules.supreme_response_pending);
test.assert(rules.get_supreme_response(empath) == rules.supreme_response_pending);
test.assert(rules.get_supreme_response(progenitor) == rules.supreme_response_none);
test.assert(#is_defined(rules.validate_call(game, clinical, 'governor')));

peacekeepers.set_relation(clinical, 'pact');
test.assert(!council_ai.choose_supreme_defiance(peacekeepers, clinical));
peacekeepers.set_relation(clinical, 'neutral');
empath.set_relation(clinical, 'vendetta');
test.assert(council_ai.choose_supreme_defiance(empath, clinical));
empath.set_relation(clinical, 'neutral');
clinical.set_major_atrocities(1);
test.assert(council_ai.choose_supreme_defiance(empath, clinical));
clinical.set_major_atrocities(0);

let peace_response = {
	caller: peacekeepers.id,
	game: game,
	data: {player: peacekeepers, defy: false},
};
test.assert(!#is_defined(respond_supreme.validate(peace_response)));
peace_response.applied = respond_supreme.apply(peace_response);
test.assert(rules.get_supreme_response(peacekeepers) == rules.supreme_response_accede);
respond_supreme.rollback(peace_response);
test.assert(rules.get_supreme_response(peacekeepers) == rules.supreme_response_pending);
peace_response.applied = respond_supreme.apply(peace_response);

let empath_response = {
	caller: empath.id,
	game: game,
	data: {player: empath, defy: true},
};
test.assert(!#is_defined(respond_supreme.validate(empath_response)));
empath_response.applied = respond_supreme.apply(empath_response);
test.assert(rules.get_supreme_response(empath) == rules.supreme_response_defy);
test.assert(#is_defined(respond_supreme.validate(empath_response)));
test.assert(#sizeof(rules.get_pending_supreme_players(game)) == 0);

let accession = {caller: 0, game: game, data: {}};
test.assert(!#is_defined(resolve_accession.validate(accession)));
accession.applied = resolve_accession.apply(accession);
test.assert(!game_over);
test.assert(!accession.applied.terminal);
test.assert(rules.get_supreme_state(game) == {leader: clinical, resolved: true});
test.assert(peacekeepers.get_diplomatic_relation(clinical) == 'pact');
test.assert(empath.get_diplomatic_relation(peacekeepers) == 'vendetta');
test.assert(empath.get_diplomatic_relation(clinical) == 'vendetta');
test.assert(rules.get_forced_relation(game, peacekeepers, clinical) == 'pact');
test.assert(rules.get_forced_relation(game, empath, clinical) == 'vendetta');
test.assert(rules.get_supreme_defiance_winner(game) == null);

let loyal_vendetta = {
	caller: peacekeepers.id,
	game: game,
	data: {player: peacekeepers, target: clinical},
};
test.assert(#is_defined(declare_vendetta.validate(loyal_vendetta)));
let holdout_peace = {
	caller: empath.id,
	game: game,
	data: {player: empath, target: clinical, relation: 'treaty'},
};
test.assert(#is_defined(propose_relation.validate(holdout_peace)));

resolve_accession.rollback(accession);
test.assert(rules.get_supreme_state(game) == {leader: clinical, resolved: false});
test.assert(peacekeepers.get_diplomatic_relation(clinical) == 'neutral');
test.assert(empath.get_diplomatic_relation(peacekeepers) == 'neutral');
test.assert(empath.get_diplomatic_relation(clinical) == 'neutral');
accession.applied = resolve_accession.apply(accession);

empath_base.set_size(0);
test.assert(rules.get_supreme_defiance_winner(game) == clinical);
let defiance = {caller: 0, game: game, data: {}};
test.assert(!#is_defined(resolve_defiance.validate(defiance)));
defiance.applied = resolve_defiance.apply(defiance);
test.assert(game_over);
test.assert(victory == {type: 'diplomatic', winner_id: clinical.id});
test.assert(defiance.applied.terminal);

define_council(game);
callbacks.start({});
const trigger_count_before_projection = #sizeof(triggers);
master = false;
callbacks.player_update({player: peacekeepers});
test.assert(#sizeof(triggers) == trigger_count_before_projection + 1);
test.assert(triggers[#sizeof(triggers) - 1].name == 'council_updated');
test.assert(triggers[#sizeof(triggers) - 1].data.player == peacekeepers);
master = true;
test.assert(!values.f_council_is_governor(clinical));
test.assert(!values.f_council_has_global_trade_pact());
test.assert(values.f_council_has_salvaged_unity_core());
test.assert(!values.f_council_is_un_charter_repealed());
test.assert(values.f_council_is_policy_proposal('repeal_un_charter'));
test.assert(values.f_council_get_proposal_name('salvage_unity_core') == 'Salvage Unity Fusion Core');
test.assert(values.f_council_get_supreme_state() == {leader: clinical, resolved: true});
test.assert(values.f_council_get_supreme_response(empath) == rules.supreme_response_defy);
test.assert(values.f_council_get_forced_relation(peacekeepers, clinical) == 'pact');
test.assert(!values.f_council_has_intelligence(clinical, peacekeepers));
clinical.set_infiltrated(peacekeepers, true);
test.assert(values.f_council_has_intelligence(clinical, peacekeepers));
test.assert(!values.f_council_has_intelligence(clinical, progenitor));
clinical.set_infiltrated(progenitor, true);
test.assert(values.f_council_has_intelligence(clinical, progenitor));
test.assert(#sizeof(messages) >= 8);
test.assert(#sizeof(triggers) >= 18);
