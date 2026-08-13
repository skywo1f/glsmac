const set_obsolete = #include('../default/game/event/set_unit_design_obsolete');
const retire_design = #include('../default/game/event/retire_unit_design');
const install_unit_designs = #include('../default/game/unit_designs');

const owned_id = 'WorkshopP1_Infantry_Laser_NoArmor_FissionPlant';
const owned_definition = {
	id: owned_id,
	name: 'Laser Infantry',
	owner_player_id: 1,
	buildable: true,
	is_native: false,
};
const foreign_definition = {
	id: 'WorkshopP2_Infantry_Laser_NoArmor_FissionPlant',
	owner_player_id: 2,
	buildable: true,
	is_native: false,
};
const definitions = [owned_definition, foreign_definition];

let obsolete_designs = [];
let retired_designs = [];
const player = {
	id: 1,
	name: 'Gaia',
	type: 'human',
	get_obsolete_unit_designs: () => { return obsolete_designs; },
	is_unit_design_obsolete: (id) => {
		for (candidate of obsolete_designs) {
			if (candidate == id) { return true; }
		}
		return false;
	},
	set_obsolete_unit_designs: (values) => {
		obsolete_designs = [];
		for (value of values) { obsolete_designs :+value; }
	},
	get_retired_unit_designs: () => { return retired_designs; },
	is_unit_design_retired: (id) => {
		for (candidate of retired_designs) {
			if (candidate == id) { return true; }
		}
		return false;
	},
	set_retired_unit_designs: (values) => {
		retired_designs = [];
		for (value of values) { retired_designs :+value; }
	},
};

const make_base = (owner_id, entries) => {
	let queue = entries;
	return {
		get_owner: () => { return {id: owner_id}; },
		get_production_queue: () => { return queue; },
		set_production_queue: (specs) => {
			queue = [];
			for (spec of specs) {
				queue :+{production_kind: spec.kind, id: spec.id};
			}
		},
	};
};

const own_base = make_base(1, [
	{production_kind: 'unit', id: owned_id},
	{production_kind: 'facility', id: 'RecyclingTanks'},
	{production_kind: 'unit', id: owned_id},
]);
const foreign_base = make_base(2, [
	{production_kind: 'unit', id: owned_id},
]);
let triggers = [];
let messages = [];
let game_functions = {};
const game = {
	is_started: () => { return true; },
	is_turn_complete: (id) => { return false; },
	get_player: (id) => { return player; },
	get_um: () => { return {get_unit_defs: () => { return definitions; }}; },
	get_bm: () => { return {get_bases: () => { return [own_base, foreign_base]; }}; },
	trigger: (name, data) => { triggers :+data; },
	message: (text) => { messages :+text; },
	set: (name, value) => { game_functions[name] = value; },
};

install_unit_designs(game);
test.assert(#sizeof(game_functions.f_unit_design_get_existing(player)) == 1);
retired_designs = [owned_id];
test.assert(#sizeof(game_functions.f_unit_design_get_existing(player)) == 0);
retired_designs = [];

let event = {
	caller: player.id,
	game: game,
	data: {id: owned_id, obsolete: true},
};
test.assert(!#is_defined(set_obsolete.validate(event)));
event.applied = set_obsolete.apply(event);
test.assert(event.applied.changed);
test.assert(!event.applied.previous);
test.assert(#sizeof(event.applied.queues) == 1);
test.assert(player.is_unit_design_obsolete(owned_id));
test.assert(own_base.get_production_queue() == [
	{production_kind: 'facility', id: 'RecyclingTanks'},
]);
test.assert(#sizeof(foreign_base.get_production_queue()) == 1);
test.assert(#sizeof(triggers) == 1 && triggers[0].obsolete);

const duplicate = set_obsolete.apply(event);
test.assert(!duplicate.changed);
test.assert(#sizeof(triggers) == 1);

set_obsolete.rollback(event);
test.assert(!player.is_unit_design_obsolete(owned_id));
const restored_queue = own_base.get_production_queue();
test.assert(#sizeof(restored_queue) == 3);
test.assert(restored_queue[0].id == owned_id);
test.assert(restored_queue[2].id == owned_id);
test.assert(#sizeof(triggers) == 2 && !triggers[1].obsolete);

obsolete_designs = [owned_id];
event.data.obsolete = false;
event.applied = set_obsolete.apply(event);
test.assert(event.applied.changed && event.applied.previous);
test.assert(!player.is_unit_design_obsolete(owned_id));
test.assert(#sizeof(event.applied.queues) == 0);
set_obsolete.rollback(event);
test.assert(player.is_unit_design_obsolete(owned_id));

let retirement = {
	caller: player.id,
	game: game,
	data: {id: owned_id},
};
test.assert(!#is_defined(retire_design.validate(retirement)));
retirement.applied = retire_design.apply(retirement);
test.assert(player.is_unit_design_retired(owned_id));
test.assert(player.is_unit_design_obsolete(owned_id));
test.assert(triggers[#sizeof(triggers) - 1].retired);
test.assert(messages == ['Gaia permanently retired ' + owned_definition.name + '.']);
event.data = {id: owned_id, obsolete: false};
test.assert(
	set_obsolete.validate(event) ==
		'Retired unit designs cannot be reactivated or managed'
);
test.assert(
	retire_design.validate(retirement) ==
		'Unit design has already been permanently retired'
);
retire_design.rollback(retirement);
test.assert(!player.is_unit_design_retired(owned_id));
test.assert(player.is_unit_design_obsolete(owned_id));
test.assert(!triggers[#sizeof(triggers) - 1].retired);
test.assert(!#is_defined(set_obsolete.validate(event)));
event.applied = set_obsolete.apply(event);
test.assert(!player.is_unit_design_obsolete(owned_id));
test.assert(
	retire_design.validate(retirement) ==
		'Unit design must be made obsolete before permanent retirement'
);

event.data = {id: foreign_definition.id, obsolete: true};
test.assert(
	set_obsolete.validate(event) ==
		'Only faction-owned Workshop designs can be made obsolete'
);
retirement.data = {id: foreign_definition.id};
test.assert(
	retire_design.validate(retirement) ==
		'Only faction-owned Workshop designs can be retired'
);
event.data = {id: 'Missing', obsolete: true};
test.assert(set_obsolete.validate(event) == 'Unit design does not exist');
retirement.data = {id: 'Missing'};
test.assert(retire_design.validate(retirement) == 'Unit design does not exist');
event.data = {id: owned_id, obsolete: 1};
test.assert(
	set_obsolete.validate(event) ==
		'Unit design ID and obsolete state are required'
);
retirement.data = {id: 1};
test.assert(retire_design.validate(retirement) == 'Unit design ID is required');
