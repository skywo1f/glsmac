const rules = #include('../default/game/orbital_rules');
const attack_orbital = #include('../default/game/event/attack_orbital');

const definitions = [
	{id: 'SkyHydroponicsLab', name: 'Sky Hydroponics Lab', orbital_resource: 'NUTRIENTS', orbital_defense: false},
	{id: 'OrbitalDefensePod', name: 'Orbital Defense Pod', orbital_resource: '', orbital_defense: true},
	{id: 'RecyclingTanks', name: 'Recycling Tanks', orbital_resource: '', orbital_defense: false},
];

const make_player = (id, name, counts, deployments) => {
	let orbital_counts = #clone(counts);
	let orbital_deployments = deployments;
	return {
		id: id,
		name: name,
		get_orbital_facility_count: (facility_id) => {
			return #is_defined(orbital_counts[facility_id])
				? orbital_counts[facility_id]
				: 0;
		},
		set_orbital_facility_count: (facility_id, count) => {
			orbital_counts[facility_id] = count == 0 ? #undefined : count;
		},
		get_orbital_defense_deployments: () => { return orbital_deployments; },
		set_orbital_defense_deployments: (count) => { orbital_deployments = count; },
	};
};

const actor = make_player(1, 'University', {OrbitalDefensePod: 3}, 1);
const target = make_player(2, 'Spartans', {SkyHydroponicsLab: 2, OrbitalDefensePod: 2}, 2);
let relation_state = {p1: 'treaty', p2: 'treaty'};
let integrity_state = {p1: 0, p2: 0};
const player_key = (player) => { return 'p' + #to_string(player.id); };
let game_over = false;
let turn_complete = false;
let forced_allies = false;
let random_result = 0;
let messages = [];
let triggers = [];
let message_targets = [];
let game = null;
game = {
	random: {get_int: (minimum, maximum) => { return random_result; }},
	get_player: (id) => { return id == actor.id ? actor : target; },
	get_players: () => { return [actor, target]; },
	is_game_over: () => { return game_over; },
	is_turn_complete: (id) => { return turn_complete; },
	get_bm: () => {
		return {
			get_facility_defs: () => { return definitions; },
			get_bases: () => { return []; },
		};
	},
	get: (key) => {
		if (key == 'f_message_to_players') {
			return (text, targets) => {
				messages :+text;
				message_targets = targets;
			};
		}
		if (key == 'f_orbital_get_attack_error') {
			return (player, other, facility_id) => {
				return rules.get_attack_error(game, player, other, facility_id);
			};
		}
		if (key == 'f_council_get_forced_relation') {
			return (player, other) => { return forced_allies ? 'pact' : ''; };
		}
		if (key == 'f_diplomacy_snapshot_pair') {
			return (player, other) => {
				const player_id = player_key(player);
				const other_id = player_key(other);
				return {
					player_relation: relation_state[player_id],
					other_relation: relation_state[other_id],
					player_integrity_blemishes: integrity_state[player_id],
					other_integrity_blemishes: integrity_state[other_id],
				};
			};
		}
		if (key == 'f_diplomacy_set_bilateral_relation') {
			return (player, other, relation) => {
				const player_id = player_key(player);
				const other_id = player_key(other);
				if (relation == 'vendetta') {
					integrity_state[player_id] = integrity_state[player_id] + (
						relation_state[player_id] == 'pact'
						? 2
						: (relation_state[player_id] == 'treaty' ? 1 : 0)
					);
				}
				relation_state[player_id] = relation;
				relation_state[other_id] = relation;
			};
		}
		if (key == 'f_diplomacy_clear_offers') {
			return (player, other) => {};
		}
		if (key == 'f_diplomacy_restore_pair') {
			return (player, other, snapshot) => {
				const player_id = player_key(player);
				const other_id = player_key(other);
				relation_state[player_id] = snapshot.player_relation;
				relation_state[other_id] = snapshot.other_relation;
				integrity_state[player_id] = snapshot.player_integrity_blemishes;
				integrity_state[other_id] = snapshot.other_integrity_blemishes;
			};
		}
		throw Error('Unexpected orbital event callback: ' + key);
	},
	trigger: (name, data) => { triggers :+name; },
	message: (text) => { messages :+text; },
};

let event = {
	caller: actor.id,
	game: game,
	data: {target: target, facility_id: 'SkyHydroponicsLab'},
};
test.assert(!#is_defined(attack_orbital.validate(event)));
forced_allies = true;
test.assert(
	attack_orbital.validate(event) ==
	'Factions loyal to the Supreme Leader cannot attack each other'
);
forced_allies = false;
event.resolved = attack_orbital.resolve(event);
test.assert(event.resolved.success);
event.applied = attack_orbital.apply(event);
test.assert(actor.get_orbital_facility_count('OrbitalDefensePod') == 3);
test.assert(actor.get_orbital_defense_deployments() == 2);
test.assert(target.get_orbital_facility_count('SkyHydroponicsLab') == 1);
test.assert(relation_state.p1 == 'vendetta' && relation_state.p2 == 'vendetta');
test.assert(integrity_state.p1 == 1);
test.assert(#sizeof(messages) == 1 && #sizeof(triggers) >= 4);
test.assert(message_targets[0].id == actor.id && message_targets[1].id == target.id);
attack_orbital.rollback(event);
test.assert(actor.get_orbital_facility_count('OrbitalDefensePod') == 3);
test.assert(actor.get_orbital_defense_deployments() == 1);
test.assert(target.get_orbital_facility_count('SkyHydroponicsLab') == 2);
test.assert(relation_state.p1 == 'treaty' && relation_state.p2 == 'treaty');
test.assert(integrity_state.p1 == 0);

random_result = 1;
event.resolved = attack_orbital.resolve(event);
test.assert(!event.resolved.success);
event.applied = attack_orbital.apply(event);
test.assert(actor.get_orbital_facility_count('OrbitalDefensePod') == 2);
test.assert(actor.get_orbital_defense_deployments() == 1);
test.assert(target.get_orbital_facility_count('SkyHydroponicsLab') == 2);
attack_orbital.rollback(event);
test.assert(actor.get_orbital_facility_count('OrbitalDefensePod') == 3);

random_result = 0;
event.data.facility_id = 'OrbitalDefensePod';
event.resolved = attack_orbital.resolve(event);
event.applied = attack_orbital.apply(event);
test.assert(target.get_orbital_facility_count('OrbitalDefensePod') == 1);
test.assert(target.get_orbital_defense_deployments() == 1);
attack_orbital.rollback(event);
test.assert(target.get_orbital_facility_count('OrbitalDefensePod') == 2);
test.assert(target.get_orbital_defense_deployments() == 2);

actor.set_orbital_defense_deployments(3);
test.assert(
	attack_orbital.validate(event) ==
	'All Orbital Defense Pods have been deployed this turn'
);
actor.set_orbital_defense_deployments(1);
event.data.facility_id = 'RecyclingTanks';
test.assert(attack_orbital.validate(event) == 'Orbital attack target is not a satellite');
event.data.facility_id = 'SkyHydroponicsLab';
event.data.target = actor;
test.assert(#is_defined(attack_orbital.validate(event)));
event.data.target = target;
turn_complete = true;
test.assert(attack_orbital.validate(event) == 'Player has already completed this turn');
turn_complete = false;
game_over = true;
test.assert(attack_orbital.validate(event) == 'The game is already over');
