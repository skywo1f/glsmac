const module = #include('../default/ui/parts/game/popup/base_screen/buttons');

let hurry_handler = null;
let emitted = [];

const hurry_button = {
	text: '',
	on: (name, handler) => {
		if (name == 'click') {
			hurry_handler = handler;
		}
	},
};
let ok_handler = null;
const ok_button = {
	text: '',
	on: (name, handler) => {
		if (name == 'click') {
			ok_handler = handler;
		}
	},
};
let workshop_handler = null;
const workshop_button = {
	text: '',
	on: (name, handler) => {
		if (name == 'click') {
			workshop_handler = handler;
		}
	},
};
let button_count = 0;
let production_handler = null;
const production_select = {
	items: [],
	value: '',
	readonly: true,
	on: (name, handler) => {
		if (name == 'select') {
			production_handler = handler;
		}
	},
};
const frame = {
	button: (properties) => {
		button_count++;
		const button = button_count == 1
			? hurry_button
			: (button_count == 2 ? workshop_button : ok_button);
		button.text = properties.text;
		return button;
	},
	select: (properties) => { return production_select; },
};
let ui_class = null;
ui_class = {
	extend: (name) => { return ui_class; },
	set: (properties) => { return ui_class; },
};
const player = {id: 1};
const owner = {id: 1, energy_credits: 100};
const production = {production_kind: 'unit', id: 'ScoutPatrol'};
const base = {
	id: 9,
	get_production: () => { return production; },
	get_owner: () => { return owner; },
};
const live_base = {
	id: base.id,
	get_production: () => { return production; },
	get_owner: () => { return owner; },
};
let popup_set = null;
let popup_shown = '';
let hidden = false;
const game = {
	get_player: () => { return player; },
	get_bm: () => { return {get_bases: () => { return [live_base]; }}; },
	is_turn_complete: (player_id) => { return false; },
	get: (name) => {
		test.assert(name == 'f_economy_get_hurry_cost');
		return (target) => {
			test.assert(target == live_base);
			return 25;
		};
	},
	event: (name, data) => {
		emitted :+{
			name: name,
			kind: #is_defined(data.kind) ? data.kind : '',
			id: #is_defined(data.id) ? data.id : '',
			base: data.base,
		};
	},
};

module.init({
	body: {panel: (properties) => { return frame; }},
	ui: {class: (name) => { return ui_class; }},
	game: game,
	modules: {
		popup: {
			set: (name, data) => { popup_set = {name: name, data: data}; },
			show: (name) => { popup_shown = name; },
		},
	},
	hide: () => { hidden = true; },
});
const former = {
	production_kind: 'unit',
	id: 'Former',
	name: 'Former',
};
module.set({
	base: base,
	production: {production_kind: 'unit', id: 'ScoutPatrol'},
	production_candidates: [former],
});

test.assert(hurry_button.text == 'HURRY (25)');
test.assert(hurry_handler != null);
test.assert(workshop_handler != null);
test.assert(ok_handler != null);
test.assert(production_handler != null);
test.assert(production_select.items == [['unit:Former', 'CHANGE PRODUCTION: Former']]);
production_handler({value: 'unit:Former'});
test.assert(emitted[0].name == 'set_base_production');
test.assert(emitted[0].kind == 'unit');
test.assert(emitted[0].id == 'Former');
test.assert(emitted[0].base == live_base);
workshop_handler({});
test.assert(popup_set.name == 'unit_workshop');
test.assert(popup_set.data.base == live_base);
test.assert(popup_shown == 'unit_workshop');
ok_handler({});
test.assert(hidden);
hurry_handler({});
hurry_handler({});
test.assert(#sizeof(emitted) == 2);
test.assert(emitted[1].name == 'hurry_base_production');
test.assert(hurry_button.text == 'HURRYING...');

owner.energy_credits = 20;
module.set({base: base, production: production, production_candidates: [former]});
test.assert(hurry_button.text == 'NEED 25 EC');
hurry_handler({});
test.assert(#sizeof(emitted) == 2);
