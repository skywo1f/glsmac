const rules = #include('../default/game/base_governor_rules');
const event = #include('../default/game/event/set_base_governor');

let properties = {};
const owner = {id: 1};
const base = {
	id: 7,
	get_owner: () => { return owner; },
	has: (key) => { return #is_defined(properties[key]); },
	get: (key) => { return properties[key]; },
	set: (key, value) => { properties[key] = value; },
	unset: (key) => { properties[key] = #undefined; },
};
let turn_complete = false;
let triggers = [];
const game = {
	is_turn_complete: (id) => { return turn_complete; },
	trigger: (name, data) => { triggers :+{name: name, data: data}; },
};
const make_event = (caller, enabled, priority) => {
	return {
		caller: caller,
		game: game,
		data: {
			base: base,
			enabled: enabled,
			priority: priority,
		},
	};
};

test.assert(!rules.is_enabled(base));
test.assert(rules.get_priority(base) == 'build');
test.assert(rules.get_next_priority('explore', 1) == 'discover');
test.assert(rules.get_next_priority('explore', 0 - 1) == 'conquer');
test.assert(rules.get_next_priority('conquer', 1) == 'explore');

const baseline = {
	expansion: 10,
	terraforming: 20,
	mobility: 30,
	growth: 40,
	research: 0,
	development: 20,
	defense: 15,
	military: 25,
	rival_pressure: 5,
};
const explore = rules.apply_priority(baseline, 'explore');
test.assert(explore.expansion == 100);
test.assert(explore.terraforming == 90);
test.assert(explore.mobility == 85);
test.assert(baseline.expansion == 10);
const discover = rules.apply_priority(baseline, 'discover');
test.assert(discover.research == 100);
test.assert(discover.development == 90);
const build = rules.apply_priority(baseline, 'build');
test.assert(build.development == 100);
test.assert(build.growth == 90);
const conquer = rules.apply_priority(baseline, 'conquer');
test.assert(conquer.military == 100);
test.assert(conquer.defense == 100);
test.assert(conquer.rival_pressure == 100);

test.assert(#is_defined(event.validate(make_event(2, true, 'build'))));
test.assert(#is_defined(event.validate(make_event(1, 1, 'build'))));
test.assert(#is_defined(event.validate(make_event(1, true, 'invalid'))));
turn_complete = true;
test.assert(#is_defined(event.validate(make_event(1, true, 'build'))));
turn_complete = false;

let e = make_event(1, true, 'discover');
test.assert(!#is_defined(event.validate(e)));
e.applied = event.apply(e);
test.assert(rules.is_enabled(base));
test.assert(rules.get_priority(base) == 'discover');
test.assert(#sizeof(triggers) == 2);
test.assert(triggers[0].name == 'update_base');
test.assert(triggers[1].name == 'base_governor_changed');
test.assert(triggers[1].data.enabled == true);
event.rollback(e);
test.assert(!base.has(rules.enabled_key));
test.assert(!base.has(rules.priority_key));

properties[rules.enabled_key] = false;
properties[rules.priority_key] = 'explore';
e = make_event(1, true, 'conquer');
e.applied = event.apply(e);
event.rollback(e);
test.assert(base.get(rules.enabled_key) == false);
test.assert(base.get(rules.priority_key) == 'explore');
