const factions = [
	['Gaians', 'gaians', {starting_technologies: ['CentauriEcology']}],
	['Hive', 'hive', {}],
	['University', 'univ', {}],
	['Morganites', 'morgan', {}],
	['Spartans', 'spartans', {}],
	['Believers', 'believe', {}],
	['Peacekeepers', 'peace', {}],
	['Consciousness', 'cyborg', {}],
	['Pirates', 'pirates', {is_naval: true}],
	['Drones', 'drone', {}],
	['Angels', 'angels', {}],
	['Planetcult', 'fungboy', {starting_technologies: ['CentauriEcology']}],
	['Caretakers', 'caretake', {is_progenitor: true, starting_technologies: ['CentauriEcology']}],
	['Usurpers', 'usurper', {is_progenitor: true, starting_technologies: ['CentauriEcology']}],
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
