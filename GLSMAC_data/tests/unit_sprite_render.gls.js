const sprite_render = #include('../default/units/sprite_render');

const scout = sprite_render.get('Infantry', 'NoArmor', 'HandWeapons');
test.assert(scout.x == 2 && scout.y == 2 && scout.cx == 53 && scout.cy == 53);

const rover = sprite_render.get('Speeder', 'NoArmor', 'HandWeapons');
test.assert(rover.x == 2 && rover.y == 79);

const armored_foil = sprite_render.get('Foil', 'PlasmaSteelArmor', 'Laser');
test.assert(armored_foil.x == 206 && armored_foil.y == 233);

const former = sprite_render.get('Infantry', 'NoArmor', 'TerraformingUnit');
test.assert(former.x == 206 && former.y == 2);

const probe = sprite_render.get('Speeder', 'NoArmor', 'ProbeTeam');
test.assert(probe.x == 614 && probe.y == 79);

const gravship = sprite_render.get('Gravship', 'StasisGenerator', 'SingularityLaser');
test.assert(gravship.x == 716 && gravship.y == 541);

let threw = false;
try {
	sprite_render.get('MissingChassis', 'NoArmor', 'HandWeapons');
} catch {
	Error: (e) => {
		threw = true;
	}
}
test.assert(threw);
