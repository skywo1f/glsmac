#main((glsmac) => {

	#include('../default/game/game')(glsmac);

	const units = #include('../default/units');
	units.ensure_full_catalog();
	glsmac.on('configure_game', (event) => {
		event.game.on('configure', (configure_event) => {
			configure_event.game.event('define_units', {
				units: units.generated_definitions,
			});
		});
	});

	#include('../default/ui/ui')(glsmac);

	glsmac.on('configure_game', (event) => {
		event.game.on('start_ui', (ui_event) => {
			#print(
				'CVR_COMPONENT_RUNTIME_PASS: rendered ' +
				#to_string(units.generated_count) +
				' generated definitions with installed component assets'
			);
			#async(500, () => { glsmac.exit(); });
		});
	});

	glsmac.run();

});
