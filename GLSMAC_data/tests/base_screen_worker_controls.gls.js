const resource = #include('../default/ui/parts/game/popup/base_screen/middle_area/resource');

let emitted = [];
const worker = {
	get_type: () => { return 'WORKER'; },
	get: (name) => { return name == 'worked_tile' ? null : #undefined; },
};
const specialist = {
	get_type: () => { return 'DOCTOR'; },
	get: (name) => { return name == 'worked_tile' ? null : #undefined; },
};
const base = {
	get_pops: () => { return [worker]; },
	get_worked_tiles: () => { return []; },
};
const worked_tile = {id: 'worked'};
const open_tile = {id: 'open'};
const worst_tile = {
	get: (name) => { return name == 'working_pop' ? worker : #undefined; },
};
resource.p = {
	game: {
		get: (name) => {
			if (name == 'f_base_find_best_or_worst_tiles') {
				return (target_base, tiles, count, direction) => { return [worst_tile]; };
			}
			if (name == 'f_base_get_assignable_worker_tiles') {
				return (target_base) => { return [open_tile]; };
			}
			return #undefined;
		},
		event: (name, data) => {
			emitted :+{
				name: name,
				tile_id: data.tile.id,
				pop_type: #is_defined(data.pop) ? data.pop.get_type() : '',
			};
		},
	},
};
resource.click_context = {base: base, center: {id: 'center'}};

resource._handle_tile({tile: worked_tile, is_worked: true});
test.assert(#sizeof(emitted) == 1);
test.assert(emitted[0].name == 'unwork_base_tile');
test.assert(emitted[0].tile_id == 'worked');

resource._handle_tile({tile: open_tile, is_worked: false});
test.assert(#sizeof(emitted) == 2);
test.assert(emitted[1].name == 'work_base_tile');
test.assert(emitted[1].tile_id == 'open');
test.assert(emitted[1].pop_type == 'WORKER');

emitted = [];
const specialist_base = {
	get_pops: () => { return [specialist]; },
	get_worked_tiles: () => { return []; },
};
resource.click_context = {base: specialist_base, center: {id: 'center'}};
resource._handle_tile({tile: open_tile, is_worked: false});
test.assert(#sizeof(emitted) == 1);
test.assert(emitted[0].name == 'work_base_tile');
test.assert(emitted[0].pop_type == 'DOCTOR');
