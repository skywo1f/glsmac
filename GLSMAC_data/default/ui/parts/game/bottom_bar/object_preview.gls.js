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

	close_terraform_menu: () => {
		this.terraform_menu.hide();
		this.terraform_menu_open = false;
		this.action_button.active = false;
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

				if (object.terraforming != 'none') {
					const names = {
						road: 'Road',
						farm: 'Farm',
						mine: 'Mine',
						solar: 'Solar Collector',
					};
					f_line(
						names[object.terraforming] + ': ' +
						#to_string(object.terraforming_turns_remaining) + ' turns',
						14,
						'left'
					);
				}

				if (is_owned && def.can_found_base) {
					this.action_unit = object;
					this.action_mode = 'found_base';
					this.action_button.text = 'BUILD BASE';
					this.close_terraform_menu();
					this.action_button.show();
				} else if (is_owned && def.can_terraform) {
					this.action_unit = object;
					if (object.terraforming == 'none') {
						this.action_mode = 'terraform';
						this.action_button.text = 'TERRAFORM';
					} else {
						this.action_mode = 'cancel_terraform';
						this.action_button.text = 'CANCEL ORDER';
						this.close_terraform_menu();
					}
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
					this.terraform_menu.show();
					this.terraform_menu_open = true;
					this.action_button.active = true;
				}
			}
			return true;
		});

		this.terraform_menu = p.ui.root.panel({
			class: 'game-menu',
			zindex: 0.95,
			align: 'bottom left',
			left: 6,
			bottom: 256,
			height: 72,
		});
		this.terraform_menu.surface({class: 'game-menu-top-border'});
		this.terraform_menu.surface({class: 'game-menu-bottom-border'});
		let terraform_top = 0;
		for (entry of [
			{type: 'road', label: 'Road (2 turns)'},
			{type: 'farm', label: 'Farm (4 turns)'},
			{type: 'mine', label: 'Mine (8 turns)'},
			{type: 'solar', label: 'Solar (4 turns)'},
		]) {
			const terraform_entry = entry;
			const button = this.terraform_menu.button({
				class: 'game-menu-item',
				text: terraform_entry.label,
				top: terraform_top,
			});
			button.on('click', (e) => {
				if (this.action_unit != null && this.action_mode == 'terraform') {
					p.game.event('terraform_tile', {
						unit: this.action_unit,
						type: terraform_entry.type,
					});
				}
				this.close_terraform_menu();
				return true;
			});
			terraform_top += 18;
		}
		this.terraform_menu.hide();

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
			if (this.action_mode == 'terraform') {
				let type = null;
				if (e.code == 'R') {
					type = 'road';
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
