const generated = #include('../default/units/generated');

const find_sea_former = (definitions) => {
	for (entry of definitions) {
		if (
			entry.data.can_terraform && entry.data.movement_type == 'water' &&
			entry.data.chassis == 'Foil'
		) {
			return entry;
		}
	}
	return null;
};

let known = {
	DoctrineMobility: true,
	DoctrineFlexibility: true,
};
test.assert(find_sea_former(generated.generate_available(known)) == null);

known.CentauriEcology = true;
const sea_former = find_sea_former(generated.generate_available(known));
test.assert(sea_former != null);
test.assert(sea_former.data.required_technologies == [
	'CentauriEcology',
	'DoctrineFlexibility',
]);
test.assert(
	sea_former.data.required_technology == 'DoctrineFlexibility' ||
	sea_former.data.required_technology == 'CentauriEcology'
);
