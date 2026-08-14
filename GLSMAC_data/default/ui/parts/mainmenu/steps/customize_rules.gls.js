const game_rules = #include('../../../../game/game_rules');

return (i) => {
	const show = () => {
		let entries = [];
		for (definition of game_rules.definitions) {
			const option = definition;
			const key = option.key;
			const enabled = i.settings.global.rules[key];
			entries :+[(enabled ? '[X] ' : '[ ] ') + option.label, () => {
				i.settings.global.rules[key] = !i.settings.global.rules[key];
				show();
			}];
		}
		entries :+['Done', () => { i.steps.select_faction(i); }];
		i.sliding.show({
			title: 'Customize Game Rules',
			entries: entries,
		});
	};
	show();
};
