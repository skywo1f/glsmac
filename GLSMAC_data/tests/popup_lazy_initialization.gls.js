const popup = #include('../default/ui/parts/game/popup/popup');

let init_count = 0;
let set_value = 0;
let show_count = 0;
let menu_close_count = 0;
let sound_count = 0;
let observe_count = 0;
let hide_count = 0;
let replace_count = 0;
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
		on_hide: () => { hide_count++; },
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
popup.sound_down = {play: () => {}};
popup.viewport_size = {height: 100};
popup.no_sliding = true;

popup.available_popups = ['lazy'];
popup.popup_defs.lazy.observe = (params) => {
	observe_count++;
	test.assert(params.value == 1);
};
popup.start_observing();
test.assert(observe_count == 1);

popup.hide('lazy');
test.assert(init_count == 0);

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

const replacement_data = {
	id: '',
	el: {
		top: 10,
		show: () => {},
		hide: () => {},
	},
	height: 20,
};
popup.popup_defs.replacement = {
	init: () => { return replacement_data; },
	on_hide: () => { hide_count++; },
};
popup.popups.replacement = null;
popup.show('replacement');
test.assert(hide_count == 1);

const specialized_data = {
	id: '',
	el: {
		top: 10,
		show: () => {},
		hide: () => {},
	},
	height: 20,
};
popup.popup_defs.specialized = {
	init: () => { return specialized_data; },
	on_hide: () => { hide_count++; },
	on_replace: () => { replace_count++; },
};
popup.popups.specialized = null;
popup.show('specialized');
test.assert(hide_count == 2);

popup.show('lazy');
test.assert(replace_count == 1);
test.assert(hide_count == 2);

let callback_count = 0;
popup.popup_result = true;
popup.show('replacement', (result) => { callback_count++; });
test.assert(popup.popup_result == null);
popup.hide('replacement');
test.assert(callback_count == 0);
