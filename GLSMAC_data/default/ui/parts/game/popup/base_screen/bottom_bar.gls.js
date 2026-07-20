return {

	available_parts: [
		'production',
		'queue',
		'middle_area',
		'support',
	],

	init: (p) => {

		this.p = p;

		this.parts = {};

		this.frame = p.ui.root.area({
			zindex: 0.85,
			align: 'bottom',
			height: p.modules.bottom_bar.height,
			left: 0,
			right: 0,
		});
		this.frame.on('mousedown', (e) => {
			// prevent clickthroughs

			const left = e.ax;
			const right = p.ui.get_width() - e.ax;
			const bottom = p.ui.get_height() - e.ay;

			if (left >= 252 && right >= 262 && bottom >= 10 && bottom <= 60) {
				// allow clickthroughs to objects list
				// TODO: better way to do this?
				return false;
			}

			// block everything else
			return true;
		});
		this.frame.hide();

		// hide menus
		p.ui.class('base-screen-bottombar-menu-hidebutton').set({
			width: 106,
			height: 14,
			background: 'black',
		});
		this.frame.surface({
			class: 'base-screen-bottombar-menu-hidebutton',
			align: 'top left',
			left: 11,
			top: 20,
		}).on('mousedown', (e) => {
			return true;
		});
		this.frame.surface({
			class: 'base-screen-bottombar-menu-hidebutton',
			align: 'top right',
			right: 11,
			top: 22,
		}).on('mousedown', (e) => {
			return true;
		});

		const pp = {
			ui: p.ui,
			game: p.game,
			body: parent.frame,
			utils: p.utils,
		};

		for (s of this.available_parts) {
			this.parts[s] = #include('bottom_bar/' + s);
			this.parts[s].init(pp);
		}

	},

	set: (data) => {
		const base = data.base;
		const production = base.get_production();
		const pending = this.p.game.get('f_base_get_pending_production')(base);
		let candidates = [];
		for (def of this.p.game.get_um().get_unit_defs()) {
			if (base.can_produce(def.id)) {
				candidates :+def;
			}
		}

		if (#is_defined(production)) {
			this.parts.production.set({
				name: production.name,
				rows: #max(#ceil(#to_float(production.mineral_cost) / 10.0), 1),
				columns: 10,
				filled: #min(base.get_accumulated_minerals(), production.mineral_cost),
				pending: pending,
			});
		} else {
			this.parts.production.set({
				name: 'NOTHING',
				rows: 1,
				columns: 10,
				filled: 0,
				pending: 0,
			});
		}

		this.parts.queue.set({
			base: base,
			production: production,
			candidates: candidates,
		});

		this.parts.middle_area.set({
			name: base.name,
			owner: base.get_owner(),
			pops: base.get_pops(),
		});

	},

};
