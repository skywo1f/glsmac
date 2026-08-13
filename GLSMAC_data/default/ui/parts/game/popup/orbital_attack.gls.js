return {

	init: (p) => {
		this.p = p;
		this.player = null;
		this.targets = {};
		this.target = null;
		this.target_select = null;
		this.status_text = null;
		this.detail_text = null;
		this.attack_button = null;

		return p.create('ORBITAL ATTACK VIEW', 560, 192, (body, cb) => {
			body.text({
				class: 'game-popup-text', text: 'Target:', left: 10, top: 12,
			});
			this.target_select = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 8,
				width: 430, items: [['', 'No rival satellites']], value: '',
			});
			this.target_select.on('select', (e) => {
				this.select_target(e.value);
				return true;
			});

			this.status_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 52,
			});
			this.detail_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 82,
			});

			body.button({
				class: 'game-popup-button', text: 'Close', top: 140, is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});

			this.attack_button = body.button({
				class: 'game-popup-button', text: 'Attack Satellite', top: 164, is_ok: true,
			});
			this.attack_button.on('click', (e) => {
				if (this.player != null && this.target != null) {
					p.game.event('attack_orbital', {
						target: this.target.player,
						facility_id: this.target.definition.id,
					});
					cb(true);
				}
				return true;
			});
		});
	},

	select_target: (key) => {
		this.target = key == '' || !#is_defined(this.targets[key])
			? null
			: this.targets[key];
		this.refresh();
	},

	refresh: () => {
		this.attack_button.hide();
		if (this.player == null) {
			return;
		}
		const total = this.player.get_orbital_facility_count('OrbitalDefensePod');
		const available = this.p.game.get('f_orbital_get_available_defense_pods')(
			this.player
		);
		this.status_text.text = 'Orbital Defense Pods: ' + #to_string(total) +
			' total, ' + #to_string(available) + ' undeployed.';
		if (this.target == null) {
			this.detail_text.text = 'No rival faction currently has a satellite in orbit.';
			return;
		}
		const error = this.p.game.get('f_orbital_get_attack_error')(
			this.player,
			this.target.player,
			this.target.definition.id
		);
		if (#is_defined(error)) {
			this.detail_text.text = error + '.';
			return;
		}
		const relation = this.player.get_diplomatic_relation(this.target.player);
		this.detail_text.text = '50% destruction chance; failure destroys the Pod.' + (
			relation == 'vendetta'
				? ''
				: ' This attack will begin a vendetta with ' + this.target.player.name + '.'
		);
		this.attack_button.show();
	},

	on_show: () => {
		this.player = this.p.game.get_player();
		this.targets = {};
		let items = [];
		for (target of this.p.game.get('f_orbital_get_attack_targets')(this.player)) {
			const key = 'p' + #to_string(target.player.id) + '_' + target.definition.id;
			this.targets[key] = target;
			items :+[
				key,
				target.player.name + ': ' + target.definition.name +
					' (' + #to_string(target.count) + ')',
			];
		}
		this.target_select.items = #sizeof(items) > 0
			? items
			: [['', 'No rival satellites']];
		this.target_select.readonly = #sizeof(items) == 0;
		this.target_select.value = #sizeof(items) > 0 ? items[0][0] : '';
		this.select_target(this.target_select.value);
	},

	on_hide: () => {
		this.player = null;
		this.target = null;
		this.targets = {};
	},

};
