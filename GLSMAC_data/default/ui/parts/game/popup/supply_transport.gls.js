const supply_rules = #include('../../../../game/supply_rules');

return {
	init: (p) => {
		this.p = p;
		this.unit = null;
		this.status_text = null;
		this.resource_buttons = {};
		this.stop_button = null;
		this.contribute_button = null;

		return p.create('SUPPLY TRANSPORT', 520, 194, (body, cb) => {
			this.status_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 8,
			});

			let top = 50;
			for (resource of supply_rules.resource_types) {
				const button = body.button({
					class: 'game-popup-button',
					text: 'Convoy ' + resource,
					top: top,
					value: resource,
				});
				button.on('click', (e) => {
					if (this.unit != null) {
						p.game.event('set_supply_convoy', {
							unit: this.unit,
							resource: e.value,
						});
						cb(true);
					}
					return true;
				});
				this.resource_buttons[resource] = button;
				top += 24;
			}

			this.stop_button = body.button({
				class: 'game-popup-button', text: 'Stop Convoy', top: 122,
			});
			this.stop_button.on('click', (e) => {
				if (this.unit != null) {
					p.game.event('set_supply_convoy', {
						unit: this.unit,
						resource: 'none',
					});
					cb(true);
				}
				return true;
			});

			this.contribute_button = body.button({
				class: 'game-popup-button', text: 'Contribute Minerals', top: 146,
			});
			this.contribute_button.on('click', (e) => {
				if (this.unit != null) {
					p.game.event('contribute_supply_transport', {unit: this.unit});
					cb(true);
				}
				return true;
			});

			body.button({
				class: 'game-popup-button', text: 'Cancel', top: 170, is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});
		});
	},

	set: (data) => {
		this.unit = data.unit;
	},

	on_show: () => {
		for (resource of supply_rules.resource_types) {
			this.resource_buttons[resource].hide();
		}
		this.stop_button.hide();
		this.contribute_button.hide();
		this.status_text.text = 'No valid supply action is currently available.';
		if (this.unit == null) {
			return;
		}

		const game = this.p.game;
		const player = game.get_player();
		const home_base = supply_rules.get_home_base(game, this.unit);
		if (this.unit.convoy_resource != 'none') {
			this.stop_button.show();
			this.status_text.text = 'Convoying ' + this.unit.convoy_resource +
				(home_base == null ? '' : ' to ' + home_base.name) + '.';
		}
		for (resource of supply_rules.resource_types) {
			if (
				resource != this.unit.convoy_resource &&
				!#is_defined(supply_rules.get_order_error(
					game,
					this.unit,
					player.id,
					resource
				))
			) {
				this.resource_buttons[resource].show();
			}
		}
		if (!#is_defined(supply_rules.get_contribution_error(
			game,
			this.unit,
			player.id
		))) {
			const target = supply_rules.get_contribution_target(this.unit);
			this.contribute_button.text = 'Contribute ' +
				#to_string(this.unit.get_def().mineral_cost) + ' Minerals to ' +
				target.production.name;
			this.contribute_button.show();
			this.status_text.text = this.unit.get_def().name + ' at ' +
				this.unit.get_tile().get_base().name + '.';
		}
	},

	on_hide: () => {
		this.unit = null;
	},
};
