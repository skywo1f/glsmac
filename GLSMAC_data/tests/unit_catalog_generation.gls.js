const units = #include('../default/units');
const technologies = #include('../default/technologies');

test.assert(units.generated_count > 92);
test.assert(#sizeof(units.definitions) == units.generated_count + 10);

let ids = {};
let found_late_land_assault = false;
let found_sea_unit = false;
let found_air_unit = false;
let found_clean_unit = false;
let found_trained_unit = false;
let found_super_former = false;
let found_fungicidal_former = false;
for (let i = 0; i < #sizeof(units.definitions); i++) {
	const entry = units.definitions[i];
	test.assert(!#is_defined(ids[entry.id]));
	ids[entry.id] = true;
	const data = entry.data;
	test.assert(data.mineral_cost >= 0);
	test.assert(data.defense > 0);
	test.assert(data.chassis != '');
	test.assert(data.weapon != '');
	test.assert(data.armor != '');
	test.assert(data.reactor == 'FissionPlant');
	test.assert(data.reactor_power == 1);
	test.assert(#typeof(data.abilities) == 'Array');
	if (i < 10) {
		continue;
	}
	test.assert(data.mineral_cost >= 10);
	test.assert(data.offense > 0 || data.can_terraform);
	test.assert(technologies.get_definition(data.required_technology) != null);
	for (ability of data.abilities) {
		if (ability == 'CleanReactor') {
			found_clean_unit = true;
		} else if (ability == 'HighMorale') {
			found_trained_unit = true;
		} else if (ability == 'SuperFormer' && data.can_terraform) {
			found_super_former = true;
		} else if (ability == 'FungicideTanks' && data.can_terraform) {
			found_fungicidal_former = true;
		}
	}
	if (data.can_terraform) {
		test.assert(data.movement_type == 'land');
		test.assert(data.weapon == 'TerraformingUnit');
	}
	if (data.movement_type == 'water') {
		found_sea_unit = true;
	} else if (data.movement_type == 'air') {
		found_air_unit = true;
	} else if (data.offense >= 20) {
		found_late_land_assault = true;
	}
	test.assert(data.offense < 99);
}

test.assert(found_late_land_assault);
test.assert(found_sea_unit);
test.assert(found_air_unit);
test.assert(found_clean_unit);
test.assert(found_trained_unit);
test.assert(found_super_former);
test.assert(found_fungicidal_former);
