const define_nerve_stapling = #include('../default/game/nerve_stapling');
const nerve_staple_base = #include('../default/game/event/nerve_staple_base');
const process_nerve_stapling = #include('../default/game/event/process_nerve_stapling');

const callbacks = {};
const values = {};
let police_rating = 0;
let turn_complete = false;
let charter_repealed = false;
let random_value = 1;
let messages = [];
let scoped_messages = [];
let triggers = [];

const make_player = (id, name) => {
	let atrocities = 0;
	let sanction_turns = 0;
	let grievance = {wants_revenge: false, atrocity_victim: false, major_atrocity_victim: false};
	return {
		id: id,
		name: name,
		type: 'human',
		difficulty_level: 'Transcend',
		get_major_atrocities: () => { return atrocities; },
		set_major_atrocities: (value) => { atrocities = value; },
		get_sanction_turns: () => { return sanction_turns; },
		set_sanction_turns: (value) => { sanction_turns = value; },
		get_diplomatic_grievance: (other) => { return #clone(grievance); },
		set_diplomatic_grievance: (other, value) => { grievance = #clone(value); },
	};
};

const actor = make_player(1, 'University');
const former_owner = make_player(2, 'Spartans');
const players = [actor, former_owner];

const make_pop = (initial_type, worked) => {
	let type = initial_type;
	return {
		has: (key) => { return key == 'worked_tile' && worked; },
		get_type: () => { return type; },
		set_type: (value) => { type = value; },
	};
};

let base_values = {former_owner_id: former_owner.id};
const pops = [
	make_pop('DRONE', true),
	make_pop('TALENT', true),
	make_pop('DOCTOR', false),
];
const base = {
	id: 7,
	name: 'Academy Park',
	get_owner: () => { return actor; },
	get_pops: () => { return pops; },
	has: (key) => { return #is_defined(base_values[key]); },
	get: (key) => { return base_values[key]; },
	set: (key, value) => { base_values[key] = value; },
	unset: (key) => { base_values[key] = #undefined; },
};

const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, value) => { values[name] = value; },
	get: (name) => { return values[name]; },
	get_players: () => { return players; },
	is_turn_complete: (id) => { return turn_complete; },
	random: {get_int: (minimum, maximum) => { return random_value; }},
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
	message: (text) => { messages :+text; },
};

values.f_social_get_ratings = (player) => { return {police: police_rating}; };
values.f_council_is_un_charter_repealed = () => { return charter_repealed; };
values.f_economy_get_base_psych = (target_game, target_base) => { return 0; };
values.f_base_process_psych = (target_game, target_base, psych) => {
	if (target_base.has('nerve_stapling_turns')) {
		for (pop of target_base.get_pops()) {
			if (pop.has('worked_tile')) {
				pop.set_type('WORKER');
			}
		}
	} else {
		for (target_pop of target_base.get_pops()) {
			target_pop.set_type('DRONE');
			break;
		}
	}
};
values.f_diplomacy_snapshot_pair = (victim, offender) => {
	return {grievance: victim.get_diplomatic_grievance(offender)};
};
values.f_diplomacy_add_grievance = (victim, offender, revenge, atrocity, major) => {
	victim.set_diplomatic_grievance(offender, {
		wants_revenge: revenge,
		atrocity_victim: atrocity,
		major_atrocity_victim: major,
	});
};
values.f_diplomacy_restore_pair = (victim, offender, snapshot) => {
	victim.set_diplomatic_grievance(offender, snapshot.grievance);
};
values.f_message_to_player = (player, text) => {
	scoped_messages :+{player: player, text: text};
};

define_nerve_stapling(game);
callbacks.start({});

let e = {caller: actor.id, game: game, data: {base: base}};
test.assert(!#is_defined(nerve_staple_base.validate(e)));
police_rating = 0 - 1;
test.assert(
	nerve_staple_base.validate(e) == 'Current Police rating does not permit nerve stapling'
);
police_rating = 0;
turn_complete = true;
test.assert(nerve_staple_base.validate(e) == 'Player has already completed this turn');
turn_complete = false;
e.caller = former_owner.id;
test.assert(nerve_staple_base.validate(e) == 'Only the base owner can order nerve stapling');
e.caller = actor.id;
base.set('nerve_stapling_count', 'invalid');
test.assert(nerve_staple_base.validate(e) == 'Base has invalid nerve-stapling state');
base.unset('nerve_stapling_count');

e.resolved = nerve_staple_base.resolve(e);
test.assert(e.resolved.attempts == 1 && e.resolved.success);
e.applied = nerve_staple_base.apply(e);
test.assert(base.get('nerve_stapling_count') == 1);
test.assert(base.get('nerve_stapling_turns') == 10);
test.assert(pops[0].get_type() == 'WORKER' && pops[1].get_type() == 'WORKER');
test.assert(pops[2].get_type() == 'DOCTOR');
test.assert(actor.get_major_atrocities() == 1 && actor.get_sanction_turns() == 10);
test.assert(#sizeof(messages) == 1);
test.assert(#sizeof(scoped_messages) == 1 && scoped_messages[0].player.id == actor.id);
const former_grievance = former_owner.get_diplomatic_grievance(actor);
test.assert(former_grievance.wants_revenge && former_grievance.atrocity_victim);
test.assert(!former_grievance.major_atrocity_victim);
nerve_staple_base.rollback(e);
test.assert(!base.has('nerve_stapling_count') && !base.has('nerve_stapling_turns'));
test.assert(pops[0].get_type() == 'DRONE' && pops[1].get_type() == 'TALENT');
test.assert(actor.get_major_atrocities() == 0 && actor.get_sanction_turns() == 0);
test.assert(!former_owner.get_diplomatic_grievance(actor).wants_revenge);

base.set('nerve_stapling_count', 1);
base.set('nerve_stapling_turns', 4);
e.resolved = nerve_staple_base.resolve(e);
test.assert(e.resolved.attempts == 2 && e.resolved.success);
e.applied = nerve_staple_base.apply(e);
test.assert(base.get('nerve_stapling_turns') == 14);
nerve_staple_base.rollback(e);
test.assert(base.get('nerve_stapling_count') == 1 && base.get('nerve_stapling_turns') == 4);

base.set('nerve_stapling_count', 2);
base.unset('nerve_stapling_turns');
random_value = 0;
e.resolved = nerve_staple_base.resolve(e);
test.assert(e.resolved.attempts == 3 && !e.resolved.success);
e.applied = nerve_staple_base.apply(e);
test.assert(base.get('nerve_stapling_count') == 3 && !base.has('nerve_stapling_turns'));
test.assert(pops[0].get_type() == 'DRONE' && pops[1].get_type() == 'TALENT');
nerve_staple_base.rollback(e);

base.set('nerve_stapling_count', 8);
random_value = 1;
e.resolved = nerve_staple_base.resolve(e);
test.assert(e.resolved.attempts == 9 && !e.resolved.success);

base.set('nerve_stapling_count', 0);
charter_repealed = true;
e.resolved = nerve_staple_base.resolve(e);
e.applied = nerve_staple_base.apply(e);
test.assert(actor.get_major_atrocities() == 1 && actor.get_sanction_turns() == 0);
nerve_staple_base.rollback(e);
charter_repealed = false;

base.set('nerve_stapling_turns', 1);
pops[0].set_type('WORKER');
pops[1].set_type('WORKER');
let decay = {caller: 0, game: game, data: {base: base}};
test.assert(!#is_defined(process_nerve_stapling.validate(decay)));
decay.applied = process_nerve_stapling.apply(decay);
test.assert(!base.has('nerve_stapling_turns'));
test.assert(pops[0].get_type() == 'DRONE');
process_nerve_stapling.rollback(decay);
test.assert(base.get('nerve_stapling_turns') == 1);
test.assert(pops[0].get_type() == 'WORKER' && pops[1].get_type() == 'WORKER');
