const validator = #include('../default/content/validator');
const technologies = #include('../default/technologies');
const facilities = #include('../default/facilities');
const units = #include('../default/units');
const factions = #include('../default/factions');

const make_catalog = () => {
	return {
		technologies: {
			definitions: #clone(technologies.definitions),
			order: #clone(technologies.order),
		},
		facilities: #clone(facilities.definitions),
		units: #clone(units.definitions),
		moralesets: #clone(units.moralesets),
		factions: #clone(factions.definitions),
	};
};

const result = validator.validate(make_catalog());

test.assert(result.errors == []);
test.assert(result.counts == {
	technologies: 11,
	facilities: 8,
	units: 10,
	moralesets: 2,
	factions: 14,
});

let invalid = make_catalog();
invalid.facilities[0].data.nutrient_typo = 1;
test.assert(validator.validate(invalid).errors == [
	'facilities.RecyclingTanks.nutrient_typo: is not a supported field',
]);

invalid = make_catalog();
invalid.facilities[0].data.required_technology = 'MissingTechnology';
test.assert(validator.validate(invalid).errors == [
	'facilities.RecyclingTanks.required_technology: references missing technology MissingTechnology',
]);

invalid = make_catalog();
invalid.facilities :+#clone(invalid.facilities[0]);
test.assert(validator.validate(invalid).errors == [
	'facilities.RecyclingTanks: duplicates facility id RecyclingTanks',
]);

invalid = make_catalog();
invalid.facilities[0].data.nutrient_bonus = 0;
invalid.facilities[0].data.mineral_bonus = 0;
invalid.facilities[0].data.energy_bonus = 0;
test.assert(validator.validate(invalid).errors == [
	'facilities.RecyclingTanks: has no implemented gameplay effect',
]);

invalid = make_catalog();
invalid.units[0].data.morale = 'MISSING';
test.assert(validator.validate(invalid).errors == [
	'units.ScoutPatrol.morale: references missing morale set MISSING',
]);

invalid = make_catalog();
invalid.units[0].data.required_technology = 'MissingTechnology';
test.assert(validator.validate(invalid).errors == [
	'units.ScoutPatrol.required_technology: references missing technology MissingTechnology',
]);

invalid = make_catalog();
invalid.factions[0].data.starting_technologies :+'CentauriEcology';
test.assert(validator.validate(invalid).errors == [
	'factions.GAIANS.starting_technologies[1]: duplicates starting technology CentauriEcology',
]);

const cyclic = validator.validate({
	technologies: {
		definitions: {
			Alpha: {id: 'Alpha', name: 'Alpha', cost: 10, prerequisites: ['Beta']},
			Beta: {id: 'Beta', name: 'Beta', cost: 10, prerequisites: ['Alpha']},
		},
		order: ['Alpha', 'Beta'],
	},
	facilities: [],
	units: [],
	moralesets: [],
	factions: [],
});
test.assert(cyclic.errors == [
	'technologies: dependency cycle prevents resolution of: Alpha, Beta',
]);
