return {
	init: (p) => {
		this.p = p;
		this.base = null;
		return p.create('NERVE STAPLING', 500, 132, (body, cb) => {
			const prompt = body.panel({
				class: 'game-popup-block',
				height: 80,
			});
			this.base_text = prompt.text({
				class: 'game-popup-text',
				text: '',
				top: 4,
			});
			prompt.text({
				class: 'game-popup-text',
				text: 'A successful operation suppresses all drones for 10 years.',
				top: 25,
			});
			prompt.text({
				class: 'game-popup-text',
				text: 'Every attempt is an atrocity and may trigger economic sanctions.',
				top: 46,
			});

			body.button({
				class: 'game-popup-button',
				text: 'Cancel',
				top: 84,
				is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});

			body.button({
				class: 'game-popup-button',
				text: 'Commit nerve-stapling atrocity',
				top: 108,
				is_ok: true,
			}).on('click', (e) => {
				if (this.base != null) {
					p.game.event('nerve_staple_base', {base: this.base});
				}
				cb(true);
				return true;
			});
		});
	},

	set: (data) => {
		this.base = data.base;
		this.base_text.text = 'Order nerve stapling at ' + data.base.name + '?';
	},
};
