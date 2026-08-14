return {

	available_pages: ['resource', 'support', 'psych'],

	init: (p) => {
		this.active_page = 'resource';
		this.current_data = null;

		const button_width = 132;
		const button_padding = 2;

		p.ui.class('base-screen-middle-area').set({
			left: 2,
			top: 2,
			right: 2,
			bottom: 2,
		});

		p.ui.class('base-screen-middle-button').extend('game-popup-button').set({
			width: button_width,
			align: 'bottom left',
			bottom: button_padding,
			height: 20,
			group: 'base-screen-middle-area-buttons',
		});

		this.area = p.body.panel({
			class: 'base-screen-frame',
			align: 'top center',
			top: 32,
			width: 404,
			height: 225,
		});
		const inner = this.area.area({
			bottom: 22,
		});

		const pp = {
			ui: p.ui,
			game: p.game,
			area: inner,
		};

		let left = button_padding;
		this.pages = {};
		const register_page_button = (page, button_left) => {
			const btn = this.area.button({
				class: 'base-screen-middle-button',
				left: button_left,
				text: #uppercase(page.name),
			});
			btn.on('on', (e) => {
				this.active_page = page.name;
				if (this.current_data != null) {
					this._set_page(page.name, this.current_data);
				}
				page.el.show();
				return true;
			});
			btn.on('off', (e) => {
				page.el.hide();
				return true;
			});
		};
		for (page_name of this.available_pages) {
			const page = #include('middle_area/' + page_name);
			page.name = page_name;
			page.init(pp);
			if (left > button_padding) {
				page.el.hide();
			}
			register_page_button(page, left);
			left += button_width + button_padding;
			this.pages[page_name] = page;
		}

	},

	_set_page: (name, data) => {
		switch (name) {
			case 'resource': {
				this.pages.resource.set({
					base: data.base,
				});
				break;
			}
			case 'support': {
				this.pages.support.set(data.support);
				break;
			}
			case 'psych': {
				this.pages.psych.set({
					base: data.base,
				});
				break;
			}
		}
	},

	set: (data) => {
		this.current_data = data;
		this._set_page(this.active_page, data);
	},

};
