const units = #include('../default/units');

return (glsmac, technology_ids) => {
	let known = {};
	for (technology_id of technology_ids) {
		known[technology_id] = true;
	}
	units.generate_available(known);
	glsmac.on('configure_game', (event) => {
		event.game.on('configure', (configure_event) => {
			configure_event.game.event('define_units', {
				units: units.generated_definitions,
			});
		});
	});
};
