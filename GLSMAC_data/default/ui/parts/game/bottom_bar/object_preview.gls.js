const terraforming = #include('../../../../units/terraforming');
const artifact_rules = #include('../../../../game/artifact_rules');
const airdrop_rules = #include('../../../../game/airdrop_rules');
const psi_gate_rules = #include('../../../../game/psi_gate_rules');
const supply_rules = #include('../../../../game/supply_rules');

return {

	get_morale: (type, value) => {
		if (!#is_defined(this.moralesets[type])) {
			this.moralesets[type] = this.um.get_moraleset(type);
		}
		if (value >= #sizeof(this.moralesets[type])) {
			#print('Morale not found: ' + type + '/' + #to_string(value));
			return '(???)';
		}
		return this.moralesets[type][value];
	},

	format_movement: (movement) => {
		return #to_string(#to_float(#round(movement * 100.0)) / 100.0);
	},

	get_upgrade_targets: (unit) => {
		const resolver = this.p.game.get('f_unit_upgrade_get_targets');
		return #is_defined(resolver)
			? resolver(this.p.game.get_player(), unit.get_def())
			: [];
	},

	get_psi_gate_destinations: (unit) => {
		return psi_gate_rules.get_available_destinations(
			this.p.game,
			unit,
			this.p.game.get_player().id
		);
	},

	has_supply_action: (unit) => {
		if (!supply_rules.is_supply_transport(unit)) {
			return false;
		}
		const player_id = this.p.game.get_player().id;
		if (unit.convoy_resource != 'none' || !#is_defined(
			supply_rules.get_contribution_error(this.p.game, unit, player_id)
		)) {
			return true;
		}
		for (resource of supply_rules.resource_types) {
			if (!#is_defined(supply_rules.get_order_error(
				this.p.game,
				unit,
				player_id,
				resource
			))) {
				return true;
			}
		}
		return false;
	},

	open_upgrade_popup: () => {
		if (this.action_unit != null && #sizeof(this.get_upgrade_targets(this.action_unit)) > 0) {
			this.p.modules.popup.set('unit_upgrade', {unit: this.action_unit});
			this.p.modules.popup.show('unit_upgrade');
			return true;
		}
		return false;
	},

	close_terraform_menu: () => {
		if (this.terraform_menu != null) {
			this.terraform_menu.hide();
		}
		this.terraform_menu_open = false;
		this.action_button.active = false;
	},

	refresh_terraform_menu: () => {
		if (this.action_unit == null) {
			return;
		}
		const tile = this.action_unit.get_tile();
		const player = this.p.game.get_player();
		const get_project_effects = this.p.game.get('f_project_get_player_effects');
		const project_effects = #is_defined(get_project_effects)
			? get_project_effects(player)
			: {advanced_terraforming: false};
		let top = 0;
		for (type of terraforming.order_ids) {
			const button = this.terraform_buttons[type];
			if (
				terraforming.get_unavailable_reason(
					tile,
					player,
					type,
					project_effects
				) != null
			) {
				button.hide();
				continue;
			}
			let detail = #to_string(terraforming.get_joined_completion_turns(
				tile,
				this.action_unit,
				type,
				project_effects
			));
			if (
				terraforming.is_elevation_order(type) &&
				!terraforming.has_order_helper(tile, this.action_unit, type)
			) {
				detail += ', ' + #to_string(terraforming.get_elevation_change_cost(
					this.p.game,
					tile,
					player
				)) + ' EC';
			}
			button.text = terraforming.get_order_name(type, tile.is_water) + ' (' + detail + ')';
			button.top = top;
			button.show();
			top += 18;
		}
		this.terraform_menu.height = top > 0 ? top : 18;
	},

	on_terraform_click: (e) => {
		if (this.action_unit != null && this.action_mode == 'terraform') {
			this.p.game.event('terraform_tile', {
				unit: this.action_unit,
				type: e.value,
			});
		}
		this.close_terraform_menu();
		return true;
	},

	init_terraform_menu: () => {
		this.terraform_menu = this.p.ui.root.panel({
			class: 'game-menu',
			zindex: 0.95,
			align: 'bottom left',
			left: 6,
			bottom: 256,
			height: 18,
		});
		this.terraform_menu.surface({class: 'game-menu-top-border'});
		this.terraform_menu.surface({class: 'game-menu-bottom-border'});
		let top = 0;
		for (type of terraforming.order_ids) {
			const order = terraforming.get_order(type);
			const button = this.terraform_menu.button({
				class: 'game-menu-item',
				text: order.name + ' (' + #to_string(order.turns) + ')',
				top: top,
				value: type,
			});
			button.on('click', this.on_terraform_click);
			this.terraform_buttons[type] = button;
			top += 18;
		}
		this.terraform_menu.height = top > 0 ? top : 18;
		this.terraform_menu.hide();
	},

	set_image: (object) => {
		if (object == null) {
			if (this.last_object_class != null) {
				this.preview.remove();
				this.preview = null;
			}
			this.last_object_class = null;
			return;
		}
		const cls = #classof(object);
		if (this.last_object_class != cls) {
			if (this.last_object_class != null) {
				this.preview.remove();
				this.preview = null;
			}
			this.last_object_class = cls;
		}
		let type = '';
		let data = {};
		switch (cls) {
			case 'Unit': {
				type = 'unit-preview';
				data.unit = object;
				break;
			}
			case 'Base': {
				type = 'base-preview';
				data.base = object;
				break;
			}
			default: {
				throw Error('Unknown object class: ' + cls);
			}
		}
		if (this.preview == null) {
			this.preview = this.frame.widget({
				class: 'bottombar-object-preview',
				type: type,
				data: data,
			});
		} else {
			this.preview.data = data;
		}
	},

	set_lines: (object) => {

		if (#is_defined(this.lines)) {
			this.lines.remove(); // TODO: fix this.lines.clear();
		}

		if (object == null) {
			this.lines = #undefined;
			this.action_unit = null;
			this.action_mode = null;
			this.close_terraform_menu();
			this.action_button.hide();
			return;
		}

		this.lines = this.frame.listview({
			left: 3,
			right: 3,
			top: 86,
			bottom: 3,
			itemsize: 17,
		});

		const f_line = (text, size, align) => {
			let left = #undefined;
			if (align == 'left') {
				left = 3;
			}
			this.lines.text({
				align: 'top ' + align,
				color: 'rgb(116,156,56)',
				font: 'arialnb.ttf:' + #to_string(size),
				text: text,
				left: left,
			});
		};

		switch (#classof(object)) {
			case 'Unit': {
				const def = object.get_def();
				const is_owned = object.owner == this.p.game.get_player().id;

				f_line(def.name, 16, 'center');

				f_line(this.p.get_stats_str(object), 14, 'center');

				f_line(this.get_morale(def.morale_set, object.morale), 14, 'left');

				if (!object.is_immovable) {
					f_line('Moves: ' + this.format_movement(object.movement), 14, 'left');
				}
				if (def.operational_range > 0) {
					f_line(
						'Fuel: ' + #to_string(object.fuel) + '/' + #to_string(def.operational_range),
						14,
						'left'
					);
				}
				if (def.cargo_capacity > 0) {
					f_line(
						'Cargo: ' + #to_string(#sizeof(object.get_cargo())) + '/' +
							#to_string(def.cargo_capacity),
						14,
						'left'
					);
				}
				if (object.transport_id > 0) {
					const transport = object.get_transport();
					f_line('Aboard: ' + transport.get_def().name, 14, 'left');
				}

				if (object.terraforming != 'none') {
					const order = terraforming.get_order(object.terraforming);
					f_line(
						order.name + ': ' +
						#to_string(object.terraforming_turns_remaining) + ' turns',
						14,
						'left'
					);
				}
				if (#is_defined(object.convoy_resource) && object.convoy_resource != 'none') {
					f_line('Convoy: ' + object.convoy_resource, 14, 'left');
				}

				if (
					is_owned && object.transport_id == 0 &&
					def.weapon == 'AlienArtifact' &&
					(
						!#is_defined(artifact_rules.get_study_error(
							this.p.game,
							object,
							this.p.game.get_player().id
						)) ||
						!#is_defined(artifact_rules.get_contribution_error(
							this.p.game,
							object,
							this.p.game.get_player().id
						))
					)
				) {
					this.action_unit = object;
					this.action_mode = 'alien_artifact';
					this.action_button.text = 'USE ARTIFACT';
					this.close_terraform_menu();
					this.action_button.show();
				} else if (
					is_owned && object.transport_id == 0 && this.has_supply_action(object)
				) {
					this.action_unit = object;
					this.action_mode = 'supply_transport';
					this.action_button.text = 'SUPPLY';
					this.close_terraform_menu();
					this.action_button.show();
				} else if (
					is_owned && object.transport_id == 0 &&
					!#is_defined(airdrop_rules.get_source_error(
						this.p.game,
						object,
						this.p.game.get_player().id
					))
				) {
					this.action_unit = object;
					this.action_mode = 'airdrop';
					this.action_button.text = 'AIR DROP';
					this.close_terraform_menu();
					this.action_button.show();
				} else if (
					is_owned && object.transport_id == 0 &&
					#sizeof(this.get_psi_gate_destinations(object)) > 0
				) {
					this.action_unit = object;
					this.action_mode = 'psi_gate';
					this.action_button.text = 'PSI GATE';
					this.close_terraform_menu();
					this.action_button.show();
				} else if (
					is_owned && object.transport_id == 0 && def.weapon == 'ProbeTeam' &&
					object.movement > 0.0
				) {
					this.action_unit = object;
					this.action_mode = 'probe';
					this.action_button.text = 'PROBE ACTION';
					this.close_terraform_menu();
					this.action_button.show();
				} else if (is_owned && object.transport_id == 0 && def.can_found_base) {
					this.action_unit = object;
					this.action_mode = 'found_base';
					this.action_button.text = 'BUILD BASE';
					this.close_terraform_menu();
					this.action_button.show();
				} else if (is_owned && object.transport_id == 0 && def.can_terraform) {
					this.action_unit = object;
					if (object.terraforming == 'none') {
						this.action_mode = 'terraform';
						this.action_button.text = 'TERRAFORM';
						this.close_terraform_menu();
						this.action_button.show();
					} else {
						this.action_mode = 'cancel_terraform';
						this.action_button.text = 'CANCEL ORDER';
						this.close_terraform_menu();
					}
					if (object.terraforming != 'none') {
						this.action_button.show();
					}
				} else if (
					is_owned && object.transport_id == 0 &&
					#sizeof(this.get_upgrade_targets(object)) > 0
				) {
					this.action_unit = object;
					this.action_mode = 'upgrade';
					this.action_button.text = 'UPGRADE';
					this.close_terraform_menu();
					this.action_button.show();
				} else {
					this.action_unit = null;
					this.action_mode = null;
					this.close_terraform_menu();
					this.action_button.hide();
				}

				break;
			}
			case 'Base': {
				this.action_unit = null;
				this.action_mode = null;
				this.close_terraform_menu();
				this.action_button.hide();

				f_line(object.name, 14, 'center');

				const production = object.get_production();
				f_line(
					#is_defined(production)
						? 'Producing: ' + production.name
						: 'Producing: Nothing',
					14,
					'left'
				);

				break;
			}
			default: {
				throw Error('Unknown object class: ' + #classof(object));
			}
		}
	},

	show: (object) => {
		this.set_image(object);
		this.set_lines(object);
	},

	init: (p) => {

		this.preview = null;
		this.last_object_class = null;
		this.moralesets = {};
		this.action_unit = null;
		this.action_mode = null;
		this.terraform_menu_open = false;
		this.terraform_menu = null;
		this.terraform_buttons = {};

		this.p = p;
		this.um = p.game.get_um();

		p.ui.class('bottombar-object-preview').set({
			align: 'top center',
			top: 12,
			width: 100,
			height: 75,
		});

		const frame_outer = p.el.panel({
			class: 'bottombar-panel',
			align: 'top left',
			top: 59,
			bottom: 7,
			left: 6,
			width: 129,
		});
		this.frame = frame_outer.panel({
			class: 'bottombar-panel-inner',
		});
		this.action_button = this.frame.button({
			class: 'bottombar-menu-button',
			align: 'bottom center',
			bottom: 3,
			text: 'BUILD BASE',
		});
		this.action_button.hide();
		this.action_button.on('click', (e) => {
			if (this.action_unit == null) {
				return true;
			}
			if (this.action_mode == 'found_base') {
				p.game.event('found_base', {
					unit: this.action_unit,
				});
			} else if (this.action_mode == 'cancel_terraform') {
				p.game.event('cancel_terraform', {
					unit: this.action_unit,
				});
			} else if (this.action_mode == 'terraform') {
				if (this.terraform_menu_open) {
					this.close_terraform_menu();
				} else {
					this.refresh_terraform_menu();
					this.terraform_menu.show();
					this.terraform_menu_open = true;
					this.action_button.active = true;
				}
			} else if (this.action_mode == 'probe') {
				p.modules.popup.set('probe_operations', {unit: this.action_unit});
				p.modules.popup.show('probe_operations');
			} else if (this.action_mode == 'alien_artifact') {
				p.modules.popup.set('alien_artifact', {unit: this.action_unit});
				p.modules.popup.show('alien_artifact');
			} else if (this.action_mode == 'supply_transport') {
				p.modules.popup.set('supply_transport', {unit: this.action_unit});
				p.modules.popup.show('supply_transport');
			} else if (this.action_mode == 'airdrop') {
				p.modules.popup.set('airdrop', {unit: this.action_unit});
				p.modules.popup.show('airdrop');
			} else if (this.action_mode == 'psi_gate') {
				p.modules.popup.set('psi_gate', {unit: this.action_unit});
				p.modules.popup.show('psi_gate');
			} else if (this.action_mode == 'upgrade') {
				this.open_upgrade_popup();
			}
			return true;
		});

		this.init_terraform_menu();

		this.frame.on('keydown', (e) => {
			if (
				p.modules.popup.is_shown() ||
				this.action_unit == null ||
				e.modifiers != {}
			) {
				return false;
			}
			if (this.action_mode == 'cancel_terraform' && e.code == 'C') {
				p.game.event('cancel_terraform', {unit: this.action_unit});
				return true;
			}
			if (e.code == 'U' && this.open_upgrade_popup()) {
				return true;
			}
			if (this.action_mode == 'supply_transport' && e.code == 'O') {
				p.modules.popup.set('supply_transport', {unit: this.action_unit});
				p.modules.popup.show('supply_transport');
				return true;
			}
			if (this.action_mode == 'airdrop' && e.code == 'I') {
				p.modules.popup.set('airdrop', {unit: this.action_unit});
				p.modules.popup.show('airdrop');
				return true;
			}
			if (this.action_mode == 'terraform') {
				let type = null;
				if (e.code == 'R') {
					type = 'road';
				} else if (e.code == 'P') {
					type = 'forest';
				} else if (e.code == 'F') {
					type = 'farm';
				} else if (e.code == 'M') {
					type = 'mine';
				} else if (e.code == 'S') {
					type = 'solar';
				}
				if (type != null) {
					p.game.event('terraform_tile', {unit: this.action_unit, type: type});
					this.close_terraform_menu();
					return true;
				}
			}
			return false;
		});

		p.map.on('unit_preview', (e) => {
			this.show(e.unit);
		});
		p.map.on('base_preview', (e) => {
			this.show(e.base);
		})

	},

};
