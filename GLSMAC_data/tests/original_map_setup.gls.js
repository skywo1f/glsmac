const start_game = #include('../default/ui/parts/mainmenu/steps/start_game');

let menu = null;
let map_size_steps = 0;
let difficulty_steps = 0;
let requested_maps = [];
let popup_data = null;
let popup_hidden = 0;
let popup_back = 0;
let popup_errors = [];
let path_input = null;
const settings = {
	global: {
		map: {
			type: '',
			filename: '',
		},
	},
};
const i = {
	glsmac: {
		get_original_map_path: (filename) => {
			requested_maps :+filename;
			return 'C:/SMAC/maps/' + filename;
		},
		get_map_file_path: (filename) => {
			if (filename == 'bad') {
				throw MapFileError('Map file not found: bad');
			}
			return 'C:/Maps/' + filename;
		},
	},
	settings: settings,
	randomize_map: () => {},
	sliding: {show: (data) => { menu = data; }},
	popup: {
		show: (data) => {
			popup_data = data;
			data.generator({
				text: (style) => {},
				input: (style) => {
					path_input = {value: style.value};
					return path_input;
				},
			});
		},
		hide: () => { popup_hidden++; },
		back: () => { popup_back++; },
		error: (message) => { popup_errors :+message; },
	},
	steps: {
		select_mapsize: () => { map_size_steps++; },
		select_difficulty_level: () => { difficulty_steps++; },
	},
};

start_game(i);
test.assert(#sizeof(menu.entries) == 5);
menu.entries[0][1]();
test.assert(i.settings.global.map.type == 'random');
menu.entries[1][1]();
test.assert(i.settings.global.map.type == 'custom');
test.assert(map_size_steps == 2);

menu.entries[2][1]();
test.assert(i.settings.global.map.type == 'mapfile');
test.assert(i.settings.global.map.filename == 'C:/SMAC/maps/planet.MP');
menu.entries[3][1]();
test.assert(i.settings.global.map.filename == 'C:/SMAC/maps/planetx.MP');
test.assert(requested_maps == ['planet.MP', 'planetx.MP']);
test.assert(difficulty_steps == 2);

menu.entries[4][1]();
test.assert(popup_data.title == 'Load Map File');
path_input.value = 'bad';
popup_data.buttons[0].onclick({});
test.assert(#sizeof(popup_errors) == 1);
test.assert(popup_errors[0] == 'Map file not found: bad');
test.assert(difficulty_steps == 2);

path_input.value = 'custom.gsm';
popup_data.buttons[0].onclick({});
test.assert(i.settings.global.map.filename == 'C:/Maps/custom.gsm');
test.assert(popup_hidden == 1);
test.assert(difficulty_steps == 3);

menu.entries[4][1]();
popup_data.buttons[1].onclick({});
test.assert(popup_back == 1);
