const define_social_engineering = #include('../default/game/social_engineering');

const callbacks = {};
const values = {};
const game = {
	on: (name, callback) => { callbacks[name] = callback; },
	set: (name, value) => { values[name] = value; },
};
define_social_engineering(game);
callbacks.start({});

let choices = {
	politics: 'Frontier',
	economics: 'Simple',
	values: 'Survival',
	future_society: 'None',
};
let technologies = {};
let faction_id = 'GAIANS';
const player = {
	get_social_engineering: () => { return choices; },
	get_faction: () => { return {id: faction_id}; },
	has_technology: (id) => { return #is_defined(technologies[id]); },
};

const categories = values.f_social_get_categories();
test.assert(#sizeof(categories) == 4);
for (category of categories) {
	test.assert(#sizeof(category.choices) == 4);
}

let ratings = values.f_social_get_ratings(player);
test.assert(ratings.effic == 2);
test.assert(ratings.planet == 1);
test.assert(ratings.morale == 0 - 1);
test.assert(ratings.police == 0 - 1);

let error = values.f_social_validate_choices(player, {
	politics: 'Democratic',
	economics: 'Simple',
	values: 'Survival',
	future_society: 'None',
});
test.assert(#is_defined(error));
technologies.EthicalCalculus = true;
test.assert(!#is_defined(values.f_social_validate_choices(player, {
	politics: 'Democratic',
	economics: 'Simple',
	values: 'Survival',
	future_society: 'None',
})));
test.assert(#sizeof(values.f_social_get_available_choices(player, 'politics')) == 2);

technologies = {
	EthicalCalculus: true,
	PlanetaryNetworks: true,
	AdvancedMilitaryAlgorithms: true,
	DigitalSentience: true,
};
choices = {
	politics: 'Democratic',
	economics: 'Planned',
	values: 'Power',
	future_society: 'Cybernetic',
};
faction_id = 'HIVE';
ratings = values.f_social_get_ratings(player);
test.assert(ratings.economy == 0 - 2);
test.assert(ratings.effic == 2);
test.assert(ratings.support == 0);
test.assert(ratings.morale == 2);
test.assert(ratings.police == 0 - 3);
test.assert(ratings.growth == 5);
test.assert(ratings.planet == 2);
test.assert(ratings.industry == 0);
test.assert(ratings.research == 2);

test.assert(values.f_social_get_mineral_cost(player, 40) == 40);
test.assert(values.f_social_get_support_cost(player) == 1);
test.assert(values.f_social_get_free_support(player, 6) == 2);
test.assert(values.f_social_get_new_base_minerals(player) == 10);
test.assert(values.f_social_get_morale_bonus(player, false) == 1);
test.assert(values.f_social_get_morale_bonus(player, true) == 2);
test.assert(values.f_social_get_economy_base_bonus(player, false) == 0 - 1);
test.assert(values.f_social_get_tile_energy_bonus(player) == 0);
test.assert(values.f_social_get_research_multiplier(player) == 1.2);

choices = {
	politics: 'Frontier',
	economics: 'FreeMarket',
	values: 'Wealth',
	future_society: 'Eudaimonic',
};
faction_id = 'MORGANITES';
ratings = values.f_social_get_ratings(player);
test.assert(ratings.economy == 5);
test.assert(ratings.industry == 3);
test.assert(values.f_social_get_mineral_cost(player, 40) == 28);
test.assert(values.f_social_get_economy_base_bonus(player, false) == 4);
test.assert(values.f_social_get_tile_energy_bonus(player) == 1);

choices = {
	politics: 'Democratic',
	economics: 'Simple',
	values: 'Survival',
	future_society: 'None',
};
faction_id = 'PEACEKEEPERS';
test.assert(values.f_social_get_ratings(player).support == 0 - 2);
test.assert(values.f_social_get_new_base_minerals(player) == 0);

choices.politics = 'Frontier';
test.assert(values.f_social_get_new_base_minerals(player) == 10);
