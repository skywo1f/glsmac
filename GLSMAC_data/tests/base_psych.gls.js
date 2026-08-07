const define_bases = #include('../default/game/bases');

const callbacks = {};
const values = {};
let psych_energy = 2;
values.f_economy_get_base_psych = (game, base) => { return psych_energy; };

const game = {
	get_bm: () => {
		return {
			on: (name, callback) => {},
			get_bases: () => { return []; },
		};
	},
	get_tm: () => {
		return {
			get_map_width: () => { return 20; },
			get_map_height: () => { return 10; },
		};
	},
	event: (name, data) => {},
	on: (name, callback) => {
		callbacks[name] = callback;
	},
	set: (key, value) => {
		values[key] = value;
	},
	get: (key) => {
		return values[key];
	},
	is_master: () => { return true; },
};

define_bases(game);
callbacks.start({});

const population_base = {
	get_pops: () => { return [1, 2, 3, 4, 5, 6]; },
};
test.assert(values.f_base_get_stable_worker_count(population_base, 0) == 4);
test.assert(values.f_base_get_stable_worker_count(population_base, 2) == 5);
test.assert(values.f_base_get_stable_worker_count(population_base, 10) == 6);

const make_pop = (initial_type, worked) => {
	let type = initial_type;
	return {
		has: (key) => { return key == 'worked_tile' && worked; },
		get_type: () => { return type; },
		set_type: (value) => { type = value; },
	};
};

const laborers = [
	make_pop('WORKER', true),
	make_pop('WORKER', true),
	make_pop('WORKER', true),
	make_pop('WORKER', true),
	make_pop('WORKER', true),
	make_pop('WORKER', true),
];
const doctor = make_pop('DOCTOR', false);
let pops = laborers + [doctor];
const base = {
	get_pops: () => { return pops; },
	get_intake: () => { return {NUTRIENTS: 14, MINERALS: 10, ENERGY: 10}; },
	get_consumption: () => { return {NUTRIENTS: 14, MINERALS: 2, ENERGY: 0}; },
};

values.f_base_process_psych(game, base, psych_energy);
let state = values.f_base_get_psych(base);
test.assert(state.talents == 0);
test.assert(state.workers == 5);
test.assert(state.drones == 1);
test.assert(state.specialists == 1);
test.assert(state.psych == 2);
test.assert(state.is_rioting == true);
test.assert(values.f_base_get_pending_production(base) == 0);

psych_energy = 10;
values.f_base_process_psych(game, base, psych_energy);
state = values.f_base_get_psych(base);
test.assert(state.talents == 3);
test.assert(state.workers == 3);
test.assert(state.drones == 0);
test.assert(state.is_rioting == false);
test.assert(values.f_base_get_pending_production(base) == 8);

psych_energy = 0;
doctor.set_type('TECHNICIAN');
let previous = [];
for (pop of pops) {
	previous :+pop.get_type();
}
values.f_base_process_psych(game, base, psych_energy);
state = values.f_base_get_psych(base);
test.assert(state.talents == 0);
test.assert(state.workers == 3);
test.assert(state.drones == 3);
test.assert(state.is_rioting == true);
test.assert(previous == ['TALENT', 'TALENT', 'TALENT', 'WORKER', 'WORKER', 'WORKER', 'TECHNICIAN']);
