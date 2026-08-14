const event = #include('../default/game/event/set_governed_base_production');

const owner = {id: 4};
let enabled = true;
let turn_complete = false;
let available = true;
let queue = [
	{production_kind: 'unit', id: 'ScoutPatrol'},
	{production_kind: 'facility', id: 'RecyclingTanks'},
];
const base = {
	get_owner: () => { return owner; },
	has: (key) => { return key == 'governor_enabled'; },
	get: (key) => { return key == 'governor_enabled' ? enabled : 'build'; },
	get_production_queue: () => { return queue; },
	can_set_production: (kind, id) => { return available; },
	set_production: (kind, id) => {
		queue = [{production_kind: kind, id: id}];
	},
	set_production_queue: (specs) => {
		queue = [];
		for (spec of specs) {
			queue :+{production_kind: spec.kind, id: spec.id};
		}
	},
};
let triggers = [];
const game = {
	is_turn_complete: (id) => { return turn_complete; },
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
};
const make_event = (caller, kind, id) => {
	return {
		caller: caller,
		game: game,
		data: {base: base, kind: kind, id: id},
	};
};

test.assert(#is_defined(event.validate(make_event(1, 'unit', 'Former'))));
enabled = false;
test.assert(#is_defined(event.validate(make_event(0, 'unit', 'Former'))));
enabled = true;
turn_complete = true;
test.assert(#is_defined(event.validate(make_event(0, 'unit', 'Former'))));
turn_complete = false;
available = false;
test.assert(#is_defined(event.validate(make_event(0, 'unit', 'Former'))));
available = true;
test.assert(#is_defined(event.validate(make_event(0, 1, 'Former'))));

const e = make_event(0, 'unit', 'Former');
test.assert(!#is_defined(event.validate(e)));
e.applied = event.apply(e);
test.assert(#sizeof(queue) == 1);
test.assert(queue[0].id == 'Former');
test.assert(#sizeof(triggers) == 1);
test.assert(triggers[0].name == 'base_governor_production_selected');
event.rollback(e);
test.assert(#sizeof(queue) == 2);
test.assert(queue[0].id == 'ScoutPatrol');
test.assert(queue[1].id == 'RecyclingTanks');
