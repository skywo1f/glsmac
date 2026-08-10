const content = #include('./_content_validation_common');

let invalid = content.make_catalog();
invalid.facilities :+#clone(content.get_facility(invalid, 'RecyclingTanks'));
test.assert(content.validator.validate(invalid).errors == [
	'facilities.RecyclingTanks: duplicates facility id RecyclingTanks',
]);

invalid = content.make_catalog();
content.get_facility(invalid, 'RecyclingTanks').data.nutrient_bonus = 0;
content.get_facility(invalid, 'RecyclingTanks').data.mineral_bonus = 0;
content.get_facility(invalid, 'RecyclingTanks').data.energy_bonus = 0;
test.assert(content.validator.validate(invalid).errors == [
	'facilities.RecyclingTanks: has no implemented gameplay effect',
]);

invalid = content.make_catalog();
content.get_facility(invalid, 'StockpileEnergy').data.mineral_cost = 10;
test.assert(content.validator.validate(invalid).errors == [
	'facilities.StockpileEnergy.mineral_to_energy_divisor: requires a zero-cost non-project definition',
	'facilities.StockpileEnergy.mineral_cost: does not match base-game manifest value 0',
]);
