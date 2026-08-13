const airdrop_rules = #include('../../../../game/airdrop_rules');

const tile_key = (tile) => {
	return #to_string(tile.x) + ':' + #to_string(tile.y);
};

const tile_label = (game, unit, tile) => {
	const base = tile.get_base();
	const location = '(' + #to_string(tile.x) + ', ' + #to_string(tile.y) + ')';
	if (base != null) {
		return base.name + ' ' + location;
	}
	return location + ' - ' +
		#to_string(game.get_tm().get_distance(unit.get_tile(), tile)) + ' squares';
};

return {
	init: (p) => {
		this.p = p;
		this.unit = null;
		this.destinations = {};
		this.destination = null;
		this.destination_select = null;
		this.drop_button = null;
		this.status_text = null;

		return p.create('AIR DROP', 520, 164, (body, cb) => {
			body.text({class: 'game-popup-text', text: 'Destination:', left: 10, top: 12});
			this.destination_select = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 8,
				width: 370, items: [['', 'No available destinations']], value: '',
			});
			this.destination_select.on('select', (e) => {
				this.select_destination(e.value);
				return true;
			});

			this.status_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 50,
			});

			body.button({
				class: 'game-popup-button', text: 'Cancel', top: 116, is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});

			this.drop_button = body.button({
				class: 'game-popup-button', text: 'Air Drop', top: 140, is_ok: true,
			});
			this.drop_button.on('click', (e) => {
				if (this.unit != null && this.destination != null) {
					p.game.event('airdrop_unit', {
						unit: this.unit,
						destination: this.destination,
					});
					cb(true);
				}
				return true;
			});
		});
	},

	set: (data) => {
		this.unit = data.unit;
	},

	select_destination: (id) => {
		this.destination = id == '' || !#is_defined(this.destinations[id])
			? null
			: this.destinations[id];
		this.drop_button.hide();
		this.status_text.text = this.destination == null
			? 'No available air-drop destination.'
			: tile_label(this.p.game, this.unit, this.destination) +
				'; damage: ' + #to_string(#round(airdrop_rules.get_damage(this.unit) * 100.0)) + '%';
		if (this.destination != null) {
			this.drop_button.show();
		}
	},

	on_show: () => {
		this.destinations = {};
		let items = [];
		if (this.unit != null) {
			const player = this.p.game.get_player();
			for (tile of airdrop_rules.get_available_destinations(
				this.p.game,
				this.unit,
				player.id
			)) {
				const key = tile_key(tile);
				this.destinations[key] = tile;
				items :+[key, tile_label(this.p.game, this.unit, tile)];
			}
		}
		this.destination_select.items = #sizeof(items) > 0
			? items
			: [['', 'No available destinations']];
		this.destination_select.readonly = #sizeof(items) == 0;
		this.destination_select.value = #sizeof(items) > 0 ? items[0][0] : '';
		this.select_destination(this.destination_select.value);
	},

	on_hide: () => {
		this.unit = null;
		this.destination = null;
		this.destinations = {};
	},
};
