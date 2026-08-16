return {

	init: (p) => {
		this.p = p;
		this.targets = {};
		this.target = '';
		this.target_list = null;
		this.available_count = 0;

		return p.create('SELECT RESEARCH GOAL', 500, 320, (body, cb) => {
			this.list_body = body;
			body.text({
				class: 'game-popup-text',
				text: 'Available technologies',
				left: 10,
				top: 12,
			});
			this.create_target_list();
			this.status = body.text({
				class: 'game-popup-text',
				text: '',
				left: 10,
				right: 10,
				top: 238,
			});
			body.button({
				class: 'game-popup-button',
				text: 'Cancel',
				top: 264,
				is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});
			this.begin_button = body.button({
				class: 'game-popup-button',
				text: 'Begin Research',
				top: 288,
				is_ok: true,
			});
			this.begin_button.on('click', (e) => {
				if (
					this.target != '' &&
					#is_defined(this.targets[this.target])
				) {
					const player = p.game.get_player();
					const target = this.target;
					p.game.event('set_research_target', {
						player: player,
						target: target,
					});
					cb(true);
				}
				return true;
			});
		});
	},

	create_target_list: () => {
		this.target_list = this.list_body.listview({
			class: 'default-panel-inner',
			left: 10,
			right: 10,
			top: 38,
			bottom: 92,
			itemsize: 25,
			padding: 3,
			vscroll_class: 'default-scroll-v',
			has_hscroll: false,
			has_vscroll: true,
		});
	},

	select_target: (target) => {
		this.target = target;
		this.refresh();
	},

	refresh: () => {
		if (!#is_defined(this.targets[this.target])) {
			this.status.text = 'No technology is currently available.';
			this.begin_button.hide();
			return;
		}
		const definition = this.targets[this.target];
		const state = this.p.game.get_player().get_research_state();
		this.status.text = definition.name + ': ' + #to_string(definition.cost) +
			' labs. Accumulated labs: ' + #to_string(state.progress) + '.';
		this.begin_button.show();
	},

	on_show: () => {
		this.targets = {};
		this.available_count = 0;
		if (this.target_list != null) {
			this.target_list.remove();
		}
		this.create_target_list();
		const state = this.p.game.get_player().get_research_state();
		let available = [];
		for (id of this.p.game.get('f_technology_get_available_targets')(
			state.technologies
		)) {
			const definition = this.p.game.get('f_technology_get_definition')(id);
			if (definition != null) {
				this.targets[id] = definition;
				available :+{id: id, definition: definition};
			}
		}
		this.available_count = #sizeof(available);
		const target = #is_defined(this.targets[state.target])
			? state.target
			: (this.available_count > 0 ? available[0].id : '');
		for (candidate of available) {
			const target_id = candidate.id;
			const button = this.target_list.button({
				class: 'game-popup-button',
				text: candidate.definition.name + ' (' +
					#to_string(candidate.definition.cost) + ' labs)',
				left: 0,
				right: 0,
			});
			button.on('click', (e) => {
				this.select_target(target_id);
				return true;
			});
		}
		if (this.available_count == 0) {
			this.target_list.text({
				class: 'game-popup-text',
				text: 'No research is currently available.',
			});
		}
		this.select_target(target);
	},

	on_hide: () => {
		this.targets = {};
		this.available_count = 0;
		this.target = '';
	},

};
