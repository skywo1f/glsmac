const manifest = #include('content/base_facilities');

const effects = {
	Headquarters: {energy_bonus: 1},
	ChildrenSCreche: {growth_rating_bonus: 2},
	RecyclingTanks: {nutrient_bonus: 1, mineral_bonus: 1, energy_bonus: 1},
	PerimeterDefense: {defense_multiplier: 2.0},
	TachyonField: {defense_multiplier: 2.0},
	RecreationCommons: {drone_modifier: -2},
	EnergyBank: {economy_multiplier: 0.5},
	NetworkNode: {research_multiplier: 0.5},
	BiologyLab: {research_bonus: 2, native_lifecycle_bonus: 1},
	HologramTheatre: {drone_modifier: -2, psych_multiplier: 0.5},
	ParadiseGarden: {talent_bonus: 2},
	TreeFarm: {economy_multiplier: 0.5, psych_multiplier: 0.5},
	HybridForest: {economy_multiplier: 0.5, psych_multiplier: 0.5},
	FusionLab: {economy_multiplier: 0.5, research_multiplier: 0.5},
	QuantumLab: {economy_multiplier: 0.5, research_multiplier: 0.5},
	ResearchHospital: {drone_modifier: -1, psych_multiplier: 0.25, research_multiplier: 0.5},
	Nanohospital: {drone_modifier: -1, psych_multiplier: 0.25, research_multiplier: 0.5},
	RoboticAssemblyPlant: {mineral_multiplier: 0.5},
	Nanoreplicator: {mineral_multiplier: 0.5},
	QuantumConverter: {mineral_multiplier: 0.5},
	GenejackFactory: {mineral_multiplier: 0.5, drone_modifier: 1},
	PunishmentSphere: {research_multiplier: -0.5, suppress_psych: true},
	HabComplex: {population_limit: 14},
	HabitationDome: {population_limit: 1000000, required_facility: 'HabComplex'},
	PressureDome: {nutrient_bonus: 1, mineral_bonus: 1, energy_bonus: 1},
	CommandCenter: {unit_morale_land_bonus: 2},
	NavalYard: {unit_morale_water_bonus: 2, water_defense_multiplier: 2.0},
	AerospaceComplex: {unit_morale_air_bonus: 2, air_defense_multiplier: 2.0},
	BioenhancementCenter: {unit_morale_bonus: 2, native_lifecycle_bonus: 1},
	CentauriPreserve: {native_lifecycle_bonus: 1},
	TempleOfPlanet: {native_lifecycle_bonus: 1},
};

const partial_effects = {
	Headquarters: true,
	ChildrenSCreche: true,
	NetworkNode: true,
	BiologyLab: true,
	TreeFarm: true,
	HybridForest: true,
	ResearchHospital: true,
	Nanohospital: true,
	GenejackFactory: true,
	PunishmentSphere: true,
	PressureDome: true,
	CommandCenter: true,
	NavalYard: true,
	AerospaceComplex: true,
	BioenhancementCenter: true,
	CentauriPreserve: true,
	TempleOfPlanet: true,
};

const project_effects = {
	TheSupercollider: {research_multiplier: 1.0},
	TheTheoryOfEverything: {research_multiplier: 1.0},
};

const facilities = [];
const coverage = {complete: 0, partial: 0, status: {}};
const project_coverage = {complete: 0, partial: 0, status: {}};
for (entry of manifest) {
	if (entry.kind == 'facility' && !#is_defined(effects[entry.id])) {
		continue;
	}
	const is_project = entry.kind == 'project';
	let data = {
		name: entry.name,
		mineral_cost: entry.mineral_cost,
		nutrient_bonus: 0,
		mineral_bonus: 0,
		energy_bonus: 0,
		energy_maintenance: entry.energy_maintenance,
		required_technology: entry.required_technology,
		is_project: is_project,
	};
	const implemented_effects = is_project ? project_effects[entry.id] : effects[entry.id];
	if (#is_defined(implemented_effects)) {
		for (key in implemented_effects) {
			data[key] = implemented_effects[key];
		}
	}
	facilities :+{id: entry.id, data: data};
	if (is_project) {
		const status = #is_defined(implemented_effects) ? 'complete' : 'partial';
		project_coverage.status[entry.id] = status;
		project_coverage[status] = project_coverage[status] + 1;
	} else {
		const status = #is_defined(partial_effects[entry.id]) ? 'partial' : 'complete';
		coverage.status[entry.id] = status;
		coverage[status] = coverage[status] + 1;
	}
}

return {
	definitions: facilities,
	manifest: manifest,
	coverage: coverage,
	project_coverage: project_coverage,

	define: (game) => {
		for (facility of facilities) {
			game.event('define_base_facility', facility);
		}
	},
};
