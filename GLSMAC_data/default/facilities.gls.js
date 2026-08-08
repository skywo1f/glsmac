const manifest = #include('content/base_facilities');

const effects = {
	Headquarters: {energy_bonus: 1},
	RecyclingTanks: {nutrient_bonus: 1, mineral_bonus: 1, energy_bonus: 1},
	PerimeterDefense: {defense_multiplier: 2.0},
	TachyonField: {defense_multiplier: 2.0},
	RecreationCommons: {psych_bonus: 4},
	EnergyBank: {economy_multiplier: 0.5},
	NetworkNode: {research_multiplier: 0.5},
	BiologyLab: {research_bonus: 2},
	HologramTheatre: {psych_bonus: 4, psych_multiplier: 0.5},
	ParadiseGarden: {psych_bonus: 4},
	TreeFarm: {economy_multiplier: 0.5, psych_multiplier: 0.5},
	HybridForest: {economy_multiplier: 0.5, psych_multiplier: 0.5},
	FusionLab: {economy_multiplier: 0.5, research_multiplier: 0.5},
	QuantumLab: {economy_multiplier: 0.5, research_multiplier: 0.5},
	ResearchHospital: {psych_bonus: 2, psych_multiplier: 0.25, research_multiplier: 0.5},
	Nanohospital: {psych_bonus: 2, psych_multiplier: 0.25, research_multiplier: 0.5},
	RoboticAssemblyPlant: {mineral_multiplier: 0.5},
	Nanoreplicator: {mineral_multiplier: 0.5},
	QuantumConverter: {mineral_multiplier: 0.5},
	PressureDome: {nutrient_bonus: 1, mineral_bonus: 1, energy_bonus: 1},
	CommandCenter: {unit_morale_bonus: 2},
	BioenhancementCenter: {unit_morale_bonus: 2},
};

const partial_effects = {
	Headquarters: true,
	RecreationCommons: true,
	NetworkNode: true,
	BiologyLab: true,
	HologramTheatre: true,
	ParadiseGarden: true,
	TreeFarm: true,
	HybridForest: true,
	ResearchHospital: true,
	Nanohospital: true,
	PressureDome: true,
	CommandCenter: true,
	BioenhancementCenter: true,
};

const facilities = [];
const coverage = {complete: 0, partial: 0, status: {}};
for (entry of manifest) {
	if (entry.kind != 'facility' || !#is_defined(effects[entry.id])) {
		continue;
	}
	let data = {
		name: entry.name,
		mineral_cost: entry.mineral_cost,
		nutrient_bonus: 0,
		mineral_bonus: 0,
		energy_bonus: 0,
		energy_maintenance: entry.energy_maintenance,
		required_technology: entry.required_technology,
	};
	for (key in effects[entry.id]) {
		data[key] = effects[entry.id][key];
	}
	facilities :+{id: entry.id, data: data};
	const status = #is_defined(partial_effects[entry.id]) ? 'partial' : 'complete';
	coverage.status[entry.id] = status;
	coverage[status] = coverage[status] + 1;
}

return {
	definitions: facilities,
	manifest: manifest,
	coverage: coverage,

	define: (game) => {
		for (facility of facilities) {
			game.event('define_base_facility', facility);
		}
	},
};
