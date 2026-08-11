return {

	init: (p) => {
		return p.create([
			{
				label: 'Start New Game',
				open: () => {
					p.maybe_quit(false);
				},
			},
			{
				label: 'Global Market',
				open: () => {
					p.modules.popup.show('economic_victory');
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
