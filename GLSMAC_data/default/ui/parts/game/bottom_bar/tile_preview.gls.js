return {

	TRENCH_LEVEL: -2000,
	OCEAN_LEVEL: -1000,
	SEA_LEVEL: 0,

	ROCKINESS_LEVELS: ['?', 'Flat', 'Rolling', 'Rocky'],
	MOISTURE_LEVELS: ['?', 'Arid', 'Moist', 'Rainy'],

	get_moisture: (tile) => {
		if (
			#is_defined(this.p) && #is_defined(this.p.game) &&
			#typeof(this.p.game.get) == 'Callable'
		) {
			const resolver = this.p.game.get('f_resource_get_effective_moisture');
			if (#typeof(resolver) == 'Callable') {
				return resolver(tile);
			}
		}
		return tile.moisture;
	},

	get_feature_name: (tile, feature) => {

		if (tile.is_water) {
			// water-only features
			switch (feature) {
				case 'xenofungus': {
					return 'Sea Fungus';
				}
				case 'geothermal': {
					return 'Geothermal';
				}
			}
		} else {
			// land-only features
			switch (feature) {
				case 'xenofungus': {
					return 'Xenofungus';
				}
				case 'river': {
					return 'River';
				}
				case 'jungle': {
					return 'Jungle';
				}
				case 'dunes': {
					return 'Dunes';
				}
				case 'uranium': {
					return 'Uranium';
				}
				case 'volcano': {
					if (!#is_defined(tile.landmarks) || !tile.landmarks.mount_planet) {
						return 'Volcano';
					}
					return #undefined;
				}
				case 'sunny_mesa': {
					if (!#is_defined(tile.landmarks) || !tile.landmarks.sunny_mesa) {
						return 'Sunny Mesa';
					}
					return #undefined;
				}
				case 'garland_crater': {
					if (!#is_defined(tile.landmarks) || !tile.landmarks.garland_crater) {
						return 'Garland Crater';
					}
					return #undefined;
				}
			}
		}

		// water-or-land features
		switch (feature) {
			case 'monolith': {
				return 'Monolith';
			}
		}

	},

	get_resource_name: (resource) => {
		switch (resource) {
			case 'nutrient': {
				return 'Nutrient bonus';
			}
			case 'energy': {
				return 'Energy bonus';
			}
			case 'minerals': {
				return 'Minerals bonus';
			}
		}
	},

	get_landmark_name: (landmark) => {
		switch (landmark) {
			case 'garland_crater': { return 'Garland Crater'; }
			case 'mount_planet': { return 'Mount Planet'; }
			case 'monsoon_jungle': { return 'Monsoon Jungle'; }
			case 'uranium_flats': { return 'Uranium Flats'; }
			case 'new_sargasso': { return 'New Sargasso'; }
			case 'the_ruins': { return 'The Ruins'; }
			case 'great_dunes': { return 'Great Dunes'; }
			case 'freshwater_sea': { return 'Freshwater Sea'; }
			case 'sunny_mesa': { return 'Sunny Mesa'; }
			case 'nessus_canyon': { return 'Nessus Canyon'; }
			case 'geothermal_shallows': { return 'Geothermal Shallows'; }
			case 'pholus_ridge': { return 'Pholus Ridge'; }
			case 'borehole_cluster': { return 'Borehole Cluster'; }
			case 'manifold_nexus': { return 'Manifold Nexus'; }
		}
	},

	get_terraforming_name: (terraforming) => {
		switch (terraforming) {
			case 'forest': {
				return 'Forest';
			}
			case 'farm': {
				return 'Farm';
			}
			case 'mine': {
				return 'Mine';
			}
			case 'solar': {
				return 'Solar Collector';
			}
			case 'road': {
				return 'Road';
			}
		}
	},

	is_explored: (tile) => {
		if (
			!#is_defined(this.p) || !#is_defined(this.p.game) ||
			#typeof(this.p.game.get_player) != 'Callable'
		) {
			return false;
		}
		const player = this.p.game.get_player();
		return player != null && #typeof(player.has_explored) == 'Callable' &&
			player.has_explored(tile);
	},

	set_image: () => {
		const tile = this.tile;
		if (!this.is_explored(tile)) {
			if (#is_defined(this.preview)) {
				this.preview.hide();
			}
			return;
		}
		if (!#is_defined(this.preview)) {
			this.preview = this.frame.widget({
				type: 'tile-preview',
				data: {
					tile: tile,
				},
				align: 'top center',
				top: 5,
				width: 84,
				height: 52,
			});
		} else {
			this.preview.show();
			this.preview.data = {
				tile: tile,
			};
		}
	},

	line: (text) => {
		this.lines.text({
			class: 'tile-preview-line',
			text: text,
			left: 3,
		});
	},

	set_lines: () => {
		const tile = this.tile;
		if (#is_defined(this.lines)) {
			this.lines.remove(); // TODO: fix .clear()
		}
		this.lines = this.frame.listview({
			left: 3,
			right: 3,
			top: 63,
			bottom: 3,
			itemsize: 16,
		});
		const explored = this.is_explored(tile);
		if (!explored) {
			this.line('Unexplored');
		}

		if (!explored) {
			// Coordinates remain visible so orders can still target unknown terrain.
		} else if (this.show_resources) {

			const resources = tile.get_resources();
			this.line('Nutrients: ' + #to_string(resources.NUTRIENTS));
			this.line(''); // TODO: hints
			this.line('Minerals: ' + #to_string(resources.MINERALS));
			this.line(''); // TODO: hints
			this.line('Energy: ' + #to_string(resources.ENERGY));
			this.line(''); // TODO: hints

		} else {

			const sea_level = #is_defined(tile.sea_level) ? tile.sea_level : this.SEA_LEVEL;
			const relative_elevation = tile.elevation - sea_level;
			if (tile.is_water) {
				if (relative_elevation < this.TRENCH_LEVEL) {
					this.line('Ocean Trench');
				} else if (relative_elevation < this.OCEAN_LEVEL) {
					this.line('Ocean');
				} else {
					this.line('Ocean Shelf');
				}
				this.line('Depth: ' + #to_string(0 - relative_elevation));
			} else {
				this.line('Elev:' + #to_string(relative_elevation));
				let tilestr = '';
				if (tile.rockiness < #sizeof(this.ROCKINESS_LEVELS)) {
					tilestr += this.ROCKINESS_LEVELS[tile.rockiness];
				}
				tilestr += ' & ';
				const moisture = this.get_moisture(tile);
				if (moisture < #sizeof(this.MOISTURE_LEVELS)) {
					tilestr += this.MOISTURE_LEVELS[moisture];
				}
				this.line(tilestr);
			}

			if (#is_defined(tile.landmarks)) {
				for (landmark in tile.landmarks) {
					if (tile.landmarks[landmark]) {
						this.line(this.get_landmark_name(landmark));
					}
				}
			}

			for (f in tile.features) {
				if (tile.features[f]) {
					const feature_name = this.get_feature_name(tile, f);
					if (#is_defined(feature_name)) {
						this.line(feature_name);
					}
				}
			}

			for (f in tile.bonuses) {
				if (tile.bonuses[f]) {
					this.line(this.get_resource_name(f));
				}
			}

			for (terraforming of ['forest', 'farm', 'mine', 'solar', 'road']) {
				if (tile.terraforming[terraforming]) {
					this.line(this.get_terraforming_name(terraforming));
				}
			}

		}
		if (explored && #is_defined(this.p.game)) {
			const get_owner = this.p.game.get('f_territory_get_owner');
			if (#is_defined(get_owner)) {
				const owner = get_owner(tile);
				this.line('Territory: ' + (owner == null ? 'Unclaimed' : owner.name));
			}
		}

		this.line(''); // tmp workaround for 'cut-off' bottom in listview

		const txt = '(' + #to_string(tile.x) + ' , ' + #to_string(tile.y) + ')';
		if (!#is_defined(this.bottom_line)) {
			this.bottom_line = this.frame.text({
				class: 'tile-preview-line',
				align: 'bottom right',
				bottom: 3,
				right: 3,
				text: txt,
			});
		} else {
			this.bottom_line.text = txt;
		}
	},

	init: (p) => {

		this.p = p;
		this.show_resources = false;

		p.ui.class('tile-preview-line').set({
			color: 'rgb(116,156,56)',
			font: 'arialnb.ttf:14',
		});

		const frame_outer = p.el.panel({
			class: 'bottombar-panel',
			align: 'top left',
			top: 59,
			bottom: 7,
			left: 137,
			width: 106,
		});
		this.frame = frame_outer.panel({
			class: 'bottombar-panel-inner',
		});

		p.map.on('tile_preview', (e) => {
			this.tile = e.tile;
			this.set_image();
			this.set_lines();
		});
		p.game.on('map_visibility_updated', (e) => {
			if (#is_defined(this.tile)) {
				this.set_image();
				this.set_lines();
			}
		});

		frame_outer.on('mousedown', (e) => {
			this.show_resources = !this.show_resources;
			this.set_lines();
			return true;
		});

	},

};
