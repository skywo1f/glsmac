return {

	refresh: (width) => {

		const optimal_panel_size = 210;
		const panel_padding = 3;

		let panels_count = ( width + panel_padding ) / optimal_panel_size;
		if ( panels_count < 1 ) {
			panels_count = 1; // prevent division by zero
		}
		const panel_width = ( width + panel_padding ) / panels_count - panel_padding;

		let current_panels_count = #sizeof(this.panels);

		let left = 0;
		for (let i = 0; i < panels_count; i++) {
			if (i < current_panels_count) {
				// resize existing panel
				this.panels[i].width = panel_width;
				this.panels[i].left = left;
			}
			else {
				// add new panel
				this.panels :+ this.add_panel(left, panel_width, i);
			}
			left += panel_width + panel_padding;
		}
		while ( current_panels_count > panels_count ) {
			// remove excessive panels
			current_panels_count--;
			this.panels[ current_panels_count ].remove();
			this.panels :~;
		}

	},

	set_research: () => {
		if (this.research_name == null) {
			return;
		}
		const player = this.game.get_player();
		const state = player.get_research_state();
		if (state.target != '') {
			const technology = this.game.get('f_technology_get_definition')(state.target);
			if (technology == null) {
				this.research_name.text = 'Unknown technology';
				this.research_progress.text = '';
				return;
			}
			this.research_name.text = technology.name;
			const cost_resolver = this.game.get('f_technology_get_research_cost');
			const cost = #is_defined(state.cost) && state.cost > 0
				? state.cost
				: (#typeof(cost_resolver) == 'Callable'
					? cost_resolver(player)
					: technology.cost);
			this.research_progress.text =
				#to_string(state.progress) + ' / ' + #to_string(cost) + ' Labs';
		} else if (player.has_technology('CentauriEcology')) {
			this.research_name.text = 'Centauri Ecology';
			this.research_progress.text = 'Discovered';
		} else {
			this.research_name.text = 'No research selected';
			this.research_progress.text = '';
		}
	},

	set_economy: () => {
		if (this.energy_credits == null) {
			return;
		}
		const player = this.game.get_player();
		const income_resolver = this.game.get('f_economy_get_player');
		const income = #typeof(income_resolver) == 'Callable'
			? income_resolver(this.game, player)
			: 0;
		this.energy_credits.text = #to_string(player.get_energy_credits()) + ' Energy Credits';
		this.energy_income.text = (income >= 0 ? '+' : '') +
			#to_string(income) + ' per turn';
	},

	add_panel: (left, width, index) => {

		const panel = this.page.panel({
			class: 'bottombar-info-panel',
			width: width,
			left: left,
		});

		if (index == 0) {
			panel.text({
				class: 'bottombar-info-title',
				text: 'RESEARCH',
			});
			this.research_name = panel.text({
				class: 'bottombar-info-value',
				top: 25,
			});
			this.research_progress = panel.text({
				class: 'bottombar-info-detail',
				top: 49,
			});
		} else if (index == 1) {
			panel.text({
				class: 'bottombar-info-title',
				text: 'ECONOMY',
			});
			this.energy_credits = panel.text({
				class: 'bottombar-info-value',
				top: 25,
			});
			this.energy_income = panel.text({
				class: 'bottombar-info-detail',
				top: 49,
			});
		}

		return panel;

	},

	on_show: () => {
		this.refresh(this.page.width); // TODO: make resize event trigger while hidden
		this.set_research();
		this.set_economy();
	},

	init: (p) => {

		this.panels = [];
		this.game = p.game;
		this.research_name = null;
		this.research_progress = null;
		this.energy_credits = null;
		this.energy_income = null;

		p.ui.class('bottombar-info-panel').extend('bottombar-panel-inner').set({
			top: 0,
			bottom: 0,
			//height: 97,
		});
		p.ui.class('bottombar-info-title').set({
			font: 'arialnb.ttf:16',
			color: 'rgb(118,158,198)',
			left: 7,
			right: 7,
			top: 5,
		});
		p.ui.class('bottombar-info-value').set({
			font: 'arialnb.ttf:15',
			color: 'rgb(191,214,221)',
			left: 7,
			right: 7,
		});
		p.ui.class('bottombar-info-detail').set({
			font: 'arialn.ttf:14',
			color: 'rgb(89,145,159)',
			left: 7,
			right: 7,
		});

		this.page = p.frame.panel({
			class: 'bottombar-panel-page',
			overflow: 'hidden',
		});

		this.button = p.frame.button({
			class: 'bottombar-panel-page-button',
			align: 'bottom right',
			bottom: 5,
			right: 5,
			text: 'I',
			group: 'pages',
		});

		this.page.on('resize', (e) => {
			this.refresh(e.width);
		});
		this.page.listen(p.game, 'research_updated', (e) => {
			if (e.player.id == p.game.get_player().id) {
				this.set_research();
			}
		});
		this.page.listen(p.game, 'player_update', (e) => {
			if (e.player.id == p.game.get_player().id) {
				this.set_research();
				this.set_economy();
			}
		});
		this.page.listen(p.game, 'economy_updated', (e) => {
			if (e.player.id == p.game.get_player().id) {
				this.set_economy();
			}
		});
		this.page.listen(p.game, 'turn', (e) => {
			this.set_research();
			this.set_economy();
		});
		this.refresh(this.page.width);
		this.set_research();
		this.set_economy();

	},

};
