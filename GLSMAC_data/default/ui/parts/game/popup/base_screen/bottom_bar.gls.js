return {

	available_parts: [
		'production',
		'queue',
		'middle_area',
		'support',
	],

	init: (p) => {

		this.p = p;
		this.catalog_key = '';
		this.catalog = [];
		this.candidates_key = '';
		this.candidates = {set: [], queue: []};

		this.parts = {};

		this.frame = p.ui.root.area({
			zindex: 0.85,
			align: 'bottom',
			height: p.modules.bottom_bar.height,
			left: 0,
			right: 0,
		});
		this.frame.on('mousedown', (e) => {
			// prevent clickthroughs

			const left = e.ax;
			const right = p.ui.get_width() - e.ax;
			const bottom = p.ui.get_height() - e.ay;

			if (left >= 252 && right >= 262 && bottom >= 10 && bottom <= 60) {
				// allow clickthroughs to objects list
				// TODO: better way to do this?
				return false;
			}

			// block everything else
			return true;
		});
		this.frame.hide();

		// hide menus
		p.ui.class('base-screen-bottombar-menu-hidebutton').set({
			width: 106,
			height: 14,
			background: 'black',
		});
		this.frame.surface({
			class: 'base-screen-bottombar-menu-hidebutton',
			align: 'top left',
			left: 11,
			top: 20,
		}).on('mousedown', (e) => {
			return true;
		});
		this.frame.surface({
			class: 'base-screen-bottombar-menu-hidebutton',
			align: 'top right',
			right: 11,
			top: 22,
		}).on('mousedown', (e) => {
			return true;
		});

		const pp = {
			ui: p.ui,
			game: p.game,
			body: parent.frame,
			utils: p.utils,
		};

		for (s of this.available_parts) {
			this.parts[s] = #include('bottom_bar/' + s);
			this.parts[s].init(pp);
		}

	},

	get_catalog: (base) => {
		const owner = base.get_owner();
		const research = owner.get_research_state();
		let known = {};
		let key = #to_string(owner.id) + '|';
		for (id of research.technologies) {
			known[id] = true;
			key += id + ',';
		}
		key += '|';
		for (id of owner.get_obsolete_unit_designs()) {
			key += id + ',';
		}
		const unit_defs = this.p.game.get_um().get_unit_defs();
		const facility_defs = this.p.game.get_bm().get_facility_defs();
		key += '|' + #to_string(#sizeof(unit_defs)) + ':' +
			#to_string(#sizeof(facility_defs));
		if (key == this.catalog_key) {
			return this.catalog;
		}

		let result = [];
		for (def of unit_defs) {
			if (
				(#is_defined(def.required_technology) &&
					def.required_technology != '' &&
					!#is_defined(known[def.required_technology])) ||
				(#is_defined(def.owner_player_id) && def.owner_player_id >= 0 &&
					def.owner_player_id != owner.id) ||
				owner.is_unit_design_obsolete(def.id)
			) {
				continue;
			}
			result :+def;
		}
		for (def of facility_defs) {
			if (
				#is_defined(def.required_technology) &&
				def.required_technology != '' &&
				!#is_defined(known[def.required_technology])
			) {
				continue;
			}
			result :+def;
		}
		this.catalog_key = key;
		this.catalog = result;
		return result;
	},

	get_candidates: (base, definitions) => {
		const tile = base.get_tile();
		let has_water_access = tile.is_water;
		if (!has_water_access) {
			for (nearby of tile.get_surrounding_tiles()) {
				if (nearby.is_water) {
					has_water_access = true;
					break;
				}
			}
		}
		let key = this.catalog_key + '|b' + #to_string(base.id) +
			'|water:' + #to_string(has_water_access);
		for (facility of base.get_facilities()) {
			key += '|f:' + facility.id;
		}
		for (queued of base.get_production_queue()) {
			key += '|q:' + queued.production_kind + ':' + queued.id;
		}
		for (def of definitions) {
			if (#is_defined(def.is_project) && def.is_project) {
				const project_base = this.p.game.get_bm().get_project_base(def.id);
				const has_project_base =
					#is_defined(project_base) && project_base != null;
				key += '|p:' + def.id + ':' + (!has_project_base
					? '-'
					: #to_string(project_base.id) + '@' +
						#to_string(project_base.get_owner().id));
			}
		}
		if (key == this.candidates_key) {
			return this.candidates;
		}

		let set_candidates = [];
		let queue_candidates = [];
		for (def of definitions) {
			if (base.can_set_production(def.production_kind, def.id)) {
				set_candidates :+def;
			}
			if (base.can_queue_production(def.production_kind, def.id)) {
				queue_candidates :+def;
			}
		}
		this.candidates_key = key;
		this.candidates = {
			set: set_candidates,
			queue: queue_candidates,
		};
		return this.candidates;
	},

	set: (data) => {
		const bottom_profile_callback = this.p.game.get('f_base_screen_profile');
		const is_bottom_profiling = #typeof(bottom_profile_callback) == 'Callable';
		const bottom_profile_started = is_bottom_profiling ? #monotonic_ms() : 0;
		let bottom_phase_started = bottom_profile_started;
		const finish_bottom_phase = (phase) => {
			if (!is_bottom_profiling) { return; }
			const bottom_now = #monotonic_ms();
			bottom_profile_callback({
				phase: phase,
				elapsed_ms: bottom_now - bottom_phase_started,
				total_ms: bottom_now - bottom_profile_started,
			});
			bottom_phase_started = bottom_now;
		};
		const base = data.base;
		const production = base.get_production();
		const queue = base.get_production_queue();
		const pending = #is_defined(data.pending_production)
			? data.pending_production
			: this.p.game.get('f_base_get_pending_production')(base);
		finish_bottom_phase('bottom_state');
		const definitions = this.get_catalog(base);
		finish_bottom_phase('bottom_catalog');
		const candidates = this.get_candidates(base, definitions);
		finish_bottom_phase('bottom_candidates');

		if (#is_defined(production)) {
			const production_cost = this.p.game.get('f_base_get_production_cost')(
				base,
				production
			);
			const accumulated_minerals = #min(
				base.get_accumulated_minerals(),
				production_cost
			);
			const meter_capacity = 30;
			const meter_filled = production_cost > 0
				? #floor(
					#to_float(accumulated_minerals * meter_capacity) /
					#to_float(production_cost)
				)
				: 0;
			const meter_pending = pending > 0 && production_cost > 0
				? #max(
					#ceil(
						#to_float(pending * meter_capacity) /
						#to_float(production_cost)
					),
					1
				)
				: 0;
			const production_turns = pending > 0
				? #ceil(
					#to_float(production_cost - accumulated_minerals) /
					#to_float(pending)
				)
				: 0;
			const is_mineral_conversion =
				#is_defined(production.mineral_to_energy_divisor) &&
				production.mineral_to_energy_divisor > 0;
			const stockpile_energy = is_mineral_conversion
				? this.p.game.get('f_economy_get_base_stockpile_energy')(
					this.p.game,
					base
				)
				: 0;
			this.parts.production.set({
				name: production.name,
				rows: 3,
				columns: 10,
				filled: is_mineral_conversion
					? 0
					: meter_filled,
				pending: is_mineral_conversion ? 0 : meter_pending,
				turns: production_turns,
				conversion_label: is_mineral_conversion
					? #to_string(stockpile_energy) + ' EC / TURN'
					: #undefined,
			});
		} else {
			this.parts.production.set({
				name: 'NOTHING',
				rows: 3,
				columns: 10,
				filled: 0,
				pending: 0,
				turns: 0,
			});
		}
		finish_bottom_phase('bottom_production');

		this.parts.queue.set({
			base: base,
			production: production,
			queue: queue,
			set_candidates: candidates.set,
			queue_candidates: candidates.queue,
		});
		finish_bottom_phase('bottom_queue');

		this.parts.middle_area.set({
			base: base,
			name: base.name,
			owner: base.get_owner(),
			pops: base.get_pops(),
		});
		finish_bottom_phase('bottom_middle_area');

		this.parts.support.set(data.support);
		finish_bottom_phase('bottom_support');

		return {
			production: production,
			set_candidates: candidates.set,
		};

	},

};
