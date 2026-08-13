return {

	init: (p) => {
		this.p = p;
		this.base = null;
		this.get_hurry_state = () => {
			if (this.base == null) {
				return {cost: 0, can_hurry: false};
			}
			const production = this.base.get_production();
			if (!#is_defined(production)) {
				return {cost: 0, can_hurry: false};
			}
			const owner = this.base.get_owner();
			const player = this.p.game.get_player();
			const cost = this.p.game.get('f_economy_get_hurry_cost')(this.base);
			const is_owned = owner.id == player.id;
			const is_turn_active = !this.p.game.is_turn_complete(player.id);
			const affordable = owner.energy_credits >= cost;
			return {
				cost: cost,
				affordable: affordable,
				can_hurry:
					cost > 0 &&
					is_owned &&
					is_turn_active &&
					affordable,
			};
		};

		this.frame = p.body.panel({
			class: 'base-screen-frame',
			align: 'bottom center',
			width: 428,
			height: 28,
			bottom: -32,
		});

		p.ui.class('base-screen-popup-bottom-button').extend('game-popup-button').set({
			top: 3,
			bottom: 3,
			width: 210, // TODO: why doesn't this work?
		});

		this.btn_hurry = this.frame.button({
			class: 'base-screen-popup-bottom-button',
			align: 'left',
			left: 3,
			width: 210,
			text: 'HURRY',
		});
		const btn_ok = this.frame.button({
			class: 'base-screen-popup-bottom-button',
			align: 'right',
			right: 3,
			width: 210,
			text: 'OK',
			is_ok: true,
			is_cancel: true,
		});

		btn_ok.on('click', (e) => {
			p.hide();
			return false;
		});
		this.btn_hurry.on('click', (e) => {
			const state = this.get_hurry_state();
			if (state.can_hurry) {
				this.btn_hurry.text = 'HURRYING...';
				this.p.game.event('hurry_base_production', {base: this.base});
			}
			return true;
		});

	},

	set: (data) => {
		this.base = data.base;
		const state = this.get_hurry_state();
		this.btn_hurry.text = state.cost <= 0
			? 'HURRY'
			: (
				state.affordable
					? 'HURRY (' + #to_string(state.cost) + ')'
					: 'NEED ' + #to_string(state.cost) + ' EC'
			);
	},

};
