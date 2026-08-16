const registration = #include('../default/units/catalog_registration');

const player = (technologies) => {
	return {
		get_research_state: () => { return {technologies: technologies}; },
	};
};

const alpha = player(['CentauriEcology', 'Biogenetics']);
const beta = player(['Biogenetics', 'DoctrineMobility']);
const known = registration.get_known_technologies([alpha, beta]);

test.assert(#is_defined(known.CentauriEcology));
test.assert(#is_defined(known.Biogenetics));
test.assert(#is_defined(known.DoctrineMobility));
test.assert(!registration.has_new_technology(known, alpha));
test.assert(!registration.has_new_technology(known, beta));
test.assert(registration.has_new_technology(
	known,
	player(['Biogenetics', 'AppliedPhysics'])
));
test.assert(!registration.has_new_technology(known, player([])));
