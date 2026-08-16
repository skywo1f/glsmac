return {

	tile_width: 100,
	tile_height: 50,

	init: (p) => {

		this.p = p;
		this.render_signature = null;
		this.click_context = null;

		this.el = p.area.panel({
			class: 'base-screen-middle-area',
		});
		this.el.on('mousedown', (e) => {
			return this._handle_mousedown(e);
		});

		p.ui.class('base-screen-middle-area-tile').set({
			width: parent.tile_width,
			height: parent.tile_height,
		});

	},

	_tile_key: (tile) => {
		return #to_string(tile.x) + '_' + #to_string(tile.y);
	},

	_handle_mousedown: (e) => {
		if (e.button != 'left' || this.click_context == null) {
			return true;
		}
		const click = this.click_context;
		const click_half_width = this.tile_width / 2;
		const click_x = e.x - click.c_left - click_half_width;
		const click_y = e.y - click.c_top - this.tile_height / 2;
		for (click_tile of click.existing_tiles) {
			const click_distance =
				#abs(click_tile.cx - click_x) +
				#abs(click_tile.cy - click_y) * click.tile_aspect_ratio;
			if (click_distance > click_half_width) {
				continue;
			}
			this._handle_tile(click_tile);
			break;
		}
		return true;
	},

	_handle_tile: (click_tile) => {
		if (this.click_context == null) {
			return true;
		}
		const click = this.click_context;
		const click_base = click.base;
		const find_best_or_worst = this.p.game.get('f_base_find_best_or_worst_tiles');
		const get_assignable = this.p.game.get('f_base_get_assignable_worker_tiles');
		if (click_tile == click.center) {
				let click_pops = click_base.get_pops();
				const best_tiles = find_best_or_worst(
					click_base,
					get_assignable(click_base),
					#sizeof(click_pops),
					1
				);
				let click_pop_index = 0;
				for (click_pop of click_pops) {
					const worked_tile = click_pop.get('worked_tile');
					if (#is_defined(worked_tile)) {
						this.p.game.event('unwork_base_tile', {
							base: click_base,
							tile: worked_tile,
						});
					}
				}
				for (click_pop of click_pops) {
					const best_tile = best_tiles[click_pop_index++];
					if (!#is_defined(best_tile)) {
						break;
					}
					this.p.game.event('work_base_tile', {
						base: click_base,
						tile: best_tile,
						pop: click_pop,
					});
				}
		} else if (click_tile.is_worked) {
				this.p.game.event('unwork_base_tile', {
					base: click_base,
					tile: click_tile.tile,
				});
		} else {
				let target_pop = null;
				for (candidate_pop of click_base.get_pops()) {
					if (candidate_pop.get_type() != 'WORKER') {
						target_pop = candidate_pop;
						break;
					}
				}
				if (target_pop == null) {
					const worst_tile = (
						find_best_or_worst(click_base, click_base.get_worked_tiles(), 1, 0 - 1)
					)[0];
					if (#is_defined(worst_tile)) {
						target_pop = worst_tile.get('working_pop');
					}
				}
				if (target_pop != null) {
					this.p.game.event('work_base_tile', {
						base: click_base,
						tile: click_tile.tile,
						pop: target_pop,
					});
				}
		}
		return true;
	},

	set: (data) => {
		let render_signature = #to_string(data.base.id);
		for (signature_tile of data.base.get_worked_tiles()) {
			render_signature += '|' + this._tile_key(signature_tile);
		}
		if (render_signature == this.render_signature) {
			this.click_context.base = data.base;
			return;
		}
		this.render_signature = render_signature;

		this.el.clear();

		// tile previews

		const c_left = #round(#to_float(this.tile_width) * 1.5);
		const c_top = #round(#to_float(this.tile_height) * 1.5);
		let existing_tiles = {};

		const tile_aspect_ratio = this.tile_width / this.tile_height;

		const f_tile = (tile, cx, cy) => {
			const key = this._tile_key(tile);
			if (#is_defined(existing_tiles[key])) {
				// don't draw duplicate tiles
				return;
			}
			const t = {
				tile: tile,
				cx: #round(#to_float(parent.tile_width) * cx),
				cy: #round(#to_float(parent.tile_height) * cy),
				is_worked: false,
			};

			const tile_el = this.el.widget({
				class: 'base-screen-middle-area-tile',
				data: {
					tile: tile,
				},
				left: c_left + t.cx,
				top: c_top + t.cy,
				type: 'tile-preview',
			});
			tile_el.on('mousedown', (e) => {
				if (e.button == 'left') {
					return this._handle_tile(t);
				}
				return true;
			});

			existing_tiles[key] = t;
			return t;
		};

		const f_base = () => {
			this.el.widget({
				type: 'base-preview',
				data: {
					base: data.base,
					no_badge: true,
				},
				width: parent.tile_width,
				height: parent.tile_height + 20,
				left: c_left,
				top: c_top - 20,
			});
		};

		const f_resources = (t) => {
			t.is_worked = true;
			const resources_el = this.el.widget({
				class: 'base-screen-middle-area-tile',
				data: {
					tile: t.tile,
				},
				left: c_left + t.cx,
				top: c_top + t.cy,
				type: 'tile-resources',
			});
			resources_el.on('mousedown', (e) => {
				if (e.button == 'left') {
					return this._handle_tile(t);
				}
				return true;
			});
		};

		// terrain
		const t_center = f_tile(data.base.get_tile(), 0.0, 0.0);
		const t_n = f_tile(t_center.tile.get_N(), 0.0, 0.0 - 1.0); // TODO: remove the need for 0.0 - ...
		const t_ne = f_tile(t_center.tile.get_NE(), 0.5, 0.0 - 0.5);
		const t_e = f_tile(t_center.tile.get_E(), 1.0, 0.0);
		const t_se = f_tile(t_center.tile.get_SE(), 0.5, 0.5);
		const t_s = f_tile(t_center.tile.get_S(), 0.0, 1.0);
		const t_sw = f_tile(t_center.tile.get_SW(), 0.0 - 0.5, 0.5);
		const t_w = f_tile(t_center.tile.get_W(), 0.0 - 1.0, 0.0);
		const t_nw = f_tile(t_center.tile.get_NW(), 0.0 - 0.5, 0.0 - 0.5);
		if (#is_defined(t_n)) {
			const t_n_nw = f_tile(t_n.tile.get_NW(), 0.0 - 0.5, 0.0 - 1.5);
			const t_n_ne = f_tile(t_n.tile.get_NE(), 0.5, 0.0 - 1.5);
		}
		if (#is_defined(t_ne)) {
			const t_ne_ne = f_tile(t_ne.tile.get_NE(), 1.0, 0.0 - 1.0);
		}
		const t_e_ne = f_tile(t_e.tile.get_NE(), 1.5, 0.0 - 0.5);
		const t_e_se = f_tile(t_e.tile.get_SE(), 1.5, 0.5);
		if (#is_defined(t_se)) {
			const t_se_se = f_tile(t_se.tile.get_SE(), 1.0, 1.0);
		}
		if (#is_defined(t_s)) {
			const t_s_se = f_tile(t_s.tile.get_SE(), 0.5, 1.5);
			const t_s_sw = f_tile(t_s.tile.get_SW(), 0.0 - 0.5, 1.5);
		}
		if (#is_defined(t_sw)) {
			const t_sw_sw = f_tile(t_sw.tile.get_SW(), 0.0 - 1.0, 1.0);
		}
		const t_w_sw = f_tile(t_w.tile.get_SW(), 0.0 - 1.5, 0.5);
		const t_w_nw = f_tile(t_w.tile.get_NW(), 0.0 - 1.5, 0.0 - 0.5);
		if (#is_defined(t_nw)) {
			const t_nw_nw = f_tile(t_nw.tile.get_NW(), 0.0 - 1.0, 0.0 - 1.0);
		}

		// base
		f_base();

		// resources
		f_resources(t_center);
		for (tile of data.base.get_worked_tiles()) {
			const key = this._tile_key(tile);
			if (#is_defined(existing_tiles[key])) {
				f_resources(existing_tiles[key]);
			}
		}
		this.click_context = {
			base: data.base,
			c_left: c_left,
			c_top: c_top,
			tile_aspect_ratio: tile_aspect_ratio,
			existing_tiles: existing_tiles,
			center: t_center,
		};
	},

};
