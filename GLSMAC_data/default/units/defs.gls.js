const moralesets = [
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

const units = [
	native_lifeform('FungalTower', 'Fungal Tower', 0, 'immovable', 0, 79),
	native_lifeform('MindWorms', 'Mind Worms', 30, 'land', 1, 233),
	native_lifeform('SeaLurk', 'Sea Lurk', 40, 'water', 4, 310),
	native_lifeform('SporeLauncher', 'Spore Launcher', 50, 'land', 1, 387),
];

const result = {
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
