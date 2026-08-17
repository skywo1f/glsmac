const get_role_y = (weapon_id) => {
	if (weapon_id == 'ColonyModule') {
		return 235;
	}
	if (
		weapon_id == 'TerraformingUnit' || weapon_id == 'ProbeTeam' ||
		weapon_id == 'TroopTransport'
	) {
		return 158;
	}
	if (weapon_id == 'SupplyTransport' || weapon_id == 'AlienArtifact') {
		return 312;
	}
	return 82;
};

const get_fallback = (weapon_id) => {
	const x = 518;
	const y = get_role_y(weapon_id);
	return {
		type: 'sprite',
		file: 'newicons.pcx',
		x: x,
		y: y,
		w: 80,
		h: 69,
		cx: x + 40,
		cy: y + 35,
	};
};

const get_layered_vehicle_files = (chassis_id, armor_id, weapon_id, reactor_id) => {
	if (!#is_defined(reactor_id)) {
		return [];
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
		HandWeapons: 'Vw00.cvr',
		Laser: 'VW01.cvr',
		ParticleImpactor: 'VW02.cvr',
		GatlingLaser: 'Vw03.cvr',
		MissileLauncher: 'VW04.cvr',
		ChaosGun: 'VW05.cvr',
		FusionLaser: 'VW06.cvr',
		TachyonBolt: 'VW07.cvr',
		PlasmaShard: 'Vw08.cvr',
		QuantumLaser: 'Vw09.cvr',
		GravitonGun: 'VW10.cvr',
		SingularityLaser: 'VW11.cvr',
		PsiAttack: 'VW12.cvr',
		ColonyModule: 'Droplet.cvr',
		TerraformingUnit: 'Vwntu.cvr',
		TroopTransport: 'VWNTT.cvr',
		SupplyTransport: 'VWNST.cvr',
		ProbeTeam: 'Ptmod.cvr',
		AlienArtifact: 'VWNAA.cvr',
	};
	const reactor_suffixes = {
		FissionPlant: '00',
		FusionReactor: '01',
		QuantumChamber: '02',
		SingularityEngine: '03',
	};
	if (!#is_defined(reactor_suffixes[reactor_id])) {
		return [];
	}
	const suffix = reactor_suffixes[reactor_id];
	if (chassis_id == 'Infantry') {
		const infantry_weapon_files = {
			HandWeapons: 'Vw00.cvr',
			Laser: 'VW01.cvr',
			ParticleImpactor: 'VW02.cvr',
			GatlingLaser: 'Vw03.cvr',
			MissileLauncher: 'VW04.cvr',
			ChaosGun: 'VW05.cvr',
			FusionLaser: 'VW06.cvr',
			TachyonBolt: 'VW07.cvr',
			PlasmaShard: 'Vw08.cvr',
			QuantumLaser: 'Vw09.cvr',
			GravitonGun: 'VW10.cvr',
			SingularityLaser: 'VW11.cvr',
			PsiAttack: 'VW12.cvr',
		};
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
			!#is_defined(infantry_weapon_files[weapon_id]) ||
			!#is_defined(infantry_armor_files[armor_id])
		) {
			return [];
		}
		let files = ['VI.cvr', infantry_weapon_files[weapon_id]];
		for (file of infantry_armor_files[armor_id]) {
			files :+file;
		}
		return files;
	}
	if (chassis_id == 'Missile') {
		let missile_file = '';
		if (weapon_id == 'PlanetBuster') {
			missile_file = 'VW13.cvr';
		} else if (weapon_id == 'ConventionalPayload') {
			missile_file = 'VM.cvr';
		}
		if (missile_file == '') {
			return [];
		}
		return [
			missile_file, 'VB.cvr', 'VBP.cvr', 'vpbr' + suffix + '.cvr',
		];
	}
	if (
		!#is_defined(chassis_specs[chassis_id]) ||
		!#is_defined(weapon_files[weapon_id])
	) {
		return [];
	}
	const spec = chassis_specs[chassis_id];
	let files = [];
	if (spec.cockpit) {
		files :+('VRCP' + suffix + '.cvr');
	}
	for (file of spec.files) {
		files :+file;
	}
	files :+weapon_files[weapon_id];
	if (armor_id != 'NoArmor') {
		for (file of spec.armor_files) {
			files :+file;
		}
	}
	files :+('vr' + suffix + '.cvr');
	return files;
};

const get = (chassis_id, armor_id, weapon_id, reactor_id) => {
	const supported_chassis = {
		Infantry: true,
		Speeder: true,
		Hovertank: true,
		Foil: true,
		Cruiser: true,
		Needlejet: true,
		Copter: true,
		Gravship: true,
		Missile: true,
	};
	if (!#is_defined(supported_chassis[chassis_id])) {
		throw Error('Unknown unit sprite chassis: ' + chassis_id);
	}
	const fallback = get_fallback(weapon_id);
	let cvr_file = '';
	if (chassis_id == 'Infantry' && armor_id == 'NoArmor') {
		if (weapon_id == 'HandWeapons') {
			cvr_file = 'VI.cvr';
		} else if (weapon_id == 'ColonyModule') {
			cvr_file = 'Drop.cvr';
		} else if (weapon_id == 'TerraformingUnit') {
			cvr_file = 'VT.cvr';
		}
	}
	if (cvr_file != '') {
		return {
			type: 'cvr',
			files: [cvr_file],
			w: 100,
			h: 75,
			cx: 50,
			cy: 52,
			fallback: fallback,
		};
	}
	const layered_files = get_layered_vehicle_files(
		chassis_id, armor_id, weapon_id, reactor_id
	);
	if (#sizeof(layered_files) > 0) {
		return {
			type: 'cvr',
			files: layered_files,
			w: 100,
			h: 75,
			cx: 50,
			cy: 52,
			fallback: fallback,
		};
	}
	return fallback;
};

return {get: get};
