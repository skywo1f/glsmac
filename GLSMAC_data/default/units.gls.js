const defs = #include('units/defs');
const turns = #include('units/turns');
const animations = #include('units/animations');
const manifest = #include('content/base_units');
const catalog_registration = #include('units/catalog_registration');

let result = null;
const synchronize_generated_catalog = () => {
	result.definitions = defs.definitions;
	result.generated_definitions = defs.generated_definitions;
	result.generated_count = defs.generated_count;
	return result.generated_definitions;
};

result = {
	moralesets: defs.moralesets,
	definitions: defs.definitions,
	predefined_definitions: defs.predefined_definitions,
	generated_definitions: defs.generated_definitions,
	generated_count: defs.generated_count,
	manifest: manifest,
	generate_available: (known) => {
		defs.generate_available(known);
		return synchronize_generated_catalog();
	},
	ensure_full_catalog: () => {
		defs.ensure_full_catalog();
		return synchronize_generated_catalog();
	},

	configure: (game) => {
		turns.configure(game);

		let registration_scheduled = false;
		let registered = {};
		let known_technologies = {};
		const register_available_designs = () => {
			registration_scheduled = false;
			if (!game.is_master()) {
				return;
			}
			for (definition of game.get_um().get_unit_defs()) {
				registered[definition.id] = true;
			}
			const known = catalog_registration.get_known_technologies(game.get_players());
			known_technologies = known;
			defs.generate_available(known);
			synchronize_generated_catalog();
			let pending = [];
			for (entry of defs.generated_definitions) {
				const technology_id = entry.data.required_technology;
				if (
					technology_id != '' && #is_defined(known[technology_id]) &&
					!#is_defined(registered[entry.id])
				) {
					registered[entry.id] = true;
					pending :+entry;
				}
			}
			if (#sizeof(pending) > 0) {
				game.event('define_units', {units: pending});
			}
		};
		const schedule_registration = () => {
			if (!game.is_master() || registration_scheduled) {
				return;
			}
			registration_scheduled = true;
			#async(0, register_available_designs);
		};
		game.on('start', (e) => {
			game.on('research_updated', (event) => {
				if (
					!#is_defined(event.player) ||
					catalog_registration.has_new_technology(
						known_technologies,
						event.player
					)
				) {
					schedule_registration();
				}
			});
			schedule_registration();
		});
	},

	define: (game) => {
		defs.define(game);
		animations.define(game);
	},

};

return result;
