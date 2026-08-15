return {

	init: (p) => {
		this.p = p;
		this.player = null;
		this.targets = {};
		this.target = '';

		return p.create('SELECT RESEARCH GOAL', 500, 148, (body, cb) => {
			body.text({
				class: 'game-popup-text',
				text: 'Technology:',
				left: 10,
				top: 12,
			});
			this.target_select = body.select({
				class: 'popup-list-select',
				align: 'top right',
				right: 10,
				top: 8,
				width: 350,
				items: [['', 'No research available']],
				value: '',
			});
			this.target_select.on('select', (e) => {
				this.target = e.value;
				this.refresh();
				return true;
			});
			this.status = body.text({
				class: 'game-popup-text',
				text: '',
				left: 10,
				right: 10,
				top: 52,
			});
			body.button({
				class: 'game-popup-button',
				text: 'Cancel',
				top: 92,
				is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});
			this.begin_button = body.button({
				class: 'game-popup-button',
				text: 'Begin Research',
				top: 116,
				is_ok: true,
			});
			this.begin_button.on('click', (e) => {
				if (
					this.player != null && this.target != '' &&
					#is_defined(this.targets[this.target])
				) {
					p.game.event('set_research_target', {
						player: this.player,
						target: this.target,
					});
					cb(true);
				}
				return true;
			});
		});
	},

	refresh: () => {
		if (!#is_defined(this.targets[this.target])) {
			this.status.text = 'No technology is currently available.';
			this.begin_button.hide();
			return;
		}
		const definition = this.targets[this.target];
		const state = this.player.get_research_state();
		this.status.text = 'Research cost: ' + #to_string(definition.cost) +
			' labs. Accumulated labs: ' + #to_string(state.progress) + '.';
		this.begin_button.show();
	},

	on_show: () => {
		this.player = this.p.game.get_player();
		this.targets = {};
		const state = this.player.get_research_state();
		let items = [];
		for (id of this.p.game.get('f_technology_get_available_targets')(
			state.technologies
		)) {
			const definition = this.p.game.get('f_technology_get_definition')(id);
			if (definition != null) {
				this.targets[id] = definition;
				items :+[id, definition.name + ' (' + #to_string(definition.cost) + ' labs)'];
			}
		}
		this.target_select.items = #sizeof(items) > 0
			? items
			: [['', 'No research available']];
		this.target_select.readonly = #sizeof(items) == 0;
		this.target = #is_defined(this.targets[state.target])
			? state.target
			: (#sizeof(items) > 0 ? items[0][0] : '');
		this.target_select.value = this.target;
		this.refresh();
	},

	on_hide: () => {
		this.player = null;
		this.targets = {};
		this.target = '';
	},

};
