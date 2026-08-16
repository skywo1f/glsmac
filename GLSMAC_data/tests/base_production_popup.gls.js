const popup = #include('../default/ui/parts/game/popup/base_production');

let candidate_buttons = [];
let cancel_handler = null;
let removed_lists = 0;
const make_button = (properties) => {
	let click_handler = null;
	return {
		text: properties.text,
		on: (name, handler) => {
			if (name == 'click') {
				click_handler = handler;
			}
		},
		click: () => { return click_handler({}); },
	};
};
const body = {
	listview: (properties) => {
		candidate_buttons = [];
		return {
			button: (button_properties) => {
				const button = make_button(button_properties);
				candidate_buttons :+button;
				return button;
			},
			text: (text_properties) => {},
			remove: () => { removed_lists++; },
		};
	},
	button: (properties) => {
		const button = make_button(properties);
		button.on('click', (e) => {});
		return {
			on: (name, handler) => {
				if (name == 'click') {
					cancel_handler = handler;
				}
			},
		};
	},
};

let emitted = [];
let popup_set = null;
let popup_shown = '';
let hidden = false;
const base = {id: 7};
const module_params = {
	game: {
		get_bm: () => { return {get_bases: () => { return [base]; }}; },
		event: (name, data) => {
			emitted :+{
				name: name,
				base_id: data.base.id,
				kind: data.kind,
				id: data.id,
			};
		},
	},
	modules: {
		popup: {
			set: (name, data) => {
				popup_set = {name: name, base_id: data.base.id};
			},
			show: (name) => { popup_shown = name; },
		},
	},
	hide: () => { hidden = true; },
	create: (title, width, height, generator) => {
		generator(body, (result) => {});
		return {};
	},
};

popup.init(module_params);
const candidates = [
	{production_kind: 'unit', id: 'Former', name: 'Former', mineral_cost: 20},
	{
		production_kind: 'project',
		id: 'TheWeatherParadigm',
		name: 'The Weather Paradigm',
		mineral_cost: 200,
	},
];
popup.set({base: base, candidates: candidates});
popup.on_show();

test.assert(popup.available_count == 2);
test.assert(#sizeof(candidate_buttons) == 2);
test.assert(candidate_buttons[0].text == 'UNIT: Former (20 minerals)');
test.assert(candidate_buttons[1].text == 'SECRET PROJECT: The Weather Paradigm (200 minerals)');
candidate_buttons[0].click();
test.assert(#sizeof(emitted) == 1);
test.assert(emitted[0].name == 'set_base_production');
test.assert(emitted[0].base_id == base.id);
test.assert(emitted[0].kind == 'unit');
test.assert(emitted[0].id == 'Former');
test.assert(popup_set.name == 'base_screen' && popup_set.base_id == base.id);
test.assert(popup_shown == 'base_screen');

popup_set = null;
popup_shown = '';
cancel_handler({});
test.assert(popup_set.name == 'base_screen' && popup_set.base_id == base.id);
test.assert(popup_shown == 'base_screen');
test.assert(!hidden);
test.assert(removed_lists == 1);

popup.on_hide();
test.assert(popup.available_count == 0);
