return {

	init: (p) => {
		return p.create([
			{
				label: 'Quick Save',
				open: () => {
					try {
						p.glsmac.save_game();
					} catch {
						: (e) => {
							p.game.message(e.message);
						}
					}
				},
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
