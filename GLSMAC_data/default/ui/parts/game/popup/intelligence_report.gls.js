const relation_name = (relation) => {
	if (relation == 'treaty') { return 'Treaty'; }
	if (relation == 'pact') { return 'Pact'; }
	if (relation == 'vendetta') { return 'Vendetta'; }
	return 'Neutral';
};

const join = (values) => {
	if (#sizeof(values) == 0) {
		return 'None';
	}
	let result = values[0];
	for (let i = 1; i < #sizeof(values); i++) {
		result += ' / ' + values[i];
	}
	return result;
};

return {
	init: (p) => {
		this.p = p;
		this.player = null;
		this.target = null;
		this.opponent_select = null;
		this.lines = [];

		for (event_name of [
			'probe_operation',
			'economy_updated',
			'research_updated',
			'diplomacy_updated',
			'base_spawn',
			'base_despawn',
			'base_update',
			'unit_spawn',
			'unit_despawn',
			'unit_update',
		]) {
			const observed_event_name = event_name;
			p.game.on(observed_event_name, (e) => {
				if (this.player != null && this.target != null) {
					this.refresh();
				}
			});
		}

		return p.create('INTELLIGENCE REPORT', 650, 414, (body, cb) => {
			body.text({class: 'game-popup-text', text: 'Faction:', left: 10, top: 12});
			this.opponent_select = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 8,
				width: 500, items: [['', 'No contacted factions']], value: '',
			});
			this.opponent_select.on('select', (e) => {
				this.select_target(e.value);
				return true;
			});

			for (let i = 0; i < 14; i++) {
				this.lines :+body.text({
					class: 'game-popup-text', text: '', left: 10, right: 10,
					top: 48 + i * 23,
				});
			}

			body.button({
				class: 'game-popup-button', text: 'Close', top: 386, is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});
		});
	},

	set_lines: (values) => {
		for (let i = 0; i < #sizeof(this.lines); i++) {
			this.lines[i].text = i < #sizeof(values) ? values[i] : '';
		}
	},

	select_target: (value) => {
		this.target = value == '' ? null : this.p.game.get_player(#to_int(value));
		this.refresh();
	},

	refresh: () => {
		if (this.player == null || this.target == null) {
			this.set_lines(['No contacted faction is available.']);
			return;
		}
		const report = this.p.game.get('f_probe_get_intelligence_report')(
			this.player,
			this.target
		);
		if (report == null) {
			this.set_lines([
				'No current intelligence access.',
				'Infiltrate this faction\'s datalinks with a Probe Team.',
			]);
			return;
		}
		const research = report.research.target_id == ''
			? 'No active project'
			: report.research.target_name + ' (' +
				#to_string(report.research.progress) + '/' +
				#to_string(report.research.cost) + ' labs)';
		this.set_lines([
			'Access: ' + (report.source == 'infiltrated_datalinks'
				? 'Infiltrated datalinks'
				: 'Planetary Governor network'),
			'Relations: ' + relation_name(report.relation),
			'Energy reserves: ' + #to_string(report.energy_credits) + ' credits',
			'Research: ' + research,
			'Known technologies: ' + #to_string(report.research.known_technologies),
			'Social model: ' + join(report.social_choices),
			'Bases: ' + #to_string(report.bases.count) +
				'     Population: ' + #to_string(report.bases.population),
			'Headquarters: ' + (report.bases.headquarters == ''
				? 'None established'
				: report.bases.headquarters),
			'Facilities: ' + #to_string(report.bases.facilities) +
				'     Secret Projects: ' + #to_string(report.bases.projects),
			'Units: ' + #to_string(report.units.total) +
				'     Combat units: ' + #to_string(report.units.combat),
			'Probe Teams: ' + #to_string(report.units.probes),
			'Colony Pods: ' + #to_string(report.units.colony_pods) +
				'     Formers: ' + #to_string(report.units.formers),
			'Land: ' + #to_string(report.units.land) +
				'     Sea: ' + #to_string(report.units.sea) +
				'     Air: ' + #to_string(report.units.air),
		]);
	},

	on_show: () => {
		this.player = this.p.game.get_player();
		let items = [];
		for (player of this.p.game.get_players()) {
			if (
				player.id != this.player.id && player.type != 'native' &&
				this.player.has_contact(player) && player.has_contact(this.player)
			) {
				items :+['' + player.id, '' + player.name];
			}
		}
		this.opponent_select.items = #sizeof(items) > 0
			? items
			: [['', 'No contacted factions']];
		this.opponent_select.readonly = #sizeof(items) == 0;
		this.opponent_select.value = #sizeof(items) > 0 ? items[0][0] : '';
		this.select_target(this.opponent_select.value);
	},

	on_hide: () => {
		this.player = null;
		this.target = null;
	},
};
