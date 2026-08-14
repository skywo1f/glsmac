return {

	init: (p) => {
		this.p = p;
		this.status_text = null;
		this.detail_text = null;

		const result = p.create('GAME COMPLETE', 520, 142, (body, cb) => {
			this.status_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 18,
			});
			this.detail_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 50,
			});

			body.button({
				class: 'game-popup-button', text: 'Continue Viewing Planet', top: 88,
			}).on('click', (e) => {
				cb(true);
				return true;
			});

			body.button({
				class: 'game-popup-button', text: 'Return to Main Menu', top: 114, is_ok: true,
			}).on('click', (e) => {
				cb(true);
				#async(0, () => { p.glsmac.reset(); });
				return true;
			});
		});

		p.game.on('victory_declared', (e) => {
			this.refresh();
			p.modules.popup.show('victory');
		});
		return result;
	},

	refresh: () => {
		const victory = this.p.game.get_victory_state();
		if (victory.type == '' || victory.winner < 0) {
			this.status_text.text = 'No faction has won the game.';
			this.detail_text.text = '';
			return;
		}
		const winner = this.p.game.get_player(victory.winner);
		const local_player = this.p.game.get_player();
		const victory_names = {
			conquest: 'Conquest Victory',
			transcendence: 'Transcendence Victory',
			economic: 'Economic Victory',
			diplomatic: 'Diplomatic Victory',
		};
		const victory_name = #is_defined(victory_names[victory.type])
			? victory_names[victory.type]
			: 'Victory';
		this.status_text.text = winner.id == local_player.id
			? 'You have won the game.'
			: winner.get_faction().name + ' has won the game.';
		this.detail_text.text = victory_name + ' in M.Y. ' +
			#to_string(victory.turn + 2100) + '.';
	},

	on_show: () => {
		this.refresh();
	},

};
