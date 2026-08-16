const sprite_render = #include('../default/units/sprite_render');

const scout = sprite_render.get('Infantry', 'NoArmor', 'HandWeapons');
test.assert(scout.type == 'cvr');
test.assert(scout.files == ['VI.cvr']);
test.assert(scout.w == 100 && scout.h == 75 && scout.cx == 50 && scout.cy == 52);
test.assert(scout.fallback.file == 'newicons.pcx');
test.assert(
	scout.fallback.x == 518 && scout.fallback.y == 82 &&
	scout.fallback.cx == 558 && scout.fallback.cy == 117
);

const rover = sprite_render.get('Speeder', 'NoArmor', 'HandWeapons');
test.assert(rover.type == 'sprite');
test.assert(rover.x == 518 && rover.y == 82);

const armored_foil = sprite_render.get('Foil', 'PlasmaSteelArmor', 'Laser');
test.assert(armored_foil.x == 518 && armored_foil.y == 82);

const former = sprite_render.get('Infantry', 'NoArmor', 'TerraformingUnit');
test.assert(former.x == 518 && former.y == 158);

const probe = sprite_render.get('Speeder', 'NoArmor', 'ProbeTeam');
test.assert(probe.x == 518 && probe.y == 158);

const gravship = sprite_render.get('Gravship', 'StasisGenerator', 'SingularityLaser');
test.assert(gravship.x == 518 && gravship.y == 82);

const colony = sprite_render.get('Infantry', 'NoArmor', 'ColonyModule');
test.assert(colony.y == 235);

const artifact = sprite_render.get('Infantry', 'NoArmor', 'AlienArtifact');
test.assert(artifact.y == 312);

let threw = false;
try {
	sprite_render.get('MissingChassis', 'NoArmor', 'HandWeapons');
} catch {
	Error: (e) => {
		threw = true;
	}
}
test.assert(threw);
