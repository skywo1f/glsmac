const sprite_render = #include('../default/units/sprite_render');

const scout = sprite_render.get('Infantry', 'NoArmor', 'HandWeapons', 'FissionPlant');
test.assert(scout.type == 'cvr');
test.assert(scout.files == ['VI.cvr']);
test.assert(scout.w == 100 && scout.h == 75 && scout.cx == 50 && scout.cy == 52);
test.assert(scout.fallback.file == 'newicons.pcx');
test.assert(
	scout.fallback.x == 518 && scout.fallback.y == 82 &&
	scout.fallback.cx == 558 && scout.fallback.cy == 117
);

const rover = sprite_render.get('Speeder', 'NoArmor', 'HandWeapons', 'FissionPlant');
test.assert(rover.type == 'cvr');
test.assert(
	rover.files == [
		'VRCP00.cvr', 'VGMC.cvr', 'VGMCP.cvr', 'VB.cvr', 'VBP.cvr',
		'VSP.cvr', 'VSPTb.cvr', 'VSPTf.cvr', 'VLIGHTS.cvr',
		'Vw00.cvr', 'vr00.cvr'
	]
);
test.assert(rover.fallback.x == 518 && rover.fallback.y == 82);

const rover_without_reactor = sprite_render.get(
	'Speeder', 'NoArmor', 'HandWeapons', #undefined
);

const laser_infantry = sprite_render.get(
	'Infantry', 'NoArmor', 'Laser', 'FissionPlant'
);
test.assert(laser_infantry.type == 'cvr');
test.assert(laser_infantry.files == [
	'VI.cvr', 'VW01.cvr', 'VGMT.cvr', 'VGMTP.cvr', 'Viptr00.cvr',
]);

const synthmetal_sentinels = sprite_render.get(
	'Infantry', 'SynthmetalArmor', 'HandWeapons', 'FusionReactor'
);
test.assert(synthmetal_sentinels.type == 'cvr');
test.assert(synthmetal_sentinels.files == [
	'VI.cvr', 'Vw00.cvr', 'VGMT.cvr', 'VGMTP.cvr',
	'Vipta00.cvr', 'Viptr01.cvr',
]);
test.assert(
	rover_without_reactor.type == 'sprite' &&
	rover_without_reactor.x == 518 && rover_without_reactor.y == 82
);

const armored_foil = sprite_render.get(
	'Foil', 'PlasmaSteelArmor', 'Laser', 'FusionReactor'
);
test.assert(armored_foil.type == 'cvr');
test.assert(
	armored_foil.files == [
		'VRCP01.cvr', 'VGMC.cvr', 'VGMCP.cvr', 'VB.cvr', 'VBP.cvr',
		'VFL.cvr', 'VW01.cvr', 'VA01.cvr', 'vr01.cvr'
	]
);

const former = sprite_render.get(
	'Infantry', 'NoArmor', 'TerraformingUnit', 'FissionPlant'
);
test.assert(former.type == 'cvr');
test.assert(former.files == ['VT.cvr']);
test.assert(former.fallback.x == 518 && former.fallback.y == 158);

const probe = sprite_render.get('Speeder', 'NoArmor', 'ProbeTeam', 'FissionPlant');
test.assert(probe.type == 'cvr');
test.assert(
	probe.files == [
		'VRCP00.cvr', 'VGMC.cvr', 'VGMCP.cvr', 'VB.cvr', 'VBP.cvr',
		'VSP.cvr', 'VSPTb.cvr', 'VSPTf.cvr', 'VLIGHTS.cvr',
		'Ptmod.cvr', 'vr00.cvr'
	]
);
test.assert(probe.fallback.x == 518 && probe.fallback.y == 158);

const gravship = sprite_render.get(
	'Gravship', 'StasisGenerator', 'SingularityLaser', 'SingularityEngine'
);
test.assert(gravship.type == 'cvr');
test.assert(gravship.files == [
	'VRCP03.cvr', 'VB.cvr', 'VBP.cvr', 'VGMC.cvr', 'VGMCP.cvr',
	'VGS.cvr', 'VGSP.cvr', 'VW11.cvr', 'VA01.cvr', 'vr03.cvr',
]);

const hovertank = sprite_render.get(
	'Hovertank', 'NoArmor', 'ChaosGun', 'FissionPlant'
);
test.assert(hovertank.type == 'cvr');
test.assert(hovertank.files == [
	'VB.cvr', 'VHT-VBp.cvr', 'VHTp.cvr', 'VHTTp.cvr',
	'VHTA00.cvr', 'VHTTA00.cvr', 'VLIGHTS.cvr', 'VW05.cvr', 'vr00.cvr',
]);

const cruiser = sprite_render.get(
	'Cruiser', 'SynthmetalArmor', 'TroopTransport', 'FusionReactor'
);
test.assert(cruiser.type == 'cvr');
test.assert(cruiser.files == [
	'VB.cvr', 'VBP.cvr', 'VGMC.cvr', 'VGMCP.cvr', 'VCU.cvr',
	'VCUP.cvr', 'VCUW.cvr', 'VCUA00.cvr', 'VWNTT.cvr',
	'VCUA01.cvr', 'vr01.cvr',
]);

const needlejet = sprite_render.get(
	'Needlejet', 'NoArmor', 'PsiAttack', 'QuantumChamber'
);
test.assert(needlejet.type == 'cvr');
test.assert(needlejet.files == [
	'VRCP02.cvr', 'VB.cvr', 'VBP.cvr', 'VGMC.cvr', 'VGMCP.cvr',
	'VJTP.cvr', 'VJT00.cvr', 'VW12.cvr', 'vr02.cvr',
]);

const copter = sprite_render.get(
	'Copter', 'PlasmaSteelArmor', 'Laser', 'FissionPlant'
);
test.assert(copter.type == 'cvr');
test.assert(copter.files == [
	'VRCP00.cvr', 'VB.cvr', 'VBP.cvr', 'VGMC.cvr', 'VGMCP.cvr',
	'VCT.cvr', 'VCTP.cvr', 'VCTB.cvr', 'VCT00.cvr', 'VW01.cvr',
	'VA01.cvr', 'VCT01.cvr', 'vr00.cvr',
]);

const conventional_missile = sprite_render.get(
	'Missile', 'NoArmor', 'ConventionalPayload', 'FusionReactor'
);
test.assert(conventional_missile.type == 'cvr');
test.assert(conventional_missile.files == [
	'VM.cvr', 'VB.cvr', 'VBP.cvr', 'vpbr01.cvr',
]);
const planet_buster = sprite_render.get(
	'Missile', 'NoArmor', 'PlanetBuster', 'SingularityEngine'
);
test.assert(planet_buster.type == 'cvr');
test.assert(planet_buster.files == [
	'VW13.cvr', 'VB.cvr', 'VBP.cvr', 'vpbr03.cvr',
]);

const colony = sprite_render.get(
	'Infantry', 'NoArmor', 'ColonyModule', 'FissionPlant'
);
test.assert(colony.type == 'cvr');
test.assert(colony.files == ['Drop.cvr']);
test.assert(colony.fallback.x == 518 && colony.fallback.y == 235);

const artifact = sprite_render.get(
	'Infantry', 'NoArmor', 'AlienArtifact', 'FissionPlant'
);
test.assert(artifact.y == 312);

let threw = false;
try {
	sprite_render.get('MissingChassis', 'NoArmor', 'HandWeapons', 'FissionPlant');
} catch {
	Error: (e) => {
		threw = true;
	}
}
test.assert(threw);
