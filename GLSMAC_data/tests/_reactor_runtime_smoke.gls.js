#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('./_full_unit_catalog_runtime')(glsmac, [
		'FusionPower', 'QuantumPower', 'SingularityMechanics', 'Nanometallurgy',
	]);
	#include('../default/ui/ui')(glsmac);

	const combat_rules = #include('../default/game/combat_rules');
	let runtime_complete = false;
	let ui_started = false;
	let exit_scheduled = false;
	let definition_count = 0;

	const fail = (message) => {
		#print('REACTOR_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const finish_if_ready = () => {
		if (runtime_complete && ui_started && !exit_scheduled) {
			exit_scheduled = true;
			#print(
				'REACTOR_RUNTIME_PASS: validated four reactor tiers, original unit costs, ' +
				'reactor durability, carrier cargo, and ' + #to_string(definition_count) +
				' live unit definitions'
			);
			#async(500, () => { glsmac.exit(); });
		}
	};

	const has_ability = (def, id) => {
		for (ability of def.abilities) {
			if (ability == id) {
				return true;
			}
		}
		return false;
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		game.on('start_ui', (e) => {
			ui_started = true;
			finish_if_ready();
		});

		game.on('turn', (e) => {
			if (e.year - 2100 != 1) {
				fail('runtime test exceeded one turn');
				return;
			}

			const definitions = game.get_um().get_unit_defs();
			definition_count = #sizeof(definitions);
			let tiers = {};
			let fusion_assault = null;
			let fusion_transport = null;
			let carrier_transport = null;
			let singularity_buster = null;
			for (def of definitions) {
				let expected_power = 0;
				if (def.reactor == 'FissionPlant') {
					expected_power = 1;
				} else if (def.reactor == 'FusionReactor') {
					expected_power = 2;
				} else if (def.reactor == 'QuantumChamber') {
					expected_power = 3;
				} else if (def.reactor == 'SingularityEngine') {
					expected_power = 4;
				} else {
					fail('unknown live reactor on unit ' + def.id);
					return;
				}
				if (def.reactor_power != expected_power) {
					fail('reactor metadata mismatch on unit ' + def.id);
					return;
				}
				tiers['r' + #to_string(expected_power)] = true;
				if (
					fusion_assault == null && expected_power == 2 && def.is_land &&
					def.offense > 1 && def.weapon != 'PlanetBuster'
				) {
					fusion_assault = def;
				}
				if (
					fusion_transport == null && expected_power == 2 && def.is_water &&
					def.weapon == 'TroopTransport' && !has_ability(def, 'CarrierDeck')
				) {
					fusion_transport = def;
				}
				if (has_ability(def, 'CarrierDeck')) {
					if (
						!def.is_water || def.weapon != 'TroopTransport' ||
						def.cargo_capacity <= 0
					) {
						fail('Carrier Deck design cannot carry aircraft: ' + def.id);
						return;
					}
					carrier_transport = def;
				}
				if (
					expected_power == 4 && def.weapon == 'PlanetBuster'
				) {
					if (def.mineral_cost != 320) {
						fail('Planet Buster does not use the original 320-mineral cost');
						return;
					}
					singularity_buster = def;
				}
			}
			for (let power = 1; power <= 4; power++) {
				if (!#is_defined(tiers['r' + #to_string(power)])) {
					fail('generated catalog is missing reactor power ' + #to_string(power));
					return;
				}
			}
			if (
				fusion_assault == null || fusion_transport == null ||
				carrier_transport == null || singularity_buster == null
			) {
				fail('generated reactor role coverage is incomplete');
				return;
			}
			const expected_capacity = fusion_transport.chassis == 'Foil' ? 4 : 8;
			if (fusion_transport.cargo_capacity != expected_capacity) {
				fail('Fusion sea transport capacity did not double');
				return;
			}
			const damage = combat_rules.get_damage(fusion_assault, 0.4);
			if (damage < 0.199 || damage > 0.201) {
				fail('Fusion reactor did not halve incoming combat damage');
				return;
			}

			runtime_complete = true;
			finish_if_ready();
		});
	});

	glsmac.run();

});
