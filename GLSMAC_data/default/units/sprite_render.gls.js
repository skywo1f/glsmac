const CHASSIS_Y = {
	Infantry: 2,
	Speeder: 79,
	Hovertank: 156,
	Foil: 233,
	Cruiser: 310,
	Needlejet: 387,
	Copter: 464,
	Gravship: 541,
	Missile: 618,
};

const ARMOR_X = {
	NoArmor: 2,
	SynthmetalArmor: 104,
	PlasmaSteelArmor: 206,
	SilksteelArmor: 308,
	PhotonWall: 410,
	ProbabilitySheath: 512,
	NeutroniumArmor: 614,
	AntimatterPlate: 716,
	StasisGenerator: 716,
	PsiDefense: 614,
};

const WEAPON_X = {
	HandWeapons: 2,
	Laser: 104,
	ParticleImpactor: 206,
	GatlingLaser: 308,
	MissileLauncher: 410,
	ChaosGun: 512,
	FusionLaser: 614,
	TachyonBolt: 716,
	PlasmaShard: 716,
	QuantumLaser: 716,
	GravitonGun: 716,
	SingularityLaser: 716,
	PsiAttack: 614,
};

const EQUIPMENT_X = {
	ColonyModule: 410,
	TerraformingUnit: 206,
	TroopTransport: 512,
	SupplyTransport: 308,
	ProbeTeam: 614,
	AlienArtifact: 716,
	ConventionalPayload: 614,
	PlanetBuster: 716,
};

const get = (chassis_id, armor_id, weapon_id) => {
	if (!#is_defined(CHASSIS_Y[chassis_id])) {
		throw Error('Unknown unit sprite chassis: ' + chassis_id);
	}
	let x = #is_defined(ARMOR_X[armor_id]) ? ARMOR_X[armor_id] : 2;
	if (#is_defined(EQUIPMENT_X[weapon_id])) {
		x = EQUIPMENT_X[weapon_id];
	} else if (armor_id == 'NoArmor' && #is_defined(WEAPON_X[weapon_id])) {
		x = WEAPON_X[weapon_id];
	}
	const y = CHASSIS_Y[chassis_id];
	return {
		type: 'sprite',
		file: 'units.pcx',
		x: x,
		y: y,
		w: 100,
		h: 75,
		cx: x + 51,
		cy: y + 51,
	};
};

return {get: get};
