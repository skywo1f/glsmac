return {
	init: (p) => {
		this.p = p;
		this.base = null;
		this.description = null;
		this.destination = null;
		this.responded = false;

		return p.create('HEADQUARTERS OVERRUN', 610, 134, (body, cb) => {
			this.description = body.text({
				class: 'game-popup-text',
				left: 10,
				right: 10,
				top: 12,
				text: '',
			});
			this.destination = body.text({
				class: 'game-popup-text',
				left: 10,
				right: 10,
				top: 38,
				text: '',
			});

			body.button({
				class: 'game-popup-button',
				text: 'Abandon Headquarters',
				top: 86,
				is_cancel: true,
			}).on('click', (e) => {
				this.respond('abandon');
				cb('abandon');
				return true;
			});

			body.button({
				class: 'game-popup-button',
				text: 'Evacuate Headquarters',
				top: 110,
				is_ok: true,
			}).on('click', (e) => {
				this.respond('evacuate');
				cb('evacuate');
				return true;
			});
		});
	},

	respond: (action) => {
		if (this.base == null) {
			return;
		}
		this.responded = true;
		this.p.game.event('respond_headquarters_evacuation', {
			base: this.base,
			action: action,
		});
	},

	set: (data) => {
		this.base = data.base;
		this.responded = false;
		this.description.text = this.base.name + ' has fallen.';
		this.destination.text =
			'Evacuate to ' + data.destination.name + ' for ' +
			#to_string(data.cost) + ' energy credits?';
	},

	on_hide: () => {
		if (this.base != null && !this.responded) {
			this.respond('abandon');
		}
		this.base = null;
		this.responded = false;
	},

	on_replace: () => {
		if (this.base != null && !this.responded) {
			this.respond('abandon');
		}
		this.base = null;
		this.responded = false;
	},
};
