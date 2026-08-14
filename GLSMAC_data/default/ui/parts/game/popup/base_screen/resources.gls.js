return {

	init: (p) => {

		this.cell_width = 4;
		this.total_cells = 58; // original SMAC has 39 but leaves a lot of space for no reason(?)
		this.last_label_values = {};
		this.last_inefficiency_text = #undefined;

		this.frame = p.body.panel({
			class: 'base-screen-side-middle-frame',
			align: 'top right',
			top: 259,
			right: 3,
			height: 89,
		});

		const cw = this.cell_width;

		p.ui.class('base-screen-resources-cell').set({
			width: cw,
			height: 9,
			background: 'rgb(53,61,115)',
		});
		p.ui.class('base-screen-resources-cell-nutrients').extend('base-screen-resources-cell').set({
			align: 'left top',
		});
		p.ui.class('base-screen-resources-cell-minerals').extend('base-screen-resources-cell').set({
			align: 'left center',
		});
		p.ui.class('base-screen-resources-cell-energy').extend('base-screen-resources-cell').set({
			align: 'left bottom',
		});

		p.ui.class('base-screen-resources-cell-nutrients-loss').extend('base-screen-resources-cell-nutrients').set({
			background: 'interface.pcx:crop(397,22,417,41)',
		});
		p.ui.class('base-screen-resources-cell-nutrients-profit').extend('base-screen-resources-cell-nutrients').set({
			background: 'interface.pcx:crop(418,22,438,41)',
		});
		p.ui.class('base-screen-resources-cell-minerals-loss').extend('base-screen-resources-cell-minerals').set({
			background: 'interface.pcx:crop(397,43,417,62)',
		});
		p.ui.class('base-screen-resources-cell-minerals-profit').extend('base-screen-resources-cell-minerals').set({
			background: 'interface.pcx:crop(418,43,438,62)',
		});
		p.ui.class('base-screen-resources-cell-energy-loss').extend('base-screen-resources-cell-energy').set({
			background: 'interface.pcx:crop(397,1,417,20)',
		});
		p.ui.class('base-screen-resources-cell-energy-profit').extend('base-screen-resources-cell-energy').set({
			background: 'interface.pcx:crop(418,1,438,20)',
		});

		p.ui.class('base-screen-resources-label-left').extend('base-screen-side-header-text').set({
			left: 6,
		});
		p.ui.class('base-screen-resources-label-right').extend('base-screen-side-header-text').set({
			left: 359,
		});

		const c_nutrients = 'rgb(116,156,56)';
		const c_minerals = 'rgb(144,184,228)';
		const c_energy = 'rgb(224,156,28)';

		this.frame.panel({
			class: 'base-screen-side-header',
			top: 3,
		})
			.text({
				class: 'base-screen-side-header-text',
				color: c_nutrients,
				text: 'NUTRIENTS',
			})
		;

		this.frame.panel({
			class: 'base-screen-side-header',
			top: 24,
		})
			.text({
				class: 'base-screen-side-header-text',
				color: c_minerals,
				text: 'MINERALS',
			})
		;

		this.frame.panel({
			class: 'base-screen-side-header',
			top: 45,
		})
			.text({
				class: 'base-screen-side-header-text',
				color: c_energy,
				text: 'ENERGY',
			})
		;

		const body = this.frame.panel({
			class: 'base-screen-body',
			left: 132,
			top: 3,
			right: 3,
			bottom: 24,
		});
		this.cells = body.area({
			left: 66,
			right: 90,
			top: 6,
			bottom: 5,
		});
		this.resource_cells = {};
		for (resource_type of ['nutrients', 'minerals', 'energy']) {
			this.resource_cells[resource_type] = {
				loss: {items: [], count: 0},
				profit: {items: [], count: 0},
			};
		}
		this.labels = {
			nutrients: {
				left: body.text({
					class: 'base-screen-resources-label-left',
					align: 'top left',
					top: 4,
					color: c_nutrients,
				}),
				right: body.text({
					class: 'base-screen-resources-label-right',
					align: 'top left',
					top: 4,
					color: c_nutrients,
				}),
			},
			minerals: {
				left: body.text({
					class: 'base-screen-resources-label-left',
					align: 'center left',
					color: c_minerals,
				}),
				right: body.text({
					class: 'base-screen-resources-label-right',
					align: 'center left',
					color: c_minerals,
				}),
			},
			energy: {
				left: body.text({
					class: 'base-screen-resources-label-left',
					align: 'bottom left',
					bottom: 4,
					color: c_energy,
				}),
				right: body.text({
					class: 'base-screen-resources-label-right',
					align: 'bottom left',
					bottom: 4,
					color: c_energy,
				}),
			},
		};

		const info = this.frame.panel({
			class: 'base-screen-body',
			align: 'bottom',
			left: 3,
			right: 3,
			bottom: 3,
			height: 20,
		});
		this.inefficiency = info.area({
			align: 'left',
			width: 442,
		})
			.text({
				class: 'base-screen-frame-info-text',
				align: 'center',
			})
		;
		info.area({
			align: 'right',
			width: 80,
		})
			.text({
				class: 'base-screen-frame-info-text',
				text: '= SURPLUS',
				align: 'left center',
			})
		;

	},

	_pad: (value) => {
		return #pad(#to_string(value), 'left', 3, '0');
	},

	_set_cell_pool: (type, kind, count, start, width) => {
		const pool = this.resource_cells[type][kind];
		if (count < pool.count) {
			for (let hide_i = count; hide_i < pool.count; hide_i++) {
				pool.items[hide_i].hide();
			}
		} else if (count > pool.count) {
			const reusable_count = #min(count, #sizeof(pool.items));
			for (let show_i = pool.count; show_i < reusable_count; show_i++) {
				pool.items[show_i].show();
			}
			for (let create_i = #sizeof(pool.items); create_i < count; create_i++) {
				pool.items :+this.cells.surface({
					class: 'base-screen-resources-cell-' + type + '-' + kind,
					left: (start + create_i) * width,
				});
			}
		}
		for (let position_i = 0; position_i < count; position_i++) {
			pool.items[position_i].left = (start + position_i) * width;
		}
		pool.count = count;
	},

	set: (data) => {
		const types = ['nutrients', 'minerals', 'energy'];

		const w = this.cell_width + 1;

		for (type of types) {
			const d = data[type];
			const total = d.profit - d.loss;

			const loss_count = #min(#max(d.loss, 0), this.total_cells);
			this._set_cell_pool(type, 'loss', loss_count, 0, w);
			const profit_start = #max(
				loss_count,
				#min(#max(this.total_cells - total, 0), this.total_cells)
			);
			this._set_cell_pool(
				type,
				'profit',
				this.total_cells - profit_start,
				profit_start,
				w
			);

			// labels
			const l = this.labels[type];
			const left_text = this._pad(d.profit) + ' - ' + this._pad(d.loss);
			let right_text = '';
			if (d.profit == d.loss) {
				right_text = this._pad(0);
			} else if (d.profit > d.loss) {
				right_text = '+' + this._pad(d.profit - d.loss);
			} else {
				right_text = '-' + this._pad(d.loss - d.profit);
			}
			const label_signature = left_text + '|' + right_text;
			if (!#is_defined(this.last_label_values[type]) || this.last_label_values[type] != label_signature) {
				l.left.text = left_text;
				l.right.text = right_text;
				this.last_label_values[type] = label_signature;
			}
		}
		const energy = data.energy_inefficiency;
		const efficiency = energy.efficiency >= 0
			? '+' + #to_string(energy.efficiency)
			: #to_string(energy.efficiency);
		const inefficiency_text =
			'INEFFICIENCY: ' + #to_string(energy.inefficiency) +
			'  HQ DISTANCE: ' + #to_string(energy.distance) +
			'  EFFIC: ' + efficiency;
		if (inefficiency_text != this.last_inefficiency_text) {
			this.inefficiency.text = inefficiency_text;
			this.last_inefficiency_text = inefficiency_text;
		}
	},

};
