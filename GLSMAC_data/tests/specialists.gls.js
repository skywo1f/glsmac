const pops = #include('../default/game/pops');
const set_base_specialist = #include('../default/game/event/set_base_specialist');
const technologies = #include('../default/technologies');

let known = {};
const player = {
	id: 1,
	has_technology: (id) => {
		return #is_defined(known[id]) && known[id];
	},
};

const get_ids = (definitions) => {
	let result = [];
	for (definition of definitions) {
		result :+definition.id;
	}
	return result;
};

test.assert(get_ids(pops.get_available(player)) == ['TECHNICIAN', 'DOCTOR']);
test.assert(pops.get_default(player).id == 'DOCTOR');
test.assert(pops.get_next(player, 'DOCTOR').id == 'TECHNICIAN');

known.PlanetaryNetworks = true;
test.assert(get_ids(pops.get_available(player)) == ['TECHNICIAN', 'DOCTOR', 'LIBRARIAN']);
known.FusionPower = true;
test.assert(get_ids(pops.get_available(player)) == ['DOCTOR', 'LIBRARIAN', 'ENGINEER']);
known.CentauriMeditation = true;
test.assert(get_ids(pops.get_available(player)) == ['LIBRARIAN', 'ENGINEER', 'EMPATH']);
test.assert(pops.get_default(player).id == 'EMPATH');
known.MindMachineInterface = true;
test.assert(get_ids(pops.get_available(player)) == ['ENGINEER', 'EMPATH', 'THINKER']);
known.SecretsOfAlphaCentauri = true;
test.assert(get_ids(pops.get_available(player)) == ['ENGINEER', 'TRANSCEND']);
test.assert(pops.get_default(player).id == 'TRANSCEND');

let specialist_type = 'TRANSCEND';
let worked = false;
let base = null;
const specialist_pop = {
	id: 1,
	has: (key) => { return key == 'worked_tile' && worked; },
	get_type: () => { return specialist_type; },
	set_type: (type) => { specialist_type = type; },
	get_base: () => { return base; },
};
base = {
	id: 10,
	get_owner: () => { return player; },
	get_pops: () => { return [specialist_pop]; },
	get_consumption: () => { return {NUTRIENTS: 0, MINERALS: 0, ENERGY: 0}; },
	has_facility: (id) => { return false; },
};

known.SecretsOfAlphaCentauri = false;
specialist_type = 'DOCTOR';
const normalized = pops.normalize({
	get_bm: () => { return {get_bases: () => { return [base]; }}; },
}, player);
test.assert(#sizeof(normalized) == 1);
test.assert(specialist_type == 'EMPATH');
pops.rollback_normalize(normalized);
test.assert(specialist_type == 'DOCTOR');
pops.rollback_normalize([
	{pop: specialist_pop, type: 'DOCTOR'},
	{pop: specialist_pop, type: 'EMPATH'},
]);
test.assert(specialist_type == 'DOCTOR');
known.SecretsOfAlphaCentauri = true;
specialist_type = 'TRANSCEND';

test.assert(pops.get_yields(base) == {economy: 2, psych: 2, labs: 4});
const lab_game = {
	get: (name) => {
		return name == 'f_base_get_specialist_yields' ? pops.get_yields : #undefined;
	},
};
test.assert(
	technologies.get_base_labs(
		base,
		lab_game,
		{net: 0},
		{NUTRIENTS: 0, MINERALS: 0, ENERGY: 0},
		[]
	).total == 6
);
worked = true;
test.assert(pops.get_yields(base) == {economy: 0, psych: 0, labs: 0});
worked = false;

const values = {
	f_base_get_available_specialists: pops.get_available,
	f_economy_get_base_psych: (game, target_base) => { return 0; },
	f_base_process_psych: (game, target_base, psych) => {},
};
const game = {
	get: (name) => { return values[name]; },
	is_turn_complete: (player_id) => { return false; },
};
let event = {
	caller: player.id,
	game: game,
	data: {base: base, pop: specialist_pop, type: 'ENGINEER'},
};
test.assert(!#is_defined(set_base_specialist.validate(event)));
event.applied = set_base_specialist.apply(event);
test.assert(specialist_type == 'ENGINEER');
test.assert(pops.get_yields(base) == {economy: 3, psych: 0, labs: 2});
set_base_specialist.rollback(event);
test.assert(specialist_type == 'TRANSCEND');

event.data.type = 'DOCTOR';
test.assert(#is_defined(set_base_specialist.validate(event)));
worked = true;
event.data.type = 'ENGINEER';
test.assert(#is_defined(set_base_specialist.validate(event)));
