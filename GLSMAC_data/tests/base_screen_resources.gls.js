const resources = #include('../default/ui/parts/game/popup/base_screen/resources');

let surfaces = [];
let clear_count = 0;

const make_label = (properties) => {
	return {text: #is_defined(properties.text) ? properties.text : ''};
};
const make_container = () => {
	return {
		panel: (properties) => { return make_container(); },
		area: (properties) => { return make_container(); },
		text: (properties) => { return make_label(properties); },
		surface: (properties) => {
			surfaces :+properties;
			return make_container();
		},
		clear: () => { clear_count++; },
	};
};
let ui_class = null;
ui_class = {
	extend: (name) => { return ui_class; },
	set: (properties) => { return ui_class; },
};

resources.init({
	body: make_container(),
	ui: {class: (name) => { return ui_class; }},
});
resources.set({
	nutrients: {profit: 2, loss: 1},
	minerals: {profit: 2, loss: 2},
	energy: {profit: 5, loss: 2},
	energy_inefficiency: {efficiency: 0, inefficiency: 0, distance: 0},
});

test.assert(clear_count == 1);
test.assert(#sizeof(surfaces) == 9);
test.assert(surfaces[0].class == 'base-screen-resources-cell-nutrients-loss');
test.assert(surfaces[0].left == 0);
test.assert(surfaces[1].class == 'base-screen-resources-cell-nutrients-profit');
test.assert(surfaces[1].left == 285);
test.assert(surfaces[2].class == 'base-screen-resources-cell-minerals-loss');
test.assert(surfaces[3].left == 5);
test.assert(surfaces[4].class == 'base-screen-resources-cell-energy-loss');
test.assert(surfaces[5].left == 5);
test.assert(surfaces[6].class == 'base-screen-resources-cell-energy-profit');
test.assert(surfaces[6].left == 275);
test.assert(surfaces[7].left == 280);
test.assert(surfaces[8].left == 285);

resources.set({
	nutrients: {profit: 0, loss: 0},
	minerals: {profit: 0, loss: 0},
	energy: {profit: 0, loss: 0},
	energy_inefficiency: {efficiency: 0, inefficiency: 0, distance: 0},
});
test.assert(clear_count == 2);
test.assert(#sizeof(surfaces) == 9);
