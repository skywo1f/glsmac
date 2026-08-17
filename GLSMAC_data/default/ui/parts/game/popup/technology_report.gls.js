const facility_catalog = #include('../../../../content/base_facilities');
const unit_catalog = #include('../../../../content/base_units');

const join_limited = (values) => {
	if (#sizeof(values) == 0) {
		return 'None';
	}
	const shown = #min(#sizeof(values), 3);
	let result = values[0];
	for (let i = 1; i < shown; i++) {
		result += ', ' + values[i];
	}
	if (#sizeof(values) > shown) {
		result += ' +' + #to_string(#sizeof(values) - shown) + ' more';
	}
	return result;
};

const get_unlocks = (technology_id) => {
	let facilities = [];
	let projects = [];
	for (definition of facility_catalog) {
		if (definition.required_technology == technology_id) {
			if (definition.kind == 'project') {
				projects :+definition.name;
			} else {
				facilities :+definition.name;
			}
		}
	}

	let components = [];
	for (group of [
		unit_catalog.chassis,
		unit_catalog.weapons,
		unit_catalog.armors,
		unit_catalog.reactors,
		unit_catalog.abilities,
	]) {
		for (definition of group) {
			if (
				definition.required_technology == technology_id &&
				definition.availability != 'disabled'
			) {
				components :+definition.name;
			}
		}
	}

	let units = [];
	for (definition of unit_catalog.predefined_units) {
		if (
			definition.required_technology == technology_id &&
			definition.availability != 'disabled'
		) {
			units :+definition.name;
		}
	}
	return {
		facilities: facilities,
		projects: projects,
		components: components,
		units: units,
	};
};

