const units = #include('../default/units');
const technologies = #include('../default/technologies');
const manifest = #include('../default/content/base_units');
const PREDEFINED_COUNT = 16;

units.ensure_full_catalog();

test.assert(units.generated_count > 92);
test.assert(#sizeof(units.predefined_definitions) == PREDEFINED_COUNT);
test.assert(#sizeof(units.generated_definitions) == units.generated_count);
test.assert(#sizeof(units.definitions) == units.generated_count + PREDEFINED_COUNT);

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
test.assert(get_unit('FungalTower') == null);
test.assert(get_unit('SeaLurk') == null);
test.assert(get_unit('SporeLauncher') == null);

const scout = get_unit('ScoutPatrol');
const colony = get_unit('ColonyPod');
const former = get_unit('Former');
const transport_foil = get_unit('TransportFoil');
const supply_crawler = get_unit('SupplyCrawler');
test.assert(
	scout.data.render.type == 'cvr' && scout.data.render.files == [
		'VI.cvr', 'Vw00.cvr', 'VGMT.cvr', 'VGMTP.cvr', 'Viptr00.cvr'
	] &&
	scout.data.render.fallback.file == 'newicons.pcx' &&
	scout.data.render.fallback.x == 518 && scout.data.render.fallback.y == 82
);
test.assert(
	colony.data.render.type == 'cvr' && colony.data.render.files == ['Drop.cvr'] &&
	colony.data.render.fallback.file == 'newicons.pcx' &&
	colony.data.render.fallback.x == 518 && colony.data.render.fallback.y == 235
);
test.assert(
	former.data.render.type == 'cvr' && former.data.render.files == ['VT.cvr'] &&
	former.data.render.fallback.file == 'newicons.pcx' &&
	former.data.render.fallback.x == 518 && former.data.render.fallback.y == 158
);
test.assert(
	transport_foil != null && transport_foil.data.mineral_cost == 30 &&
	transport_foil.data.movement_type == 'water' &&
	transport_foil.data.cargo_capacity == 2 &&
	transport_foil.data.required_technology == 'DoctrineFlexibility'
);
test.assert(
	supply_crawler != null && supply_crawler.data.mineral_cost == 30 &&
	supply_crawler.data.weapon == 'SupplyTransport' &&
	supply_crawler.data.required_technology == 'IndustrialAutomation'
);
const recon = get_unit('ReconRover');
const probe = get_unit('ProbeTeam');
test.assert(
	recon.data.render.type == 'cvr' &&
	recon.data.render.files == [
		'VRCP00.cvr', 'VGMC.cvr', 'VGMCP.cvr', 'VB.cvr', 'VBP.cvr',
		'VSP.cvr', 'VSPTb.cvr', 'VSPTf.cvr', 'VLIGHTS.cvr',
		'Vw00.cvr', 'vr00.cvr'
	]
);
test.assert(
	probe.data.render.type == 'cvr' &&
	probe.data.render.files == [
		'VRCP00.cvr', 'VGMC.cvr', 'VGMCP.cvr', 'VB.cvr', 'VBP.cvr',
		'VSP.cvr', 'VSPTb.cvr', 'VSPTf.cvr', 'VLIGHTS.cvr',
		'Ptmod.cvr', 'vr00.cvr'
	] && probe.data.render.fallback.y == 158
);

const get_expected_cvr_files = (data) => {
	if (data.is_native) { return []; }
	if (data.chassis == 'Infantry' && data.armor == 'NoArmor') {
		if (data.weapon == 'ColonyModule') { return ['Drop.cvr']; }
		if (data.weapon == 'TerraformingUnit') { return ['VT.cvr']; }
	}
	const chassis_specs = {
		Speeder: {
			cockpit: true,
			files: [
				'VGMC.cvr', 'VGMCP.cvr', 'VB.cvr', 'VBP.cvr', 'VSP.cvr',
				'VSPTb.cvr', 'VSPTf.cvr', 'VLIGHTS.cvr',
			],
			armor_files: ['VA01.cvr', 'VSPA01.cvr'],
		},
		Hovertank: {
			cockpit: false,
			files: [
				'VB.cvr', 'VHT-VBp.cvr', 'VHTp.cvr', 'VHTTp.cvr',
				'VHTA00.cvr', 'VHTTA00.cvr', 'VLIGHTS.cvr',
			],
			armor_files: ['VHTA01.cvr', 'VHTTA01.cvr'],
		},
		Foil: {
			cockpit: true,
			files: ['VGMC.cvr', 'VGMCP.cvr', 'VB.cvr', 'VBP.cvr', 'VFL.cvr'],
			armor_files: ['VA01.cvr'],
		},
		Cruiser: {
			cockpit: false,
			files: [
				'VB.cvr', 'VBP.cvr', 'VGMC.cvr', 'VGMCP.cvr', 'VCU.cvr',
				'VCUP.cvr', 'VCUW.cvr', 'VCUA00.cvr',
			],
			armor_files: ['VCUA01.cvr'],
		},
		Needlejet: {
			cockpit: true,
			files: [
				'VB.cvr', 'VBP.cvr', 'VGMC.cvr', 'VGMCP.cvr',
				'VJTP.cvr', 'VJT00.cvr',
			],
			armor_files: ['VA01.cvr', 'VJT01.cvr'],
		},
		Copter: {
			cockpit: true,
			files: [
				'VB.cvr', 'VBP.cvr', 'VGMC.cvr', 'VGMCP.cvr', 'VCT.cvr',
				'VCTP.cvr', 'VCTB.cvr', 'VCT00.cvr',
			],
			armor_files: ['VA01.cvr', 'VCT01.cvr'],
		},
		Gravship: {
			cockpit: true,
			files: [
				'VB.cvr', 'VBP.cvr', 'VGMC.cvr', 'VGMCP.cvr',
				'VGS.cvr', 'VGSP.cvr',
			],
			armor_files: ['VA01.cvr'],
		},
	};
	const weapon_files = {
		HandWeapons: 'Vw00.cvr', Laser: 'VW01.cvr',
		ParticleImpactor: 'VW02.cvr', GatlingLaser: 'Vw03.cvr',
		MissileLauncher: 'VW04.cvr', ChaosGun: 'VW05.cvr',
		FusionLaser: 'VW06.cvr', TachyonBolt: 'VW07.cvr',
		PlasmaShard: 'Vw08.cvr', QuantumLaser: 'Vw09.cvr',
		GravitonGun: 'VW10.cvr', SingularityLaser: 'VW11.cvr',
		PsiAttack: 'VW12.cvr',
		ColonyModule: 'Droplet.cvr', TerraformingUnit: 'Vwntu.cvr',
		TroopTransport: 'VWNTT.cvr', SupplyTransport: 'VWNST.cvr',
		ProbeTeam: 'Ptmod.cvr', AlienArtifact: 'VWNAA.cvr',
	};
	const reactor_suffixes = {
		FissionPlant: '00', FusionReactor: '01',
		QuantumChamber: '02', SingularityEngine: '03',
	};
	if (!#is_defined(reactor_suffixes[data.reactor])) {
		return [];
	}
	const suffix = reactor_suffixes[data.reactor];
	if (data.chassis == 'Infantry') {
		const infantry_armor_files = {
			NoArmor: [],
			SynthmetalArmor: ['Vipta00.cvr'],
			PlasmaSteelArmor: ['Vipta00.cvr'],
			SilksteelArmor: ['Vipta00.cvr'],
			PhotonWall: ['Viptawal.cvr'],
			ProbabilitySheath: [],
			NeutroniumArmor: ['Vipta00.cvr'],
			AntimatterPlate: ['Vipta00.cvr'],
			StasisGenerator: ['Viptasgn.cvr'],
			PsiDefense: ['Viptapsi.cvr'],
		};
		if (
			!#is_defined(weapon_files[data.weapon]) ||
			!#is_defined(infantry_armor_files[data.armor]) ||
			data.weapon == 'ColonyModule' || data.weapon == 'TerraformingUnit' ||
			data.weapon == 'TroopTransport' || data.weapon == 'SupplyTransport' ||
			data.weapon == 'ProbeTeam' || data.weapon == 'AlienArtifact'
		) { return []; }
		let result = [
			'VI.cvr', weapon_files[data.weapon], 'VGMT.cvr', 'VGMTP.cvr',
		];
		for (file of infantry_armor_files[data.armor]) { result :+file; }
		result :+('Viptr' + suffix + '.cvr');
		return result;
	}
	if (data.chassis == 'Missile') {
		let missile_file = '';
		if (data.weapon == 'PlanetBuster') { missile_file = 'VW13.cvr'; }
		if (data.weapon == 'ConventionalPayload') { missile_file = 'VM.cvr'; }
		if (missile_file == '') { return []; }
		return [missile_file, 'VB.cvr', 'VBP.cvr', 'vpbr' + suffix + '.cvr'];
	}
	if (
		!#is_defined(chassis_specs[data.chassis]) ||
		!#is_defined(weapon_files[data.weapon])
	) { return []; }
	const spec = chassis_specs[data.chassis];
	let result = [];
	if (spec.cockpit) { result :+('VRCP' + suffix + '.cvr'); }
	for (file of spec.files) { result :+file; }
	result :+weapon_files[data.weapon];
	if (data.armor != 'NoArmor') {
		for (file of spec.armor_files) { result :+file; }
	}
	result :+('vr' + suffix + '.cvr');
	return result;
};

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
	const expected_cvr_files = get_expected_cvr_files(data);
	if (data.render.type == 'cvr') {
		test.assert(
			#sizeof(expected_cvr_files) > 0 && data.render.files == expected_cvr_files &&
			data.render.fallback.file == 'newicons.pcx'
		);
	} else {
		test.assert(#sizeof(expected_cvr_files) == 0);
		test.assert(data.render.type == 'sprite');
		test.assert(data.render.file == (data.is_native ? 'units.pcx' : 'newicons.pcx'));
	}
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
	if (i < PREDEFINED_COUNT) {
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
