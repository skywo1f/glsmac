#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let game = null;
	let ui_started = false;
	let exit_scheduled = false;

	const fail = (message) => {
		if (exit_scheduled) {
			return;
		}
		exit_scheduled = true;
		#print('SMALL_MAP_STARTUP_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	glsmac.on('configure_game', (e) => {
		game = e.game;

		game.on('start_ui', (event) => {
			if (exit_scheduled) {
				return;
			}
			ui_started = true;
			const player = game.get_player();
			if (player.get_faction().id != 'GAIANS') {
				fail('requested Gaians faction was not assigned');
				return;
			}
			if (game.get_tm().get_map_width() != 88 || game.get_tm().get_map_height() != 44) {
				fail('small map dimensions were not preserved');
				return;
			}

			let ai_count = 0;
			let human_base_count = 0;
			let seen_factions = {};
			for (candidate of game.get_players()) {
				if (#is_defined(seen_factions[candidate.get_faction().id])) {
					fail('duplicate playable faction was assigned');
					return;
				}
				seen_factions[candidate.get_faction().id] = true;
				if (candidate.type == 'ai') {
					ai_count++;
				}
			}
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == player.id) {
					human_base_count++;
				}
			}
			if (#sizeof(game.get_players()) != 7 || ai_count != 6 || human_base_count != 1) {
				fail('seven-player starting roster or human base is invalid');
				return;
			}
			for (crossfire_id of [
				'CONSCIOUSNESS', 'PIRATES', 'DRONES', 'ANGELS',
				'PLANETCULT', 'CARETAKERS', 'USURPERS'
			]) {
				if (#is_defined(seen_factions[crossfire_id])) {
					fail('unsupported Crossfire faction was assigned: ' + crossfire_id);
					return;
				}
			}

			#print('SMALL_MAP_STARTUP_RUNTIME_READY');
			#async(3000, () => {
				if (!exit_scheduled && !game.is_turn_complete(player.id)) {
					game.event('complete_turn', {});
				}
			});
		});

		game.on('turn', (event) => {
			if (!ui_started || exit_scheduled || event.year - 2100 < 2) {
				return;
			}
			exit_scheduled = true;
			#print('SMALL_MAP_STARTUP_RUNTIME_PASS');
			#async(500, () => { glsmac.exit(); });
		});
	});

	glsmac.run();

});
