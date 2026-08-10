const content = #include('./_content_validation_common');
const catalog = content.make_catalog();
const result = content.validator.validate(catalog);

test.assert(result.errors == []);
test.assert(content.get_facility(catalog, 'TreeFarm').data.forest_nutrient_bonus == 1);
test.assert(content.get_facility(catalog, 'HybridForest').data.forest_nutrient_bonus == 1);
test.assert(content.get_facility(catalog, 'HybridForest').data.forest_energy_bonus == 1);
test.assert(content.get_facility(catalog, 'Headquarters').data.defender_morale_bonus == 1);
test.assert(content.get_facility(catalog, 'ChildrenSCreche').data.efficiency_rating_bonus == 2);
test.assert(content.get_facility(catalog, 'ChildrenSCreche').data.defender_morale_minimum == 1);
test.assert(catalog.facility_coverage.status.ChildrenSCreche == 'complete');
test.assert(catalog.facility_coverage.status.BioenhancementCenter == 'complete');
test.assert(content.get_facility(catalog, 'BiologyLab').data.full_repair_native);
test.assert(content.get_facility(catalog, 'CommandCenter').data.full_repair_land);
test.assert(content.get_facility(catalog, 'NavalYard').data.full_repair_water);
test.assert(content.get_facility(catalog, 'AerospaceComplex').data.full_repair_air);
test.assert(content.get_facility(catalog, 'TheAsceticVirtues').data.global_police_rating_bonus == 1);
test.assert(content.get_facility(catalog, 'TheSelfAwareColony').data.global_extra_police_units == 1);
test.assert(catalog.project_coverage.status.TheLongevityVaccine == 'complete');
test.assert(catalog.project_coverage.status.TheCloningVats == 'complete');
test.assert(catalog.project_coverage.status.TheTelepathicMatrix == 'complete');
test.assert(catalog.project_coverage.status.TheNetworkBackbone == 'partial');
test.assert(result.counts == {
	technologies: 77,
	facilities: 31,
	complete_facilities: 19,
	partial_facilities: 12,
	implemented_projects: 33,
	complete_projects: 23,
	partial_projects: 10,
	base_facilities: 38,
	projects: 33,
	units: #sizeof(content.units.definitions),
	chassis: 9,
	reactors: 4,
	weapons: 21,
	armors: 10,
	abilities: 24,
	predefined_units: 14,
	moralesets: 2,
	factions: 14,
});
