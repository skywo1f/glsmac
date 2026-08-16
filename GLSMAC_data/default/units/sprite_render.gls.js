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

const get = (chassis_id, armor_id, weapon_id) => {
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
	if (chassis_id == 'Infantry' && armor_id == 'NoArmor' && weapon_id == 'HandWeapons') {
		return {
			type: 'cvr',
			files: ['VI.cvr'],
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
