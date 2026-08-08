#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let last_progress = 0 - 1;
	let research_complete = false;
	let mobility_accelerated = false;
	let information_accelerated = false;
	let physics_accelerated = false;
	let industry_accelerated = false;
	let social_accelerated = false;
	let ui_started = false;
	let exit_scheduled = false;

	const finish_if_ready = () => {
		if (research_complete && ui_started && !exit_scheduled) {
			exit_scheduled = true;
			#print('RESEARCH_RUNTIME_PASS: six-tier research unlocked facilities and specialized units');
			#async(500, () => {
				glsmac.exit();
			});
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
				#print('RESEARCH_RUNTIME_FAIL: player base is missing');
				glsmac.exit();
				return;
			}

			const former = game.get_um().get_unit_def('Former');
			const rover = game.get_um().get_unit_def('ReconRover');
			const laser = game.get_um().get_unit_def('LaserInfantry');
			const sentinels = game.get_um().get_unit_def('SynthmetalSentinels');
			const network_node = game.get_bm().get_facility_def('NetworkNode');
			const recreation_commons = game.get_bm().get_facility_def('RecreationCommons');
			if (
				former.required_technology != 'CentauriEcology' ||
				rover.required_technology != 'DoctrineMobility' ||
				rover.movement_per_turn != 2.0 ||
				rover.offense != 1 ||
				rover.defense != 1 ||
				laser.required_technology != 'AppliedPhysics' ||
				laser.offense != 2 ||
				laser.defense != 1 ||
				sentinels.required_technology != 'IndustrialBase' ||
				sentinels.offense != 1 ||
				sentinels.defense != 2 ||
				network_node.required_technology != 'InformationNetworks' ||
				network_node.energy_maintenance != 1 ||
				recreation_commons.required_technology != 'SocialPsych' ||
				recreation_commons.energy_maintenance != 1 ||
				recreation_commons.psych_bonus != 4
			) {
				#print('RESEARCH_RUNTIME_FAIL: technology-gated unit definitions are invalid');
				glsmac.exit();
				return;
			}

			const state = player.get_research_state();
			if (turn_id == 1) {
				if (
					player.get_faction().id != 'HIVE' ||
					player.has_technology('CentauriEcology') ||
					state.technologies != [] ||
					state.target != 'CentauriEcology' ||
					state.progress != 0 ||
					base.can_set_production('unit', 'Former')
				) {
					#print('RESEARCH_RUNTIME_FAIL: initial Hive research or production gate is invalid');
					glsmac.exit();
					return;
				}
			}

			if (player.has_technology('SocialPsych')) {
				if (
					state.technologies != ['AppliedPhysics', 'CentauriEcology', 'DoctrineMobility', 'IndustrialBase', 'InformationNetworks', 'SocialPsych'] ||
					state.target != '' ||
					state.progress != 0 ||
					!base.can_set_production('unit', 'LaserInfantry') ||
					!base.can_set_production('unit', 'SynthmetalSentinels') ||
					!base.can_set_production('facility', 'RecreationCommons')
				) {
					#print('RESEARCH_RUNTIME_FAIL: Social Psych did not unlock Recreation Commons');
					glsmac.exit();
					return;
				}
				const consumption_before = base.get_consumption().ENERGY;
				const psych_before = game.get('f_economy_get_base_psych')(game, base);
				base.add_facility('RecreationCommons');
				if (
					base.get_consumption().ENERGY != consumption_before + 1 ||
					game.get('f_economy_get_base_psych')(game, base) != psych_before + 4
				) {
					#print('RESEARCH_RUNTIME_FAIL: Recreation Commons maintenance or psych bonus is invalid');
					glsmac.exit();
					return;
				}
				research_complete = true;
				finish_if_ready();
				return;
			}

			if (player.has_technology('IndustrialBase')) {
				const social = game.get('f_technology_get_definition')('SocialPsych');
				const expected_progress = social_accelerated ? social.cost - 1 : 0;
				if (
					state.technologies != ['AppliedPhysics', 'CentauriEcology', 'DoctrineMobility', 'IndustrialBase', 'InformationNetworks'] ||
					state.target != 'SocialPsych' ||
					state.progress != expected_progress ||
					!base.can_set_production('unit', 'SynthmetalSentinels') ||
					base.can_set_production('facility', 'RecreationCommons')
				) {
					#print('RESEARCH_RUNTIME_FAIL: Industrial Base did not advance to Social Psych');
					glsmac.exit();
					return;
				}
				if (!social_accelerated) {
					social_accelerated = true;
					player.set_research_state({
						technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase'],
						target: 'SocialPsych',
						progress: social.cost - 1,
					});
				}
				game.event('complete_turn', {});
				return;
			}

			if (player.has_technology('AppliedPhysics')) {
				const industry = game.get('f_technology_get_definition')('IndustrialBase');
				const expected_progress = industry_accelerated ? industry.cost - 1 : 0;
				if (
					state.technologies != ['AppliedPhysics', 'CentauriEcology', 'DoctrineMobility', 'InformationNetworks'] ||
					state.target != 'IndustrialBase' ||
					state.progress != expected_progress ||
					!base.can_set_production('unit', 'LaserInfantry') ||
					base.can_set_production('unit', 'SynthmetalSentinels')
				) {
					#print('RESEARCH_RUNTIME_FAIL: Applied Physics did not unlock offensive production');
					glsmac.exit();
					return;
				}
				if (!industry_accelerated) {
					industry_accelerated = true;
					player.set_research_state({
						technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics'],
						target: 'IndustrialBase',
						progress: industry.cost - 1,
					});
				}
				game.event('complete_turn', {});
				return;
			}

			if (player.has_technology('InformationNetworks')) {
				const physics = game.get('f_technology_get_definition')('AppliedPhysics');
				const expected_progress = physics_accelerated ? physics.cost - 1 : 0;
				if (
					state.technologies != ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks'] ||
					state.target != 'AppliedPhysics' ||
					state.progress != expected_progress ||
					!base.can_set_production('facility', 'NetworkNode') ||
					base.can_set_production('unit', 'LaserInfantry')
				) {
					#print('RESEARCH_RUNTIME_FAIL: Information Networks did not unlock Network Node production');
					glsmac.exit();
					return;
				}
				const consumption_before = base.get_consumption().ENERGY;
				const labs_before = game.get('f_technology_get_base_labs')(base).total;
				base.add_facility('NetworkNode');
				if (
					base.get_consumption().ENERGY != consumption_before + 1 ||
					game.get('f_technology_get_base_labs')(base).total <= labs_before
				) {
					#print('RESEARCH_RUNTIME_FAIL: Network Node maintenance or labs bonus is invalid');
					glsmac.exit();
					return;
				}
				if (!physics_accelerated) {
					physics_accelerated = true;
					player.set_research_state({
						technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks'],
						target: 'AppliedPhysics',
						progress: physics.cost - 1,
					});
				}
				game.event('complete_turn', {});
				return;
			}

			if (player.has_technology('DoctrineMobility')) {
				const information = game.get('f_technology_get_definition')('InformationNetworks');
				const expected_progress = information_accelerated ? information.cost - 1 : 0;
				if (
					state.technologies != ['CentauriEcology', 'DoctrineMobility'] ||
					state.target != 'InformationNetworks' ||
					state.progress != expected_progress ||
					!base.can_set_production('unit', 'ReconRover') ||
					base.can_set_production('facility', 'NetworkNode')
				) {
					#print('RESEARCH_RUNTIME_FAIL: Information Networks research or facility gate is invalid');
					glsmac.exit();
					return;
				}
				if (!information_accelerated) {
					information_accelerated = true;
					player.set_research_state({
						technologies: ['CentauriEcology', 'DoctrineMobility'],
						target: 'InformationNetworks',
						progress: information.cost - 1,
					});
				}
				game.event('complete_turn', {});
				return;
			}

			if (player.has_technology('CentauriEcology')) {
				const mobility = game.get('f_technology_get_definition')('DoctrineMobility');
				const expected_progress = mobility_accelerated ? mobility.cost - 1 : 0;
				if (
					state.technologies != ['CentauriEcology'] ||
					state.target != 'DoctrineMobility' ||
					state.progress != expected_progress ||
					!base.can_set_production('unit', 'Former') ||
					base.can_set_production('unit', 'ReconRover')
				) {
					#print('RESEARCH_RUNTIME_FAIL: chained Doctrine Mobility research or production gate is invalid');
					glsmac.exit();
					return;
				}
				if (!mobility_accelerated) {
					mobility_accelerated = true;
					player.set_research_state({
						technologies: ['CentauriEcology'],
						target: 'DoctrineMobility',
						progress: mobility.cost - 1,
					});
				}
				game.event('complete_turn', {});
				return;
			}

			if (
				state.target != 'CentauriEcology' ||
				state.progress <= last_progress ||
				base.can_set_production('unit', 'Former')
			) {
				#print('RESEARCH_RUNTIME_FAIL: research did not advance monotonically behind the production gate');
				glsmac.exit();
				return;
			}
			last_progress = state.progress;
			if (turn_id >= 15) {
				#print('RESEARCH_RUNTIME_FAIL: research progression did not complete within fifteen turns');
				glsmac.exit();
				return;
			}
			game.event('complete_turn', {});
		});
	});

	glsmac.run();

});
