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
	let biogenetics_accelerated = false;
	let planetary_networks_accelerated = false;
	let doctrine_loyalty_accelerated = false;
	let industrial_economics_accelerated = false;
	let secrets_human_brain_accelerated = false;
	let ui_started = false;
	let exit_scheduled = false;

	const finish_if_ready = () => {
		if (research_complete && ui_started && !exit_scheduled) {
			exit_scheduled = true;
			#print('RESEARCH_RUNTIME_PASS: eleven-tier research unlocked facilities and specialized units');
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
			const recycling_tanks = game.get_bm().get_facility_def('RecyclingTanks');
			const network_node = game.get_bm().get_facility_def('NetworkNode');
			const recreation_commons = game.get_bm().get_facility_def('RecreationCommons');
			const hologram_theatre = game.get_bm().get_facility_def('HologramTheatre');
			const perimeter_defense = game.get_bm().get_facility_def('PerimeterDefense');
			const energy_bank = game.get_bm().get_facility_def('EnergyBank');
			const command_center = game.get_bm().get_facility_def('CommandCenter');
			const biology_lab = game.get_bm().get_facility_def('BiologyLab');
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
				recycling_tanks.required_technology != 'Biogenetics' ||
				network_node.required_technology != 'InformationNetworks' ||
				network_node.research_multiplier != 0.5 ||
				network_node.energy_maintenance != 1 ||
				recreation_commons.required_technology != 'SocialPsych' ||
				recreation_commons.energy_maintenance != 1 ||
				recreation_commons.psych_bonus != 4 ||
				hologram_theatre.required_technology != 'PlanetaryNetworks' ||
				hologram_theatre.energy_maintenance != 3 ||
				hologram_theatre.psych_bonus != 4 ||
				perimeter_defense.required_technology != 'DoctrineLoyalty' ||
				perimeter_defense.energy_maintenance != 0 ||
				perimeter_defense.defense_multiplier != 2.0 ||
				energy_bank.required_technology != 'IndustrialEconomics' ||
				energy_bank.energy_maintenance != 1 ||
				energy_bank.economy_multiplier != 0.5 ||
				command_center.required_technology != 'DoctrineMobility' ||
				command_center.energy_maintenance != 1 ||
				command_center.unit_morale_bonus != 2 ||
				biology_lab.required_technology != 'SecretsHumanBrain' ||
				biology_lab.energy_maintenance != 1 ||
				biology_lab.research_bonus != 2
			) {
				#print('RESEARCH_RUNTIME_FAIL: technology-gated unit or facility definitions are invalid');
				glsmac.exit();
				return;
			}

			const state = player.get_research_state();
			if (turn_id == 1) {
				if (
					player.get_faction().id != 'GAIANS' ||
					!player.has_technology('CentauriEcology') ||
					state.technologies != ['CentauriEcology'] ||
					state.target != 'DoctrineMobility' ||
					state.progress != 0 ||
					!base.can_set_production('unit', 'Former')
				) {
					#print('RESEARCH_RUNTIME_FAIL: initial Gaian research or production gate is invalid');
					glsmac.exit();
					return;
				}
			}

			if (player.has_technology('SecretsHumanBrain')) {
				if (
					state.technologies != ['AppliedPhysics', 'Biogenetics', 'CentauriEcology', 'DoctrineLoyalty', 'DoctrineMobility', 'IndustrialBase', 'IndustrialEconomics', 'InformationNetworks', 'PlanetaryNetworks', 'SecretsHumanBrain', 'SocialPsych'] ||
					state.target != '' ||
					state.progress != 0
				) {
					#print('RESEARCH_RUNTIME_FAIL: final eleven-tier research state is invalid');
					glsmac.exit();
					return;
				}
				if (
					!base.can_set_production('facility', 'BiologyLab') ||
					!base.can_set_production('facility', 'PerimeterDefense')
				) {
					#print('RESEARCH_RUNTIME_FAIL: final facility production gates are invalid');
					glsmac.exit();
					return;
				}
				const labs_before = game.get('f_technology_get_base_labs')(base).total;
				const consumption_before = base.get_consumption().ENERGY;
				base.add_facility('BiologyLab');
				const labs_after = game.get('f_technology_get_base_labs')(base).total;
				if (
					base.get_consumption().ENERGY != consumption_before + 1 ||
					labs_after <= labs_before
				) {
					#print('RESEARCH_RUNTIME_FAIL: Biology Lab maintenance or research bonus is invalid');
					glsmac.exit();
					return;
				}
				research_complete = true;
				finish_if_ready();
				return;
			}

			if (player.has_technology('IndustrialEconomics')) {
				const secrets_human_brain = game.get('f_technology_get_definition')('SecretsHumanBrain');
				const progress_is_valid = secrets_human_brain_accelerated
					? state.progress == secrets_human_brain.cost - 1
					: state.progress >= 0 && state.progress < secrets_human_brain.cost;
				if (
					state.technologies != ['AppliedPhysics', 'Biogenetics', 'CentauriEcology', 'DoctrineLoyalty', 'DoctrineMobility', 'IndustrialBase', 'IndustrialEconomics', 'InformationNetworks', 'PlanetaryNetworks', 'SocialPsych'] ||
					state.target != 'SecretsHumanBrain' ||
					!progress_is_valid ||
					!base.can_set_production('facility', 'EnergyBank') ||
					base.can_set_production('facility', 'BiologyLab')
				) {
					#print('RESEARCH_RUNTIME_FAIL: Industrial Economics did not advance to Secrets of the Human Brain');
					glsmac.exit();
					return;
				}
				const allocation_before = game.get('f_economy_get_base_allocation')(game, base);
				const consumption_before = base.get_consumption().ENERGY;
				base.add_facility('EnergyBank');
				const allocation_after = game.get('f_economy_get_base_allocation')(game, base);
				if (
					base.get_consumption().ENERGY != consumption_before + 1 ||
					allocation_after.economy.value != allocation_before.economy.value - 1 ||
					allocation_after.economy.bonus != #ceil(
						#to_float(#max(allocation_after.economy.value, 0)) * 0.5
					)
				) {
					#print('RESEARCH_RUNTIME_FAIL: Energy Bank maintenance or economy bonus is invalid');
					glsmac.exit();
					return;
				}
				if (!secrets_human_brain_accelerated) {
					secrets_human_brain_accelerated = true;
					player.set_research_state({
						technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics', 'PlanetaryNetworks', 'DoctrineLoyalty', 'IndustrialEconomics'],
						target: 'SecretsHumanBrain',
						progress: secrets_human_brain.cost - 1,
					});
				}
				game.event('complete_turn', {});
				return;
			}

			if (player.has_technology('DoctrineLoyalty')) {
				const industrial_economics = game.get('f_technology_get_definition')('IndustrialEconomics');
				const progress_is_valid = industrial_economics_accelerated
					? state.progress == industrial_economics.cost - 1
					: state.progress >= 0 && state.progress < industrial_economics.cost;
				if (
					state.technologies != ['AppliedPhysics', 'Biogenetics', 'CentauriEcology', 'DoctrineLoyalty', 'DoctrineMobility', 'IndustrialBase', 'InformationNetworks', 'PlanetaryNetworks', 'SocialPsych'] ||
					state.target != 'IndustrialEconomics' ||
					!progress_is_valid ||
					base.can_set_production('facility', 'EnergyBank') ||
					!base.can_set_production('facility', 'PerimeterDefense')
				) {
					#print('RESEARCH_RUNTIME_FAIL: Doctrine Loyalty did not advance to Industrial Economics');
					glsmac.exit();
					return;
				}
				const consumption_before = base.get_consumption().ENERGY;
				const psych_before = game.get('f_economy_get_base_psych')(game, base);
				base.add_facility('HologramTheatre');
				if (
					base.get_consumption().ENERGY != consumption_before + 3 ||
					game.get('f_economy_get_base_psych')(game, base) != psych_before + 4
				) {
					#print('RESEARCH_RUNTIME_FAIL: Hologram Theatre maintenance or psych bonus is invalid');
					glsmac.exit();
					return;
				}
				if (!industrial_economics_accelerated) {
					industrial_economics_accelerated = true;
					player.set_research_state({
						technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics', 'PlanetaryNetworks', 'DoctrineLoyalty'],
						target: 'IndustrialEconomics',
						progress: industrial_economics.cost - 1,
					});
				}
				game.event('complete_turn', {});
				return;
			}

			if (player.has_technology('PlanetaryNetworks')) {
				const doctrine_loyalty = game.get('f_technology_get_definition')('DoctrineLoyalty');
				const progress_is_valid = doctrine_loyalty_accelerated
					? state.progress == doctrine_loyalty.cost - 1
					: state.progress >= 0 && state.progress < doctrine_loyalty.cost;
				if (
					state.technologies != ['AppliedPhysics', 'Biogenetics', 'CentauriEcology', 'DoctrineMobility', 'IndustrialBase', 'InformationNetworks', 'PlanetaryNetworks', 'SocialPsych'] ||
					state.target != 'DoctrineLoyalty' ||
					!progress_is_valid ||
					base.can_set_production('facility', 'PerimeterDefense') ||
					!base.can_set_production('facility', 'HologramTheatre')
				) {
					#print('RESEARCH_RUNTIME_FAIL: Planetary Networks did not advance to Doctrine Loyalty');
					glsmac.exit();
					return;
				}
				if (!doctrine_loyalty_accelerated) {
					doctrine_loyalty_accelerated = true;
					player.set_research_state({
						technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics', 'PlanetaryNetworks'],
						target: 'DoctrineLoyalty',
						progress: doctrine_loyalty.cost - 1,
					});
				}
				game.event('complete_turn', {});
				return;
			}

			if (player.has_technology('Biogenetics')) {
				const planetary_networks = game.get('f_technology_get_definition')('PlanetaryNetworks');
				const progress_is_valid = planetary_networks_accelerated
					? state.progress == planetary_networks.cost - 1
					: state.progress >= 0 && state.progress < planetary_networks.cost;
				if (
					state.technologies != ['AppliedPhysics', 'Biogenetics', 'CentauriEcology', 'DoctrineMobility', 'IndustrialBase', 'InformationNetworks', 'SocialPsych'] ||
					state.target != 'PlanetaryNetworks' ||
					!progress_is_valid ||
					!base.can_set_production('facility', 'RecyclingTanks') ||
					base.can_set_production('facility', 'HologramTheatre') ||
					!base.has_facility('RecreationCommons')
				) {
					#print('RESEARCH_RUNTIME_FAIL: Biogenetics did not advance to Planetary Networks');
					glsmac.exit();
					return;
				}
				const intake_before = base.get_intake();
				base.add_facility('RecyclingTanks');
				const intake_after = base.get_intake();
				if (
					intake_after.NUTRIENTS != intake_before.NUTRIENTS + 1 ||
					intake_after.MINERALS != intake_before.MINERALS + 1 ||
					intake_after.ENERGY != intake_before.ENERGY + 1
				) {
					#print('RESEARCH_RUNTIME_FAIL: Recycling Tanks resource bonus is invalid');
					glsmac.exit();
					return;
				}
				if (!planetary_networks_accelerated) {
					planetary_networks_accelerated = true;
					player.set_research_state({
						technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych', 'Biogenetics'],
						target: 'PlanetaryNetworks',
						progress: planetary_networks.cost - 1,
					});
				}
				game.event('complete_turn', {});
				return;
			}

			if (player.has_technology('SocialPsych')) {
				const biogenetics = game.get('f_technology_get_definition')('Biogenetics');
				const progress_is_valid = biogenetics_accelerated
					? state.progress == biogenetics.cost - 1
					: state.progress >= 0 && state.progress < biogenetics.cost;
				if (
					state.technologies != ['AppliedPhysics', 'CentauriEcology', 'DoctrineMobility', 'IndustrialBase', 'InformationNetworks', 'SocialPsych'] ||
					state.target != 'Biogenetics' ||
					!progress_is_valid ||
					base.can_set_production('facility', 'RecyclingTanks') ||
					!base.can_set_production('facility', 'RecreationCommons')
				) {
					#print('RESEARCH_RUNTIME_FAIL: Social Psych did not advance to Biogenetics');
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
				if (!biogenetics_accelerated) {
					biogenetics_accelerated = true;
					player.set_research_state({
						technologies: ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks', 'AppliedPhysics', 'IndustrialBase', 'SocialPsych'],
						target: 'Biogenetics',
						progress: biogenetics.cost - 1,
					});
				}
				game.event('complete_turn', {});
				return;
			}

			if (player.has_technology('IndustrialBase')) {
				const social = game.get('f_technology_get_definition')('SocialPsych');
				const progress_is_valid = social_accelerated
					? state.progress == social.cost - 1
					: state.progress >= 0 && state.progress < social.cost;
				if (
					state.technologies != ['AppliedPhysics', 'CentauriEcology', 'DoctrineMobility', 'IndustrialBase', 'InformationNetworks'] ||
					state.target != 'SocialPsych' ||
					!progress_is_valid ||
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
				const progress_is_valid = industry_accelerated
					? state.progress == industry.cost - 1
					: state.progress >= 0 && state.progress < industry.cost;
				if (
					state.technologies != ['AppliedPhysics', 'CentauriEcology', 'DoctrineMobility', 'InformationNetworks'] ||
					state.target != 'IndustrialBase' ||
					!progress_is_valid ||
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
				const progress_is_valid = physics_accelerated
					? state.progress == physics.cost - 1
					: state.progress >= 0 && state.progress < physics.cost;
				if (
					state.technologies != ['CentauriEcology', 'DoctrineMobility', 'InformationNetworks'] ||
					state.target != 'AppliedPhysics' ||
					!progress_is_valid ||
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
				const progress_is_valid = information_accelerated
					? state.progress == information.cost - 1
					: state.progress >= 0 && state.progress < information.cost;
				if (
					state.technologies != ['CentauriEcology', 'DoctrineMobility'] ||
					state.target != 'InformationNetworks' ||
					!progress_is_valid ||
					!base.can_set_production('unit', 'ReconRover') ||
					!base.can_set_production('facility', 'CommandCenter') ||
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
				const progress_is_valid = mobility_accelerated
					? state.progress == mobility.cost - 1
					: state.progress >= 0 && state.progress < mobility.cost;
				if (
					state.technologies != ['CentauriEcology'] ||
					state.target != 'DoctrineMobility' ||
					!progress_is_valid ||
					!base.can_set_production('unit', 'Former') ||
					base.can_set_production('unit', 'ReconRover') ||
					base.can_set_production('facility', 'CommandCenter')
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
