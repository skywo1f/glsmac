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
			required_technology: 'Biogenetics',
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
			research_multiplier: 0.5,
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
	{
		id: 'HologramTheatre',
		data: {
			name: 'Hologram Theatre',
			mineral_cost: 60,
			nutrient_bonus: 0,
			mineral_bonus: 0,
			energy_bonus: 0,
			energy_maintenance: 3,
			psych_bonus: 4,
			required_technology: 'PlanetaryNetworks',
		},
	},
	{
		id: 'PerimeterDefense',
		data: {
			name: 'Perimeter Defense',
			mineral_cost: 50,
			nutrient_bonus: 0,
			mineral_bonus: 0,
			energy_bonus: 0,
			energy_maintenance: 0,
			defense_multiplier: 2.0,
			required_technology: 'DoctrineLoyalty',
		},
	},
	{
		id: 'EnergyBank',
		data: {
			name: 'Energy Bank',
			mineral_cost: 80,
			nutrient_bonus: 0,
			mineral_bonus: 0,
			energy_bonus: 0,
			energy_maintenance: 1,
			economy_multiplier: 0.5,
			required_technology: 'IndustrialEconomics',
		},
	},
	{
		id: 'CommandCenter',
		data: {
			name: 'Command Center',
			mineral_cost: 40,
			nutrient_bonus: 0,
			mineral_bonus: 0,
			energy_bonus: 0,
			energy_maintenance: 1,
			unit_morale_bonus: 2,
			required_technology: 'DoctrineMobility',
		},
	},
	{
		id: 'BiologyLab',
		data: {
			name: 'Biology Lab',
			mineral_cost: 60,
			nutrient_bonus: 0,
			mineral_bonus: 0,
			energy_bonus: 0,
			energy_maintenance: 1,
			research_bonus: 2,
			required_technology: 'SecretsHumanBrain',
		},
	},
];

return {
	definitions: facilities,

	define: (game) => {
		for (facility of facilities) {
			game.event('define_base_facility', facility);
		}
	},
};
