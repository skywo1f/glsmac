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
		'VGMC.cvr', 'VSP.cvr', 'vr00.cvr', 'VRCP00.cvr', 'Vw00.cvr'
	]
);
test.assert(rover.fallback.x == 518 && rover.fallback.y == 82);

const rover_without_reactor = sprite_render.get(
	'Speeder', 'NoArmor', 'HandWeapons', #undefined
);
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
		'VFL.cvr', 'vr01.cvr', 'VRCP01.cvr', 'VA01.cvr', 'VW01.cvr'
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
		'VGMC.cvr', 'VSP.cvr', 'vr00.cvr', 'VRCP00.cvr', 'Ptmod.cvr'
	]
);
test.assert(probe.fallback.x == 518 && probe.fallback.y == 158);

const gravship = sprite_render.get(
	'Gravship', 'StasisGenerator', 'SingularityLaser', 'SingularityEngine'
);
test.assert(gravship.x == 518 && gravship.y == 82);

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
