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
		facility_manifest: #clone(facilities.manifest),
		facility_coverage: #clone(facilities.coverage),
		project_coverage: #clone(facilities.project_coverage),
		units: #clone(units.definitions),
		unit_manifest: #clone(units.manifest),
		moralesets: #clone(units.moralesets),
		factions: #clone(factions.definitions),
	};
};

const get_facility = (catalog, id) => {
	for (entry of catalog.facilities) {
		if (entry.id == id) {
			return entry;
		}
	}
	return null;
};

const result = validator.validate(make_catalog());

test.assert(result.errors == []);
test.assert(result.counts == {
	technologies: 77,
	facilities: 31,
	complete_facilities: 14,
	partial_facilities: 17,
	implemented_projects: 33,
		complete_projects: 17,
		partial_projects: 16,
	base_facilities: 38,
	projects: 33,
	units: 102,
	chassis: 9,
	reactors: 4,
	weapons: 21,
	armors: 10,
	abilities: 24,
	predefined_units: 14,
	moralesets: 2,
	factions: 14,
});

let invalid = make_catalog();
invalid.technologies.definitions.Biogenetics.cost_typo = 30;
test.assert(validator.validate(invalid).errors == [
	'technologies.Biogenetics.cost_typo: is not a supported field',
]);

invalid = make_catalog();
get_facility(invalid, 'RecyclingTanks').data.nutrient_typo = 1;
test.assert(validator.validate(invalid).errors == [
	'facilities.RecyclingTanks.nutrient_typo: is not a supported field',
]);

invalid = make_catalog();
invalid.facility_coverage.status.RecyclingTanks = 'unknown';
test.assert(validator.validate(invalid).errors == [
	'facility_coverage.RecyclingTanks: must be complete or partial',
	'facility_coverage.complete: reports 14 but contains 13',
]);

invalid = make_catalog();
get_facility(invalid, 'RecyclingTanks').data.required_technology = 'MissingTechnology';
test.assert(validator.validate(invalid).errors == [
	'facilities.RecyclingTanks.required_technology: references missing technology MissingTechnology',
	'facilities.RecyclingTanks.required_technology: does not match base-game manifest value Biogenetics',
]);

invalid = make_catalog();
get_facility(invalid, 'HabitationDome').data.required_facility = 'MissingFacility';
test.assert(validator.validate(invalid).errors == [
	'facilities.HabitationDome.required_facility: references missing facility MissingFacility',
]);

invalid = make_catalog();
get_facility(invalid, 'RecyclingTanks').data.mineral_cost = 41;
test.assert(validator.validate(invalid).errors == [
	'facilities.RecyclingTanks.mineral_cost: does not match base-game manifest value 40',
]);

invalid = make_catalog();
invalid.facilities :+#clone(get_facility(invalid, 'RecyclingTanks'));
test.assert(validator.validate(invalid).errors == [
	'facilities.RecyclingTanks: duplicates facility id RecyclingTanks',
]);

invalid = make_catalog();
get_facility(invalid, 'RecyclingTanks').data.nutrient_bonus = 0;
get_facility(invalid, 'RecyclingTanks').data.mineral_bonus = 0;
get_facility(invalid, 'RecyclingTanks').data.energy_bonus = 0;
test.assert(validator.validate(invalid).errors == [
	'facilities.RecyclingTanks: has no implemented gameplay effect',
]);

invalid = make_catalog();
invalid.units[0].data.morale = 'MISSING';
test.assert(validator.validate(invalid).errors == [
	'units.ScoutPatrol.morale: references missing morale set MISSING',
]);

invalid = make_catalog();
invalid.units[0].data.movement_per_turn = 1.5;
test.assert(validator.validate(invalid).errors == [
	'units.ScoutPatrol.movement_per_turn: must be an integer from 0 through 1000',
]);

invalid = make_catalog();
invalid.units[0].data.required_technology = 'MissingTechnology';
test.assert(validator.validate(invalid).errors == [
	'units.ScoutPatrol.required_technology: references missing technology MissingTechnology',
]);

invalid = make_catalog();
invalid.units[0].data.weapon = 'MissingWeapon';
test.assert(validator.validate(invalid).errors == [
	'units.ScoutPatrol.weapon: references missing weapon MissingWeapon',
]);

invalid = make_catalog();
invalid.units[0].data.abilities = ['HeavyArtillery', 'HeavyArtillery'];
test.assert(validator.validate(invalid).errors == [
	'units.ScoutPatrol.abilities[1]: duplicates unit ability HeavyArtillery',
]);

invalid = make_catalog();
invalid.unit_manifest.weapons[1].required_technology = 'MissingTechnology';
test.assert(validator.validate(invalid).errors == [
	'unit_manifest.weapons.Laser.required_technology: references missing technology MissingTechnology',
]);

invalid = make_catalog();
invalid.unit_manifest.predefined_units[0].chassis = 'MissingChassis';
test.assert(validator.validate(invalid).errors == [
	'unit_manifest.predefined_units.ColonyPod.chassis: references missing chassis MissingChassis',
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
	facility_manifest: [],
	facility_coverage: {complete: 0, partial: 0, status: {}},
	project_coverage: {complete: 0, partial: 0, status: {}},
	units: [],
	unit_manifest: {
		chassis: [],
		reactors: [],
		weapons: [],
		armors: [],
		abilities: [],
		predefined_units: [],
	},
	moralesets: [],
	factions: [],
});
test.assert(cyclic.errors == [
	'technologies: dependency cycle prevents resolution of: Alpha, Beta',
]);
