#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	const technology_catalog = #include('../default/content/base_technologies');
	let finished = false;

	const fail = (message) => {
		if (finished) {
			return;
		}
		finished = true;
		#print('FACILITY_PRODUCTION_RULES_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const expect = (condition, message) => {
		if (!condition) {
			fail(message);
			return false;
		}
		return true;
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.on('turn', (e) => {
			if (finished || e.year - 2100 != 1) {
				return;
			}

			const player = game.get_player();
			let base = null;
			for (candidate of game.get_bm().get_bases()) {
				if (candidate.get_owner().id == player.id) {
					base = candidate;
					break;
				}
			}
			if (!expect(base != null, 'quickstart player has no base')) {
				return;
			}

			const known = #clone(technology_catalog.order);
			player.set_research_state({
				technologies: known,
				target: '',
				progress: 0,
				cost: 0,
			});
			base.clear_production();

			if (!expect(
				!base.can_set_production('facility', 'HybridForest'),
				'Hybrid Forest did not require a Tree Farm'
			)) {
				return;
			}
			base.set_production('facility', 'TreeFarm');
			if (!expect(
				base.can_queue_production('facility', 'HybridForest'),
				'queued Tree Farm did not satisfy Hybrid Forest prerequisite'
			)) {
				return;
			}
			base.queue_production('facility', 'HybridForest');
			base.clear_production();

			for (rule of [
				['QuantumLab', 'FusionLab'],
				['Nanohospital', 'ResearchHospital'],
				['HabitationDome', 'HabComplex'],
				['TempleOfPlanet', 'CentauriPreserve'],
				['QuantumConverter', 'RoboticAssemblyPlant'],
			]) {
				if (!expect(
					!base.can_set_production('facility', rule[0]),
					rule[0] + ' did not require ' + rule[1]
				)) {
					return;
				}
				base.add_facility(rule[1]);
				if (!expect(
					base.can_set_production('facility', rule[0]),
					rule[1] + ' did not unlock ' + rule[0]
				)) {
					return;
				}
				base.remove_facility(rule[1]);
			}

			if (!expect(
				!base.can_set_production('facility', 'Nanoreplicator'),
				'Nanoreplicator lacked its factory prerequisite'
			)) {
				return;
			}
			for (factory of ['GenejackFactory', 'RoboticAssemblyPlant']) {
				base.add_facility(factory);
				if (!expect(
					base.can_set_production('facility', 'Nanoreplicator'),
					factory + ' did not unlock Nanoreplicator'
				)) {
					return;
				}
				base.remove_facility(factory);
			}

			base.add_facility('PressureDome');
			if (!expect(
				!base.can_set_production('facility', 'RecyclingTanks'),
				'Pressure Dome did not replace Recycling Tanks'
			)) {
				return;
			}
			base.remove_facility('PressureDome');

			base.add_facility('RecreationCommons');
			if (!expect(
				base.can_set_production('facility', 'HologramTheatre'),
				'Recreation Commons did not unlock Hologram Theatre'
			)) {
				return;
			}
			base.add_facility('TheVirtualWorld');
			if (!expect(
				!base.can_set_production('facility', 'HologramTheatre'),
				'Virtual World did not make Hologram Theatre redundant'
			)) {
				return;
			}
			base.remove_facility('TheVirtualWorld');
			base.remove_facility('RecreationCommons');

			base.add_facility('PunishmentSphere');
			if (!expect(
				!base.can_set_production('facility', 'ParadiseGarden'),
				'Punishment Sphere did not block Paradise Garden'
			)) {
				return;
			}
			base.remove_facility('PunishmentSphere');
			base.add_facility('ParadiseGarden');
			if (!expect(
				!base.can_set_production('facility', 'PunishmentSphere'),
				'Paradise Garden did not block Punishment Sphere'
			)) {
				return;
			}
			base.remove_facility('ParadiseGarden');

			if (!expect(
				!base.can_set_production('facility', 'TachyonField'),
				'Tachyon Field lacked its defense prerequisite'
			)) {
				return;
			}
			base.add_facility('TheCitizensDefenseForce');
			if (!expect(
				base.can_set_production('facility', 'TachyonField'),
				'Citizens\' Defense Force did not satisfy Tachyon Field prerequisite'
			)) {
				return;
			}
			if (!expect(
				!base.can_set_production('facility', 'PerimeterDefense'),
				'Citizens\' Defense Force did not make Perimeter Defense redundant'
			)) {
				return;
			}
			base.remove_facility('TheCitizensDefenseForce');

			for (grant of [
				['TheCommandNexus', 'CommandCenter'],
				['TheMaritimeControlCenter', 'NavalYard'],
				['TheCyborgFactory', 'BioenhancementCenter'],
				['TheSingularityInductor', 'QuantumConverter'],
			]) {
				base.add_facility(grant[0]);
				if (!expect(
					!base.can_set_production('facility', grant[1]),
					grant[0] + ' did not make ' + grant[1] + ' redundant'
				)) {
					return;
				}
				base.remove_facility(grant[0]);
			}

			let coastal = base.get_tile().is_water;
			for (nearby of base.get_tile().get_surrounding_tiles()) {
				if (nearby.is_water) {
					coastal = true;
				}
			}
			if (!expect(
				base.can_set_production('facility', 'NavalYard') == coastal,
				'Naval Yard coastal requirement did not match the base location'
			)) {
				return;
			}

			finished = true;
			#print(
				'FACILITY_PRODUCTION_RULES_RUNTIME_PASS: base-SMAC prerequisites, ' +
				'queue chains, coastal gating, and project redundancy verified'
			);
			#async(250, () => { glsmac.exit(); });
		});
	});

	glsmac.run();

});
