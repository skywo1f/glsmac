const units = #include('../default/units');
const technologies = #include('../default/technologies');
const manifest = #include('../default/content/base_units');

units.ensure_full_catalog();

test.assert(units.generated_count > 92);
test.assert(#sizeof(units.predefined_definitions) == 17);
test.assert(#sizeof(units.generated_definitions) == units.generated_count);
test.assert(#sizeof(units.definitions) == units.generated_count + 17);

const get_unit = (id) => {
	for (unit of units.definitions) {
		if (unit.id == id) {
			return unit;
		}
	}
	return null;
};

const has_ability = (data, ability_id) => {
	for (ability of data.abilities) {
		if (ability == ability_id) {
			return true;
		}
	}
	return false;
};

const artifact = get_unit('AlienArtifact');
test.assert(artifact != null);
test.assert(!artifact.data.buildable);
test.assert(artifact.data.weapon == 'AlienArtifact');

const scout = get_unit('ScoutPatrol');
const colony = get_unit('ColonyPod');
const former = get_unit('Former');
test.assert(
	scout.data.render.file == 'newicons.pcx' &&
	scout.data.render.x == 518 && scout.data.render.y == 82
);
test.assert(
	colony.data.render.file == 'newicons.pcx' &&
	colony.data.render.x == 518 && colony.data.render.y == 235
);
test.assert(
	former.data.render.file == 'newicons.pcx' &&
	former.data.render.x == 518 && former.data.render.y == 158
);
const recon = get_unit('ReconRover');
const probe = get_unit('ProbeTeam');
test.assert(recon.data.render.x == 518 && recon.data.render.y == 82);
test.assert(probe.data.render.x == 518 && probe.data.render.y == 158);

const unity_rover = get_unit('UnityRover');
const unity_chopper = get_unit('UnityScoutChopper');
const unity_foil = get_unit('UnityFoil');
const isle = get_unit('IsleOfTheDeep');
const locusts = get_unit('LocustsOfChiron');
test.assert(unity_rover != null && !unity_rover.data.buildable);
test.assert(
	unity_rover.data.movement_type == 'land' &&
	unity_rover.data.movement_per_turn == 2
);
test.assert(unity_chopper != null && !unity_chopper.data.buildable);
test.assert(
	unity_chopper.data.movement_type == 'air' &&
	unity_chopper.data.movement_per_turn == 8 &&
	unity_chopper.data.operational_range == 1
);
test.assert(unity_foil != null && !unity_foil.data.buildable);
test.assert(
	unity_foil.data.movement_type == 'water' &&
	unity_foil.data.cargo_capacity == 2
);
test.assert(
	locusts != null && locusts.data.movement_type == 'air' &&
	locusts.data.movement_per_turn == 8 &&
	locusts.data.required_technology == 'CentauriGenetics'
);
test.assert(isle != null && isle.data.is_native && isle.data.cargo_capacity == 4);

let ids = {};
let found_late_land_assault = false;
let found_sea_unit = false;
let found_air_unit = false;
let found_needlejet = false;
let found_copter = false;
let found_gravship = false;
let found_missile = false;
let found_planet_buster = false;
let found_carrier = false;
let found_radar_artillery = false;
let found_cloaked_land = false;
let found_submarine = false;
let found_sea_colony = false;
let found_fast_land_colony = false;
let found_clean_unit = false;
let found_trained_unit = false;
let found_super_former = false;
let found_fungicidal_former = false;
let found_sea_former = false;
let found_probe_team = false;
let found_amphibious_unit = false;
let found_land_sam = false;
let found_sea_sam = false;
let found_air_sam = false;
let found_land_nerve_gas = false;
let found_air_nerve_gas = false;
let found_drop_unit = false;
let found_fission = false;
let found_fusion = false;
let found_quantum = false;
let found_singularity = false;
let found_fusion_transport = false;
let found_singularity_planet_buster = false;
let found_supply_crawler = false;
for (let i = 0; i < #sizeof(units.definitions); i++) {
	const entry = units.definitions[i];
	test.assert(!#is_defined(ids[entry.id]));
	ids[entry.id] = true;
	const data = entry.data;
	test.assert(data.mineral_cost >= 0);
	test.assert(data.defense > 0);
	test.assert(data.render.file == (data.is_native ? 'units.pcx' : 'newicons.pcx'));
	test.assert(data.chassis != '');
	test.assert(data.weapon != '');
	test.assert(data.armor != '');
	test.assert(data.reactor_power >= 1 && data.reactor_power <= 4);
	if (data.reactor == 'FissionPlant') {
		test.assert(data.reactor_power == 1);
		found_fission = true;
	} else if (data.reactor == 'FusionReactor') {
		test.assert(data.reactor_power == 2);
		found_fusion = true;
	} else if (data.reactor == 'QuantumChamber') {
		test.assert(data.reactor_power == 3);
		found_quantum = true;
	} else {
		test.assert(data.reactor == 'SingularityEngine' && data.reactor_power == 4);
		found_singularity = true;
	}
	test.assert(#typeof(data.abilities) == 'Array');
	test.assert(data.operational_range >= 0);
	test.assert(#typeof(data.is_missile) == 'Bool');
	if (entry.id == 'ProbeTeam') {
		test.assert(data.weapon == 'ProbeTeam');
		test.assert(data.required_technology == 'PlanetaryNetworks');
		test.assert(data.movement_per_turn == 2);
		found_probe_team = true;
	}
	if (i < 17) {
		test.assert(data.reactor == 'FissionPlant');
		continue;
	}
	test.assert(data.mineral_cost >= 10);
	test.assert(
		data.offense > 0 || data.can_found_base ||
		data.can_terraform || data.cargo_capacity > 0 ||
		data.weapon == 'SupplyTransport'
	);
	test.assert(technologies.get_definition(data.required_technology) != null);
	for (ability of data.abilities) {
		if (ability == 'CleanReactor') {
			found_clean_unit = true;
		} else if (ability == 'HighMorale') {
			found_trained_unit = true;
		} else if (ability == 'SuperFormer' && data.can_terraform) {
			found_super_former = true;
		} else if (ability == 'FungicideTanks' && data.can_terraform) {
			found_fungicidal_former = true;
		} else if (ability == 'CarrierDeck' && data.movement_type == 'water') {
			test.assert(data.weapon == 'TroopTransport' && data.cargo_capacity > 0);
			found_carrier = true;
		} else if (ability == 'DeepRadar' && has_ability(data, 'HeavyArtillery')) {
			found_radar_artillery = true;
		} else if (ability == 'CloakingDevice') {
			test.assert(data.movement_type == 'land');
			found_cloaked_land = true;
		} else if (ability == 'DeepPressureHull') {
			test.assert(data.movement_type == 'water');
			found_submarine = true;
		} else if (ability == 'AmphibiousPods') {
			test.assert(data.movement_type == 'land');
			found_amphibious_unit = true;
		} else if (ability == 'AirSuperiority') {
			if (data.movement_type == 'land') {
				found_land_sam = true;
			} else if (data.movement_type == 'water') {
				found_sea_sam = true;
			} else if (data.movement_type == 'air') {
				found_air_sam = true;
			}
		} else if (ability == 'NerveGasPods') {
			test.assert(!data.is_native && data.weapon != 'PsiAttack');
			test.assert(data.movement_type != 'water');
			if (data.movement_type == 'land') {
				found_land_nerve_gas = true;
			} else if (data.movement_type == 'air') {
				found_air_nerve_gas = true;
			}
		} else if (ability == 'DropPods') {
			test.assert(!data.is_native && data.movement_type == 'land');
			found_drop_unit = true;
		}
	}
	if (data.can_terraform) {
		test.assert(data.movement_type == 'land' || data.movement_type == 'water');
		test.assert(data.weapon == 'TerraformingUnit');
		if (data.movement_type == 'water') {
			found_sea_former = true;
		}
	}
	if (data.can_found_base) {
		test.assert(data.movement_type == 'land' || data.movement_type == 'water');
		test.assert(data.weapon == 'ColonyModule');
		if (data.movement_type == 'water') {
			found_sea_colony = true;
		} else if (data.movement_per_turn > 1) {
			found_fast_land_colony = true;
		}
	}
	if (data.weapon == 'SupplyTransport') {
		test.assert(data.movement_type == 'land');
		test.assert(data.required_technology != '');
		found_supply_crawler = true;
	}
	if (data.movement_type == 'water') {
		found_sea_unit = true;
		if (data.weapon == 'TroopTransport' && data.reactor_power == 2) {
			let base_capacity = 0;
			for (chassis of manifest.chassis) {
				if (chassis.id == data.chassis) {
					base_capacity = chassis.cargo;
				}
			}
			test.assert(data.cargo_capacity == base_capacity * 2);
			found_fusion_transport = true;
		}
	} else if (data.movement_type == 'air') {
		found_air_unit = true;
		if (data.chassis == 'Needlejet') {
			test.assert(data.operational_range == 2 && !data.is_missile);
			found_needlejet = true;
		} else if (data.chassis == 'Copter') {
			test.assert(data.operational_range == 1 && !data.is_missile);
			found_copter = true;
		} else if (data.chassis == 'Gravship') {
			test.assert(data.operational_range == 0 && !data.is_missile);
			found_gravship = true;
		} else if (data.chassis == 'Missile') {
			test.assert(data.operational_range == 1 && data.is_missile);
			if (data.weapon == 'ConventionalPayload') {
				found_missile = true;
			} else {
				test.assert(data.weapon == 'PlanetBuster');
				test.assert(data.offense == 99);
				test.assert(data.mineral_cost == 320);
				if (data.reactor_power == 4) {
					found_singularity_planet_buster = true;
				}
				found_planet_buster = true;
			}
		}
	} else if (data.offense >= 20) {
		found_late_land_assault = true;
	}
	test.assert(data.offense < 99 || data.weapon == 'PlanetBuster');
}

test.assert(found_late_land_assault);
test.assert(found_sea_unit);
test.assert(found_air_unit);
test.assert(found_needlejet);
test.assert(found_copter);
test.assert(found_gravship);
test.assert(found_missile);
test.assert(found_planet_buster);
test.assert(found_carrier);
test.assert(found_radar_artillery);
test.assert(found_cloaked_land);
test.assert(found_submarine);
test.assert(found_sea_colony);
test.assert(found_fast_land_colony);
test.assert(found_clean_unit);
test.assert(found_trained_unit);
test.assert(found_super_former);
test.assert(found_fungicidal_former);
test.assert(found_sea_former);
test.assert(found_probe_team);
test.assert(found_amphibious_unit);
test.assert(found_land_sam);
test.assert(found_sea_sam);
test.assert(found_air_sam);
test.assert(found_land_nerve_gas);
test.assert(found_air_nerve_gas);
test.assert(found_drop_unit);
test.assert(found_fission);
test.assert(found_fusion);
test.assert(found_quantum);
test.assert(found_singularity);
test.assert(found_fusion_transport);
test.assert(found_singularity_planet_buster);
test.assert(found_supply_crawler);
