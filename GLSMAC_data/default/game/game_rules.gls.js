const definitions = [
	{key: 'allow_transcendence_victory', label: 'Higher Goal: Transcendence Victory'},
	{key: 'allow_conquest_victory', label: 'Total War: Conquest Victory'},
	{key: 'allow_diplomatic_victory', label: 'Peace in Our Time: Diplomatic Victory'},
	{key: 'allow_economic_victory', label: 'Mine, All Mine: Economic Victory'},
	{key: 'allow_cooperative_victory', label: 'One for All: Cooperative Victory'},
	{key: 'tech_stagnation', label: 'Tech Stagnation'},
	{key: 'spoils_of_war', label: 'Spoils of War'},
	{key: 'unity_survey', label: 'Unity Survey'},
	{key: 'random_events', label: 'Random Events'},
];

const defaults = {
	allow_transcendence_victory: true,
	allow_conquest_victory: true,
	allow_diplomatic_victory: true,
	allow_economic_victory: true,
	allow_cooperative_victory: false,
	tech_stagnation: false,
	spoils_of_war: true,
	unity_survey: false,
	random_events: true,
};

const is_rule = (key) => {
	for (definition of definitions) {
		if (definition.key == key) {
			return true;
		}
	}
	return false;
};

const get = (game, key) => {
	const fallback = defaults[key];
	if (!#is_defined(game) || #typeof(game.get_settings) != 'Callable') {
		return fallback;
	}
	const settings = game.get_settings();
	if (
		#typeof(settings) != 'Object' || #typeof(settings.global) != 'Object' ||
		#typeof(settings.global.rules) != 'Object' ||
		!#is_defined(settings.global.rules[key])
	) {
		return fallback;
	}
	return settings.global.rules[key];
};

return {
	definitions: definitions,
	defaults: defaults,
	is_rule: is_rule,
	get: get,
};
