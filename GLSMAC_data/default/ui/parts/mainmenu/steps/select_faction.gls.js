return (i) => {
	const game = i.glsmac.game;

	let starting = false;
	const start = (faction_id) => {
		if (starting) {
			return;
		}
		starting = true;
		if (faction_id == 'RANDOM') {
			i.glsmac.add_single_player();
		} else {
			i.glsmac.add_single_player(faction_id);
		}
		for (let opponent = 0; opponent < 6; opponent++) {
			i.glsmac.add_ai_player();
		}
		i.glsmac.start_game();
	};

	let entries = [
		['Random', () => { start('RANDOM'); }],
	];
	for (faction of game.get_fm().list()) {
		if (#is_defined(faction.is_native) && faction.is_native) { continue; }
		const selected_faction = faction;
		entries :+[faction.name, () => { start(selected_faction.id); }];
	}
	i.sliding.show({
		title: 'Select a faction',
		entries: entries,
	});
};
