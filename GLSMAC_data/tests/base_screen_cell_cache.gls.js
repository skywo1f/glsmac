const base_screen = #include('../default/ui/parts/game/popup/base_screen');

let created_cells = [];
let clear_count = 0;
const cells = {
	clear: () => { clear_count++; },
	panel: (properties) => {
		const cell = {
			class: properties.class,
			left: properties.left,
			top: properties.top,
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
	columns: 0,
	rows: 0,
	capacity: 0,
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

base_screen.set_cells(
	100, 40, 5, 2, 1, 0, cells, 'test-cell', label,
	(turns) => { return #to_string(turns); },
	10, cache
);
test.assert(clear_count == 1);
test.assert(#sizeof(created_cells) == 10);
test.assert(created_cells[0].class == 'test-cell-full');
test.assert(created_cells[1].class == 'test-cell-empty');

base_screen.set_cells(
	100, 40, 5, 1, 1, 0, cells, 'test-cell', label,
	(turns) => { return #to_string(turns); },
	5, cache
);
test.assert(clear_count == 2);
test.assert(#sizeof(created_cells) == 15);
test.assert(#sizeof(cache.cells) == 5);
