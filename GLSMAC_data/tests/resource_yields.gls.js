const resources = #include('../default/resources');
const define_bases = #include('../default/game/bases');

let resource_callback = null;
const tm = {
	on: (name, callback) => {
		test.assert(name == 'get_tile_resources');
		resource_callback = callback;
	},
};
resources.configure({get_tm: () => { return tm; }});

const make_tile = (fungus) => {
	return {
		is_land: true,
		moisture: 2,
		rockiness: 1,
		features: {
			xenofungus: fungus,
			jungle: false,
			river: false,
		},
		terraforming: {
			farm: false,
			mine: false,
			solar: false,
		},
		bonuses: {
			nutrient: false,
			minerals: false,
			energy: false,
		},
		get_base: () => { return null; },
	};
};

let has_ecology = false;
const player = {
	has_technology: (id) => {
		test.assert(id == 'CentauriEcology');
		return has_ecology;
	},
};

let yields = resource_callback({tile: make_tile(true), player: player});
test.assert(yields == {NUTRIENTS: 0, MINERALS: 0, ENERGY: 0});
has_ecology = true;
yields = resource_callback({tile: make_tile(true), player: player});
test.assert(yields == {NUTRIENTS: 1, MINERALS: 0, ENERGY: 0});

const bm_callbacks = {};
const bm = {
	on: (name, callback) => {
		bm_callbacks[name] = callback;
	},
};
const game_callbacks = {};
const game = {
	get_bm: () => { return bm; },
	event: (name, data) => {},
	on: (name, callback) => {
		game_callbacks[name] = callback;
	},
};
define_bases(game);

let queried_players = [];
const base_owner = {id: 7};
const make_base_tile = () => {
	return {
		get_resources: (value_player) => {
			queried_players :+value_player;
			return {NUTRIENTS: 1, MINERALS: 1, ENERGY: 1};
		},
	};
};
const center_tile = make_base_tile();
const worked_tile = make_base_tile();
const base = {
	get_owner: () => { return base_owner; },
	get_tile: () => { return center_tile; },
	get_worked_tiles: () => { return [worked_tile]; },
	get_facilities: () => { return []; },
};

const intake = bm_callbacks.get_base_intake({base: base});
test.assert(intake == {NUTRIENTS: 2, MINERALS: 2, ENERGY: 2});
test.assert(queried_players == [base_owner, base_owner]);
