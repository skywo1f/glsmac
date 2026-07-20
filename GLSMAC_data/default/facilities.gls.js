const facilities = [
	{
		id: 'RecyclingTanks',
		data: {
			name: 'Recycling Tanks',
			mineral_cost: 40,
			nutrient_bonus: 1,
			mineral_bonus: 1,
			energy_bonus: 1,
			energy_maintenance: 0,
		},
	},
];

return {
	define: (game) => {
		for (facility of facilities) {
			game.event('define_base_facility', facility);
		}
	},
};
