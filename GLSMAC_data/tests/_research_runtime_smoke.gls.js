#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	const technologies = #include('../default/technologies');
	const production_gates = [
		['unit', 'Former', 'CentauriEcology'],
		['unit', 'ReconRover', 'DoctrineMobility'],
		['unit', 'LaserInfantry', 'AppliedPhysics'],
		['unit', 'SynthmetalSentinels', 'IndustrialBase'],
		['facility', 'RecyclingTanks', 'Biogenetics'],
		['facility', 'NetworkNode', 'InformationNetworks'],
		['facility', 'RecreationCommons', 'SocialPsych'],
		['facility', 'HologramTheatre', 'PlanetaryNetworks'],
		['facility', 'PerimeterDefense', 'DoctrineLoyalty'],
		['facility', 'EnergyBank', 'IndustrialEconomics'],
		['facility', 'CommandCenter', 'DoctrineMobility'],
		['facility', 'BiologyLab', 'CentauriEmpathy'],
	];
	const facility_ids = [
		'RecyclingTanks',
		'NetworkNode',
		'RecreationCommons',
		'HologramTheatre',
		'PerimeterDefense',
		'EnergyBank',
		'CommandCenter',
		'BiologyLab',
	];

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
			#print('RESEARCH_RUNTIME_PASS: validated 77 technologies and batch production gates');
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
					const should_be_available = gate[2] == 'CentauriEcology';
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
					if (!base.can_set_production(gate[0], gate[1])) {
						fail('full-catalog production gate stayed locked: ' + gate[1]);
						return;
					}
				}

				const intake_before = base.get_intake();
				const consumption_before = base.get_consumption().ENERGY;
				const psych_before = game.get('f_economy_get_base_psych')(game, base);
				const labs_before = game.get('f_technology_get_base_labs')(base).total;
				for (facility_id of facility_ids) {
					base.add_facility(facility_id);
				}
				const intake_after = base.get_intake();
				if (
					intake_after.NUTRIENTS != intake_before.NUTRIENTS + 1 ||
					intake_after.MINERALS != intake_before.MINERALS + 1 ||
					intake_after.ENERGY != intake_before.ENERGY + 1 ||
					base.get_consumption().ENERGY != consumption_before + 8 ||
					game.get('f_economy_get_base_psych')(game, base) != psych_before + 8 ||
					game.get('f_technology_get_base_labs')(base).total <= labs_before
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
