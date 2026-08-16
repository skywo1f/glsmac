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
	const chassis_files = {
		Speeder: ['VGMC.cvr', 'VSP.cvr'],
		Foil: ['VFL.cvr'],
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
	if (
		!#is_defined(chassis_files[chassis_id]) ||
		!#is_defined(weapon_files[weapon_id]) ||
		!#is_defined(reactor_suffixes[reactor_id])
	) {
		return [];
	}
	let files = [];
	for (file of chassis_files[chassis_id]) {
		files :+file;
	}
	const suffix = reactor_suffixes[reactor_id];
	files :+('vr' + suffix + '.cvr');
	files :+('VRCP' + suffix + '.cvr');
	if (armor_id != 'NoArmor') {
		files :+'VA01.cvr';
	}
	files :+weapon_files[weapon_id];
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
