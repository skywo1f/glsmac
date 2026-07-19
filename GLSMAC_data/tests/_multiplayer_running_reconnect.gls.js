#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let map_size_requested = false;
	let ready_requested = false;
	let game_configured = false;
	let exit_scheduled = false;
	const initial_nutrient_stamp = 37;
	const defeated_snapshot_unit_id = 3;

	glsmac.on('configure_state', (e) => {
		#async(100, () => {
			const game = glsmac.game;
			if (#sizeof(game.get_players()) != 2) {
				return true;
			}

			const map = game.get_settings().global.map;
			if (game.is_master() && !map_size_requested) {
				map_size_requested = true;
				game.event('game_settings', {
					changes: [
						['planet_size', '20x10'],
					],
				});
			}
			if (map.size_x != 20 || map.size_y != 10) {
				return true;
			}

			const me = game.get_player();
			if (!me.is_ready()) {
				if (!ready_requested) {
					ready_requested = true;
					game.event('ready_or_not', {
						ready: true,
					});
				}
			}
			else {
				ready_requested = false;
			}
			return !game_configured;
		});
	});

	glsmac.on('configure_game', (e) => {
		game_configured = true;
		const game = e.game;
		const role = game.is_master() ? 'HOST' : 'CLIENT';
		let handled_turns = {};

		const find_base_for_player = (player_id) => {
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == player_id) {
					return base;
				}
			}
			return null;
		};

		const get_remote_player_id = () => {
			const local_player_id = game.get_player().id;
			for (player of game.get_players()) {
				if (player.id != local_player_id) {
					return player.id;
				}
			}
			return null;
		};

		const get_base_state_error = (player_id) => {
			if (game.get_um().has_unit(defeated_snapshot_unit_id)) {
				return 'defeated unit was restored from the snapshot';
			}
			const base = find_base_for_player(player_id);
			if (base == null) {
				return 'base is missing';
			}
			const accumulated_nutrients = base.get('accumulated_nutrients');
			if (!#is_defined(accumulated_nutrients)) {
				return 'accumulated nutrients are missing';
			}
			const expected_snapshot_nutrients =
				initial_nutrient_stamp +
				base.get_tile().get_resources(base.get_owner()).NUTRIENTS -
				game.get('map_growth_base');
			if (accumulated_nutrients != expected_snapshot_nutrients) {
				return
					'accumulated nutrients are ' + #to_string(accumulated_nutrients) +
					', expected ' + #to_string(expected_snapshot_nutrients);
			}
			const pops = base.get_pops();
			const worked_tiles = base.get_worked_tiles();
			if (#sizeof(pops) != 1) {
				return 'population count is ' + #to_string(#sizeof(pops));
			}
			if (#sizeof(worked_tiles) != 1) {
				return 'worked tile count is ' + #to_string(#sizeof(worked_tiles));
			}
			const pop = pops[0];
			if (!pop.has('worked_tile')) {
				return 'population has no worked tile';
			}
			const tile = pop.get('worked_tile');
			if (!base.is_tile_worked(tile)) {
				return 'population tile is absent from the base worked set';
			}
			if (!tile.has('working_pop')) {
				return 'worked tile has no population link';
			}
			if (tile.get('working_pop') != pop) {
				return 'worked tile links to a different population';
			}
			return #undefined;
		};

		let handle_turn = (turn_id) => {
			const turn_key = #to_string(turn_id);
			if (#is_defined(handled_turns[turn_key])) {
				return;
			}
			handled_turns[turn_key] = true;
			if (
				#sizeof(game.get_players()) != 2 ||
				#sizeof(game.get_bm().get_bases()) < 2 ||
				!game.get_um().has_unit(1)
			) {
				#print('RUNNING_RECONNECT_FAIL_' + role + ': synchronized state is incomplete');
				glsmac.exit();
				return;
			}

			if (turn_id == 1) {
				if (game.is_master()) {
					const client_base = find_base_for_player(get_remote_player_id());
					if (client_base == null) {
						#print('RUNNING_RECONNECT_FAIL_HOST: client base is missing');
						glsmac.exit();
						return;
					}
					// Initial growth adds the base-tile yield, then spends the map growth threshold.
					client_base.set('accumulated_nutrients', initial_nutrient_stamp);
					const defeated_unit = game.get_um().spawn_unit({
						def: 'MindWorms',
						owner: client_base.get_owner(),
						tile: client_base.get_tile(),
						morale: 1,
						health: 1.0,
					});
					if (defeated_unit.id != defeated_snapshot_unit_id) {
						#print('RUNNING_RECONNECT_FAIL_HOST: unexpected defeated unit id');
						glsmac.exit();
						return;
					}
					defeated_unit.health = 0.0;
					#print('RUNNING_RECONNECT_HOST_WAITING');
					game.event('complete_turn', {});
				}
				else {
					const base_state_error = get_base_state_error(game.get_player().id);
					if (#is_defined(base_state_error)) {
						#print('RUNNING_RECONNECT_FAIL_CLIENT: ' + base_state_error);
						glsmac.exit();
						return;
					}
					#print('RUNNING_RECONNECT_BASE_STATE_INITIAL_CLIENT');
					#print('RUNNING_RECONNECT_DROP_READY');
				}
			}
			else if (turn_id == 2 && game.is_master() && !exit_scheduled) {
				exit_scheduled = true;
				#print('RUNNING_RECONNECT_PASS_HOST');
				#async(2000, () => {
					glsmac.exit();
				});
			}
		};

		game.on('start_ui', (e) => {
			if (!game.is_master() && game.get_turn() > 0) {
				handle_turn(game.get_turn());
			}
		});

		game.on('start', (e) => {
			game.on('turn', (e) => {
				handle_turn(e.year - 2100);
			});
		});
	});

	glsmac.run();

});
