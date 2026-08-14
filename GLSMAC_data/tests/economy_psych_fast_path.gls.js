const define_economy = #include('../default/game/economy');

const callbacks = {};
const values = {};
const owner = {id: 1};
const tile = {};
const facilities = [{
	id: 'RecreationCommons',
	efficiency_rating_bonus: 1,
	economy_multiplier: 0.0,
	psych_bonus: 2,
	psych_multiplier: 0.5,
}];
let base = null;
base = {
	id: 7,
	get_owner: () => { return owner; },
	get_tile: () => { return tile; },
	get_consumption: () => { return {ENERGY: 2}; },
	get_intake: () => { return {ENERGY: 20}; },
	get_facilities: () => { return facilities; },
	has_facility: (id) => { return id == 'Headquarters'; },
};
const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, value) => { values[name] = value; },
	get: (name) => { return values[name]; },
	get_bm: () => {
		return {get_bases: () => { return [base]; }};
	},
	get_tm: () => {
		return {get_distance: (first, second) => { return 0; }};
	},
	get_players: () => { return [owner]; },
	is_master: () => { return true; },
};
values.f_base_get_effective_facilities = (target) => { return facilities; };
values.f_project_get_effects = (target) => { return {}; };
values.f_social_get_ratings = (player) => { return {effic: 1}; };
values.f_technology_get_base_labs = (target, energy, consumption, effective) => {
	return {allocation: 0.4, value: 4, bonus: 0};
};

define_economy(game);
callbacks.start({});

const allocation = values.f_economy_get_base_allocation(game, base);
const expected_psych = allocation.psych.value + allocation.psych.bonus;
test.assert(expected_psych == 8);
test.assert(values.f_economy_get_base_psych(game, base) == expected_psych);

const headquarters = {p1: [base]};
test.assert(
	values.f_economy_get_base_psych(game, base, headquarters) == expected_psych
);
