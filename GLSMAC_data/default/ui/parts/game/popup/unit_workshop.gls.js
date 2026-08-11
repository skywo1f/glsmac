const prototype_rules = #include('../../../../game/prototype_rules');

return {
	_items: (entries, empty_label) => {
		let items = [];
		for (entry of entries) {
			items :+[entry.id, entry.name];
		}
		return #sizeof(items) > 0 ? items : [['', empty_label]];
	},

	_selection: () => {
		let abilities = [];
		if (this.ability_one.value != '') {
			abilities :+this.ability_one.value;
		}
		if (this.ability_two.value != '') {
			abilities :+this.ability_two.value;
		}
		return {
			chassis: this.chassis.value,
			weapon: this.weapon.value,
			armor: this.armor.value,
			reactor: this.reactor.value,
			abilities: abilities,
		};
	},

	_set_default: (select, id) => {
		for (item of select.items) {
			if (item[0] == id) {
				select.value = id;
				return;
			}
		}
		select.value = #sizeof(select.items) > 0 ? select.items[0][0] : '';
	},

	_refresh_abilities: () => {
		let compatible = [];
		const base_selection = this._selection();
		base_selection.abilities = [];
		for (ability of this.options.abilities) {
			const trial = {
				chassis: base_selection.chassis,
				weapon: base_selection.weapon,
				armor: base_selection.armor,
				reactor: base_selection.reactor,
				abilities: [ability.id],
			};
			const preview = this.p.game.get('f_unit_design_get_preview')(
				this.player,
				trial
			);
			if (!#is_defined(preview.error)) {
				compatible :+ability;
			}
		}
		const previous_one = this.ability_one.value;
		const previous_two = this.ability_two.value;
		let first_items = [['', 'None']];
		let second_items = [['', 'None']];
		for (ability of compatible) {
			first_items :+[ability.id, ability.name];
			if (ability.id != previous_one) {
				second_items :+[ability.id, ability.name];
			}
		}
		this.ability_one.items = first_items;
		this.ability_two.items = second_items;
		this._set_default(this.ability_one, previous_one);
		this._set_default(this.ability_two, previous_two == previous_one ? '' : previous_two);
		this.ability_two.readonly = this.options.ability_limit < 2;
		if (this.options.ability_limit < 2) {
			this.ability_two.value = '';
		}
	},

	_refresh: (components_changed) => {
		if (components_changed) {
			this._refresh_abilities();
		}
		const selection = this._selection();
		const preview = this.p.game.get('f_unit_design_get_preview')(
			this.player,
			selection
		);
		this.preview = preview;
		this.create_button.hide();
		this.prototype_status.text = '';
		if (#is_defined(preview.error)) {
			this.status.text = preview.error;
			return;
		}
		this.name_input.value = preview.name;
		const production = {
			production_kind: 'unit',
			is_native: preview.data.is_native,
			chassis: preview.data.chassis,
			weapon: preview.data.weapon,
			armor: preview.data.armor,
		};
		const prototype = prototype_rules.is_prototype(this.player, production);
		const waiver = this.base != null && prototype_rules.has_cost_waiver(this.base);
		const mineral_cost = this.base == null
			? preview.data.mineral_cost
			: prototype_rules.get_mineral_cost(
				this.base,
				production,
				preview.data.mineral_cost
			);
		this.status.text =
			'Attack ' + #to_string(preview.data.offense) +
			'   Defense ' + #to_string(preview.data.defense) +
			'   Move ' + #to_string(preview.data.movement_per_turn) +
			'   Cost ' + #to_string(mineral_cost) + ' minerals';
		this.prototype_status.text = prototype
			? (waiver ? 'Prototype cost waived at this base.' : 'New prototype components included.')
			: 'Components already prototyped.';
		if (preview.exists) {
			this.status.text = 'This component combination already exists for your faction.';
			this.prototype_status.text = '';
			return;
		}
		this.create_button.show();
	},

	init: (p) => {
		this.p = p;
		this.player = null;
		this.options = null;
		this.preview = null;
		this.base = null;

		return p.create('UNIT WORKSHOP', 620, 390, (body, cb) => {
			const add_label = (text, top) => {
				body.text({class: 'game-popup-text', text: text, left: 12, top: top + 4});
			};
			const add_select = (top) => {
				return body.select({
					class: 'popup-list-select', align: 'top right', right: 12, top: top,
					width: 410, items: [['', 'Unavailable']], value: '',
				});
			};

			add_label('Chassis:', 10);
			this.chassis = add_select(10);
			add_label('Weapon / Equipment:', 48);
			this.weapon = add_select(48);
			add_label('Armor:', 86);
			this.armor = add_select(86);
			add_label('Reactor:', 124);
			this.reactor = add_select(124);
			add_label('Special Ability 1:', 162);
			this.ability_one = add_select(162);
			add_label('Special Ability 2:', 200);
			this.ability_two = add_select(200);
			add_label('Design Name:', 242);
			this.name_input = body.input({
				class: 'popup-input', align: 'top right', right: 12, top: 242,
				width: 410, value: '',
			});
			this.status = body.text({
				class: 'game-popup-text', text: '', left: 12, right: 12, top: 286,
			});
			this.prototype_status = body.text({
				class: 'game-popup-text', text: '', left: 12, right: 12, top: 310,
			});

			this.chassis.on('select', (e) => {
				this._refresh(true);
				return true;
			});
			this.weapon.on('select', (e) => {
				this._refresh(true);
				return true;
			});
			this.armor.on('select', (e) => {
				this._refresh(true);
				return true;
			});
			this.reactor.on('select', (e) => {
				this._refresh(true);
				return true;
			});
			this.ability_one.on('select', (e) => {
				this._refresh_abilities();
				this._refresh(false);
				return true;
			});
			this.ability_two.on('select', (e) => {
				this._refresh(false);
				return true;
			});

			body.button({
				class: 'game-popup-button', text: 'Cancel', top: 340, is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});
			this.create_button = body.button({
				class: 'game-popup-button', text: 'Create Design', top: 364, is_ok: true,
			});
			this.create_button.on('click', (e) => {
				if (this.preview == null || #is_defined(this.preview.error) || this.preview.exists) {
					return true;
				}
				const name = #trim(this.name_input.value);
				this.p.game.event('create_unit_design', {
					name: name == '' ? this.preview.name : name,
					selection: this._selection(),
				});
				cb(true);
				return true;
			});
		});
	},

	set: (data) => {
		this.base = data.base;
	},

	on_show: () => {
		this.player = this.p.game.get_player();
		this.options = this.p.game.get('f_unit_design_get_options')(this.player);
		this.chassis.items = this._items(this.options.chassis, 'No chassis available');
		this.weapon.items = this._items(this.options.weapons, 'No weapon available');
		this.armor.items = this._items(this.options.armors, 'No armor available');
		this.reactor.items = this._items(this.options.reactors, 'No reactor available');
		this._set_default(this.chassis, 'Infantry');
		this._set_default(this.weapon, 'HandWeapons');
		this._set_default(this.armor, 'NoArmor');
		this._set_default(this.reactor, 'FissionPlant');
		this.ability_one.items = [['', 'None']];
		this.ability_one.value = '';
		this.ability_two.items = [['', 'None']];
		this.ability_two.value = '';
		this._refresh(true);
	},

	on_hide: () => {
		this.preview = null;
		this.base = null;
	},
};
