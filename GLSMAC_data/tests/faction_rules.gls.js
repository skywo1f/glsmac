const rules = #include('../default/game/faction_rules');

const player = (id) => {
	return {get_faction: () => { return {id: id}; }};
};

const gaians = player('GAIANS');
const hive = player('HIVE');
const university = player('UNIVERSITY');
const morganites = player('MORGANITES');
const believers = player('BELIEVERS');
const peacekeepers = player('PEACEKEEPERS');

test.assert(rules.get_faction_id(gaians) == 'GAIANS');
test.assert(rules.get_faction_id({}) == '');
test.assert(rules.get_starting_energy(gaians) == 10);
test.assert(rules.get_starting_energy(morganites) == 110);
test.assert(rules.get_free_base_facilities(gaians) == []);
test.assert(rules.get_free_base_facilities(hive) == ['PerimeterDefense']);
test.assert(rules.get_free_base_facilities(university) == ['NetworkNode']);
test.assert(rules.has_free_base_facility(hive, 'PerimeterDefense'));
test.assert(!rules.has_free_base_facility(hive, 'NetworkNode'));
test.assert(rules.get_population_limit_modifier(gaians) == 0);
test.assert(rules.get_population_limit_modifier(morganites) == 0 - 3);
test.assert(rules.get_population_limit_modifier(peacekeepers) == 2);

test.assert(rules.get_psych_modifiers(gaians, 16) == {drones: 0, talents: 0});
test.assert(rules.get_psych_modifiers(university, 3) == {drones: 0, talents: 0});
test.assert(rules.get_psych_modifiers(university, 4) == {drones: 1, talents: 0});
test.assert(rules.get_psych_modifiers(university, 16) == {drones: 4, talents: 0});
test.assert(rules.get_psych_modifiers(peacekeepers, 0) == {drones: 0, talents: 0});
test.assert(rules.get_psych_modifiers(peacekeepers, 1) == {drones: 0, talents: 1});
test.assert(rules.get_psych_modifiers(peacekeepers, 4) == {drones: 0, talents: 1});
test.assert(rules.get_psych_modifiers(peacekeepers, 5) == {drones: 0, talents: 2});

test.assert(rules.get_attack_multiplier(gaians, false) == 1.0);
test.assert(rules.get_attack_multiplier(believers, false) == 1.25);
test.assert(rules.get_attack_multiplier(believers, true) == 1.0);

let facilities = ['Headquarters'];
const base = {
	has_facility: (id) => {
		for (candidate of facilities) {
			if (candidate == id) {
				return true;
			}
		}
		return false;
	},
	add_facility: (id) => { facilities :+id; },
	remove_facility: (id) => {
		let remaining = [];
		for (candidate of facilities) {
			if (candidate != id) {
				remaining :+candidate;
			}
		}
		facilities = remaining;
	},
};
const added = rules.apply_free_base_facilities(base, university);
test.assert(added == ['NetworkNode'] && facilities == ['Headquarters', 'NetworkNode']);
test.assert(rules.apply_free_base_facilities(base, university) == []);
rules.rollback_free_base_facilities(base, added);
test.assert(facilities == ['Headquarters']);
