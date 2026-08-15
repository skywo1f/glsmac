return {
	_get_live_base: (base_id) => {
		for (base of this.p.game.get_bm().get_bases()) {
			if (base.id == base_id) {
				return base;
			}
		}
		return null;
	},

	_get_live_pop: (base, pop_id) => {
		if (base == null) {
			return null;
		}
		for (pop of base.get_pops()) {
			if (pop.id == pop_id) {
				return pop;
			}
		}
		return null;
	},

	_get_relative_base: (direction) => {
		if (this.base == null) {
			return null;
		}
		const owner_id = this.base.get_owner().id;
		let first = null;
		let last = null;
		let previous = null;
		let next = null;
		for (candidate of this.p.game.get_bm().get_bases()) {
			if (candidate.get_owner().id != owner_id) {
				continue;
			}
			if (first == null || candidate.id < first.id) {
				first = candidate;
			}
			if (last == null || candidate.id > last.id) {
				last = candidate;
			}
			if (
				candidate.id < this.base.id &&
				(previous == null || candidate.id > previous.id)
			) {
				previous = candidate;
			}
			if (
				candidate.id > this.base.id &&
				(next == null || candidate.id < next.id)
			) {
				next = candidate;
			}
		}
		return direction < 0
			? (previous == null ? last : previous)
			: (next == null ? first : next);
	},

	_select_relative_base: (direction) => {
		const target = this._get_relative_base(direction);
		if (target != null) {
			this.p.game.select_base(target);
		}
	},

	_get_pop_renders: (owner) => {
		const faction_id = owner.get_faction().id;
		if (#is_defined(this.renders_by_faction[faction_id])) {
			return this.renders_by_faction[faction_id];
		}
		const renders = this.p.game.get_bm().get_pop_renders(owner);
		for (id in renders) {
			const variants = renders[id];
			for (i in variants) {
				this.p.ui.class(
					'base-screen-bottombar-pop-' + id + '-' + #to_string(i)
				).extend('base-screen-bottombar-pop').set({
					background: variants[i],
				});
			}
		}
		this.renders_by_faction[faction_id] = renders;
		return renders;
	},

	init: (p) => {

		this.p = p;
		this.renders_by_faction = {};

		this.frame = p.body.panel({
			class: 'default-panel',
			border: 'transparent',
			left: 263,
			top: 69,
			right: 263,
			bottom: 86,
		});

		const header = this.frame.panel({
			class: 'default-panel',
			align: 'top',
			top: 2,
			left: 4,
			right: 4,
			height: 41,
		});

		const header_title = header.panel({
			class: 'default-panel-inner',
			top: 3,
			bottom: 3,
			left: 25,
			right: 25,
		});

		this.basename = header_title.text({
			align: 'top center', // TODO: fix vertical centering
			top: 3,
			font: 'arialnb.ttf:28',
			color: 'rgb(137,166,166)',
			transform: 'uppercase',
		});

		p.ui.class('base-screen-bottombar-arrow').set({
			width: 20,
			height: 35,
			top: 3,
			sound: 'ok.wav',
		});
		// TODO: make _hover and _active work without class
		p.ui.class('base-screen-bottombar-arrow-left').extend('base-screen-bottombar-arrow').set({
			align: 'top left',
			left: 3,
			background: 'interface.pcx:crop(290,64,309,98)',
			_hover: {
				background: 'interface.pcx:crop(290,100,309,134)',
			},
			_active: {
				background: 'interface.pcx:crop(290,136,309,170)',
			},
		});
		this.previous_button = header.button({
			class: 'base-screen-bottombar-arrow-left',
		});
		this.previous_button.on('click', (e) => {
			this._select_relative_base(0 - 1);
			return true;
		});
		p.ui.class('base-screen-bottombar-arrow-right').extend('base-screen-bottombar-arrow').set({
			align: 'top right',
			right: 3,
			background: 'interface.pcx:crop(311,64,330,98)',
			_hover: {
				background: 'interface.pcx:crop(311,100,330,134)',
			},
			_active: {
				background: 'interface.pcx:crop(311,136,330,170)',
			},
		});
		this.next_button = header.button({
			class: 'base-screen-bottombar-arrow-right',
		});
		this.next_button.on('click', (e) => {
			this._select_relative_base(1);
			return true;
		});

		p.ui.class('base-screen-bottombar-pop').set({
			width: 38,
			height: 48,
			align: 'left',
			top: 3,
			bottom: 3,
		});

		this.pops = this.frame.panel({
			class: 'default-panel',
			align: 'bottom',
			bottom: 2,
			left: 4,
			right: 60,
			height: 54,
		});

		p.ui.class('base-screen-bottombar-nsbtn').set({
			align: 'center',
			width: 48,
			height: 48,
			sound: 'ok.wav',
			background: 'interface.pcx:crop(332,1,379,48)',
			_hover: {
				background: 'interface.pcx:crop(332,50,379,97)',
			},
			_active: {
				background: 'interface.pcx:crop(332,99,379,146)',
			},
		});
		this.nerve_stapling_panel = this.frame.panel({
			class: 'default-panel',
			width: 54,
			height: 54,
			align: 'bottom right',
			bottom: 2,
			right: 4,
		});
		this.nerve_stapling_btn = this.nerve_stapling_panel.button({
			class: 'base-screen-bottombar-nsbtn',
		});
		this.nerve_stapling_btn.on('click', (e) => {
			if (this.base != null) {
				this.p.modules.popup.set('nerve_stapling', {base: this.base});
				this.p.modules.popup.show('nerve_stapling');
			}
			return true;
		});

	},

	set: (data) => {

		const base = data.base;
		this.base = base;
		this.basename.text = base.name;
		const player = this.p.game.get_player();
		const error = this.p.game.get('f_nerve_stapling_get_error')(base, player.id);
		if (!#is_defined(error)) {
			this.nerve_stapling_panel.show();
		} else {
			this.nerve_stapling_panel.hide();
		}

		const renders = this._get_pop_renders(base.get_owner());

		this.pops.clear();
		let left = 3;
		let shift = 40;
		for (pop of base.get_pops()) {
			let variant = pop.variant;
			const pop_type = pop.get_type();
			if (!#is_defined(renders[pop_type][variant])) {
				variant = 0;
			}
			const icon = pop.has('worked_tile')
				? this.pops.surface({
					class: 'base-screen-bottombar-pop-' + pop_type + '-' + #to_string(variant),
					left: left,
				})
				: this.pops.button({
					class: 'base-screen-bottombar-pop-' + pop_type + '-' + #to_string(variant),
					left: left,
					sound: 'ok.wav',
				});
			if (!pop.has('worked_tile')) {
				const base_id = base.id;
				const pop_id = pop.id;
				icon.on('click', (e) => {
					const live_base = this._get_live_base(base_id);
					const live_pop = this._get_live_pop(live_base, pop_id);
					if (
						live_base == null || live_pop == null ||
						live_base.get_owner().id != this.p.game.get_player().id
					) {
						return true;
					}
					const next = this.p.game.get('f_base_get_next_specialist')(
						live_base.get_owner(),
						live_pop.get_type()
					);
					if (next != null) {
						this.p.game.event('set_base_specialist', {
							base: live_base,
							pop: live_pop,
							type: next.id,
						});
					}
					return true;
				});
			}
			left += shift;
		}

	},

};