return {
	init: (p) => {
		this.p = p;
		this.player = null;
		this.filter = 'all';
		this.selected_id = '';
		this.known = {};
		this.available = {};
		this.visible_ids = [];
		this.total_count = 0;
		this.known_count = 0;
		this.available_count = 0;
		this.technology_list = null;
		this.detail_lines = [];

		for (event_name of ['research_updated', 'base_spawn', 'base_despawn', 'base_update']) {
			const observed_event_name = event_name;
			p.game.on(observed_event_name, (e) => {
				if (this.player != null) {
					this.refresh();
				}
			});
		}

		return p.create('TECHNOLOGY', 760, 450, (body, cb) => {
			this.body = body;
			this.summary = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 10,
			});
			this.current = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 34,
			});
			body.text({
				class: 'game-popup-text', text: 'View:', left: 10, top: 62,
			});
			this.filter_select = body.select({
				class: 'popup-list-select', left: 75, top: 56, width: 275,
				items: [
					['all', 'All technologies'],
					['known', 'Discovered'],
					['available', 'Available research'],
					['locked', 'Locked'],
				],
				value: 'all',
			});
			this.filter_select.on('select', (e) => {
				this.filter = e.value;
				this.refresh_list();
				return true;
			});

			for (let i = 0; i < 13; i++) {
				this.detail_lines :+body.text({
					class: 'game-popup-text', text: '', left: 380, right: 10,
					top: 90 + i * 23,
				});
			}

			body.button({
				class: 'game-popup-button', text: 'Change Research', top: 398,
			}).on('click', (e) => {
				p.modules.popup.show('research');
				return true;
			});
			this.close_button = body.button({
				class: 'game-popup-button', text: 'Close', top: 423, is_cancel: true,
			});
			this.close_button.on('click', (e) => {
				cb(false);
				return true;
			});
		});
	},

	create_list: () => {
		this.technology_list = this.body.listview({
			class: 'default-panel-inner', left: 10, top: 88, width: 350,
			bottom: 55, itemsize: 23, padding: 2,
			vscroll_class: 'default-scroll-v', has_hscroll: false, has_vscroll: true,
		});
	},

	set_details: (values) => {
		for (let i = 0; i < #sizeof(this.detail_lines); i++) {
			this.detail_lines[i].text = i < #sizeof(values) ? values[i] : '';
		}
	},

	get_status: (technology_id, state) => {
		if (#is_defined(this.known[technology_id])) {
			return 'Known';
		}
		if (state.target == technology_id) {
			return 'Researching';
		}
		if (#is_defined(this.available[technology_id])) {
			return 'Available';
		}
		return 'Locked';
	},

	select_technology: (technology_id) => {
		this.selected_id = technology_id;
		this.refresh_details();
	},

	refresh_details: () => {
		if (this.player == null || this.selected_id == '') {
			this.set_details(['No technology is selected.']);
			return;
		}
		const game = this.p.game;
		const definition = game.get('f_technology_get_definition')(this.selected_id);
		if (definition == null) {
			this.set_details(['Technology data is unavailable.']);
			return;
		}
		const state = this.player.get_research_state();
		let prerequisites = [];
		for (id of definition.prerequisites) {
			const prerequisite = game.get('f_technology_get_definition')(id);
			prerequisites :+(prerequisite == null ? id : prerequisite.name);
		}
		let successors = [];
		for (id of game.get('f_technology_get_order')()) {
			const candidate = game.get('f_technology_get_definition')(id);
			for (prerequisite_id of candidate.prerequisites) {
				if (prerequisite_id == this.selected_id) {
					successors :+candidate.name;
					break;
				}
			}
		}
		const unlocks = get_unlocks(this.selected_id);
		let effects = [];
		if (definition.free_technology_for_first_discoverer) { effects :+'Free technology'; }
		if (definition.reveals_map) { effects :+'Reveals Planet map'; }
		if (definition.allows_genetic_warfare) { effects :+'Genetic warfare'; }
		if (definition.probe_morale_bonus > 0) {
			effects :+'Probe morale +' + #to_string(definition.probe_morale_bonus);
		}
		if (definition.commerce_bonus > 0) {
			effects :+'Commerce +' + #to_string(definition.commerce_bonus);
		}
		if (definition.fungus_nutrient_bonus > 0) {
			effects :+'Fungus nutrients +' + #to_string(definition.fungus_nutrient_bonus);
		}
		if (definition.fungus_mineral_bonus > 0) {
			effects :+'Fungus minerals +' + #to_string(definition.fungus_mineral_bonus);
		}
		if (definition.fungus_energy_bonus > 0) {
			effects :+'Fungus energy +' + #to_string(definition.fungus_energy_bonus);
		}

		let research_line = 'Base research value: ' + #to_string(definition.cost) + ' labs';
		if (state.target == this.selected_id) {
			research_line = 'Progress: ' + #to_string(state.progress) + '/' +
				#to_string(state.cost) + ' labs';
		}
		this.set_details([
			definition.name,
			'Status: ' + this.get_status(this.selected_id, state),
			research_line,
			'Prerequisites: ' + join_limited(prerequisites),
			'Leads to: ' + join_limited(successors),
			'Facilities: ' + join_limited(unlocks.facilities),
			'Secret Projects: ' + join_limited(unlocks.projects),
			'Unit components: ' + join_limited(unlocks.components),
			'Predefined units: ' + join_limited(unlocks.units),
			'Special effects: ' + join_limited(effects),
		]);
	},

	refresh_list: () => {
		if (this.player == null) {
			return;
		}
		if (this.technology_list != null) {
			this.technology_list.remove();
		}
		this.create_list();
		this.visible_ids = [];
		const state = this.player.get_research_state();
		for (id of this.p.game.get('f_technology_get_order')()) {
			const status = this.get_status(id, state);
			if (
				this.filter != 'all' &&
				!(this.filter == 'known' && status == 'Known') &&
				!(this.filter == 'available' && (status == 'Available' || status == 'Researching')) &&
				!(this.filter == 'locked' && status == 'Locked')
			) {
				continue;
			}
			const definition = this.p.game.get('f_technology_get_definition')(id);
			const technology_id = id;
			this.visible_ids :+technology_id;
			const button = this.technology_list.button({
				class: 'game-popup-button',
				text: '[' + status + '] ' + definition.name,
				left: 0, right: 0,
			});
			button.on('click', (e) => {
				this.select_technology(technology_id);
				return true;
			});
		}
		if (#sizeof(this.visible_ids) == 0) {
			this.technology_list.text({
				class: 'game-popup-text', text: 'No technologies match this view.',
			});
			this.selected_id = '';
		} else {
			let selected_visible = false;
			for (id of this.visible_ids) {
				if (id == this.selected_id) {
					selected_visible = true;
					break;
				}
			}
			if (!selected_visible) {
				this.selected_id = this.visible_ids[0];
			}
		}
		this.refresh_details();
	},

	refresh: () => {
		if (this.player == null) {
			return;
		}
		const game = this.p.game;
		const state = this.player.get_research_state();
		this.known = {};
		for (id of state.technologies) {
			this.known[id] = true;
		}
		this.available = {};
		for (id of game.get('f_technology_get_available_targets')(state.technologies)) {
			this.available[id] = true;
		}
		this.total_count = #sizeof(game.get('f_technology_get_order')());
		this.known_count = #sizeof(state.technologies);
		this.available_count = #sizeof(game.get('f_technology_get_available_targets')(
			state.technologies
		));
		const labs = game.get('f_technology_get_player_labs')(this.player);
		this.summary.text = 'Discovered: ' + #to_string(this.known_count) + '/' +
			#to_string(this.total_count) + '     Available: ' +
			#to_string(this.available_count) + '     Labs: ' + #to_string(labs) + '/turn';
		if (state.target == '') {
			this.current.text = 'Current research: None';
		} else {
			const target = game.get('f_technology_get_definition')(state.target);
			const remaining = #max(state.cost - state.progress, 0);
			const turns = labs > 0 ? #ceil(#to_float(remaining) / #to_float(labs)) : 0;
			this.current.text = 'Current research: ' + target.name + ' (' +
				#to_string(state.progress) + '/' + #to_string(state.cost) +
				' labs' + (labs > 0 ? ', ' + #to_string(turns) + ' turns' : '') + ')';
		}
		this.refresh_list();
	},

	on_show: () => {
		this.player = this.p.game.get_player();
		this.filter = 'all';
		this.filter_select.value = 'all';
		const state = this.player.get_research_state();
		this.selected_id = state.target;
		this.refresh();
	},

	on_hide: () => {
		this.player = null;
		this.selected_id = '';
		this.visible_ids = [];
	},

	on_replace: () => {
		this.player = null;
		this.selected_id = '';
		this.visible_ids = [];
	},
};
