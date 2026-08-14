return {

	init: (p) => {
		const save = (slot) => {
			try {
				if (slot == 0) {
					p.glsmac.save_game();
				} else {
					p.glsmac.save_game(slot);
				}
			} catch {
				: (e) => {
					p.game.message(e.message);
				}
			}
			p.menu.close_all();
		};
		return p.create([
			{
				label: 'Quick Save',
				open: () => { save(0); },
			},
			{
				label: 'Save Slot 1',
				open: () => { save(1); },
			},
			{
				label: 'Save Slot 2',
				open: () => { save(2); },
			},
			{
				label: 'Save Slot 3',
				open: () => { save(3); },
			},
			{
				label: 'Save Slot 4',
				open: () => { save(4); },
			},
			{
				label: 'Save Slot 5',
				open: () => { save(5); },
			},
			{
				label: 'Start New Game',
				open: () => {
					p.maybe_quit(false);
				},
			},
			{
				label: 'Planetary Council',
				open: () => {
					p.modules.popup.show('planetary_council');
				},
			},
			{
				label: 'Global Market',
				open: () => {
					p.modules.popup.show('economic_victory');
				},
			},
			{
				label: 'Orbital Attack',
				open: () => {
					p.modules.popup.show('orbital_attack');
				},
			},
			{
				label: 'Quit',
				open: () => {
					p.maybe_quit(true);
				},
			},
		]);
	},

};
