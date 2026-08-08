#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	const technologies = #include('../default/technologies');
	const facility_catalog = #include('../default/facilities');
	let production_gates = [
		['unit', 'Former', 'CentauriEcology'],
		['unit', 'ReconRover', 'DoctrineMobility'],
		['unit', 'LaserInfantry', 'AppliedPhysics'],
		['unit', 'SynthmetalSentinels', 'IndustrialBase'],
	];
	let facility_ids = [];
	for (entry of facility_catalog.definitions) {
		facility_ids :+entry.id;
		production_gates :+['facility', entry.id, entry.data.required_technology];
	}

	let runtime_complete = false;
	let ui_started = false;
	let exit_scheduled = false;

	const fail = (message) => {
		#print('RESEARCH_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const finish_if_ready = () => {
		if (runtime_complete && ui_started && !exit_scheduled) {
			exit_scheduled = true;
			#print(
				'RESEARCH_RUNTIME_PASS: validated 77 technologies, 22 facilities, and batch production gates'
			);
			#async(500, () => { glsmac.exit(); });
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		game.on('start_ui', (e) => {
			ui_started = true;
			finish_if_ready();
		});

		game.on('turn', (e) => {
			const turn_id = e.year - 2100;
			const player = game.get_player();
			let base = null;
			for (candidate of game.get_bm().get_bases()) {
				if (candidate.get_owner().id == player.id) {
					base = candidate;
					break;
				}
			}
			if (base == null) {
				fail('player base is missing');
				return;
			}

			if (turn_id == 1) {
				let catalog_count = 0;
				for (technology_id of technologies.order) {
					const definition = game.get('f_technology_get_definition')(technology_id);
					if (
						definition == null ||
						definition.id != technology_id ||
						definition.name == '' ||
						definition.cost <= 0
					) {
						fail('technology definition is invalid: ' + technology_id);
						return;
					}
					catalog_count++;
				}
				if (catalog_count != 77) {
					fail('technology catalog count is ' + #to_string(catalog_count));
					return;
				}

				const state = player.get_research_state();
				if (
					player.get_faction().id != 'GAIANS' ||
					state.technologies != ['CentauriEcology'] ||
					state.target != 'Biogenetics' ||
					state.progress != 0
				) {
					fail('initial Gaian research state is invalid');
					return;
				}
				for (gate of production_gates) {
					const should_be_available = gate[2] == '' || gate[2] == 'CentauriEcology';
					if (base.can_set_production(gate[0], gate[1]) != should_be_available) {
						fail('initial production gate is invalid: ' + gate[1]);
						return;
					}
				}

				const biogenetics = game.get('f_technology_get_definition')('Biogenetics');
				player.set_research_state({
					technologies: ['CentauriEcology'],
					target: 'Biogenetics',
					progress: biogenetics.cost - 1,
				});
				game.event('complete_turn', {});
				return;
			}

			if (turn_id == 2) {
				const state = player.get_research_state();
				if (
					state.technologies != ['Biogenetics', 'CentauriEcology'] ||
					state.target != 'IndustrialBase' ||
					state.progress < 0 ||
					state.progress >= game.get('f_technology_get_definition')('IndustrialBase').cost
				) {
					fail('live research completion did not advance to Industrial Base');
					return;
				}

				let all_technologies = [];
				for (technology_id of technologies.order) {
					all_technologies :+technology_id;
				}
				player.set_research_state({
					technologies: all_technologies,
					target: '',
					progress: 0,
				});
				for (gate of production_gates) {
					const expected_available = gate[1] != 'HabitationDome';
					if (base.can_set_production(gate[0], gate[1]) != expected_available) {
						fail('full-catalog production gate stayed locked: ' + gate[1]);
						return;
					}
				}
				base.add_facility('HabComplex');
				if (!base.can_set_production('facility', 'HabitationDome')) {
					fail('Habitation Dome stayed locked after Hab Complex');
					return;
				}
				base.remove_facility('HabComplex');

				const intake_before = base.get_intake();
				const consumption_before = base.get_consumption().ENERGY;
				const labs_before = game.get('f_technology_get_base_labs')(base).total;
				let nutrient_bonus = 0;
				let mineral_bonus = 0;
				let energy_bonus = 0;
				let maintenance = 0;
				let mineral_multiplier = 0.0;
				let psych_bonus = 0;
				let psych_multiplier = 0.0;
				let research_multiplier = 0.0;
				let research_bonus = 0;
				let defense_multiplier = 1.0;
				let morale_bonus = 0;
				for (facility_id of facility_ids) {
					const definition = game.get_bm().get_facility_def(facility_id);
					nutrient_bonus += definition.nutrient_bonus;
					mineral_bonus += definition.mineral_bonus;
					energy_bonus += definition.energy_bonus;
					maintenance += definition.energy_maintenance;
					mineral_multiplier += definition.mineral_multiplier;
					psych_bonus += definition.psych_bonus;
					psych_multiplier += definition.psych_multiplier;
					research_multiplier += definition.research_multiplier;
					research_bonus += definition.research_bonus;
					defense_multiplier += #max(definition.defense_multiplier - 1.0, 0.0);
					morale_bonus += definition.unit_morale_bonus;
					base.add_facility(facility_id);
				}
				const intake_after = base.get_intake();
				const psych_after = game.get('f_economy_get_base_allocation')(game, base).psych;
				const labs_after = game.get('f_technology_get_base_labs')(base);
				if (
					#sizeof(facility_ids) != 24 ||
					nutrient_bonus != 2 || mineral_bonus != 2 || energy_bonus != 3 ||
					maintenance != 58 || mineral_multiplier != 1.5 ||
					psych_bonus != 16 || psych_multiplier != 2.0 ||
					research_multiplier != 2.5 || research_bonus != 2 ||
					defense_multiplier != 3.0 || morale_bonus != 4 ||
					intake_after.NUTRIENTS != intake_before.NUTRIENTS + nutrient_bonus ||
					intake_after.MINERALS != #ceil(
						#to_float(intake_before.MINERALS + mineral_bonus) * (1.0 + mineral_multiplier)
					) ||
					intake_after.ENERGY != intake_before.ENERGY + energy_bonus ||
					base.get_consumption().ENERGY != consumption_before + maintenance ||
					psych_after.bonus != psych_bonus + #ceil(
						#to_float(psych_after.value) * psych_multiplier
					) ||
					labs_after.bonus != 2 + research_bonus + #ceil(
						#to_float(labs_after.value + 2 + research_bonus) * research_multiplier
					) ||
					labs_after.total <= labs_before
				) {
					fail('batch facility effects are invalid');
					return;
				}
				for (facility_id of facility_ids) {
					if (!base.has_facility(facility_id)) {
						fail('batch facility construction missed ' + facility_id);
						return;
					}
				}

				runtime_complete = true;
				finish_if_ready();
				return;
			}

			fail('runtime test exceeded two turns');
		});
	});

	glsmac.run();

});
