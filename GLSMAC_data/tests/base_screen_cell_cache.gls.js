const base_screen = #include('../default/ui/parts/game/popup/base_screen');

let created_cells = [];
let clear_count = 0;
const cells = {
	clear: () => { clear_count++; },
	panel: (properties) => {
		let cell = null;
		cell = {
			class: properties.class,
			left: properties.left,
			top: properties.top,
			visible: true,
			show: () => { cell.visible = true; },
			hide: () => { cell.visible = false; },
		};
		created_cells :+cell;
		return cell;
	},
};
let cell_class = null;
cell_class = {
	set: (properties) => { return cell_class; },
};
base_screen.p = {
	ui: {
		class: (name) => { return cell_class; },
	},
};
const label = {text: ''};
const cache = {
	cells: [],
	classes: [],
	variants: [],
	columns: 0,
	rows: 0,
	capacity: 0,
	width: 0,
	height: 0,
};

base_screen.set_cells(
	100, 40, 5, 2, 3, 2, cells, 'test-cell', label,
	(turns) => { return #to_string(turns); },
	10, cache
);
test.assert(clear_count == 1);
test.assert(#sizeof(created_cells) == 10);
test.assert(created_cells[0].class == 'test-cell-full');
test.assert(created_cells[3].class == 'test-cell-pending');
test.assert(created_cells[5].class == 'test-cell-empty');
test.assert(cache.classes[0] == 'test-cell-full');
test.assert(cache.classes[3] == 'test-cell-pending');
test.assert(cache.width == 19);
test.assert(cache.height == 19);

base_screen.set_cells(
	100, 40, 5, 2, 4, 1, cells, 'test-cell', label,
	(turns) => { return #to_string(turns); },
	10, cache
);
test.assert(clear_count == 1);
test.assert(#sizeof(created_cells) == 11);
test.assert(created_cells[0].class == 'test-cell-full');
test.assert(!created_cells[3].visible);
test.assert(created_cells[10].class == 'test-cell-full');
test.assert(created_cells[10].visible);
test.assert(created_cells[4].class == 'test-cell-pending');
test.assert(cache.classes[0] == 'test-cell-full');
test.assert(cache.classes[3] == 'test-cell-full');
test.assert(cache.classes[4] == 'test-cell-pending');
test.assert(cache.classes[9] == 'test-cell-empty');

base_screen.set_cells(
	100, 40, 5, 2, 1, 0, cells, 'test-cell', label,
	(turns) => { return #to_string(turns); },
	10, cache
);
test.assert(clear_count == 1);
test.assert(#sizeof(created_cells) == 15);
test.assert(cache.cells[0].class == 'test-cell-full');
test.assert(cache.cells[1].class == 'test-cell-empty');

base_screen.set_cells(
	100, 40, 5, 2, 4, 1, cells, 'test-cell', label,
	(turns) => { return #to_string(turns); },
	10, cache
);
test.assert(clear_count == 1);
test.assert(#sizeof(created_cells) == 15);
test.assert(cache.cells[3].class == 'test-cell-full');
test.assert(cache.cells[3].visible);
test.assert(cache.cells[4].class == 'test-cell-pending');

base_screen.set_cells(
	100, 40, 5, 1, 1, 0, cells, 'test-cell', label,
	(turns) => { return #to_string(turns); },
	5, cache
);
test.assert(clear_count == 2);
test.assert(#sizeof(created_cells) == 20);
test.assert(#sizeof(cache.cells) == 5);
test.assert(#sizeof(cache.classes) == 5);
test.assert(#sizeof(cache.variants) == 5);
test.assert(cache.width == 19);
test.assert(cache.height == 39);
