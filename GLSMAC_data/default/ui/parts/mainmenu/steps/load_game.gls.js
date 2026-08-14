return (i) => {
	const load = (slot) => {
		const exists = slot == 0
			? i.glsmac.has_quicksave()
			: i.glsmac.has_save_game(slot);
		if (!exists) {
			i.popup.error(slot == 0
				? 'No quicksave exists yet.'
				: 'Save slot ' + #to_string(slot) + ' is empty.');
			return;
		}
		try {
			i.glsmac.init();
			i.settings.local.game_mode = 'single';
			if (slot == 0) {
				i.glsmac.load_game();
			} else {
				i.glsmac.load_game(slot);
			}
		} catch {
			: (e) => {
				i.glsmac.deinit();
				i.popup.error(e.message);
			}
		}
	};
	const label = (slot) => {
		return 'Save Slot ' + #to_string(slot) + (
			i.glsmac.has_save_game(slot) ? '' : ' (Empty)'
		);
	};
	i.sliding.show({
		title: 'Load Game',
		entries: [
			[i.glsmac.has_quicksave() ? 'Quicksave' : 'Quicksave (Empty)', () => { load(0); }],
			[label(1), () => { load(1); }],
			[label(2), () => { load(2); }],
			[label(3), () => { load(3); }],
			[label(4), () => { load(4); }],
			[label(5), () => { load(5); }],
		],
	});
};
