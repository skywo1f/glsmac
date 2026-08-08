const generated = #include('generated');

const moralesets = [
	{
		id: 'STANDARD',
		data: [
			{name: 'Very Green'},
			{name: 'Green'},
			{name: 'Disciplined'},
			{name: 'Hardened'},
			{name: 'Veteran'},
			{name: 'Commando'},
			{name: 'Elite'},
		]
	},
	{
		id: 'NATIVE',
		data: [
			{name: 'Hatchling'},
			{name: 'Larval Mass'},
			{name: 'Pre-Boil'},
			{name: 'Boil'},
			{name: 'Mature Boil'},
			{name: 'Great Boil'},
			{name: 'Demon Boil'},
		]
	},
];

const native_lifeform = (id, name, mineral_cost, movement_type, movement_per_turn, base_y) => {
	return {
		id: id,
		data: {
			name: name,
			mineral_cost: mineral_cost,
			is_native: true,
			offense: 1,
			defense: 1,
			morale: 'NATIVE',
			type: 'static',
			movement_type: movement_type,
			movement_per_turn: movement_per_turn,
			render: {
				type: 'sprite',
				file: 'units.pcx',
				x: 2, y: base_y,
				w: 100, h: 75,
				cx: 53, cy: base_y + 51,
				morale_based_xshift: 102
			},
		},
	};
};

const conventional_unit = (
	id,
	name,
	mineral_cost,
	offense,
	defense,
	sprite_x,
	sprite_y,
	can_found_base,
	can_terraform,
	required_technology,
	movement_per_turn
) => {
	return {
		id: id,
		data: {
			name: name,
			mineral_cost: mineral_cost,
			is_native: false,
			offense: offense,
			defense: defense,
			can_found_base: can_found_base,
			can_terraform: can_terraform,
			required_technology: required_technology,
			morale: 'STANDARD',
			type: 'static',
			movement_type: 'land',
			movement_per_turn: movement_per_turn,
			render: {
				type: 'sprite',
				file: 'units.pcx',
				x: sprite_x, y: sprite_y,
				w: 100, h: 75,
				cx: sprite_x + 51, cy: sprite_y + 51,
			},
		},
	};
};

const units = [
	// Stock-sheet fallbacks keep these roles distinct until CVR composition is available.
	conventional_unit('ScoutPatrol', 'Scout Patrol', 10, 1, 1, 2, 156, false, false, '', 1),
	conventional_unit('ColonyPod', 'Colony Pod', 30, 0, 1, 2, 2, true, false, '', 1),
	conventional_unit('Former', 'Former', 20, 0, 1, 206, 156, false, true, 'CentauriEcology', 1),
	conventional_unit('ReconRover', 'Recon Rover', 20, 1, 1, 104, 156, false, false, 'DoctrineMobility', 2),
	conventional_unit('LaserInfantry', 'Laser Infantry', 20, 2, 1, 206, 156, false, false, 'AppliedPhysics', 1),
	conventional_unit('SynthmetalSentinels', 'Synthmetal Sentinels', 20, 1, 2, 2, 156, false, false, 'IndustrialBase', 1),
	native_lifeform('FungalTower', 'Fungal Tower', 0, 'immovable', 0, 79),
	native_lifeform('MindWorms', 'Mind Worms', 30, 'land', 1, 233),
	native_lifeform('SeaLurk', 'Sea Lurk', 40, 'water', 4, 310),
	native_lifeform('SporeLauncher', 'Spore Launcher', 50, 'land', 1, 387),
];

for (unit of generated.definitions) {
	units :+unit;
}

const result = {
	moralesets: moralesets,
	definitions: units,
	generated_count: #sizeof(generated.definitions),

	define: (game) => {

		for (moraleset of moralesets) {
			game.event('define_moraleset', moraleset);
		}

		for (unit of units) {
			game.event('define_unit', unit);
		}

	},
};

return result;
