const governor_rules = #include('../../../../../game/base_governor_rules');

return {

	init: (p) => {
		this.p = p;
		this.base = null;
		this.get_live_base = () => {
			if (this.base == null) {
				return null;
			}
			for (candidate of this.p.game.get_bm().get_bases()) {
				if (candidate.id == this.base.id) {
					return candidate;
				}
			}
			return null;
		};
		this.set_governor = (enabled, priority) => {
			const base = this.get_live_base();
			if (
				base != null &&
				base.get_owner().id == this.p.game.get_player().id &&
				!this.p.game.is_turn_complete(this.p.game.get_player().id)
			) {
				this.p.game.event('set_base_governor', {
					base: base,
					enabled: enabled,
					priority: priority,
				});
			}
		};

		this.buttons = p.body.panel({
			align: 'top',
			top: 3,
			left: 3,
			right: 3,
			height: 26,
			border: 'rgb(232,136,8),2',
		});

		p.ui.class('base-screen-top-button').set({
			width: 112,
			top: 3,
			bottom: 3,
			font: 'arialnb.ttf:16',
			color: 'rgb(228,104,24)',
			sound: 'ok.wav',
			_hover: {
				color: 'black',
			},
			_active: {
				color: 'black',
			},
		});

		p.ui.class('base-screen-top-button-1').extend('base-screen-top-button').set({
			border: 'rgb(136,69,28),2',
			background: 'interface.pcx:crop(68,65,134,82)',
			_hover: {
				background: 'interface.pcx:crop(68,86,134,103)',
			},
			_active: {
				background: 'interface.pcx:crop(68,86,134,103)',
				border: 'rgb(220,172,52),2',
			},
		});

		p.ui.class('base-screen-top-button-2').extend('base-screen-top-button').set({
			border: 'rgb(176,20,20),2',
			background: 'interface.pcx:crop(68,2,134,19)',
			_hover: {
				background: 'interface.pcx:crop(68,23,134,40)',
				border: 'rgb(136,12,12),2',
			},
			_active: {
				background: 'interface.pcx:crop(68,23,134,40)',
				border: 'rgb(228,120,24),2',
			},
		});

		p.ui.class('base-screen-top-button-dropdown').extend('base-screen-top-button-2').set({
			width: 20,
			background: 'interface.pcx:crop(248,2,265,19)',
			_hover: {
				background: 'interface.pcx:crop(248,23,265,40)',
			},
			_active: {
				background: 'interface.pcx:crop(248,44,265,61)',
			},
		});

		this.explore_button = this.buttons.button({
			class: 'base-screen-top-button-1',
			align: 'left',
			left: 3,
			text: 'EXPLORE',
		});
		this.discover_button = this.buttons.button({
			class: 'base-screen-top-button-1',
			align: 'left',
			left: 116,
			text: 'DISCOVER',
		});

		this.previous_button = this.buttons.button({
			class: 'base-screen-top-button-dropdown',
			align: 'left',
			left: 230,
		});
		this.governor_button = this.buttons.button({
			class: 'base-screen-top-button-2',
			align: 'center',
			width: 170,
			text: 'GOVERNOR',
		});
		this.next_button = this.buttons.button({
			class: 'base-screen-top-button-dropdown',
			align: 'right',
			right: 230,
		});

		this.build_button = this.buttons.button({
			class: 'base-screen-top-button-1',
			align: 'right',
			right: 116,
			text: 'BUILD',
		});
		this.conquer_button = this.buttons.button({
			class: 'base-screen-top-button-1',
			align: 'right',
			right: 3,
			text: 'CONQUER',
		});

		this.priority_buttons = {
			explore: this.explore_button,
			discover: this.discover_button,
			build: this.build_button,
			conquer: this.conquer_button,
		};
		this.explore_button.on('click', (e) => {
			this.set_governor(true, 'explore');
			return true;
		});
		this.discover_button.on('click', (e) => {
			this.set_governor(true, 'discover');
			return true;
		});
		this.build_button.on('click', (e) => {
			this.set_governor(true, 'build');
			return true;
		});
		this.conquer_button.on('click', (e) => {
			this.set_governor(true, 'conquer');
			return true;
		});
		this.governor_button.on('click', (e) => {
			const base = this.get_live_base();
			if (base != null) {
				this.set_governor(
					!governor_rules.is_enabled(base),
					governor_rules.get_priority(base)
				);
			}
			return true;
		});
		const cycle_priority = (direction) => {
			const base = this.get_live_base();
			if (base != null) {
				this.set_governor(
					true,
					governor_rules.get_next_priority(
						governor_rules.get_priority(base),
						direction
					)
				);
			}
		};
		this.previous_button.on('click', (e) => {
			cycle_priority(0 - 1);
			return true;
		});
		this.next_button.on('click', (e) => {
			cycle_priority(1);
			return true;
		});

	},

	set: (data) => {
		this.base = data.base;
		const priority = governor_rules.get_priority(data.base);
		const enabled = governor_rules.is_enabled(data.base);
		this.governor_button.text = enabled ? 'GOVERNOR ON' : 'GOVERNOR OFF';
		this.governor_button.active = enabled;
		this.explore_button.active = priority == 'explore';
		this.discover_button.active = priority == 'discover';
		this.build_button.active = priority == 'build';
		this.conquer_button.active = priority == 'conquer';
	},

};
