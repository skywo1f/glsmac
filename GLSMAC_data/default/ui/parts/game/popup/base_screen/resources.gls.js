return {

	init: (p) => {

		this.cell_width = 4;
		this.total_cells = 58; // original SMAC has 39 but leaves a lot of space for no reason(?)

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

	set: (data) => {
		const types = ['nutrients', 'minerals', 'energy'];

		this.cells.clear();

		const w = this.cell_width + 1;

		for (type of types) {
			const d = data[type];
			const total = d.profit - d.loss;

			const loss_count = #min(#max(d.loss, 0), this.total_cells);
			for (let i = 0; i < loss_count; i++) {
				this.cells.surface({
					class: 'base-screen-resources-cell-' + type + '-loss',
					left: i * w,
				});
			}
			const profit_start = #max(
				loss_count,
				#min(#max(this.total_cells - total, 0), this.total_cells)
			);
			for (let profit_i = profit_start; profit_i < this.total_cells; profit_i++) {
				this.cells.surface({
					class: 'base-screen-resources-cell-' + type + '-profit',
					left: profit_i * w,
				});
			}

			// labels
			const l = this.labels[type];
			l.left.text = this._pad(d.profit) + ' - ' + this._pad(d.loss);
			if (d.profit == d.loss) {
				l.right.text = this._pad(0);
			} else if (d.profit > d.loss) {
				l.right.text = '+' + this._pad(d.profit - d.loss);
			} else {
				l.right.text = '-' + this._pad(d.loss - d.profit);
			}
		}
		const energy = data.energy_inefficiency;
		const efficiency = energy.efficiency >= 0
			? '+' + #to_string(energy.efficiency)
			: #to_string(energy.efficiency);
		this.inefficiency.text =
			'INEFFICIENCY: ' + #to_string(energy.inefficiency) +
			'  HQ DISTANCE: ' + #to_string(energy.distance) +
			'  EFFIC: ' + efficiency;
	},

};
