return {

	init: (p) => {
		this.p = p;
		this.base = null;
		this.production = #undefined;
		this.candidates = [];

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
			bottom: 24,
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
			bottom: 2,
			left: 2,
			right: 2,
		});
		this.change_button.on('click', (e) => {
			if (this.base == null || #sizeof(this.candidates) == 0) {
				return true;
			}
			let next_index = 0;
			if (#is_defined(this.production)) {
				for (let i = 0; i < #sizeof(this.candidates); i++) {
					if (this.candidates[i].id == this.production.id) {
						next_index = (i + 1) % #sizeof(this.candidates);
						break;
					}
				}
			}
			this.p.game.event('set_base_production', {
				base: this.base,
				type: this.candidates[next_index].id,
			});
			return true;
		});
	},

	set: (data) => {
		this.base = data.base;
		this.production = data.production;
		this.candidates = data.candidates;

		this.items.clear();

		let i = 0;
		let items = [];
		if (#is_defined(this.production)) {
			items :+this.production.name;
		}
		for (item of items) {
			this.items.text({
				class: 'base-screen-frame-text',
				text: item,
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
