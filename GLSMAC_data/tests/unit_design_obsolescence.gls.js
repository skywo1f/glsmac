const set_obsolete = #include('../default/game/event/set_unit_design_obsolete');

const owned_id = 'WorkshopP1_Infantry_Laser_NoArmor_FissionPlant';
const owned_definition = {
	id: owned_id,
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
const player = {
	id: 1,
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
const game = {
	is_started: () => { return true; },
	is_turn_complete: (id) => { return false; },
	get_player: (id) => { return player; },
	get_um: () => { return {get_unit_defs: () => { return definitions; }}; },
	get_bm: () => { return {get_bases: () => { return [own_base, foreign_base]; }}; },
	trigger: (name, data) => { triggers :+data; },
};

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

event.data = {id: foreign_definition.id, obsolete: true};
test.assert(
	set_obsolete.validate(event) ==
		'Only faction-owned Workshop designs can be made obsolete'
);
event.data = {id: 'Missing', obsolete: true};
test.assert(set_obsolete.validate(event) == 'Unit design does not exist');
event.data = {id: owned_id, obsolete: 1};
test.assert(
	set_obsolete.validate(event) ==
		'Unit design ID and obsolete state are required'
);
