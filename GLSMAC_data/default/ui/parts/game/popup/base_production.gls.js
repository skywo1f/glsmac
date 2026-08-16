return {

	init: (p) => {
		this.p = p;
		this.base_id = null;
		this.candidates = [];
		this.available_count = 0;
		this.list = null;
		this.get_live_base = () => {
			if (this.base_id == null) {
				return null;
			}
			for (candidate of this.p.game.get_bm().get_bases()) {
				if (candidate.id == this.base_id) {
					return candidate;
				}
			}
			return null;
		};
		return p.create('CHOOSE PRODUCTION', 560, 360, (body, cb) => {
			this.list_body = body;
			this.create_list();
			body.button({
				class: 'game-popup-button',
				text: 'Cancel',
				align: 'bottom',
				bottom: 8,
				is_cancel: true,
			}).on('click', (e) => {
				this.return_to_base_screen();
				return true;
			});
		});
	},

	return_to_base_screen: () => {
		const base = this.get_live_base();
		if (base == null) {
			this.p.hide();
			return;
		}
		this.p.modules.popup.set('base_screen', {base: base});
		this.p.modules.popup.show('base_screen');
	},

	create_list: () => {
		this.list = this.list_body.listview({
			class: 'default-panel-inner',
			left: 8,
			right: 8,
			top: 8,
			bottom: 36,
			itemsize: 27,
			padding: 3,
			vscroll_class: 'default-scroll-v',
			has_hscroll: false,
			has_vscroll: true,
		});
	},

	set: (data) => {
		this.base_id = data.base.id;
		this.candidates = [];
		for (candidate of data.candidates) {
			this.candidates :+{
				production_kind: candidate.production_kind,
				id: candidate.id,
				name: candidate.name,
				mineral_cost: candidate.mineral_cost,
			};
		}
		this.available_count = #sizeof(this.candidates);
	},

	on_show: () => {
		if (this.list != null) {
			this.list.remove();
		}
		this.create_list();
		this.available_count = #sizeof(this.candidates);
		if (this.get_live_base() == null || this.available_count == 0) {
			this.list.text({
				class: 'game-popup-text',
				text: 'No production is currently available.',
			});
			return;
		}
		for (candidate of this.candidates) {
			const selected = candidate;
			const kind = candidate.production_kind == 'project'
				? 'SECRET PROJECT'
				: (candidate.production_kind == 'facility' ? 'FACILITY' : 'UNIT');
			const button = this.list.button({
				class: 'game-popup-button',
				text: kind + ': ' + candidate.name + ' (' +
					#to_string(candidate.mineral_cost) + ' minerals)',
				left: 0,
				right: 0,
			});
			button.on('click', (e) => {
				const base = this.get_live_base();
				if (base == null) {
					return true;
				}
				this.p.game.event('set_base_production', {
					base: base,
					kind: selected.production_kind,
					id: selected.id,
				});
				this.return_to_base_screen();
				return true;
			});
		}
	},

	on_hide: () => {
		this.base_id = null;
		this.candidates = [];
		this.available_count = 0;
	},

	on_cancel: () => {
		this.return_to_base_screen();
		return true;
	},

};
