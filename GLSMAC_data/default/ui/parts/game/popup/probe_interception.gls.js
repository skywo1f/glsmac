return {

	init: (p) => {
		this.p = p;
		this.attacker = null;
		this.unit = null;
		this.description = null;

		return p.create('PROBE TEAM INTERCEPTED', 610, 158, (body, cb) => {
			this.description = body.text({
				class: 'game-popup-text',
				left: 10,
				right: 10,
				top: 12,
				text: '',
			});

			body.button({
				class: 'game-popup-button',
				text: 'Leave Them Alone',
				top: 86,
				is_cancel: true,
			}).on('click', (e) => {
				cb('leave');
				return true;
			});

			body.button({
				class: 'game-popup-button',
				text: 'Interrogate and Return',
				top: 110,
			}).on('click', (e) => {
				this.resolve('interrogate');
				cb('interrogate');
				return true;
			});

			body.button({
				class: 'game-popup-button',
				text: 'Eliminate Probe Team',
				top: 134,
				is_ok: true,
			}).on('click', (e) => {
				this.resolve('eliminate');
				cb('eliminate');
				return true;
			});
		});
	},

	resolve: (action) => {
		if (this.attacker == null || this.unit == null) {
			return;
		}
		this.p.game.event('attack_unit', {
			attacker: this.attacker,
			defender: this.unit,
			probe_interception_action: action,
		});
	},

	set: (data) => {
		this.attacker = data.attacker;
		this.unit = data.unit;
		this.description.text =
			this.unit.get_owner().name + ' ' + this.unit.get_def().name +
			' intercepted in our territory.';
	},

	on_hide: () => {
		this.attacker = null;
		this.unit = null;
	},

};
