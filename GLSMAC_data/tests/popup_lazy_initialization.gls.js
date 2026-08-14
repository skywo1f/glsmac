const popup = #include('../default/ui/parts/game/popup/popup');

let init_count = 0;
let set_value = 0;
let show_count = 0;
let menu_close_count = 0;
let sound_count = 0;
const element = {
	top: 10,
	show: () => { show_count++; },
	hide: () => {},
};
const data = {id: '', el: element, height: 20};
popup.popup_defs = {
	lazy: {
		init: (params) => {
			init_count++;
			return data;
		},
		set: (value) => { set_value = value; },
	},
};
popup.popups = {lazy: null};
popup.popup_params = {value: 1};
popup.popup_profile_callback = null;
popup.popup = null;
popup.popup_def = null;
popup.popup_cb = null;
popup.menu = {close_all: () => { menu_close_count++; }};
popup.sound_up = {play: () => { sound_count++; }};
popup.viewport_size = {height: 100};
popup.no_sliding = true;

const first = popup.ensure_initialized('lazy');
const second = popup.ensure_initialized('lazy');

test.assert(first == data);
test.assert(second == data);
test.assert(first.id == 'lazy');
test.assert(init_count == 1);

popup.set('lazy', 17);
test.assert(set_value == 17);
test.assert(init_count == 1);

popup.show('lazy');
test.assert(init_count == 1);
test.assert(menu_close_count == 1);
test.assert(sound_count == 1);
test.assert(show_count == 1);
test.assert(popup.is_shown());
