return (m) => {

	const modules = [
		'menu',
		'popup',
		'bottom_bar',
	];

	m.ui.class('default-panel').set({
		background: 'interface.pcx:crop(86, 665, 109, 688)',
		border: 'rgb(49, 78, 44),2',
	});

	m.ui.class('default-panel-inner').set({
		background: 'interface.pcx:crop(86, 548, 109, 571)',
		border: 'rgb(35, 59, 34),2',
		left: 3,
		top: 3,
		right: 3,
		bottom: 3,
	});

	m.glsmac.on('configure_game', (e) => {

		const game = e.game;

		let p = null;
		let messages_buffer = [];

		game.on('message', (e) => {
			if (p != null) {
				p.process_message(e.text);
			} else {
				messages_buffer :+e.text;
			}
		});

		game.on('scoped_message', (e) => {
			let is_visible = false;
			const player = game.get_player();
			for (player_id of e.player_ids) {
				if (player_id == player.id) {
					is_visible = true;
					break;
				}
			}
			if (!is_visible) {
				return;
			}
			if (p != null) {
				p.process_message(e.text);
			} else {
				messages_buffer :+e.text;
			}
		});

		game.on('probe_interception_requested', (e) => {
			if (p == null || game.get_player().id != e.player.id) {
				return;
			}
			p.modules.popup.set('probe_interception', e);
			p.modules.popup.show('probe_interception');
		});

		game.on('headquarters_evacuation_requested', (e) => {
			if (p == null || game.get_player().id != e.player.id) {
				return;
			}
			p.modules.popup.set('headquarters_evacuation', e);
			p.modules.popup.show('headquarters_evacuation');
		});

		game.on('research_selection_requested', (e) => {
			if (
				p != null && game.get_player().id == e.player.id &&
				!p.modules.popup.is_shown()
			) {
				p.modules.popup.show('research');
			}
		});

		game.on('start_ui', (e) => {
			const ui_profile_callback = game.get('f_ui_profile');
			const is_ui_profiling = #typeof(ui_profile_callback) == 'Callable';
			const ui_profile_started = is_ui_profiling ? #monotonic_ms() : 0;
			let ui_phase_started = ui_profile_started;
			const finish_ui_phase = (phase) => {
				if (!is_ui_profiling) { return; }
				const now = #monotonic_ms();
				ui_profile_callback({
					phase: phase,
					elapsed_ms: now - ui_phase_started,
					total_ms: now - ui_profile_started,
				});
				ui_phase_started = now;
			};

			m.root.clear();
			m.root.sound({
				id: 'game-music',
				sound: 'opening menu.wav',
				autoplay: true,
				repeat: true,
				volume: 0.55,
			});
			finish_ui_phase('root');

			p = {
				game: game,
				glsmac: m.glsmac,
				map: game.get_map(),
				ui: m.ui,
				root: m.root,
				modules: {},
				process_message: (text) => {
					for (m of modules) {
						const module = p.modules[m];
						if (#is_defined(module.process_message)) {
							module.process_message(text);
						}
					}
				},
				maybe_quit: (full_quit) => {
					p.modules.popup.show('please_dont_go', (result) => {
						if (result) {
							if (full_quit) {
								m.glsmac.exit();
							} else {
								m.glsmac.reset();
							}
						}
					});
				},
			};
			finish_ui_phase('state');
			for (m of modules) {
				p.modules[m] = #include(m + '/' + m);
			}
			finish_ui_phase('includes');
			for (m of modules) {
				p.modules[m].init(p);
				finish_ui_phase('init_' + m);
			}

			m.root.on('keydown', (e) => {
				if (
					e.modifiers == {} && e.code == 'ENTER' &&
					!p.modules.popup.is_shown() &&
					#typeof(p.request_turn_action) == 'Callable'
				) {
					return p.request_turn_action();
				}
				if (e.modifiers == {} && e.code == 'ESCAPE') {
					p.maybe_quit(true);
					return true;
				}
				if (e.modifiers == {ctrl: true, shift: true} && e.code == 'Q') {
					p.maybe_quit(false);
					return true;
				}
				if (e.modifiers == {} && e.code == 'F6') {
					p.modules.popup.show('orbital_attack');
					return true;
				}
				return false;
			});

			for (m of messages_buffer) {
				p.process_message(m);
			}
			messages_buffer = [];
			const get_evacuation =
				game.get('f_headquarters_get_player_evacuation');
			if (#typeof(get_evacuation) == 'Callable') {
				const evacuation = get_evacuation(game.get_player());
				if (evacuation != null) {
					p.modules.popup.set('headquarters_evacuation', evacuation);
					p.modules.popup.show('headquarters_evacuation');
				}
			}
			const get_supreme = game.get('f_council_get_supreme_state');
			const get_supreme_response = game.get('f_council_get_supreme_response');
			if (
				#typeof(get_supreme) == 'Callable' &&
				#typeof(get_supreme_response) == 'Callable'
			) {
				const supreme = get_supreme();
				if (
					supreme != null && !supreme.resolved &&
					get_supreme_response(game.get_player()) == 1 &&
					!p.modules.popup.is_shown()
				) {
					p.modules.popup.show('planetary_council');
				}
			}
			if (game.is_game_over() && !p.modules.popup.is_shown()) {
				p.modules.popup.show('victory');
			}
			const research_state = game.get_player().get_research_state();
			if (
				research_state.target != '' &&
				!p.modules.popup.is_shown()
			) {
				p.modules.popup.show('research');
			}
			const ui_ready_callback = game.get('f_ui_ready');
			if (#typeof(ui_ready_callback) == 'Callable') {
				ui_ready_callback(p);
			}
			finish_ui_phase('finalize');

		});

	});

};
