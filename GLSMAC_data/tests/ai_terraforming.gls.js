const terraforming = #include('../default/game/ai/terraforming');

const owner = {id: 1};

const make_tile = (moisture, rockiness, nutrients, minerals, energy) => {
	return {
		is_water: false,
		moisture: moisture,
		rockiness: rockiness,
		features: {monolith: false, xenofungus: false},
		terraforming: {road: false, forest: false, farm: false, mine: false, solar: false},
		get_base: () => { return null; },
		get_resources: (player) => {
			test.assert(player == owner);
			return {NUTRIENTS: nutrients, MINERALS: minerals, ENERGY: energy};
		},
	};
};

const moist = make_tile(2, 1, 2, 1, 1);
test.assert(terraforming.get_order(moist, true) == 'farm');
test.assert(terraforming.get_order(moist, false) == 'farm');

const arid = make_tile(0, 1, 1, 1, 1);
test.assert(terraforming.get_order(arid, true) == 'forest');

moist.terraforming.farm = true;
test.assert(terraforming.get_order(moist, true) == 'road');
moist.terraforming.road = true;
test.assert(terraforming.get_order(moist, true) == 'solar');
moist.terraforming.solar = true;
test.assert(terraforming.get_order(moist, true) == null);

const fungus = make_tile(2, 1, 3, 3, 3);
fungus.features.xenofungus = true;
test.assert(terraforming.get_order(fungus, true) == null);

const food = make_tile(2, 1, 3, 0, 0);
const minerals = make_tile(1, 2, 0, 3, 0);
test.assert(terraforming.get_target_score(food, owner, 0, 2) > terraforming.get_target_score(minerals, owner, 1, 1));
test.assert(terraforming.get_target_score(food, owner, 1, 1) > terraforming.get_target_score(food, owner, 1, 2));
test.assert(terraforming.get_target_score(food, owner, 1, 2, true) > terraforming.get_target_score(food, owner, 1, 1, false));
