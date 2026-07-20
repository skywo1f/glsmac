return {

	init: (p) => {
		this.p = p;
		this.base = null;
		this.production = #undefined;
		this.queue = [];
		this.set_candidates = [];
		this.queue_candidates = [];

		this.frame = p.body.panel({
			class: 'default-panel',
			align: 'top left',
			top: 59,
			bottom: 7,
			left: 137,
			width: 106,
		});

		this.frame.button({
			class: 'game-popup-button',
			text: 'QUEUE',
			align: 'top',
			top: 2,
			left: 2,
			right: 2,
		});
		this.items = this.frame.listview({
			class: 'default-panel-inner',
			top: 24,
			bottom: 45,
			left: 3,
			right: 3,
			itemsize: 14,
			padding: 5,
			has_hscroll: false,
			has_vscroll: false,
		});

		this.change_button = this.frame.button({
			class: 'game-popup-button',
			text: 'CHANGE',
			align: 'bottom',
			bottom: 23,
			left: 2,
			right: 2,
		});
		this.change_button.on('click', (e) => {
			if (this.base == null || #sizeof(this.set_candidates) == 0) {
				return true;
			}
			let next_index = 0;
			if (#is_defined(this.production)) {
				for (let i = 0; i < #sizeof(this.set_candidates); i++) {
					if (
						this.set_candidates[i].production_kind == this.production.production_kind &&
						this.set_candidates[i].id == this.production.id
					) {
						next_index = (i + 1) % #sizeof(this.set_candidates);
						break;
					}
				}
			}
			this.p.game.event('set_base_production', {
				base: this.base,
				kind: this.set_candidates[next_index].production_kind,
				id: this.set_candidates[next_index].id,
			});
			return true;
		});

		this.add_button = this.frame.button({
			class: 'game-popup-button',
			text: '+',
			align: 'bottom left',
			bottom: 2,
			left: 2,
			width: 49,
		});
		this.add_button.on('click', (e) => {
			if (this.base == null || #sizeof(this.queue_candidates) == 0) {
				return true;
			}
			let next_index = 0;
			if (#sizeof(this.queue) > 0) {
				const last = this.queue[#sizeof(this.queue) - 1];
				for (let i = 0; i < #sizeof(this.queue_candidates); i++) {
					if (
						this.queue_candidates[i].production_kind == last.production_kind &&
						this.queue_candidates[i].id == last.id
					) {
						next_index = (i + 1) % #sizeof(this.queue_candidates);
						break;
					}
				}
			}
			this.p.game.event('queue_base_production', {
				base: this.base,
				kind: this.queue_candidates[next_index].production_kind,
				id: this.queue_candidates[next_index].id,
			});
			return true;
		});

		this.remove_button = this.frame.button({
			class: 'game-popup-button',
			text: '-',
			align: 'bottom right',
			bottom: 2,
			right: 2,
			width: 49,
		});
		this.remove_button.on('click', (e) => {
			if (this.base == null || #sizeof(this.queue) == 0) {
				return true;
			}
			this.p.game.event('remove_base_production', {
				base: this.base,
				index: #sizeof(this.queue) - 1,
			});
			return true;
		});
	},

	set: (data) => {
		this.base = data.base;
		this.production = data.production;
		this.queue = data.queue;
		this.set_candidates = data.set_candidates;
		this.queue_candidates = data.queue_candidates;

		this.items.clear();

		let i = 0;
		for (item of this.queue) {
			this.items.text({
				class: 'base-screen-frame-text',
				text: item.name,
			});
			i++;
			if (i == 8) {
				break;
			}
		}
		while (i < 8) {
			this.items.text({
				class: 'base-screen-frame-text',
				text: 'Empty Slot',
			});
			i++;
		}
		
	},

};
