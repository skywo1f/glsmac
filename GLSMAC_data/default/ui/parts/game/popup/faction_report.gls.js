const facility_catalog = #include('../../../../content/base_facilities');
const score_rules = #include('../../../../game/score_rules');

const report_modes = [
	['energy', 'Energy (F3)'],
	['bases', 'Bases (F4)'],
	['projects', 'Secret Projects (F5)'],
	['orbital', 'Orbital Status (F6)'],
	['units', 'Units (F7)'],
	['score', 'Score (F8)'],
];

const signed = (value) => {
	return value >= 0 ? '+' + #to_string(value) : #to_string(value);
};

const find_catalog_facility = (id) => {
	for (definition of facility_catalog) {
		if (definition.id == id) {
			return definition;
		}
	}
	return null;
};

const get_technology_name = (game, id) => {
	if (id == '') {
		return 'None';
	}
	const definition = game.get('f_technology_get_definition')(id);
	return definition == null ? id : definition.name;
};

return {
	init: (p) => {
		this.p = p;
		this.player = null;
		this.requested_mode = 'energy';
		this.mode = 'energy';
		this.records = [];
		this.selected_key = '';
		this.report_list = null;
		this.detail_lines = [];
		this.record_count = 0;
		this.project_count = 0;
		this.orbital_count = 0;
		this.unit_count = 0;
		this.score_total = 0;

		for (event_name of [
			'player_update',
			'economy_updated',
			'research_updated',
			'base_spawn',
			'base_despawn',
			'base_update',
			'unit_spawn',
			'unit_despawn',
			'unit_update',
		]) {
			const observed_event_name = event_name;
			p.game.on(observed_event_name, (e) => {
				if (this.player != null) {
					this.refresh();
				}
			});
		}

		return p.create('FACTION REPORTS', 760, 450, (body, cb) => {
			this.body = body;
			body.text({class: 'game-popup-text', text: 'Report:', left: 10, top: 12});
			this.mode_select = body.select({
				class: 'popup-list-select', left: 90, top: 8, width: 310,
				items: report_modes, value: 'energy',
			});
			this.mode_select.on('select', (e) => {
				this.mode = e.value;
				this.selected_key = '';
				this.refresh();
				return true;
			});
			this.summary = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 42,
			});

			for (let i = 0; i < 13; i++) {
				this.detail_lines :+body.text({
					class: 'game-popup-text', text: '', left: 380, right: 10,
					top: 76 + i * 23,
				});
			}

			this.action_button = body.button({
				class: 'game-popup-button', text: '', top: 398,
			});
			this.action_button.on('click', (e) => {
				return this.perform_action();
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

	set: (data) => {
		if (#is_defined(data.mode)) {
			this.requested_mode = data.mode;
		}
	},

	get_owned_bases: () => {
		let result = [];
		for (base of this.p.game.get_bm().get_bases()) {
			if (base.get_owner().id == this.player.id) {
				result :+base;
			}
		}
		return result;
	},

	find_base: (id) => {
		for (base of this.p.game.get_bm().get_bases()) {
			if (base.id == id && base.get_owner().id == this.player.id) {
				return base;
			}
		}
		return null;
	},

	find_unit: (id) => {
		for (unit of this.p.game.get_um().get_units()) {
			if (unit.id == id && unit.owner == this.player.id) {
				return unit;
			}
		}
		return null;
	},

	build_energy: () => {
		const game = this.p.game;
		const credits = this.player.get_energy_credits();
		const income = game.get('f_economy_get_player')(game, this.player);
		const commerce = game.get('f_economy_get_player_commerce')(game, this.player);
		let records = [];
		for (base of this.get_owned_bases()) {
			const intake = base.get_intake();
			const consumption = base.get_consumption();
			const energy = game.get('f_economy_get_base_energy')(base, intake);
			const allocation = game.get('f_economy_get_base_allocation')(
				game,
				base,
				intake,
				consumption
			);
			const base_income = game.get('f_economy_get_base')(
				game,
				base,
				intake,
				consumption
			);
			records :+{
				key: 'base:' + #to_string(base.id),
				label: base.name,
				action: 'base',
				id: base.id,
				details: [
					base.name,
					'Population: ' + #to_string(base.get_size()),
					'Energy collected: ' + #to_string(energy.gross),
					'Inefficiency loss: ' + #to_string(energy.inefficiency),
					'Facility maintenance: ' + #to_string(consumption.ENERGY),
					'Net energy before allocation: ' + #to_string(
						energy.net - consumption.ENERGY
					),
					'Economy: ' + #to_string(allocation.economy.value) +
						' + ' + #to_string(allocation.economy.bonus) + ' bonus',
					'Labs: ' + #to_string(allocation.labs.value) +
						' + ' + #to_string(allocation.labs.bonus) + ' bonus',
					'Psych: ' + #to_string(allocation.psych.value) +
						' + ' + #to_string(allocation.psych.bonus) + ' bonus',
					'Credits per turn: ' + signed(base_income),
				],
			};
		}
		return {
			summary: 'Reserves: ' + #to_string(credits) + ' credits     Net: ' +
				signed(income) + '/turn     Commerce: ' + signed(commerce),
			records: records,
		};
	},

	build_bases: () => {
		const game = this.p.game;
		let records = [];
		let population = 0;
		for (base of this.get_owned_bases()) {
			const intake = base.get_intake();
			const consumption = base.get_consumption();
			const nutrient_surplus = intake.NUTRIENTS - consumption.NUTRIENTS;
			const mineral_surplus = #max(intake.MINERALS - consumption.MINERALS, 0);
			const production = base.get_production();
			const production_name = #is_defined(production) ? production.name : 'Nothing';
			let production_status = production_name;
			if (#is_defined(production)) {
				const cost = game.get('f_base_get_production_cost')(base, production);
				const remaining = #max(cost - base.get_accumulated_minerals(), 0);
				const turns = mineral_surplus > 0
					? #ceil(#to_float(remaining) / #to_float(mineral_surplus))
					: 0;
				production_status += ' (' + #to_string(base.get_accumulated_minerals()) +
					'/' + #to_string(cost) + ' minerals' +
					(mineral_surplus > 0 ? ', ' + #to_string(turns) + ' turns' : '') + ')';
			}
			population += base.get_size();
			records :+{
				key: 'base:' + #to_string(base.id),
				label: base.name,
				action: 'base',
				id: base.id,
				details: [
					base.name,
					'Population: ' + #to_string(base.get_size()),
					'Production: ' + production_status,
					'Nutrients: ' + #to_string(intake.NUTRIENTS) + ' - ' +
						#to_string(consumption.NUTRIENTS) + ' = ' + signed(nutrient_surplus),
					'Minerals: ' + #to_string(intake.MINERALS) + ' - ' +
						#to_string(consumption.MINERALS) + ' = ' + signed(mineral_surplus),
					'Energy: ' + #to_string(intake.ENERGY) + ' collected',
					'Facilities: ' + #to_string(#sizeof(base.get_facilities())),
					'Supported units: ' + #to_string(#sizeof(base.get_supported_units())),
					'Worked tiles: ' + #to_string(#sizeof(base.get_worked_tiles())),
				],
			};
		}
		return {
			summary: 'Bases: ' + #to_string(#sizeof(records)) +
				'     Total population: ' + #to_string(population),
			records: records,
		};
	},

	build_projects: () => {
		const game = this.p.game;
		const bases = this.get_owned_bases();
		const state = this.player.get_research_state();
		let known = {};
		for (technology_id of state.technologies) {
			known[technology_id] = true;
		}
		let owned = {};
		for (base of bases) {
			for (facility of base.get_facilities()) {
				if (facility.is_project) {
					owned[facility.id] = base.name;
				}
			}
		}
		let records = [];
		let built_count = 0;
		let available_count = 0;
		for (definition of game.get_bm().get_facility_defs()) {
			if (!definition.is_project) {
				continue;
			}
			let status = 'Locked';
			if (#is_defined(owned[definition.id])) {
				status = 'Built at ' + owned[definition.id];
				built_count++;
			} else {
				for (base of bases) {
					if (base.can_set_production('project', definition.id)) {
						status = 'Available';
						available_count++;
						break;
					}
				}
			}
			const catalog = find_catalog_facility(definition.id);
			const effect = catalog == null ? 'Imported base-game rules' : catalog.effect;
			records :+{
				key: 'project:' + definition.id,
				label: definition.name,
				action: '',
				id: definition.id,
				details: [
					definition.name,
					'Status: ' + status,
					'Mineral cost: ' + #to_string(definition.mineral_cost),
					'Required technology:',
					'  ' + get_technology_name(
						game,
						definition.required_technology
					),
					'Required project:',
					'  ' + (definition.required_project == ''
						? 'None'
						: definition.required_project),
					'Imported effect:',
					'  ' + effect,
				],
			};
		}
		this.project_count = #sizeof(records);
		return {
			summary: 'Secret Projects: ' + #to_string(this.project_count) +
				'     Controlled: ' + #to_string(built_count) +
				'     Available: ' + #to_string(available_count),
			records: records,
		};
	},

	build_orbital: () => {
		const game = this.p.game;
		let records = [];
		let total = 0;
		for (definition of game.get_bm().get_facility_defs()) {
			if (definition.orbital_resource == '' && !definition.orbital_defense) {
				continue;
			}
			const count = this.player.get_orbital_facility_count(definition.id);
			total += count;
			const purpose = definition.orbital_defense
				? 'Orbital defense'
				: definition.orbital_resource + ' supplied to bases';
			records :+{
				key: 'orbital:' + definition.id,
				label: definition.name,
				action: 'orbital',
				id: definition.id,
				details: [
					definition.name,
					'Deployed: ' + #to_string(count),
					'Role: ' + purpose,
					'Mineral cost: ' + #to_string(definition.mineral_cost),
					'Required technology:',
					'  ' + get_technology_name(
						game,
						definition.required_technology
					),
				],
			};
		}
		const available_pods = game.get('f_orbital_get_available_defense_pods')(
			this.player
		);
		this.orbital_count = #sizeof(records);
		return {
			summary: 'Orbital facilities: ' + #to_string(total) +
				'     Defense pods available: ' + #to_string(available_pods),
			records: records,
		};
	},

	build_units: () => {
		let records = [];
		let active = 0;
		let supported = 0;
		for (unit of this.p.game.get_um().get_units()) {
			if (unit.owner != this.player.id) {
				continue;
			}
			const definition = unit.get_def();
			const tile = unit.get_tile();
			if (unit.movement > 0.0 && unit.order == 'none') {
				active++;
			}
			if (unit.home_base_id > 0) {
				supported++;
			}
			records :+{
				key: 'unit:' + #to_string(unit.id),
				label: definition.name + ' #' + #to_string(unit.id),
				action: 'unit',
				id: unit.id,
				details: [
					definition.name,
					'Location: ' + #to_string(tile.x) + ',' + #to_string(tile.y),
					'Offense / defense: ' + #to_string(definition.offense) + ' / ' +
						#to_string(definition.defense),
					'Health: ' + #to_string(#round(unit.health * 100.0)) + '%',
					'Morale level: ' + #to_string(unit.morale),
					'Movement remaining: ' + #to_string(unit.movement),
					'Order: ' + unit.order,
					'Home base: ' + (unit.home_base_id > 0
						? #to_string(unit.home_base_id)
						: 'Independent'),
				],
			};
		}
		this.unit_count = #sizeof(records);
		return {
			summary: 'Units: ' + #to_string(this.unit_count) +
				'     Active: ' + #to_string(active) +
				'     Base-supported: ' + #to_string(supported),
			records: records,
		};
	},

	build_score: () => {
		const game = this.p.game;
		const player = this.player;
		const score = score_rules.get_breakdown(game, player);
		this.score_total = score.total;
		return {
			summary: player.name + '     Total score: ' + #to_string(score.total),
			records: [{
				key: 'score:' + #to_string(player.id),
				label: player.name,
				action: '',
				id: player.id,
				details: [
					player.name,
					'Population: ' + #to_string(score.population),
					'Victory population: ' + #to_string(score.victory_population),
					'Surrendered population: ' + #to_string(score.surrendered_population),
					'Commerce: ' + #to_string(score.commerce),
					'Technologies: ' + #to_string(score.technology),
					'Transcendent Thought: ' + #to_string(score.transcendent_thought),
					'Secret Projects: ' + #to_string(score.secret_projects),
					'Victory bonus: ' + #to_string(score.victory_bonus),
					'Total: ' + #to_string(score.total),
				],
			}],
		};
	},

	set_details: (values) => {
		for (let i = 0; i < #sizeof(this.detail_lines); i++) {
			this.detail_lines[i].text = i < #sizeof(values) ? values[i] : '';
		}
	},

	get_selected_record: () => {
		for (record of this.records) {
			if (record.key == this.selected_key) {
				return record;
			}
		}
		return null;
	},

	select_record: (key) => {
		this.selected_key = key;
		this.refresh_details();
	},

	refresh_details: () => {
		const record = this.get_selected_record();
		if (record == null) {
			this.set_details(['No entries are available for this report.']);
			this.action_button.hide();
			return;
		}
		this.set_details(record.details);
		if (record.action == 'base') {
			this.action_button.text = 'Open Selected Base';
			this.action_button.show();
		} else if (record.action == 'unit') {
			this.action_button.text = 'Select Unit on Map';
			this.action_button.show();
		} else if (record.action == 'orbital') {
			this.action_button.text = 'Orbital Attack';
			this.action_button.show();
		} else {
			this.action_button.hide();
		}
	},

	create_list: () => {
		this.report_list = this.body.listview({
			class: 'default-panel-inner', left: 10, top: 72, width: 350,
			bottom: 55, itemsize: 23, padding: 2,
			vscroll_class: 'default-scroll-v', has_hscroll: false, has_vscroll: true,
		});
		for (record of this.records) {
			const record_key = record.key;
			this.report_list.button({
				class: 'game-popup-button', text: record.label, left: 0, right: 0,
			}).on('click', (e) => {
				this.select_record(record_key);
				return true;
			});
		}
	},

	refresh: () => {
		if (this.player == null) {
			return;
		}
		this.project_count = 0;
		this.orbital_count = 0;
		this.unit_count = 0;
		this.score_total = 0;
		let data = null;
		if (this.mode == 'energy') {
			data = this.build_energy();
		} else if (this.mode == 'bases') {
			data = this.build_bases();
		} else if (this.mode == 'projects') {
			data = this.build_projects();
		} else if (this.mode == 'orbital') {
			data = this.build_orbital();
		} else if (this.mode == 'units') {
			data = this.build_units();
		} else {
			data = this.build_score();
		}
		this.records = data.records;
		this.record_count = #sizeof(this.records);
		this.summary.text = data.summary;
		if (this.report_list != null) {
			this.report_list.remove();
		}
		this.create_list();
		let selected_visible = false;
		for (record of this.records) {
			if (record.key == this.selected_key) {
				selected_visible = true;
				break;
			}
		}
		if (!selected_visible) {
			this.selected_key = this.record_count > 0 ? this.records[0].key : '';
		}
		this.refresh_details();
	},

	perform_action: () => {
		const record = this.get_selected_record();
		if (record == null) {
			return false;
		}
		if (record.action == 'base') {
			const base = this.find_base(record.id);
			if (base != null) {
				this.p.game.select_base(base);
				return true;
			}
		} else if (record.action == 'unit') {
			const unit = this.find_unit(record.id);
			if (unit != null) {
				this.p.modules.popup.hide('faction_report');
				this.p.game.select_unit(unit);
				return true;
			}
		} else if (record.action == 'orbital') {
			this.p.modules.popup.show('orbital_attack');
			return true;
		}
		return false;
	},

	on_show: () => {
		this.player = this.p.game.get_player();
		this.mode = this.requested_mode;
		this.mode_select.value = this.mode;
		this.selected_key = '';
		this.refresh();
	},

	on_hide: () => {
		this.player = null;
		this.records = [];
		this.selected_key = '';
	},

	on_replace: () => {
		this.player = null;
		this.records = [];
		this.selected_key = '';
	},
};
