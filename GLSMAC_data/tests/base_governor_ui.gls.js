const module = #include('../default/ui/parts/game/popup/base_screen/top_buttons');

let properties = {};
const owner = {id: 1};
const player = {id: 1};
const base = {
	id: 12,
	get_owner: () => { return owner; },
	has: (key) => { return #is_defined(properties[key]); },
	get: (key) => { return properties[key]; },
};
let turn_complete = false;
let emitted = [];
const game = {
	get_player: () => { return player; },
	get_bm: () => { return {get_bases: () => { return [base]; }}; },
	is_turn_complete: (id) => { return turn_complete; },
	event: (name, data) => { emitted :+{name: name, data: data}; },
};

let buttons = [];
const panel = {
	button: (properties) => {
		let handlers = {};
		const button = {
			text: #is_defined(properties.text) ? properties.text : '',
			active: false,
			on: (name, handler) => { handlers[name] = handler; },
			click: () => { return handlers.click({}); },
		};
		buttons :+button;
		return button;
	},
};
let ui_class = null;
ui_class = {
	extend: (name) => { return ui_class; },
	set: (properties) => { return ui_class; },
};

module.init({
	body: {panel: (properties) => { return panel; }},
	ui: {class: (name) => { return ui_class; }},
	game: game,
});
module.set({base: base});

test.assert(#sizeof(buttons) == 7);
test.assert(buttons[3].text == 'GOVERNOR OFF');
test.assert(buttons[5].active);
buttons[0].click();
test.assert(#sizeof(emitted) == 1);
test.assert(emitted[0].name == 'set_base_governor');
test.assert(emitted[0].data.base == base);
test.assert(emitted[0].data.enabled == true);
test.assert(emitted[0].data.priority == 'explore');

properties.governor_enabled = true;
properties.governor_priority = 'explore';
module.set({base: base});
test.assert(buttons[3].text == 'GOVERNOR ON');
test.assert(buttons[3].active);
test.assert(buttons[0].active);
buttons[4].click();
test.assert(emitted[1].data.enabled == true);
test.assert(emitted[1].data.priority == 'discover');
buttons[2].click();
test.assert(emitted[2].data.priority == 'conquer');
buttons[3].click();
test.assert(emitted[3].data.enabled == false);
test.assert(emitted[3].data.priority == 'explore');

turn_complete = true;
buttons[6].click();
test.assert(#sizeof(emitted) == 4);
turn_complete = false;
owner.id = 2;
buttons[1].click();
test.assert(#sizeof(emitted) == 4);
