const game_rules = #include('../../../../game/game_rules');

return (i) => {
	i.sliding.show({
		title: 'Game rules',
		entries: [
			['Play with Standard Rules', () => {
				i.settings.global.rules.allow_transcendence_victory =
					game_rules.defaults.allow_transcendence_victory;
				i.settings.global.rules.allow_conquest_victory =
					game_rules.defaults.allow_conquest_victory;
				i.settings.global.rules.allow_diplomatic_victory =
					game_rules.defaults.allow_diplomatic_victory;
				i.settings.global.rules.allow_economic_victory =
					game_rules.defaults.allow_economic_victory;
				i.settings.global.rules.allow_cooperative_victory =
					game_rules.defaults.allow_cooperative_victory;
				i.settings.global.rules.tech_stagnation = game_rules.defaults.tech_stagnation;
				i.settings.global.rules.spoils_of_war = game_rules.defaults.spoils_of_war;
				i.settings.global.rules.unity_survey = game_rules.defaults.unity_survey;
				i.settings.global.rules.random_events = game_rules.defaults.random_events;
				i.steps.select_faction(i);
			}],
			['Play with Current Rules', () => {
				i.steps.select_faction(i);
			}],
			['Customize Rules', () => {
				i.steps.customize_rules(i);
			}],
		]
	});
};
