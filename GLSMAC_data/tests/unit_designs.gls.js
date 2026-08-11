const rules = #include('../default/game/unit_design_rules');

let known = {};
const player = {
	id: 3,
	has_technology: (id) => { return #is_defined(known[id]); },
};
let definitions = [];
const game = {
	get_um: () => {
		return {get_unit_defs: () => { return definitions; }};
	},
};

const selection = (chassis, weapon, armor, reactor, abilities) => {
	return {
		chassis: chassis,
		weapon: weapon,
		armor: armor,
		reactor: reactor,
		abilities: abilities,
	};
};

let scout = selection(
	'Infantry', 'HandWeapons', 'NoArmor', 'FissionPlant', []
);
let preview = rules.get_preview(game, player, scout);
test.assert(!#is_defined(preview.error));
test.assert(preview.name == 'Gun Infantry');
test.assert(preview.data.mineral_cost == 10);
test.assert(preview.data.owner_player_id == player.id);
test.assert(preview.data.movement_per_turn == 1);
test.assert(preview.data.offense == 1);
test.assert(preview.data.defense == 1);
test.assert(!preview.exists);

definitions = [{id: preview.id}];
test.assert(rules.get_preview(game, player, scout).exists);
definitions = [];

known.CentauriEcology = true;
known.AdvancedEcologicalEngineering = true;
const super_former = selection(
	'Infantry', 'TerraformingUnit', 'NoArmor', 'FissionPlant', ['SuperFormer']
);
preview = rules.get_preview(game, player, super_former);
test.assert(!#is_defined(preview.error));
test.assert(preview.name == 'Super Former');
test.assert(preview.data.can_terraform);
test.assert(preview.data.abilities == ['SuperFormer']);

const illegal_super_scout = selection(
	'Infantry', 'HandWeapons', 'NoArmor', 'FissionPlant', ['SuperFormer']
);
test.assert(#is_defined(rules.get_error(player, illegal_super_scout)));

known.DoctrineMobility = true;
known.GravitonTheory = true;
const antigrav_speeder = selection(
	'Speeder', 'HandWeapons', 'NoArmor', 'FissionPlant', ['AntigravStruts']
);
preview = rules.get_preview(game, player, antigrav_speeder);
test.assert(!#is_defined(preview.error));
test.assert(preview.data.movement_per_turn == 3);

known.CentauriPsi = true;
known.Eudaimonia = true;
const psi = selection(
	'Infantry', 'PsiAttack', 'PsiDefense', 'FissionPlant', []
);
preview = rules.get_preview(game, player, psi);
test.assert(!#is_defined(preview.error));
test.assert(preview.data.offense == 1);
test.assert(preview.data.defense == 1);

known.CentauriEmpathy = true;
known.MatterTransmission = true;
const two_abilities = selection(
	'Infantry', 'Laser', 'NoArmor', 'FissionPlant', ['BlinkDisplacer', 'EmpathSong']
);
known.AppliedPhysics = true;
test.assert(#is_defined(rules.get_error(player, two_abilities)));
known.NeuralGrafting = true;
preview = rules.get_preview(game, player, two_abilities);
test.assert(!#is_defined(preview.error));
test.assert(preview.data.abilities == ['EmpathSong', 'BlinkDisplacer']);
test.assert(
	preview.id == 'WorkshopP3_Infantry_Laser_NoArmor_EmpathSong_BlinkDisplacer_FissionPlant'
);

known.OrbitalSpaceflight = true;
const illegal_payload = selection(
	'Infantry', 'ConventionalPayload', 'NoArmor', 'FissionPlant', []
);
test.assert(#is_defined(rules.get_error(player, illegal_payload)));
const missile = selection(
	'Missile', 'ConventionalPayload', 'NoArmor', 'FissionPlant', []
);
preview = rules.get_preview(game, player, missile);
test.assert(!#is_defined(preview.error));
test.assert(preview.data.is_missile);
test.assert(preview.data.operational_range == 1);

known.DoctrineInitiative = true;
const amphibious = selection(
	'Infantry', 'Laser', 'NoArmor', 'FissionPlant', ['AmphibiousPods']
);
test.assert(!#is_defined(rules.get_error(player, amphibious)));
known.PlanetaryNetworks = true;
const amphibious_probe = selection(
	'Infantry', 'ProbeTeam', 'NoArmor', 'FissionPlant', ['AmphibiousPods']
);
test.assert(#is_defined(rules.get_error(player, amphibious_probe)));

test.assert(
	#is_defined(rules.get_error(player, selection(
		'Infantry', 'Laser', 'NoArmor', 'FissionPlant', ['EmpathSong', 'EmpathSong']
	)))
);
