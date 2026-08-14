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
const ok_button = {
	text: '',
	on: (name, handler) => {},
};
let button_count = 0;
const frame = {
	button: (properties) => {
		button_count++;
		const button = button_count == 1 ? hurry_button : ok_button;
		button.text = properties.text;
		return button;
	},
};
let ui_class = null;
ui_class = {
	extend: (name) => { return ui_class; },
	set: (properties) => { return ui_class; },
};
const player = {id: 1};
const owner = {id: 1, energy_credits: 100};
const production = {id: 'ScoutPatrol'};
const base = {
	get_production: () => { return production; },
	get_owner: () => { return owner; },
};
const game = {
	get_player: () => { return player; },
	is_turn_complete: (player_id) => { return false; },
	get: (name) => {
		test.assert(name == 'f_economy_get_hurry_cost');
		return (target) => {
			test.assert(target == base);
			return 25;
		};
	},
	event: (name, data) => {
		emitted :+{name: name, base: data.base};
	},
};

module.init({
	body: {panel: (properties) => { return frame; }},
	ui: {class: (name) => { return ui_class; }},
	game: game,
	hide: () => {},
});
module.set({base: base});

test.assert(hurry_button.text == 'HURRY (25)');
test.assert(hurry_handler != null);
hurry_handler({});
hurry_handler({});
test.assert(#sizeof(emitted) == 1);
test.assert(emitted[0].name == 'hurry_base_production');
test.assert(hurry_button.text == 'HURRYING...');

owner.energy_credits = 20;
module.set({base: base});
test.assert(hurry_button.text == 'NEED 25 EC');
hurry_handler({});
test.assert(#sizeof(emitted) == 1);
