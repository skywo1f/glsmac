const navigation = #include('../default/ui/parts/game/popup/base_screen/bottom_bar/middle_area');

const owner = {id: 1, get_faction: () => { return {id: 'GAIANS'}; }};
const other_owner = {id: 2, get_faction: () => { return {id: 'HIVE'}; }};
const make_base = (id, base_owner) => {
	return {
		id: id,
		get_owner: () => { return base_owner; },
	};
};
const first = make_base(3, owner);
const middle = make_base(9, owner);
const last = make_base(14, owner);
const foreign = make_base(11, other_owner);
let selected = null;
let render_reads = 0;
let class_updates = 0;
let ui_class = null;
ui_class = {
	extend: (name) => { return ui_class; },
	set: (properties) => { class_updates++; return ui_class; },
};

navigation.p = {
	game: {
		get_bm: () => {
			return {
				get_bases: () => { return [middle, foreign, last, first]; },
				get_pop_renders: (player) => {
					render_reads++;
					return {WORKER: ['worker-a', 'worker-b']};
				},
			};
		},
		select_base: (base) => { selected = base; },
	},
	ui: {class: (name) => { return ui_class; }},
};
navigation.renders_by_faction = {};

navigation.base = middle;
test.assert(navigation._get_relative_base(0 - 1) == first);
test.assert(navigation._get_relative_base(1) == last);
navigation._select_relative_base(1);
test.assert(selected == last);

navigation.base = first;
test.assert(navigation._get_relative_base(0 - 1) == last);

navigation.base = last;
test.assert(navigation._get_relative_base(1) == first);

navigation.base = null;
test.assert(navigation._get_relative_base(1) == null);

test.assert(#sizeof(navigation._get_pop_renders(owner).WORKER) == 2);
test.assert(#sizeof(navigation._get_pop_renders(owner).WORKER) == 2);
test.assert(render_reads == 1);
test.assert(class_updates == 2);
