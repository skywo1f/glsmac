const define_bases = #include('../default/game/bases');

const callbacks = {};
let units = [];
let project_effects = {
	mineral_bonus: 0,
	support_bonus: 0,
	maintenance_multiplier: 1.0,
};
const game = {
	get_bm: () => {
		return {
			on: (name, callback) => { callbacks[name] = callback; },
		};
	},
	get_um: () => {
		return {
			get_units: () => { return units; },
		};
	},
	event: (name, data) => {},
	on: (name, callback) => {},
	get: (key) => {
		return key == 'f_project_get_effects'
			? (base) => { return project_effects; }
			: #undefined;
	},
};

define_bases(game);

let owner_faction_id = 'GAIANS';
const owner = {
	id: 1,
	get_faction: () => { return {id: owner_faction_id}; },
};
let base_size = 2;
const base = {
	id: 7,
	get_owner: () => { return owner; },
	get_size: () => { return base_size; },
	get_facilities: () => { return [{id: 'NetworkNode', energy_maintenance: 2}]; },
};
const supported = (owner_id, home_base_id, abilities, weapon) => {
	const def = {
		abilities: #is_defined(abilities) ? abilities : [],
		weapon: #is_defined(weapon) ? weapon : 'HandWeapons',
	};
	return {
		owner: owner_id,
		home_base_id: home_base_id,
		get_def: () => { return def; },
	};
};

units = [
	supported(owner.id, base.id),
	supported(owner.id, base.id),
	supported(owner.id, base.id),
	supported(owner.id, base.id),
	supported(owner.id, base.id, ['CleanReactor']),
	supported(owner.id, base.id, [], 'SupplyTransport'),
	supported(owner.id, 8),
	supported(2, base.id),
	supported(owner.id, 0),
];

let consumption = callbacks.get_base_consumption({base: base});
test.assert(consumption == {NUTRIENTS: 4, MINERALS: 2, ENERGY: 2});

project_effects = {
	mineral_bonus: 0,
	support_bonus: 2,
	maintenance_multiplier: 0.5,
};
consumption = callbacks.get_base_consumption({base: base});
test.assert(consumption == {NUTRIENTS: 4, MINERALS: 0, ENERGY: 1});
project_effects = {
	mineral_bonus: 0,
	support_bonus: 0,
	maintenance_multiplier: 1.0,
};

base_size = 4;
consumption = callbacks.get_base_consumption({base: base});
test.assert(consumption == {NUTRIENTS: 8, MINERALS: 0, ENERGY: 2});


owner_faction_id = 'UNIVERSITY';
base_size = 2;
units = [];
consumption = callbacks.get_base_consumption({base: base});
test.assert(consumption.NUTRIENTS == 4);
test.assert(consumption.MINERALS == 0);
test.assert(consumption.ENERGY == 0);
owner_faction_id = 'GAIANS';
base_size = 0;
units = [supported(owner.id, base.id)];
consumption = callbacks.get_base_consumption({base: base});
test.assert(consumption == {NUTRIENTS: 0, MINERALS: 0, ENERGY: 2});
