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
			forest: false,
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

const forest_tile = make_tile(false);
forest_tile.terraforming.forest = true;
yields = resource_callback({tile: forest_tile, player: player});
test.assert(yields == {NUTRIENTS: 1, MINERALS: 2, ENERGY: 1});
forest_tile.features.river = true;
yields = resource_callback({tile: forest_tile, player: player});
test.assert(yields == {NUTRIENTS: 1, MINERALS: 2, ENERGY: 2});

const bm_callbacks = {};
const bm = {
	on: (name, callback) => {
		bm_callbacks[name] = callback;
	},
};
const game_callbacks = {};
let effective_facilities = #undefined;
let global_mineral_bonus = 0;
const game = {
	get_bm: () => { return bm; },
	event: (name, data) => {},
	on: (name, callback) => {
		game_callbacks[name] = callback;
	},
	get: (key) => {
		if (key == 'f_base_get_effective_facilities' && #is_defined(effective_facilities)) {
			return (base) => { return effective_facilities; };
		}
		if (key == 'f_project_get_effects') {
			return (base) => { return {
				mineral_bonus: global_mineral_bonus,
				support_bonus: 0,
				maintenance_multiplier: 1.0,
				growth_rating_bonus: 0,
				population_limit_bonus: 0,
				talent_bonus: 0,
				network_node_drone_modifier: 0,
				prevent_riots: false,
			}; };
		}
		return #undefined;
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

base.get_facilities = () => { return [
	{nutrient_bonus: 1, mineral_bonus: 1, energy_bonus: 1, mineral_multiplier: 0.5},
	{nutrient_bonus: 0, mineral_bonus: 0, energy_bonus: 0, mineral_multiplier: 0.5},
]; };
const multiplied_intake = bm_callbacks.get_base_intake({base: base});
test.assert(multiplied_intake == {NUTRIENTS: 3, MINERALS: 6, ENERGY: 3});

effective_facilities = base.get_facilities() + [{
	nutrient_bonus: 0,
	mineral_bonus: 0,
	energy_bonus: 0,
	mineral_multiplier: 0.0,
	worked_tile_energy_bonus: 1,
}];
global_mineral_bonus = 2;
const project_intake = bm_callbacks.get_base_intake({base: base});
test.assert(project_intake == {NUTRIENTS: 3, MINERALS: 10, ENERGY: 5});
