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
	{
		id: 'NetworkNode',
		data: {
			name: 'Network Node',
			mineral_cost: 80,
			nutrient_bonus: 0,
			mineral_bonus: 0,
			energy_bonus: 0,
			energy_maintenance: 1,
			required_technology: 'InformationNetworks',
		},
	},
	{
		id: 'RecreationCommons',
		data: {
			name: 'Recreation Commons',
			mineral_cost: 40,
			nutrient_bonus: 0,
			mineral_bonus: 0,
			energy_bonus: 0,
			energy_maintenance: 1,
			psych_bonus: 4,
			required_technology: 'SocialPsych',
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
