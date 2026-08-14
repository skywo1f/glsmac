return {

	init: (p) => {
		this.p = p;
		this.base = null;
		this.hurry_pending = false;
		this.get_live_base = () => {
			if (this.base == null) {
				return null;
			}
			for (candidate of this.p.game.get_bm().get_bases()) {
				if (candidate.id == this.base.id) {
					return candidate;
				}
			}
			return null;
		};
		this.get_hurry_state = () => {
			const base = this.get_live_base();
			if (base == null) {
				return {cost: 0, can_hurry: false};
			}
			const production = base.get_production();
			if (!#is_defined(production)) {
				return {cost: 0, can_hurry: false};
			}
			const owner = base.get_owner();
			const player = this.p.game.get_player();
			const cost = this.p.game.get('f_economy_get_hurry_cost')(base);
			const is_owned = owner.id == player.id;
			const is_turn_active = !this.p.game.is_turn_complete(player.id);
			const affordable = owner.energy_credits >= cost;
			const is_not_pending = this.hurry_pending == false;
			return {
				base: base,
				cost: cost,
				affordable: affordable,
				can_hurry:
					cost > 0 &&
					is_not_pending &&
					is_owned &&
					is_turn_active &&
					affordable,
			};
		};

		this.frame = p.body.panel({
			class: 'base-screen-frame',
			align: 'bottom center',
			width: 638,
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
		const btn_workshop = this.frame.button({
			class: 'base-screen-popup-bottom-button',
			align: 'center',
			width: 210,
			text: 'UNIT WORKSHOP',
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
		btn_workshop.on('click', (e) => {
			const base = this.get_live_base();
			if (
				base != null &&
				base.get_owner().id == this.p.game.get_player().id
			) {
				this.p.modules.popup.set('unit_workshop', {base: base});
				this.p.modules.popup.show('unit_workshop');
			}
			return true;
		});
		this.btn_hurry.on('click', (e) => {
			const state = this.get_hurry_state();
			if (state.can_hurry) {
				this.hurry_pending = true;
				this.btn_hurry.text = 'HURRYING...';
				this.p.game.event('hurry_base_production', {base: state.base});
			}
			return true;
		});

	},

	set: (data) => {
		this.base = data.base;
		this.hurry_pending = false;
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
