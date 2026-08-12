return {
	init: (p) => {
		this.p = p;
		this.unit = null;
		this.targets = {};
		this.target = null;
		this.operation = null;
		this.option = '';
		this.frame_player_id = 0 - 1;
		this.target_select = null;
		this.operation_select = null;
		this.option_select = null;
		this.frame_select = null;
		this.status_text = null;
		this.execute_button = null;

		return p.create('PROBE OPERATIONS', 500, 292, (body, cb) => {
			body.text({class: 'game-popup-text', text: 'Target:', left: 10, top: 12});
			this.target_select = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 8,
				width: 350, items: [['', 'No adjacent targets']], value: '',
			});
			this.target_select.on('select', (e) => {
				this.select_target(e.value);
				return true;
			});

			body.text({class: 'game-popup-text', text: 'Operation:', left: 10, top: 50});
			this.operation_select = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 46,
				width: 350, items: [['', 'No available operations']], value: '',
			});
			this.operation_select.on('select', (e) => {
				this.operation = e.value;
				this.refresh_operation_options();
				this.refresh_frame_options();
				this.refresh_status();
				return true;
			});

			body.text({class: 'game-popup-text', text: 'Approach:', left: 10, top: 88});
			this.option_select = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 84,
				width: 350, items: [['', 'Standard operation']], value: '',
			});
			this.option_select.on('select', (e) => {
				this.option = e.value;
				this.refresh_status();
				return true;
			});

			body.text({class: 'game-popup-text', text: 'Cover story:', left: 10, top: 126});
			this.frame_select = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 122,
				width: 350, items: [['', 'Make a clean getaway']], value: '',
			});
			this.frame_select.on('select', (e) => {
				this.frame_player_id = e.value == '' ? 0 - 1 : #to_int(e.value);
				this.refresh_status();
				return true;
			});

			this.status_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 164,
			});

			body.button({
				class: 'game-popup-button', text: 'Cancel', top: 244, is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});

			this.execute_button = body.button({
				class: 'game-popup-button', text: 'Execute Operation', top: 268, is_ok: true,
			});
			this.execute_button.on('click', (e) => {
				if (this.unit != null && this.target != null && this.operation != null) {
					const data = {
						unit: this.unit,
						operation: this.operation,
						target: this.target,
					};
					if (this.operation == 'steal_technology') {
						data.target_technology_id = this.option;
					} else if (this.operation == 'sabotage') {
						data.sabotage_target_id = this.option;
					} else if (
						this.operation == 'subvert_unit' ||
						this.operation == 'mind_control_base'
					) {
						data.untraceable = this.option == 'untraceable';
					}
					if (this.frame_player_id >= 0) {
						data.frame_player_id = this.frame_player_id;
					}
					p.game.event('probe_operation', data);
					cb(true);
				}
				return true;
			});
		});
	},

	set: (data) => {
		this.unit = data.unit;
	},

	get_target_player: () => {
		return #classof(this.target) == 'Base'
			? this.target.get_owner()
			: this.p.game.get_player(this.target.owner);
	},

	is_valid_unit_target: (unit) => {
		return this.unit != null && unit.health > 0.0 &&
			(!#is_defined(unit.transport_id) || unit.transport_id == 0) &&
			(!#is_defined(unit.get_cargo) || #sizeof(unit.get_cargo()) == 0) &&
			this.p.game.get('f_probe_get_subversion_error')(this.unit, unit) == '';
	},

	get_operation_items: () => {
		if (this.target == null || this.unit == null) {
			return [];
		}
		const actor = this.p.game.get_player();
		const target_player = this.get_target_player();
		if (this.p.game.get('f_probe_has_project')(
			target_player,
			'TheHunterSeekerAlgorithm'
		)) {
			return [];
		}
		const definitions = this.p.game.get('f_probe_get_operations')();
		let items = [];
		if (#classof(this.target) == 'Unit') {
			if (!this.is_valid_unit_target(this.target)) {
				return [];
			}
			const cost = this.p.game.get('f_probe_get_subversion_cost')(actor, this.target);
			if (cost != null) {
				items :+['subvert_unit', definitions.subvert_unit.name +
					' (' + #to_string(cost) + ' EC)'];
			}
			return items;
		}
		const has_intelligence = this.p.game.get('f_council_has_intelligence');
		if (!(#is_defined(has_intelligence)
			? has_intelligence(actor, target_player)
			: actor.has_infiltrated(target_player))) {
			items :+['infiltrate', definitions.infiltrate.name];
		}
		if (
			#sizeof(this.p.game.get('f_probe_get_unknown_technologies')(
				actor,
				target_player
			)) > 0 ||
			this.p.game.get('f_probe_get_map_data_count')(actor, target_player) > 0
		) {
			items :+['steal_technology', definitions.steal_technology.name];
		}
		if (this.p.game.get('f_probe_can_sabotage')(this.target)) {
			items :+['sabotage', definitions.sabotage.name];
		}
		if (
			this.p.game.get('f_probe_get_energy_drain_limit')(this.target) > 0 &&
			actor.energy_credits < 1000000000
		) {
			items :+['drain_energy', definitions.drain_energy.name];
		}
		if (this.p.game.get('f_probe_can_incite_drone_riots')(this.target)) {
			items :+['incite_drone_riots', definitions.incite_drone_riots.name];
		}
		if (
			this.target.has_facility('Headquarters') &&
			this.p.game.get('f_probe_get_assassination_research_loss')(target_player) > 0
		) {
			items :+['assassinate_researchers', definitions.assassinate_researchers.name];
		}
		if (
			actor.has_technology('RetroviralEngineering') &&
			this.p.game.get('f_probe_get_plague_population_loss')(this.target) > 0
		) {
			items :+['genetic_plague', definitions.genetic_plague.name];
		}
		const cost = this.p.game.get('f_probe_get_mind_control_cost')(actor, this.target);
		if (cost != null) {
			items :+['mind_control_base', definitions.mind_control_base.name +
				' (' + #to_string(cost) + ' EC)'];
		}
		return items;
	},

	get_operation_option_items: () => {
		if (this.target == null || this.operation == null || this.operation == '') {
			return [['', 'Standard operation']];
		}
		if (this.operation == 'steal_technology') {
			let items = [['', 'Quick general search']];
			const actor = this.p.game.get_player();
			const target_player = this.get_target_player();
			const resolver = this.p.game.get('f_technology_get_definition');
			for (id of this.p.game.get('f_probe_get_unknown_technologies')(
				actor,
				target_player
			)) {
				const definition = #is_defined(resolver) ? resolver(id) : null;
				items :+[id, 'Target ' + (definition == null ? id : definition.name)];
			}
			if (#sizeof(items) == 1 && this.p.game.get('f_probe_get_map_data_count')(
				actor,
				target_player
			) > 0) {
				items[0][1] = 'Download world map';
			}
			return items;
		}
		if (this.operation == 'sabotage') {
			let items = [['', 'Widespread havoc']];
			if (this.target.get_accumulated_minerals() > 0) {
				items :+['production', 'Target current production'];
			}
			const allowed = this.p.game.get('f_probe_get_sabotage_facilities')(this.target);
			for (facility of this.target.get_facilities()) {
				let can_target = false;
				for (id of allowed) {
					if (id == facility.id) { can_target = true; }
				}
				if (can_target) {
					items :+[facility.id, 'Target ' + facility.name];
				}
			}
			return items;
		}
		if (this.operation == 'subvert_unit' || this.operation == 'mind_control_base') {
			return [
				['', 'Standard operation'],
				['untraceable', 'Attempt untraceable capture'],
			];
		}
		return [['', 'Standard operation']];
	},

	refresh_operation_options: () => {
		const items = this.get_operation_option_items();
		this.option_select.items = items;
		this.option_select.readonly = #sizeof(items) <= 1;
		this.option_select.value = items[0][0];
		this.option = this.option_select.value;
	},

	get_frame_items: () => {
		let items = [['', 'Make a clean getaway']];
		if (this.target == null || this.operation == null || this.operation == '') {
			return items;
		}
		const actor = this.p.game.get_player();
		for (candidate of this.p.game.get('f_probe_get_frame_candidates')(
			actor,
			this.get_target_player(),
			this.operation
		)) {
			let options = this.get_operation_options();
			options.frame_player_id = candidate.id;
			if (this.p.game.get('f_probe_get_success_chance')(
				this.unit,
				this.get_target_player(),
				this.operation,
				this.target,
				options
			) > 0) {
				items :+['' + candidate.id, 'Implicate ' + candidate.name];
			}
		}
		return items;
	},

	refresh_frame_options: () => {
		const items = this.get_frame_items();
		this.frame_select.items = items;
		this.frame_select.readonly = #sizeof(items) <= 1;
		this.frame_select.value = '';
		this.frame_player_id = 0 - 1;
	},

	get_operation_options: () => {
		let options = {};
		if (this.operation == 'steal_technology') {
			options.target_technology_id = this.option;
		} else if (this.operation == 'sabotage') {
			options.sabotage_target_id = this.option;
		} else if (
			this.operation == 'subvert_unit' || this.operation == 'mind_control_base'
		) {
			options.untraceable = this.option == 'untraceable';
		}
		if (this.frame_player_id >= 0) {
			options.frame_player_id = this.frame_player_id;
		}
		return options;
	},

	select_target: (key) => {
		this.target = key == '' || !#is_defined(this.targets[key]) ? null : this.targets[key];
		const items = this.get_operation_items();
		this.operation_select.items = #sizeof(items) > 0
			? items
			: [['', 'No available operations']];
		this.operation_select.readonly = #sizeof(items) == 0;
		this.operation_select.value = #sizeof(items) > 0 ? items[0][0] : '';
		this.operation = this.operation_select.value;
		this.refresh_operation_options();
		this.refresh_frame_options();
		this.refresh_status();
	},

	refresh_status: () => {
		this.execute_button.hide();
		if (this.target == null) {
			this.status_text.text = 'Move next to a foreign base or unit.';
			return;
		}
		const target_player = this.get_target_player();
		if (this.p.game.get('f_probe_has_project')(
			target_player,
			'TheHunterSeekerAlgorithm'
		)) {
			this.status_text.text = 'Blocked by the Hunter-Seeker Algorithm.';
			return;
		}
		if (this.operation == '') {
			this.status_text.text = 'No legal operation is available.';
			return;
		}
		const actor = this.p.game.get_player();
		let cost = 0;
		if (this.operation == 'subvert_unit') {
			cost = this.p.game.get('f_probe_get_subversion_cost')(actor, this.target);
		} else if (this.operation == 'mind_control_base') {
			cost = this.p.game.get('f_probe_get_mind_control_cost')(actor, this.target);
		}
		if (cost > actor.energy_credits) {
			this.status_text.text = 'Requires ' + #to_string(cost) +
				' energy credits; ' + #to_string(actor.energy_credits) + ' available.';
			return;
		}
		const chance = this.p.game.get('f_probe_get_success_chance')(
			this.unit,
			target_player,
			this.operation,
			this.target,
			this.get_operation_options()
		);
		const survival_chance = this.p.game.get('f_probe_get_survival_chance')(
			this.unit,
			target_player,
			this.operation,
			this.target,
			this.get_operation_options()
		);
		this.status_text.text = cost > 0
			? 'Cost: ' + #to_string(cost) + ' energy credits. Success: ' +
				#to_string(chance) + '%. Survival: ' + #to_string(survival_chance) + '%.'
			: 'Success: ' + #to_string(chance) + '%. Survival: ' +
				#to_string(survival_chance) + '%.';
		this.execute_button.show();
	},

	on_show: () => {
		this.targets = {};
		let items = [];
		if (this.unit != null) {
			const player = this.p.game.get_player();
			for (tile of this.unit.get_tile().get_surrounding_tiles()) {
				const base = tile.get_base();
				if (base != null && base.get_owner().id != player.id) {
					const key = 'b' + #to_string(base.id);
					this.targets[key] = base;
					items :+[key, base.name + ' (' + base.get_owner().name + ')'];
				}
				for (unit of tile.get_units()) {
					if (unit.owner != player.id && this.is_valid_unit_target(unit)) {
						const key = 'u' + #to_string(unit.id);
						this.targets[key] = unit;
						items :+[key, unit.get_def().name + ' (' +
							this.p.game.get_player(unit.owner).name + ')'];
					}
				}
			}
		}
		this.target_select.items = #sizeof(items) > 0
			? items
			: [['', 'No adjacent targets']];
		this.target_select.readonly = #sizeof(items) == 0;
		this.target_select.value = #sizeof(items) > 0 ? items[0][0] : '';
		this.select_target(this.target_select.value);
	},

	on_hide: () => {
		this.unit = null;
		this.target = null;
		this.operation = null;
		this.option = '';
		this.frame_player_id = 0 - 1;
		this.targets = {};
	},
};
