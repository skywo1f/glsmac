return (i) => {
	const select_original_map = (filename) => {
		i.settings.global.map.type = 'mapfile';
		i.settings.global.map.filename = i.glsmac.get_original_map_path(filename);
		i.steps.select_difficulty_level(i);
	};
	const select_map_file = () => {
		let path_input = null;
		i.popup.show({
			title: 'Load Map File',
			width: 620,
			height: 100,
			generator: (body) => {
				body.text({
					class: 'popup-text',
					text: 'Map file:',
					align: 'left',
					top: 13,
					left: 15,
				});
				path_input = body.input({
					class: 'popup-input',
					top: 12,
					left: 115,
					width: 485,
					value: '',
				});
			},
			buttons: [
				{
					style: {
						text: 'OK',
						align: 'left',
						is_ok: true,
					},
					onclick: (e) => {
						let path = '';
						try {
							path = i.glsmac.get_map_file_path(path_input.value);
						} catch {
						:
							(e) => {
								i.popup.error(e.reason);
							}
						}
						if (path == '') {
							return true;
						}
						i.settings.global.map.type = 'mapfile';
						i.settings.global.map.filename = path;
						i.popup.hide();
						i.steps.select_difficulty_level(i);
						return true;
					},
				},
				{
					style: {
						text: 'Cancel',
						align: 'right',
						is_cancel: true,
					},
					onclick: (e) => {
						i.popup.back();
						return true;
					},
				},
			],
		});
	};
	i.sliding.show({
		entries: [
			['Make Random Map', () => {
				i.settings.global.map.type = 'random';
				i.randomize_map();
				i.steps.select_mapsize(i);
			}],
			['Customize Random Map', () => {
				i.settings.global.map.type = 'custom';
				i.steps.select_mapsize(i);
			}],
			['The Map of Planet', () => {
				select_original_map('planet.MP');
			}],
			['Huge Map of Planet', () => {
				select_original_map('planetx.MP');
			}],
			['Load Map File', () => {
				select_map_file();
			}],
		]
	});
};
