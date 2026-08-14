const bottom_bar = #include('../default/ui/parts/game/popup/base_screen/bottom_bar');

let set_checks = 0;
let queue_checks = 0;
let queue = [];
let facilities = [];
let project_base = null;
const owner = {id: 1};
const tile = {
	is_water: false,
	get_surrounding_tiles: () => { return [{is_water: true}]; },
};
const base = {
	id: 7,
	get_tile: () => { return tile; },
	get_facilities: () => { return facilities; },
	get_production_queue: () => { return queue; },
	can_set_production: (kind, id) => {
		set_checks++;
		return id != 'BLOCKED';
	},
	can_queue_production: (kind, id) => {
		queue_checks++;
		return id != 'BLOCKED';
	},
};
const definitions = [
	{id: 'SCOUT', production_kind: 'unit', is_project: false},
	{id: 'BLOCKED', production_kind: 'facility', is_project: false},
	{id: 'PROJECT', production_kind: 'project', is_project: true},
];
bottom_bar.p = {
	game: {
		get_bm: () => {
			return {get_project_base: (id) => { return project_base; }};
		},
	},
};
bottom_bar.catalog_key = 'owner-tech-state';
bottom_bar.candidates_key = '';
bottom_bar.candidates = {set: [], queue: []};

let candidates = bottom_bar.get_candidates(base, definitions);
test.assert(#sizeof(candidates.set) == 2);
test.assert(#sizeof(candidates.queue) == 2);
test.assert(set_checks == 3);
test.assert(queue_checks == 3);

candidates = bottom_bar.get_candidates(base, definitions);
test.assert(set_checks == 3);
test.assert(queue_checks == 3);

project_base = #undefined;
bottom_bar.get_candidates(base, definitions);
test.assert(set_checks == 3);
test.assert(queue_checks == 3);

queue = [{id: 'SCOUT', production_kind: 'unit'}];
bottom_bar.get_candidates(base, definitions);
test.assert(set_checks == 6);
test.assert(queue_checks == 6);

facilities = [{id: 'RecyclingTanks'}];
bottom_bar.get_candidates(base, definitions);
test.assert(set_checks == 9);
test.assert(queue_checks == 9);

project_base = {id: 12, get_owner: () => { return owner; }};
bottom_bar.get_candidates(base, definitions);
test.assert(set_checks == 12);
test.assert(queue_checks == 12);
