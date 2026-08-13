const faction = (name, resource, data) => {
	return {
		id: #uppercase(name),
		name: name,
		resource: resource,
		data: data,
	};
};

const factions = [
	faction('Gaians', 'gaians', {starting_technologies: ['CentauriEcology']}),
	faction('Hive', 'hive', {starting_technologies: ['DoctrineLoyalty']}),
	faction('University', 'univ', {starting_technologies: ['InformationNetworks']}),
	faction('Morganites', 'morgan', {starting_technologies: ['IndustrialBase']}),
	faction('Spartans', 'spartans', {starting_technologies: ['DoctrineMobility']}),
	faction('Believers', 'believe', {starting_technologies: ['SocialPsych']}),
	faction('Peacekeepers', 'peace', {starting_technologies: ['Biogenetics']}),
	// Planet is a serialized owner for independent native life, never a playable faction.
	faction('Planet', 'believe', {is_native: true, starting_technologies: []}),
];

return {
	definitions: factions,

	configure: (fm) => {
		for (f of factions) {
			fm.add(f.id, {
				name: f.name,
				colors: fm.import_colors(f.resource + '.pcx'),
				bases: {
					render: {
						type: 'sprite_grid',
						file: f.resource + '.pcx',
						grid_x: 1, grid_y: 1,
						cell_width: 100, cell_height: 75,
						cell_padding: 1,
					},
					names: fm.import_base_names(f.resource + '.txt'),
				},
			} + f.data);
		}
	},

};
