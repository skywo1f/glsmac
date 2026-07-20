#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let exit_scheduled = false;
	const initial_nutrient_stamp = 37;
	const initial_mineral_stamp = 23;
	const defeated_snapshot_unit_id = 3;
	const expansion_snapshot_unit_id = 4;
	const conquered_snapshot_base_name = 'Reconnect Conquest Probe';
	const expansion_snapshot_base_name = 'Reconnect Expansion Probe';

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		let handled_turns = {};

		const get_snapshot_production_ids = (base) => {
			return base.get_tile().is_water
				? ['SeaLurk', 'SeaLurk']
				: ['SporeLauncher', 'MindWorms'];
		};

		const get_base_state_error = () => {
			if (game.get_um().has_unit(defeated_snapshot_unit_id)) {
				return 'defeated unit was restored from the snapshot';
			}
			if (game.get_um().has_unit(expansion_snapshot_unit_id)) {
				return 'consumed Colony Pod was restored from the snapshot';
			}
			const restored_unit = game.get_um().get_unit(1);
			if (restored_unit.get_def().id != restored_unit.def) {
				return 'unit definition link is inconsistent';
			}
			const colony_pod_def = game.get_um().get_unit_def('ColonyPod');
			if (
				colony_pod_def.is_native ||
				colony_pod_def.offense != 0 ||
				colony_pod_def.defense != 1 ||
				colony_pod_def.morale_set != 'STANDARD' ||
				!colony_pod_def.can_found_base ||
				colony_pod_def.can_terraform
			) {
				return 'Colony Pod definition metadata was not restored';
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
			const expected_production_ids = get_snapshot_production_ids(base);
			const production = base.get_production();
			const production_queue = base.get_production_queue();
			if (!#is_defined(production)) {
				return 'production target is missing';
			}
			if (
				production.production_kind != 'unit' ||
				production.id != expected_production_ids[0] ||
				production.mineral_cost <= 0 ||
				#sizeof(production_queue) != 2
			) {
				return 'production target is invalid';
			}
			for (let i = 0; i < #sizeof(production_queue); i++) {
				if (
					production_queue[i].production_kind != 'unit' ||
					production_queue[i].id != expected_production_ids[i]
				) {
					return 'production queue entry ' + #to_string(i) + ' is invalid';
				}
			}
			const facilities = base.get_facilities();
			if (!base.has_facility('RecyclingTanks') || #sizeof(facilities) != 1) {
				return 'built Recycling Tanks state is missing';
			}
			const recycling_tanks = facilities[0];
			if (
				recycling_tanks.id != 'RecyclingTanks' ||
				recycling_tanks.production_kind != 'facility' ||
				recycling_tanks.mineral_cost != 40 ||
				recycling_tanks.nutrient_bonus != 1 ||
				recycling_tanks.mineral_bonus != 1 ||
				recycling_tanks.energy_bonus != 1
			) {
				return 'built Recycling Tanks definition is invalid';
			}
			const expected_snapshot_minerals =
				initial_mineral_stamp +
					base.get_tile().get_resources(base.get_owner()).MINERALS +
					recycling_tanks.mineral_bonus;
			if (base.get_accumulated_minerals() != expected_snapshot_minerals) {
				return
					'accumulated minerals are ' + #to_string(base.get_accumulated_minerals()) +
					', expected ' + #to_string(expected_snapshot_minerals);
			}
			let conquered_base = null;
			for (candidate of game.get_bm().get_bases()) {
				if (candidate.name == conquered_snapshot_base_name) {
					conquered_base = candidate;
					break;
				}
			}
			if (conquered_base == null) {
				return 'conquered base is missing';
			}
			if (conquered_base.get_owner().id != game.get_player().id) {
				return 'conquered base owner was not restored';
			}
			let expansion_base = null;
			for (candidate of game.get_bm().get_bases()) {
				if (candidate.name == expansion_snapshot_base_name) {
					expansion_base = candidate;
					break;
				}
			}
			if (expansion_base == null) {
				return 'founded expansion base is missing';
			}
			const expansion_production = expansion_base.get_production();
			if (
				expansion_base.get_owner().id != game.get_player().id ||
				#sizeof(expansion_base.get_pops()) != 1 ||
				#sizeof(expansion_base.get_worked_tiles()) != 1 ||
				!#is_defined(expansion_production) ||
				expansion_production.id != 'ScoutPatrol'
			) {
				return 'founded expansion base state was not restored';
			}
			const accumulated_nutrients = base.get('accumulated_nutrients');
			if (!#is_defined(accumulated_nutrients)) {
				return 'accumulated nutrients are missing';
			}
			const expected_snapshot_nutrients =
				initial_nutrient_stamp +
					base.get_tile().get_resources(base.get_owner()).NUTRIENTS -
					game.get('map_growth_base') +
					recycling_tanks.nutrient_bonus;
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
				#print('RUNNING_RECONNECT_CONQUERED_BASE_RESUMED_CLIENT');
				#print('RUNNING_RECONNECT_EXPANSION_BASE_RESUMED_CLIENT');
				#print('RUNNING_RECONNECT_UNIT_DEF_RESUMED_CLIENT');
				#print('RUNNING_RECONNECT_PRODUCTION_RESUMED_CLIENT');
				#print('RUNNING_RECONNECT_RESUMED_CLIENT');
				game.event('complete_turn', {});
			}
			else if (turn_id == 2 && !exit_scheduled) {
				exit_scheduled = true;
				#print('RUNNING_RECONNECT_PASS_CLIENT');
				#async(3000, () => {
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
