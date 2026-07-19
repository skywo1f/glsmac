#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let exit_scheduled = false;
	const initial_nutrient_stamp = 37;
	const defeated_snapshot_unit_id = 3;

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		let handled_turns = {};

		const get_base_state_error = () => {
			if (game.get_um().has_unit(defeated_snapshot_unit_id)) {
				return 'defeated unit was restored from the snapshot';
			}
			let base = null;
			for (candidate of game.get_bm().get_bases()) {
				if (candidate.get_owner().id == game.get_player().id) {
					base = candidate;
					break;
				}
			}
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
				#print('RUNNING_RECONNECT_FAIL_CLIENT: restored state is incomplete');
				glsmac.exit();
				return;
			}

			if (turn_id == 1) {
				const base_state_error = get_base_state_error();
				if (#is_defined(base_state_error)) {
					#print('RUNNING_RECONNECT_FAIL_CLIENT: ' + base_state_error);
					glsmac.exit();
					return;
				}
				#print('RUNNING_RECONNECT_BASE_STATE_RESUMED_CLIENT');
				#print('RUNNING_RECONNECT_RESUMED_CLIENT');
				game.event('complete_turn', {});
			}
			else if (turn_id == 2 && !exit_scheduled) {
				exit_scheduled = true;
				#print('RUNNING_RECONNECT_PASS_CLIENT');
				#async(750, () => {
					glsmac.exit();
				});
			}
		};

		game.on('start_ui', (e) => {
			if (game.get_turn() > 0) {
				handle_turn(game.get_turn());
			}
		});

		game.on('turn', (e) => {
			handle_turn(e.year - 2100);
		});
	});

	glsmac.run();

});
