return {

	init: (p) => {
		this.p = p;
		this.technology_id = '';
		this.technology_name = '';
		this.text_list = null;
		this.line_count = 0;

		return p.create('TECHNOLOGY DISCOVERED', 680, 430, (body, cb) => {
			this.body = body;
			this.name = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 10,
				align: 'top center',
			});
			this.summary = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 38,
				align: 'top center',
			});
			this.continue_button = body.button({
				class: 'game-popup-button', text: 'Continue', top: 402, is_ok: true,
			});
			this.continue_button.on('click', (e) => {
				cb(true);
				return true;
			});
		});
	},

	set: (data) => {
		this.technology_id =
			#typeof(data.technology_id) == 'String' ? data.technology_id : '';
		this.technology_name =
			#typeof(data.technology_name) == 'String' ? data.technology_name : '';
	},

	create_text_list: () => {
		this.text_list = this.body.listview({
			class: 'default-panel-inner', left: 10, right: 10, top: 68, bottom: 38,
			itemsize: 21, padding: 3,
			vscroll_class: 'default-scroll-v', has_hscroll: false, has_vscroll: true,
		});
	},

	add_line: (text) => {
		this.text_list.text({
			class: 'game-popup-text', text: text, left: 4, right: 4,
		});
		this.line_count = this.line_count + 1;
	},

	get_technology_source_index: () => {
		const definition = this.p.game.get('f_technology_get_definition')(
			this.technology_id
		);
		return definition != null && #typeof(definition.source_index) == 'Int'
			? definition.source_index
			: 0 - 1;
	},

	on_show: () => {
		if (this.text_list != null) {
			this.text_list.remove();
		}
		this.create_text_list();
		this.line_count = 0;
		this.name.text = this.technology_name;
		this.summary.text = '';

		const source_index = this.get_technology_source_index();
		if (source_index < 0) {
			this.add_line('Datalinks entry unavailable.');
			return;
		}
		const text = this.p.glsmac.get_technology_text(source_index);
		this.summary.text = text.short_description;
		this.add_line('DATALINKS');
		for (line of text.description_lines) {
			this.add_line(line);
		}
		this.add_line('');
		this.add_line('ARCHIVES');
		for (line of text.quote_lines) {
			this.add_line(line);
		}
	},

	on_hide: () => {
		this.technology_id = '';
		this.technology_name = '';
	},

};
