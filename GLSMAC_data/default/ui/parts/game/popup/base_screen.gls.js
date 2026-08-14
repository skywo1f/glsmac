return {

	available_sections: [
		'top_buttons',
		'nutrients',
		'economy',
		'game_state',
		'middle_area',
		'facilities',
		'resources',
		'energy',
		'buttons',
		'bottom_bar',
	],

	init: (p) => {

		this.sections = {};
		this.p = p;
		this.is_open = false;
		this.base_id = null;

		p.ui.class('base-screen-frame').set({
			border: 'rgb(35,59,34),2',
		});
		p.ui.class('base-screen-block').extend('default-panel-inner').set({
			top: 3,
			left: 3,
			bottom: 3,
			right: 3,
		});

		p.ui.class('base-screen-header').extend('base-screen-block').set({
			align: 'top',
			height: 20,
		});
		p.ui.class('base-screen-body').extend('base-screen-block').set({
			align: 'top',
			top: 24,
		});

		p.ui.class('base-screen-side-frame').extend('base-screen-frame').set({
			width: 132,
		});
		p.ui.class('base-screen-side-middle-frame').extend('base-screen-frame').set({
			width: 539,
		});

		p.ui.class('base-screen-frame-title').set({
			align: 'center',
			font: 'arialnb.ttf:16',
			color: 'rgb(53,61,115)',
		});
		p.ui.class('base-screen-frame-text').set({
			font: 'arialnb.ttf:14', // TODO: investigate why non-bold fonts look bad (LOD settings?)
			color: 'rgb(59,111,128)',
		});

		p.ui.class('base-screen-frame-info-text').set({
			font: 'arialnb.ttf:14',
			color: 'rgb(42,101,120)',
		});

		p.ui.class('base-screen-frame-text-important').extend('base-screen-frame-text').set({
			color: 'rgb(120,164,212)',
		});

		p.ui.class('base-screen-side-header').extend('base-screen-body').set({
			left: 3,
			width: 127,
			height: 20,
		});

		p.ui.class('base-screen-side-header-text').set({
			font: 'arialnb.ttf:15',
			align: 'center',
		});

		return p.create('', 680, 442, (body, cb) => {

			body.listen(p.game, 'update_base', (e) => {
				if (this.is_open && e.base.id == this.base_id) {
					this.set({
						base: e.base,
					});
				}
			});

			const pp = {
				body: body,
				ui: p.ui,
				game: p.game,
				hide: p.hide,
				modules: p.modules,
				utils: {
					set_cells: parent.parent.set_cells,
				},
			};

			for (s of this.available_sections) {
				this.sections[s] = #include('base_screen/' + s);
				this.sections[s].init(pp);
			}

		});

	},

	set: (data) => {

		const game = this.p.game;
		const base_profile_callback = game.get('f_base_screen_profile');
		const is_base_profiling = #typeof(base_profile_callback) == 'Callable';
		const base_profile_started = is_base_profiling ? #monotonic_ms() : 0;
		let base_phase_started = base_profile_started;
		const finish_base_phase = (phase) => {
			if (!is_base_profiling) { return; }
			const now = #monotonic_ms();
			base_profile_callback({
				phase: phase,
				elapsed_ms: now - base_phase_started,
				total_ms: now - base_profile_started,
			});
			base_phase_started = now;
		};
		const base = data.base;
		const owner = base.get_owner();
		const faction = owner.get_faction();

		this.base_id = base.id;

		const intake = base.get_intake();
		const consumption = base.get_consumption();
		const pending_growth = intake.NUTRIENTS - consumption.NUTRIENTS;
		const pending_production = game.get('f_base_is_rioting')(base)
			? 0
			: #max(intake.MINERALS - consumption.MINERALS, 0);
		let supported_units = #is_defined(base.get_supported_units)
			? base.get_supported_units()
			: [];
		if (!#is_defined(base.get_supported_units)) {
			for (unit of game.get_um().get_units()) {
				if (unit.owner == owner.id && unit.home_base_id == base.id) {
					supported_units :+unit;
				}
			}
		}
		const free_support_capacity = #max(base.get_size(), 1);
		const support = {
			units: supported_units,
			free_units: #min(#sizeof(supported_units), free_support_capacity),
			mineral_upkeep: consumption.MINERALS,
		};
		finish_base_phase('prepare');

		// dummy data for now

		this.sections.nutrients.set({
			rows: base.get_size() + 1,
			columns: game.get('map_growth_base'),
			capacity: game.get('f_base_get_nutrients_for_growth')(game, base),
			filled: base.get('accumulated_nutrients'),
			pending: pending_growth,
		});
		finish_base_phase('nutrients');

		if (faction.is_progenitor) {
			this.sections.economy.set_energy_grid({
				// TODO
			});
		} else {
			this.sections.economy.set_commerce(
				game.get('f_economy_get_base_commerce')(game, base)
			);
		}
		finish_base_phase('economy');

		this.sections.game_state.set({
			year: game.get_year(),
			energy: owner.energy_credits,
			ecodamage: game.get('f_ecology_get_base_damage')(base, intake).percent,
		});
		finish_base_phase('game_state');

		this.sections.top_buttons.set({base: base});
		finish_base_phase('top_buttons');

		let facility_names = [];
		for (facility of base.get_facilities()) {
			facility_names :+(facility.is_project ? 'PROJECT: ' : '') + facility.name;
		}
		this.sections.facilities.set(facility_names);
		finish_base_phase('facilities');

		const resource_data = {
			nutrients: {
				profit: intake.NUTRIENTS,
				loss: consumption.NUTRIENTS,
			},
			minerals: {
				profit: intake.MINERALS,
				loss: consumption.MINERALS,
			},
			energy: {
				profit: intake.ENERGY,
				loss: consumption.ENERGY,
			},
		};
		const energy_diagnostics = game.get('f_economy_get_base_energy')(base, intake);
		resource_data.energy.loss =
			resource_data.energy.loss + energy_diagnostics.inefficiency;
		resource_data.energy_inefficiency = energy_diagnostics;
		this.sections.resources.set(resource_data);
		finish_base_phase('resources');

		this.sections.energy.set(
			game.get('f_economy_get_base_allocation')(game, base, intake, consumption)
		);
		finish_base_phase('energy');

		this.sections.middle_area.set({
			base: base,
			support: support,
		});
		finish_base_phase('middle_area');
		this.sections.buttons.set({
			base: base,
		});
		finish_base_phase('buttons');

		this.sections.bottom_bar.set({
			base: base,
			support: support,
			pending_production: pending_production,
		});
		finish_base_phase('bottom_bar');
	},

	on_hide: () => {
		this.sections.bottom_bar.frame.hide();
		this.is_open = false;
	},

	on_show: () => {
		this.is_open = true;
		this.sections.bottom_bar.frame.show();
	},

	set_cells: (total_width, total_height, columns, rows, filled, pending, cells_el, cell_baseclass, label_el, f_label, capacity_in, cell_cache) => {
		const width = #floor(#to_float(total_width) / #to_float(columns));
		const height = #floor(#to_float(total_height) / #to_float(rows));
		const capacity = #is_defined(capacity_in) ? capacity_in : rows * columns;
		const has_cell_cache = #is_defined(cell_cache);
		if (has_cell_cache && #is_defined(cell_cache.rendered)) {
			const rendered = cell_cache.rendered;
			if (
				rendered.total_width == total_width && rendered.total_height == total_height &&
				rendered.columns == columns && rendered.rows == rows &&
				rendered.filled == filled && rendered.pending == pending &&
				rendered.capacity == capacity && rendered.cell_baseclass == cell_baseclass
			) {
				return;
			}
		}
		const get_cell_class = (index) => {
			let suffix = 'empty';
			if (index < filled) {
				if (pending < 0 && index >= filled + pending) {
					suffix = 'deficit';
				} else {
					suffix = 'full';
				}
			} else if (index < filled + pending) {
				suffix = 'pending';
			}
			return cell_baseclass + '-' + suffix;
		};
		let can_reuse_cells =
			has_cell_cache &&
			cell_cache.columns == columns &&
			cell_cache.rows == rows &&
			cell_cache.capacity == capacity &&
			#sizeof(cell_cache.cells) == capacity &&
			#is_defined(cell_cache.classes) &&
			#sizeof(cell_cache.classes) == capacity &&
			#is_defined(cell_cache.variants) &&
			#sizeof(cell_cache.variants) == capacity;

		const cell_width = width - 1;
		const cell_height = height - 1;
		const cell_geometry_changed =
			!has_cell_cache ||
			!#is_defined(cell_cache.width) ||
			cell_cache.width != cell_width ||
			cell_cache.height != cell_height;
		if (cell_geometry_changed) {
			this.p.ui.class(cell_baseclass).set({
				width: cell_width,
				height: cell_height,
			});
			if (has_cell_cache) {
				cell_cache.width = cell_width;
				cell_cache.height = cell_height;
			}
		}
		if (!can_reuse_cells) {
			cells_el.clear();
			if (has_cell_cache) {
				cell_cache.cells = [];
				cell_cache.classes = [];
				cell_cache.variants = [];
				cell_cache.columns = columns;
				cell_cache.rows = rows;
				cell_cache.capacity = capacity;
			}
		}

		const offset_left = (total_width - (columns * width)) / 2;
		let left = offset_left;
		let top = (total_height - (rows * height)) / 2;

		let i = 0;
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < columns; x++) {
				if (i < capacity) {
					const cell_class = get_cell_class(i);
					if (can_reuse_cells) {
						if (cell_cache.classes[i] != cell_class) {
							const variants = cell_cache.variants[i];
							let next_cell = null;
							for (let variant_index = 0; variant_index < #sizeof(variants.classes); variant_index++) {
								if (variants.classes[variant_index] == cell_class) {
									next_cell = variants.cells[variant_index];
								}
							}
							cell_cache.cells[i].hide();
							if (next_cell == null) {
								next_cell = cells_el.panel({
									class: cell_class,
									left: left + 1,
									top: top + 1,
								});
								variants.classes :+cell_class;
								variants.cells :+next_cell;
							} else {
								next_cell.show();
							}
							cell_cache.cells[i] = next_cell;
							cell_cache.classes[i] = cell_class;
						}
					} else {
						const cell = cells_el.panel({
							class: cell_class,
							left: left + 1,
							top: top + 1,
						});
						if (has_cell_cache) {
							cell_cache.cells :+cell;
							cell_cache.classes :+cell_class;
							cell_cache.variants :+{
								classes: [cell_class],
								cells: [cell],
							};
						}
					}
				}
				i++;
				left += width;
			}
			top += height;
			left = offset_left;
		}

		let progress_in = 0;
		if (pending > 0) {
			progress_in = #ceil(#to_float(capacity - filled) / #to_float(pending));
		}
		label_el.text = f_label(progress_in);
		if (has_cell_cache) {
			cell_cache.rendered = {
				total_width: total_width,
				total_height: total_height,
				columns: columns,
				rows: rows,
				filled: filled,
				pending: pending,
				capacity: capacity,
				cell_baseclass: cell_baseclass,
			};
		}
	},

};
