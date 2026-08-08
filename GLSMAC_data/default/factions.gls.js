const factions = [
	['Gaians', 'gaians', {starting_technologies: ['CentauriEcology']}],
	['Hive', 'hive', {}],
	['University', 'univ', {starting_technologies: ['InformationNetworks']}],
	['Morganites', 'morgan', {starting_technologies: ['IndustrialBase']}],
	['Spartans', 'spartans', {starting_technologies: ['DoctrineMobility']}],
	['Believers', 'believe', {starting_technologies: ['SocialPsych']}],
	['Peacekeepers', 'peace', {}],
	['Consciousness', 'cyborg', {starting_technologies: ['AppliedPhysics', 'InformationNetworks']}],
	['Pirates', 'pirates', {is_naval: true, starting_technologies: ['DoctrineMobility']}],
	['Drones', 'drone', {starting_technologies: ['IndustrialBase']}],
	['Angels', 'angels', {starting_technologies: ['InformationNetworks']}],
	['Planetcult', 'fungboy', {starting_technologies: ['CentauriEcology', 'SocialPsych']}],
	['Caretakers', 'caretake', {is_progenitor: true, starting_technologies: ['CentauriEcology', 'InformationNetworks']}],
	['Usurpers', 'usurper', {is_progenitor: true, starting_technologies: ['AppliedPhysics', 'CentauriEcology']}],
];

return {

	configure: (fm) => {
		for (f of factions) {
			fm.add(#uppercase(f[0]), {
				name: f[0],
				colors: fm.import_colors(f[1] + '.pcx'),
				bases: {
					render: {
						type: 'sprite_grid',
						file: f[1] + '.pcx',
						grid_x: 1, grid_y: 1,
						cell_width: 100, cell_height: 75,
						cell_padding: 1,
					},
					names: fm.import_base_names(f[1] + '.txt'),
				},
			} + f[2]);
		}
	},

};
