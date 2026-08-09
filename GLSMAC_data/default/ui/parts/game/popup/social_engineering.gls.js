const RATING_NAMES = [
	'economy', 'effic', 'support', 'talent', 'morale', 'police',
	'growth', 'planet', 'probe', 'industry', 'research',
];

const format_rating = (name, value) => {
	return #uppercase(name) + ' ' + (value >= 0 ? '+' : '') + #to_string(value);
};

return {

	init: (p) => {
		this.p = p;
		this.player = null;
		this.pending = null;
		this.selects = {};
		this.rating_lines = [];

		return p.create('SOCIAL ENGINEERING', 520, 234, (body, cb) => {
			const categories = p.game.get('f_social_get_categories')();
			let top = 8;
			for (category of categories) {
				const category_id = category.id;
				body.text({
					class: 'game-popup-text',
					text: category.name + ':',
					left: 10,
					top: top + 2,
				});
				const select = body.select({
					class: 'popup-list-select',
					align: 'top right',
					right: 10,
					top: top,
					width: 260,
					items: [['', 'Unavailable']],
					value: '',
				});
				select.on('select', (e) => {
					if (this.pending != null) {
						this.pending[category_id] = e.value;
						this.refresh_ratings();
					}
					return true;
				});
				this.selects[category_id] = select;
				top += 30;
			}

			for (let i = 0; i < 3; i++) {
				this.rating_lines :+body.text({
					class: 'game-popup-text',
					text: '',
					left: 10,
					right: 10,
					top: 132 + i * 18,
				});
			}

			body.button({
				class: 'game-popup-button',
				text: 'Cancel',
				top: 190,
				is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});

			body.button({
				class: 'game-popup-button',
				text: 'Adopt social model',
				top: 212,
				is_ok: true,
			}).on('click', (e) => {
				if (this.player != null && this.pending != null) {
					p.game.event('set_social_engineering', {
						player: this.player,
						choices: this.pending,
					});
				}
				cb(true);
				return true;
			});
		});
	},

	refresh_ratings: () => {
		if (this.player == null || this.pending == null) {
			return;
		}
		const ratings = this.p.game.get('f_social_get_ratings_for_choices')(
			this.player,
			this.pending
		);
		let lines = ['', '', ''];
		for (let i = 0; i < #sizeof(RATING_NAMES); i++) {
			const name = RATING_NAMES[i];
			const line = #floor(#to_float(i) / 4.0);
			lines[line] += (lines[line] == '' ? '' : '   ') + format_rating(name, ratings[name]);
		}
		this.rating_lines[0].text = lines[0];
		this.rating_lines[1].text = lines[1];
		this.rating_lines[2].text = lines[2];
	},

	on_show: () => {
		this.player = this.p.game.get_player();
		const current = this.player.get_social_engineering();
		this.pending = {
			politics: current.politics,
			economics: current.economics,
			values: current.values,
			future_society: current.future_society,
		};
		for (category of this.p.game.get('f_social_get_categories')()) {
			let items = [];
			for (choice of this.p.game.get('f_social_get_available_choices')(
				this.player,
				category.id
			)) {
				items :+[choice.id, choice.name];
			}
			this.selects[category.id].items = items;
			this.selects[category.id].value = this.pending[category.id];
		}
		this.refresh_ratings();
	},

	on_hide: () => {
		this.player = null;
		this.pending = null;
	},

};
