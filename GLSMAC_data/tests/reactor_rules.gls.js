const manifest = #include('../default/content/base_units');
const design_rules = #include('../default/units/design_rules');
const combat_rules = #include('../default/game/combat_rules');

const find = (entries, id) => {
	for (entry of entries) {
		if (entry.id == id) {
			return entry;
		}
	}
	throw Error('Missing test component: ' + id);
};

const infantry = find(manifest.chassis, 'Infantry');
const foil = find(manifest.chassis, 'Foil');
const cruiser = find(manifest.chassis, 'Cruiser');
const missile = find(manifest.chassis, 'Missile');
const hand_weapons = find(manifest.weapons, 'HandWeapons');
const laser = find(manifest.weapons, 'Laser');
const transport = find(manifest.weapons, 'TroopTransport');
const planet_buster = find(manifest.weapons, 'PlanetBuster');
const no_armor = find(manifest.armors, 'NoArmor');
const synthmetal = find(manifest.armors, 'SynthmetalArmor');
const fission = find(manifest.reactors, 'FissionPlant');
const fusion = find(manifest.reactors, 'FusionReactor');
const quantum = find(manifest.reactors, 'QuantumChamber');
const singularity = find(manifest.reactors, 'SingularityEngine');
const carrier = find(manifest.abilities, 'CarrierDeck');
const artillery = find(manifest.abilities, 'HeavyArtillery');
const aaa = find(manifest.abilities, 'AAATracking');
const trance = find(manifest.abilities, 'HypnoticTrance');

test.assert(design_rules.get_mineral_cost(
	infantry, hand_weapons, no_armor, [], fission
) == 10);
test.assert(design_rules.get_mineral_cost(
	infantry, laser, no_armor, [], fission
) == 20);
test.assert(design_rules.get_mineral_cost(
	infantry, laser, no_armor, [], fusion
) == 30);
test.assert(design_rules.get_mineral_cost(
	missile, planet_buster, no_armor, [], fission
) == 320);
test.assert(design_rules.get_mineral_cost(
	missile, planet_buster, no_armor, [], singularity
) == 320);
test.assert(design_rules.get_dynamic_ability_cost(
	artillery, laser.cost, no_armor.cost, infantry.cost
) == 0);
test.assert(design_rules.get_ability_cost_modifier(
	[trance, aaa], hand_weapons, synthmetal, infantry
) == 2);

test.assert(design_rules.get_cargo_capacity(
	foil, transport, [], fission
) == 2);
test.assert(design_rules.get_cargo_capacity(
	foil, transport, [], fusion
) == 4);
test.assert(design_rules.get_cargo_capacity(
	cruiser, transport, [carrier], quantum
) == 12);
test.assert(design_rules.get_cargo_capacity(
	cruiser, hand_weapons, [carrier], singularity
) == 0);

const make_unit = (reactor_power) => {
	return {
		get_def: () => { return {reactor_power: reactor_power}; },
	};
};
test.assert(combat_rules.get_reactor_power({}) == 1);
test.assert(combat_rules.get_reactor_power(make_unit(4)) == 4);
test.assert(combat_rules.get_damage(make_unit(1), 0.4) == 0.4);
test.assert(combat_rules.get_damage(make_unit(2), 0.4) == 0.2);
test.assert(combat_rules.get_damage(make_unit(4), 0.4) == 0.1);
