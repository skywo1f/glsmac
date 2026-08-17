return (glsmac) => {

	// TODO: refactor these into modules
	const factions = #include('../factions');
	const facilities = #include('../facilities');
	const resources = #include('../resources');
	const technologies = #include('../technologies');
	const units = #include('../units');

	const modules = [
		'social_engineering', 'exploration', 'diplomacy', 'projects', 'unit_designs', 'unit_upgrades', 'orbitals', 'territory', 'random_events', 'nerve_stapling', 'bases', 'ecology', 'council', 'probes', 'headquarters_evacuation', 'conquest', 'transcendence', 'economic_victory',
		'economy', 'score', 'retirement', 'native_ai', 'ai',
	];
	let m = {};
	for (module of modules) {
		m[module] = #include(module);
	}

	glsmac.on('configure_state', (e) => {
		factions.configure(e.fm);
	});

	#include('events')(glsmac.game);

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		game.on('configure', (e) => {
			game.set('f_message_to_players', (text, players) => {
				let player_ids = [];
				for (player of players) {
					player_ids :+player.id;
				}
				game.trigger('scoped_message', {
					text: text,
					player_ids: player_ids,
				});
			});
			game.set('f_message_to_player', (player, text) => {
				game.get('f_message_to_players')(text, [player]);
			});
			game.set('f_message_to_contacts', (player, text) => {
				let audience = [player];
				for (candidate of game.get_players()) {
					if (
						candidate.id != player.id &&
						#typeof(player.has_contact) == 'Callable' &&
						#typeof(candidate.has_contact) == 'Callable' &&
						player.has_contact(candidate) && candidate.has_contact(player)
					) {
						audience :+candidate;
					}
				}
				game.get('f_message_to_players')(text, audience);
			});

			for (module of m) {
				module(game);
			}

			const um = game.get_um();

			um.on('unit_spawn', (e) => {
				//
			});

			um.on('unit_despawn', (e) => {
				//
			});

			units.configure(game);
			resources.configure(game);
			technologies.configure(game);

			if (
				(#typeof(game.is_master) != 'Callable' || game.is_master()) &&
				(#typeof(game.is_loaded_game) != 'Callable' || !game.is_loaded_game())
			) {
				resources.define(game);
				units.define(game);
				facilities.define(game);
			}

			const worldscript = #is_defined(glsmac.config.worldscript) ? glsmac.config.worldscript : 'default';
			game.on('create_world', (e) => {
				const generator = #include('world/' + worldscript);
				generator(e.game);
			});

			game.on('error', (e) => {
				glsmac.ui.error('Game initialization failed: ' + e.error, () => {
					if (
						#is_defined(glsmac.config.quickstart) ||
						#is_defined(glsmac.config.host) ||
						#is_defined(glsmac.config.join)
					) {
						glsmac.exit();
					} else {
						glsmac.reset();
					}
				});
			});

		});

	});

};
