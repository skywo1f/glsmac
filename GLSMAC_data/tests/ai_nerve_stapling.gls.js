const nerve_stapling = #include('../default/game/ai/nerve_stapling');

let error = #undefined;
let turns = 0;
let attempts = 0;
let charter_active = false;
let psych = {drones: 3, talents: 0, is_rioting: true};
let emitted = [];
let sanction_turns = 0;
let grievance = {wants_revenge: false};

const player = {
	id: 1,
	difficulty_level: 'Thinker',
	get_sanction_turns: () => { return sanction_turns; },
	get_diplomatic_grievance: (other) => { return grievance; },
};
const former_owner = {
	id: 2,
	get_diplomatic_grievance: (other) => { return grievance; },
};
let base_values = {};
let size = 8;
const base = {
	id: 1,
	get_size: () => { return size; },
	has: (key) => { return #is_defined(base_values[key]); },
	get: (key) => { return base_values[key]; },
};
const values = {
	f_nerve_stapling_get_error: (target, caller) => { return error; },
	f_nerve_stapling_get_turns: (target) => { return turns; },
	f_nerve_stapling_get_attempts: (target) => { return attempts; },
	f_nerve_stapling_is_un_charter_active: () => { return charter_active; },
	f_base_get_psych: (target) => { return psych; },
};
const game = {
	get: (name) => { return values[name]; },
	get_players: () => { return [player, former_owner]; },
	event_as: (id, name, data) => { emitted :+{id: id, name: name, data: data}; },
};

test.assert(nerve_stapling.should_staple(game, player, base));
turns = 3;
test.assert(!nerve_stapling.should_staple(game, player, base));
turns = 0;
psych = {drones: 1, talents: 1, is_rioting: false};
test.assert(!nerve_stapling.should_staple(game, player, base));
psych = {drones: 3, talents: 0, is_rioting: true};
attempts = 3;
size = 8;
test.assert(!nerve_stapling.should_staple(game, player, base));
size = 12;
test.assert(nerve_stapling.should_staple(game, player, base));
attempts = 4;
test.assert(!nerve_stapling.should_staple(game, player, base));
attempts = 0;
size = 8;

base_values.former_owner_id = former_owner.id;
test.assert(!nerve_stapling.should_staple(game, player, base));
grievance = {wants_revenge: true};
test.assert(nerve_stapling.should_staple(game, player, base));
base_values.former_owner_id = #undefined;

charter_active = true;
test.assert(nerve_stapling.should_staple(game, player, base));
sanction_turns = 2;
test.assert(!nerve_stapling.should_staple(game, player, base));
sanction_turns = 0;
player.difficulty_level = 'Talent';
test.assert(!nerve_stapling.should_staple(game, player, base));
player.difficulty_level = 'Thinker';
psych.is_rioting = false;
test.assert(!nerve_stapling.should_staple(game, player, base));

charter_active = false;
psych = {drones: 3, talents: 0, is_rioting: true};
nerve_stapling.manage(game, player, [base]);
test.assert(#sizeof(emitted) == 1);
test.assert(emitted[0].id == player.id && emitted[0].name == 'nerve_staple_base');
test.assert(emitted[0].data.base == base);
