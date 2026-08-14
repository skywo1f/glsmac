#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);
	const technologies = #include('../default/technologies');

	let lobby_timer_started = false;
	let map_size_requested = false;
	let difficulty_requested = false;
	let difficulty_retry_ticks = 0;
	let ready_requested = false;
	let ready_retry_ticks = 0;
	let game_configured = false;
	let exit_scheduled = false;
	let accepted_event_count = 0;
	let rejected_event_count = 0;
	let client_event_probe_complete = false;
	let client_worker_probe_complete = false;
	let client_movement_probe_complete = false;
	let client_immediate_movement_probe_complete = false;
	let client_combat_probe_complete = false;
	let client_immediate_combat_probe_complete = false;
	let client_base_capture_probe_complete = false;
	let client_base_founding_probe_complete = false;
	let client_terraform_probe_complete = false;
	let client_movement_unit_id = 0;
	let client_movement_target_x = 0;
	let client_movement_target_y = 0;
	let client_combat_target_x = 0;
	let client_combat_target_y = 0;
	let combat_defender_id = 0;
	let combat_defender_spawn_requested = false;
	let colony_pod_spawn_requested = false;
	let former_spawn_requested = false;
	let live_visibility_seen = false;
	let live_visibility_hidden = false;
	let live_visibility_client_ready = false;
	let live_visibility_probe_started = false;
	let host_base_snapshot_probe_started = false;
	let client_base_snapshot_probe_complete = false;
	let client_base_infiltration_probe_complete = false;
	let client_player_privacy_probe_complete = false;
	let client_player_privacy_acknowledged = false;
	let client_turn_one_ready = false;
	let client_player_update_callback_seen = false;
	let client_council_projection_refresh = false;
	let client_live_visibility_probe_complete = false;
	let mixed_unit_privacy_acknowledged = false;
	let private_map_projection_phase = 0;
	let private_map_probe = null;
	let sea_level_notification_seen = false;
	let sea_level_message_count = 0;
	let client_sea_level_probe_complete = false;
	let client_sea_level_acknowledged = false;
	let sea_level_change_requested = false;
	let terraform_site_coords = null;
	const terraform_order = 'forest';
	const combat_base_name = 'Multiplayer Capture Probe';
	const expansion_base_name = 'Multiplayer Expansion Probe';

	glsmac.on('configure_state', (e) => {
		if (lobby_timer_started) {
			return;
		}
		lobby_timer_started = true;

		#async(100, () => {
			const game = glsmac.game;
			const players = game.get_players();
			if (#sizeof(players) != 2) {
				return true;
			}

			const map = game.get_settings().global.map;
			if (game.is_master() && !map_size_requested) {
				map_size_requested = true;
				game.event('game_settings', {
					changes: [
						['planet_size', '20x10'],
						['native_lifeforms', 0.0],
					],
				});
			}
			if (map.size_x != 20 || map.size_y != 10 || map.native_lifeforms != 0.0) {
				return true;
			}

			const me = game.get_player();
			const expected_difficulty = game.is_master() ? 'Thinker' : 'Librarian';
			if (me.difficulty_level != expected_difficulty) {
				difficulty_retry_ticks++;
				if (!difficulty_requested || difficulty_retry_ticks >= 10) {
					difficulty_requested = true;
					difficulty_retry_ticks = 0;
					#print('MULTIPLAYER_SMOKE_DIFFICULTY_REQUESTED');
					game.event('select_difficulty', {
						difficulty: expected_difficulty,
					});
				}
				return true;
			}
			difficulty_requested = false;
			difficulty_retry_ticks = 0;
			if (!me.is_ready()) {
				ready_retry_ticks++;
				if (!ready_requested || ready_retry_ticks >= 10) {
					ready_requested = true;
					ready_retry_ticks = 0;
					#print('MULTIPLAYER_SMOKE_READY_REQUESTED');
					game.event('ready_or_not', {
						ready: true,
					});
				}
			}
			else {
				ready_requested = false;
				ready_retry_ticks = 0;
			}
			return !game_configured;
		});
	});

	glsmac.on('configure_game', (e) => {
		game_configured = true;
		const game = e.game;
		const role = game.is_master() ? 'HOST' : 'CLIENT';
		let handled_turns = {};
		let client_conquest_ready = false;
		let conquest_prepare_requested = false;
		let turn_completion_retry_started = false;
		let post_victory_mutations = 0;
		let victory_poll_started = false;
		#print('MULTIPLAYER_SMOKE_CONFIGURE_' + role);

		const find_base_for_player = (player_id) => {
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == player_id) {
					return base;
				}
			}
			return null;
		};

		const find_base_by_name = (name) => {
			for (base of game.get_bm().get_bases()) {
				if (base.name == name) {
					return base;
				}
			}
			return null;
		};

		const get_research_state_error = (player, expect_progress) => {
			const starting_technologies = player.get_faction().get_starting_technologies();
			let starts_with_ecology = false;
			for (id of starting_technologies) {
				if (id == 'CentauriEcology') {
					starts_with_ecology = true;
				}
			}
			const state = player.get_research_state();
			if (state.technologies != starting_technologies) {
				return 'faction starting technologies are invalid';
			}
			let target_is_available = false;
			for (available_id of technologies.get_available_targets(state.technologies)) {
				if (available_id == state.target) {
					target_is_available = true;
					break;
				}
			}
			if (starts_with_ecology) {
				if (
					!player.has_technology('CentauriEcology') ||
					!target_is_available ||
					(expect_progress ? state.progress < 0 : state.progress != 0)
				) {
					return 'starting Centauri Ecology progression is invalid';
				}
				return #undefined;
			}
			const base = find_base_for_player(player.id);
			const has_ecology = player.has_technology('CentauriEcology');
			const can_produce_former = base != null && base.can_set_production('unit', 'Former');
			if (
				has_ecology ||
				!target_is_available ||
				(expect_progress ? state.progress < 0 : state.progress != 0) ||
				can_produce_former
			) {
				return
					'Centauri Ecology progress or Former production gate is invalid (' +
					'faction=' + player.get_faction().id +
					', target=' + state.target +
					', available=' + #to_string(target_is_available) +
					', progress=' + #to_string(state.progress) +
					', ecology=' + #to_string(has_ecology) +
					', former=' + #to_string(can_produce_former) + ')';
			}
			return #undefined;
		};

		const get_client_player_id = () => {
			return game.is_master() ? 1 : game.get_player().id;
		};

		const request_turn_completion = () => {
			if (turn_completion_retry_started) {
				return;
			}
			turn_completion_retry_started = true;
			let retry_ticks = 0;
			#async(100, () => {
				retry_ticks++;
				if (game.is_turn_complete(game.get_player().id)) {
					return false;
				}
				if (retry_ticks % 5 == 1) {
					game.event('complete_turn', {});
				}
				if (retry_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': turn completion timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
		};

		game.on('player_update', (event) => {
			if (game.is_master() || game.get_player(0).get_major_atrocities() != 17) {
				return;
			}
			client_player_update_callback_seen = true;
		});
		game.on('council_updated', (event) => {
			if (game.is_master() || game.get_player(0).get_major_atrocities() != 17) {
				return;
			}
			client_council_projection_refresh = true;
		});
		game.on('message', (event) => {
			if (event.text == 'Sea levels rose by 1 metres.') {
				sea_level_message_count++;
			}
		});
		game.on('sea_level_changed', (event) => {
			if (
				sea_level_notification_seen || sea_level_message_count != 1 ||
				event.amount != 1 || event.level != 1 ||
				game.get_tm().get_sea_level() != event.level
			) {
				#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': sea-level notification state is invalid');
				glsmac.exit();
				return;
			}
			sea_level_notification_seen = true;
			if (!game.is_master()) {
				for (base of game.get_bm().get_bases()) {
					if (base.get_owner().id == 0 && !base.is_redacted) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: sea-level projection revealed private base state');
						glsmac.exit();
						return;
					}
				}
				client_sea_level_probe_complete = true;
				#print('MULTIPLAYER_SMOKE_SEA_LEVEL_PROJECTION_PASS_CLIENT');
				game.event('multiplayer_smoke_sea_level_seen', {});
			}
		});

		const find_founding_site_coords = () => {
			const tm = game.get_tm();
			let result = null;
			let reserved_combat_tile = null;
			if (client_combat_target_x != 0 || client_combat_target_y != 0) {
				reserved_combat_tile = tm.get_tile(
					client_combat_target_x,
					client_combat_target_y
				);
			}
			for (let y = 0; y < tm.get_map_height(); y++) {
				for (let x = 0; x < tm.get_map_width(); x++) {
					if (x % 2 != y % 2) {
						continue;
					}
					const tile = tm.get_tile(x, y);
					if (
						!tile.is_land ||
						tile.is_locked() ||
						tile.get_base() != null ||
						#sizeof(tile.get_units()) != 0
					) {
						continue;
					}
					if (
						terraform_site_coords == null &&
						!tile.features.monolith &&
						!tile.features.xenofungus
					) {
						terraform_site_coords = {x: x, y: y};
						continue;
					}
					if (
						reserved_combat_tile != null &&
						(tile == reserved_combat_tile || tile.is_adjactent_to(reserved_combat_tile))
					) {
						continue;
					}
					let is_adjacent_to_base = false;
					for (nearby of tile.get_surrounding_tiles()) {
						if (nearby.get_base() != null) {
							is_adjacent_to_base = true;
							break;
						}
					}
					if (!is_adjacent_to_base) {
						result = {x: x, y: y};
						break;
					}
				}
				if (result != null) {
					break;
				}
			}
			return result;
		};

		const find_client_colony_pod = () => {
			const tm = game.get_tm();
			let result_id = 0;
			for (let y = 0; y < tm.get_map_height(); y++) {
				for (let x = 0; x < tm.get_map_width(); x++) {
					if (x % 2 != y % 2) {
						continue;
					}
					for (unit of tm.get_tile(x, y).get_units()) {
						if (unit.owner == get_client_player_id() && unit.def == 'ColonyPod') {
							result_id = unit.id;
							break;
						}
					}
					if (result_id != 0) {
						break;
					}
				}
				if (result_id != 0) {
					break;
				}
			}
			return result_id == 0 ? null : game.get_um().get_unit(result_id);
		};

		const find_client_former = () => {
			const tm = game.get_tm();
			let result_id = 0;
			for (let y = 0; y < tm.get_map_height(); y++) {
				for (let x = 0; x < tm.get_map_width(); x++) {
					if (x % 2 != y % 2) {
						continue;
					}
					for (unit of tm.get_tile(x, y).get_units()) {
						if (unit.owner == get_client_player_id() && unit.def == 'Former') {
							result_id = unit.id;
							break;
						}
					}
					if (result_id != 0) {
						break;
					}
				}
				if (result_id != 0) {
					break;
				}
			}
			return result_id == 0 ? null : game.get_um().get_unit(result_id);
		};

		const spawn_terraform_probe = () => {
			if (former_spawn_requested) {
				return true;
			}
			if (terraform_site_coords == null) {
				return false;
			}
			game.event('spawn_unit', {
				owner: game.get_player(get_client_player_id()),
				tile: game.get_tm().get_tile(terraform_site_coords.x, terraform_site_coords.y),
				type: 'Former',
				health: 1.0,
				morale: 2,
			});
			former_spawn_requested = true;
			return true;
		};

		const run_client_terraform_probe = () => {
			let order_requested = false;
			let former_id = 0;
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (!order_requested) {
					const former = find_client_former();
					if (former != null) {
						const def = former.get_def();
						if (
							def.is_native ||
							def.offense != 0 ||
							def.defense != 1 ||
							def.morale_set != 'STANDARD' ||
							def.can_found_base ||
							!def.can_terraform
						) {
							#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: Former definition is invalid');
							glsmac.exit();
							return false;
						}
						former_id = former.id;
						order_requested = true;
						game.event('terraform_tile', {
							unit: former,
							type: terraform_order,
						});
					}
				}
				else if (game.get_um().has_unit(former_id)) {
					const former = game.get_um().get_unit(former_id);
					if (former.terraforming == terraform_order) {
						if (
							former.terraforming_turns_remaining != 4 ||
							former.movement != 0.0 ||
							former.get_tile().terraforming[terraform_order]
						) {
							#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: accepted Former order is invalid');
							glsmac.exit();
							return false;
						}
						client_terraform_probe_complete = true;
						#print('MULTIPLAYER_SMOKE_TERRAFORM_ORDER_PASS_CLIENT');
						return false;
					}
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: terraforming order timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
			return true;
		};

		const spawn_colony_probe = () => {
			if (colony_pod_spawn_requested) {
				return true;
			}
			const site_coords = find_founding_site_coords();
			if (site_coords == null) {
				return false;
			}
			game.event('spawn_unit', {
				owner: game.get_player(get_client_player_id()),
				tile: game.get_tm().get_tile(site_coords.x, site_coords.y),
				type: 'ColonyPod',
				health: 1.0,
				morale: 2,
			});
			colony_pod_spawn_requested = true;
			return true;
		};

		const run_client_founding_probe = () => {
			let founding_requested = false;
			let colony_pod_id = 0;
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (!founding_requested) {
					const colony_pod = find_client_colony_pod();
					if (colony_pod != null) {
						const def = colony_pod.get_def();
						if (
							def.is_native ||
							def.offense != 0 ||
							def.defense != 1 ||
							def.morale_set != 'STANDARD' ||
							!def.can_found_base
						) {
							#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: Colony Pod definition is invalid');
							glsmac.exit();
							return false;
						}
						colony_pod_id = colony_pod.id;
						founding_requested = true;
						game.event('found_base', {
							unit: colony_pod,
							name: expansion_base_name,
						});
					}
				}
				else {
					const expansion_base = find_base_by_name(expansion_base_name);
					if (expansion_base != null) {
						const production = expansion_base.get_production();
						if (
							game.get_um().has_unit(colony_pod_id) ||
							expansion_base.get_owner().id != get_client_player_id() ||
							#sizeof(expansion_base.get_pops()) != 1 ||
							#sizeof(expansion_base.get_worked_tiles()) != 1 ||
							!#is_defined(production) ||
							production.id != 'ScoutPatrol'
						) {
							#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: founded base state is invalid');
							glsmac.exit();
							return false;
						}
						client_base_founding_probe_complete = true;
						#print('MULTIPLAYER_SMOKE_BASE_FOUNDING_PASS_CLIENT');
						request_turn_completion();
						return false;
					}
				}
				if (wait_ticks >= 200) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: colony founding timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
			return true;
		};

		const find_starting_unit = (player_id) => {
			const base = find_base_for_player(player_id);
			if (base == null) {
				return null;
			}
			for (unit of base.get_tile().get_units()) {
				if (unit.owner == player_id) {
					return unit;
				}
			}
			return null;
		};

		const find_movement_target = (unit) => {
			const source = unit.get_tile();
			const candidates = [
				source.get_N(),
				source.get_NE(),
				source.get_E(),
				source.get_SE(),
				source.get_S(),
				source.get_SW(),
				source.get_W(),
				source.get_NW(),
			];
			for (tile of candidates) {
				if (tile == source) {
					continue;
				}
				if (tile.is_locked()) {
					continue;
				}
				if (unit.is_land && tile.is_water) {
					continue;
				}
				if (unit.is_water && tile.is_land) {
					continue;
				}
				let has_foreign_unit = false;
				for (other of tile.get_units()) {
					if (other.owner != unit.owner) {
						has_foreign_unit = true;
						break;
					}
				}
				if (!has_foreign_unit) {
					return tile;
				}
			}
			return null;
		};

		const find_combat_target = (unit, source, movement_target) => {
			let first_empty_tile = null;
			const candidates = [
				movement_target.get_N(),
				movement_target.get_NE(),
				movement_target.get_E(),
				movement_target.get_SE(),
				movement_target.get_S(),
				movement_target.get_SW(),
				movement_target.get_W(),
				movement_target.get_NW(),
			];
			for (tile of candidates) {
				if (tile == source || tile == movement_target || tile.is_locked()) {
					continue;
				}
				let is_adjacent_to_source = false;
				for (source_neighbour of source.get_surrounding_tiles()) {
					if (source_neighbour == tile) {
						is_adjacent_to_source = true;
						break;
					}
				}
				if (is_adjacent_to_source) {
					continue;
				}
				const tile_base = tile.get_base();
				if (tile_base != null && tile_base.name != combat_base_name) {
					continue;
				}
				if (unit.is_land && tile.is_water) {
					continue;
				}
				if (unit.is_water && tile.is_land) {
					continue;
				}
				const occupants = tile.get_units();
				for (occupant of occupants) {
					if (occupant.owner != unit.owner) {
						return tile;
					}
				}
				if (#sizeof(occupants) == 0 && first_empty_tile == null) {
					first_empty_tile = tile;
				}
			}
			return first_empty_tile;
		};

		const prepare_client_movement_probe = () => {
			if (client_movement_unit_id != 0) {
				return true;
			}
			const unit = find_starting_unit(get_client_player_id());
			if (unit == null) {
				return false;
			}
			const target = find_movement_target(unit);
			if (target == null) {
				return false;
			}
			const combat_target = find_combat_target(unit, unit.get_tile(), target);
			if (combat_target == null) {
				return false;
			}
			client_movement_unit_id = unit.id;
			client_movement_target_x = target.x;
			client_movement_target_y = target.y;
			client_combat_target_x = combat_target.x;
			client_combat_target_y = combat_target.y;
			return true;
		};

		const find_combat_defender = () => {
			if (combat_defender_id != 0) {
				if (game.get_um().has_unit(combat_defender_id)) {
					return game.get_um().get_unit(combat_defender_id);
				}
				return null;
			}
			const target = game.get_tm().get_tile(
				client_combat_target_x,
				client_combat_target_y
			);
			for (unit of target.get_units()) {
				if (unit.owner != get_client_player_id()) {
					combat_defender_id = unit.id;
					return unit;
				}
			}
			return null;
		};

		const spawn_combat_defender = () => {
			if (combat_defender_spawn_requested) {
				return true;
			}
			if (!prepare_client_movement_probe()) {
				return false;
			}
			const attacker = game.get_um().get_unit(client_movement_unit_id);
			game.event('multiplayer_smoke_set_unit_movement', {
				unit: attacker,
				movement: 3.0,
			});
			const combat_tile = game.get_tm().get_tile(
				client_combat_target_x,
				client_combat_target_y
			);
			game.event('spawn_base', {
				owner: game.get_player(0),
				tile: combat_tile,
				name: combat_base_name,
			});
			game.event('spawn_unit', {
				owner: game.get_player(0),
				tile: combat_tile,
				type: attacker.def,
				health: 0.1,
				morale: 0,
			});
			combat_defender_spawn_requested = true;
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				return find_combat_defender() == null && wait_ticks < 100;
			});
			return true;
		};

		game.register_event('multiplayer_smoke_accept_once', {
			validate: (e) => {
				if (e.caller == 0) {
					return 'Probe must be submitted by a client';
				}
			},
			apply: (e) => {
				const previous = accepted_event_count;
				accepted_event_count++;
				return {previous: previous};
			},
			rollback: (e) => {
				accepted_event_count = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_player_privacy_update', {
			player_visibility: 'private',
			validate: (e) => {
				if (e.caller != 0) {
					return 'Player privacy update probe is invalid';
				}
			},
			apply: (e) => {
				if (!e.game.is_master()) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: private rival player event was delivered');
					glsmac.exit();
				}
				const player = e.game.get_player(e.caller);
				const previous = {
					energy: player.get_energy_credits(),
					atrocities: player.get_major_atrocities(),
				};
				player.set_energy_credits(707);
				player.set_major_atrocities(17);
				return previous;
			},
			rollback: (e) => {
				const player = e.game.get_player(e.caller);
				player.set_energy_credits(e.applied.energy);
				player.set_major_atrocities(e.applied.atrocities);
			},
		});

		game.register_event('multiplayer_smoke_player_privacy_seen', {
			validate: (e) => {
				if (e.caller != get_client_player_id()) {
					return 'Only the client can acknowledge projected player privacy';
				}
			},
			apply: (e) => {
				const previous = client_player_privacy_acknowledged;
				client_player_privacy_acknowledged = true;
				return {previous: previous};
			},
			rollback: (e) => {
				client_player_privacy_acknowledged = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_turn_one_ready', {
			validate: (e) => {
				if (e.caller != get_client_player_id()) {
					return 'Only the client can signal turn-one projection readiness';
				}
			},
			apply: (e) => {
				const previous = client_turn_one_ready;
				client_turn_one_ready = true;
				return {previous: previous};
			},
			rollback: (e) => {
				client_turn_one_ready = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_base_snapshot_probe', {
			validate: (e) => {
				if (e.caller != 0) {
					return 'Only the host can report base snapshot visibility';
				}
				if (
					#typeof(e.data.x) != 'Int' || #typeof(e.data.y) != 'Int'
				) {
					return 'Base snapshot visibility probe is invalid';
				}
			},
			apply: (e) => {
				const previous = client_base_snapshot_probe_complete;
				if (!e.game.is_master()) {
					const tile = e.game.get_tm().get_tile(e.data.x, e.data.y);
					const projected = tile.get_base();
					const initially_hidden = projected == null;
					if (projected != null && !projected.is_redacted) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: foreign base snapshot visibility is invalid');
						glsmac.exit();
					}
					client_base_snapshot_probe_complete = true;
					#print('MULTIPLAYER_SMOKE_BASE_SNAPSHOT_VISIBILITY_PASS_CLIENT');
					let full_seen = false;
					let wait_ticks = 0;
					#async(100, () => {
						wait_ticks++;
						const current = tile.get_base();
						if (!full_seen && current != null && !current.is_redacted) {
							if (!#is_defined(current.get_production())) {
								#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: infiltrated base lacks private production state');
								glsmac.exit();
								return false;
							}
							full_seen = true;
							#print('MULTIPLAYER_SMOKE_BASE_INFILTRATION_REVEAL_PASS_CLIENT');
							game.event('multiplayer_smoke_base_infiltration_seen', {});
						}
						else if (
							full_seen &&
							(
								(initially_hidden && current == null) ||
								(
									!initially_hidden && current != null &&
									current.is_redacted && !#is_defined(current.get_production())
								)
							)
						) {
							client_base_infiltration_probe_complete = true;
							#print('MULTIPLAYER_SMOKE_BASE_INFILTRATION_REVOKE_PASS_CLIENT');
							return false;
						}
						if (wait_ticks >= 100) {
							#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: base infiltration projection timed out');
							glsmac.exit();
							return false;
						}
						return true;
					});
				}
				return {previous: previous};
			},
			rollback: (e) => {
				client_base_snapshot_probe_complete = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_set_base_infiltration', {
			validate: (e) => {
				if (e.caller != 0 || #typeof(e.data.enabled) != 'Bool') {
					return 'Base infiltration projection request is invalid';
				}
			},
			apply: (e) => {
				const client = e.game.get_player(get_client_player_id());
				const previous = client.has_infiltrated(e.game.get_player(0));
				client.set_infiltrated(e.game.get_player(0), e.data.enabled);
				return {previous: previous};
			},
			rollback: (e) => {
				e.game.get_player(get_client_player_id()).set_infiltrated(
					e.game.get_player(0),
					e.applied.previous
				);
			},
		});

		game.register_event('multiplayer_smoke_base_infiltration_seen', {
			validate: (e) => {
				if (e.caller != get_client_player_id()) {
					return 'Only the client can acknowledge infiltrated base state';
				}
			},
			apply: (e) => {
				if (e.game.is_master()) {
					e.game.event('multiplayer_smoke_set_base_infiltration', {enabled: false});
				}
			},
			rollback: (e) => {},
		});

		game.register_event('multiplayer_smoke_movement_ready_for_combat', {
			validate: (e) => {
				if (e.caller != get_client_player_id()) {
					return 'Only the client can finish the movement probe';
				}
			},
			apply: (e) => {
				if (e.game.is_master() && !spawn_combat_defender()) {
					#print('MULTIPLAYER_SMOKE_FAIL_HOST: combat defender could not be spawned');
					glsmac.exit();
				}
			},
			rollback: (e) => {},
		});

		game.register_event('multiplayer_smoke_reject_and_rollback', {
			validate: (e) => {
				if (e.caller == 0) {
					return 'Probe must be submitted by a client';
				}
				if (e.game.is_master()) {
					return 'Intentional server rejection for rollback coverage';
				}
			},
			apply: (e) => {
				const previous = rejected_event_count;
				rejected_event_count++;
				return {previous: previous};
			},
			rollback: (e) => {
				rejected_event_count = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_set_unit_movement', {
			validate: (e) => {
				if (e.caller != 0) {
					return 'Only the host can prepare movement coverage';
				}
			},
			apply: (e) => {
				const previous = e.data.unit.movement;
				e.data.unit.movement = e.data.movement;
				return {previous: previous};
			},
			rollback: (e) => {
				e.data.unit.movement = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_mixed_unit_privacy', {
			unit_visibility: 'private',
			validate: (e) => {
				if (e.caller != 0) {
					return 'Only the host can run the mixed unit privacy probe';
				}
				if (e.data.hidden_unit.id != 1) {
					return 'Mixed unit privacy probe must reference the hidden host unit';
				}
				if (e.data.visible_unit.owner != get_client_player_id()) {
					return 'Mixed unit privacy probe must reference the visible client unit';
				}
			},
			apply: (e) => {
				if (!e.game.is_master()) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: mixed private unit event was delivered');
					glsmac.exit();
				}
				const previous = e.data.visible_unit.movement;
				e.data.visible_unit.movement = 2.25;
				return {previous: previous};
			},
			rollback: (e) => {
				e.data.visible_unit.movement = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_mixed_unit_privacy_seen', {
			validate: (e) => {
				if (e.caller != get_client_player_id()) {
					return 'Only the client can acknowledge the mixed unit privacy probe';
				}
			},
			apply: (e) => {
				const previous = mixed_unit_privacy_acknowledged;
				mixed_unit_privacy_acknowledged = true;
				return {previous: previous};
			},
			rollback: (e) => {
				mixed_unit_privacy_acknowledged = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_private_map_probe_ready', {
			validate: (e) => {
				if (
					e.caller != 0 || #typeof(e.data.x) != 'Int' ||
					#typeof(e.data.y) != 'Int' || #typeof(e.data.initial_fungus) != 'Bool' ||
					#typeof(e.data.initial_climate_level) != 'Int'
				) {
					return 'Private map projection setup is invalid';
				}
			},
			apply: (e) => {
				const previous = private_map_probe;
				private_map_probe = {
					x: e.data.x,
					y: e.data.y,
					initial_fungus: e.data.initial_fungus,
					initial_climate_level: e.data.initial_climate_level,
				};
				return {previous: previous};
			},
			rollback: (e) => {
				private_map_probe = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_private_map_projection', {
			validate: (e) => {
				if (
					e.caller != 0 || e.data.base.get_owner().id != 0 ||
					#typeof(e.data.fungus) != 'Bool' ||
					#typeof(e.data.climate_level) != 'Int'
				) {
					return 'Private map projection request is invalid';
				}
			},
			apply: (e) => {
				if (!e.game.is_master()) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: private map event was delivered');
					glsmac.exit();
				}
				const tm = e.game.get_tm();
				const climate = tm.get_climate_state();
				const previous = {
					fungus: e.data.tile.features.xenofungus,
					climate: climate,
				};
				e.data.tile.update_features({xenofungus: e.data.fungus});
				tm.set_climate_state(
					e.data.climate_level,
					climate.future_change,
					climate.progress
				);
				return previous;
			},
			rollback: (e) => {
				e.data.tile.update_features({xenofungus: e.applied.fungus});
				e.game.get_tm().set_climate_state(
					e.applied.climate.level,
					e.applied.climate.future_change,
					e.applied.climate.progress
				);
			},
		});

		game.register_event('multiplayer_smoke_private_map_projection_seen', {
			validate: (e) => {
				if (
					e.caller != get_client_player_id() ||
					#typeof(e.data.phase) != 'Int' ||
					e.data.phase != 1
				) {
					return 'Private map projection acknowledgement is invalid';
				}
			},
			apply: (e) => {
				const previous = private_map_projection_phase;
				private_map_projection_phase = e.data.phase;
				return {previous: previous};
			},
			rollback: (e) => {
				private_map_projection_phase = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_sea_level_seen', {
			validate: (e) => {
				if (e.caller != get_client_player_id()) {
					return 'Only the client can acknowledge projected sea-level state';
				}
			},
			apply: (e) => {
				const previous = client_sea_level_acknowledged;
				client_sea_level_acknowledged = true;
				return {previous: previous};
			},
			rollback: (e) => {
				client_sea_level_acknowledged = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_relocate_hidden_unit', {
			unit_visibility: 'private',
			validate: (e) => {
				if (e.caller != 0) {
					return 'Only the host can relocate the visibility probe';
				}
				if (e.data.unit.id != 1) {
					return 'Visibility probe must use the hidden host unit';
				}
			},
			apply: (e) => {
				const previous = e.data.unit.get_tile();
				e.data.unit.teleport_to_tile(e.data.tile);
				return {tile: previous};
			},
			rollback: (e) => {
				e.data.unit.teleport_to_tile(e.applied.tile);
			},
		});

		game.register_event('multiplayer_smoke_visibility_seen', {
			validate: (e) => {
				if (e.caller == 0) {
					return 'Only the client can acknowledge a revealed unit';
				}
			},
			apply: (e) => {
				const previous = live_visibility_seen;
				live_visibility_seen = true;
				return {previous: previous};
			},
			rollback: (e) => {
				live_visibility_seen = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_visibility_client_ready', {
			validate: (e) => {
				if (e.caller == 0) {
					return 'Only the client can signal visibility readiness';
				}
			},
			apply: (e) => {
				const previous = live_visibility_client_ready;
				live_visibility_client_ready = true;
				return {previous: previous};
			},
			rollback: (e) => {
				live_visibility_client_ready = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_visibility_hidden', {
			validate: (e) => {
				if (e.caller == 0) {
					return 'Only the client can acknowledge a hidden unit';
				}
			},
			apply: (e) => {
				const previous = live_visibility_hidden;
				live_visibility_hidden = true;
				return {previous: previous};
			},
			rollback: (e) => {
				live_visibility_hidden = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_conquest_ready', {
			validate: (e) => {
				if (e.caller == 0) {
					return 'Only the client can signal conquest readiness';
				}
			},
			apply: (e) => {
				const previous = client_conquest_ready;
				client_conquest_ready = true;
				return {previous: previous};
			},
			rollback: (e) => {
				client_conquest_ready = e.applied.previous;
			},
		});

		game.register_event('multiplayer_smoke_prepare_conquest', {
			validate: (e) => {
				if (e.caller != 0) {
					return 'Only the host can prepare conquest coverage';
				}
				if (#typeof(e.data.winner_id) != 'Int' || e.data.winner_id < 0) {
					return 'Conquest probe winner ID is invalid';
				}
			},
			apply: (e) => {
				const winner = e.game.get_player(e.data.winner_id);
				let owners = [];
				for (base of e.game.get_bm().get_bases()) {
					owners :+{base: base, owner: base.get_owner()};
					if (base.get_owner().id != winner.id) {
						base.set_owner(winner);
					}
				}
				return {owners: owners};
			},
			rollback: (e) => {
				for (entry of e.applied.owners) {
					if (entry.base.get_owner().id != entry.owner.id) {
						entry.base.set_owner(entry.owner);
					}
				}
			},
		});

		game.register_event('multiplayer_smoke_mutate_after_victory', {
			validate: (e) => {},
			apply: (e) => {
				const previous = post_victory_mutations;
				post_victory_mutations++;
				return {previous: previous};
			},
			rollback: (e) => {
				post_victory_mutations = e.applied.previous;
			},
		});

		const find_live_visibility_target = () => {
			const base = find_base_for_player(get_client_player_id());
			if (base == null) {
				return null;
			}
			for (tile of base.get_tile().get_surrounding_tiles()) {
				if (
					tile.is_land && !tile.is_locked() && tile.get_base() == null &&
					#sizeof(tile.get_units()) == 0 && !tile.features.xenofungus &&
					(tile.x != client_movement_target_x || tile.y != client_movement_target_y) &&
					(tile.x != client_combat_target_x || tile.y != client_combat_target_y)
				) {
					return tile;
				}
			}
			return null;
		};

		const start_host_live_visibility_probe = () => {
			if (live_visibility_probe_started) {
				return true;
			}
			const target = find_live_visibility_target();
			if (target == null || !game.get_um().has_unit(1)) {
				return false;
			}
			live_visibility_probe_started = true;
			const unit = game.get_um().get_unit(1);
			const source = unit.get_tile();
			game.event('multiplayer_smoke_relocate_hidden_unit', {
				unit: unit,
				tile: target,
			});
			let returned = false;
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (!returned && live_visibility_seen) {
					returned = true;
					game.event('multiplayer_smoke_relocate_hidden_unit', {
						unit: game.get_um().get_unit(1),
						tile: source,
					});
				}
				else if (returned && live_visibility_hidden) {
					#print('MULTIPLAYER_SMOKE_LIVE_VISIBILITY_PASS_HOST');
					request_turn_completion();
					return false;
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_HOST: live visibility probe timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
			return true;
		};

		const start_host_base_snapshot_probe = () => {
			if (host_base_snapshot_probe_started) {
				return;
			}
			host_base_snapshot_probe_started = true;
			const host_base = find_base_for_player(0);
			const host_base_tile = host_base.get_tile();
			game.event('multiplayer_smoke_base_snapshot_probe', {
				x: host_base_tile.x,
				y: host_base_tile.y,
			});
			game.event('multiplayer_smoke_set_base_infiltration', {enabled: true});
		};

		const wait_for_client_live_visibility_probe = () => {
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (live_visibility_client_ready) {
					start_host_base_snapshot_probe();
					if (!start_host_live_visibility_probe()) {
						#print('MULTIPLAYER_SMOKE_FAIL_HOST: live visibility probe could not start');
						glsmac.exit();
					}
					return false;
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_HOST: client visibility readiness timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
		};

		const continue_host_turn_one = () => {
			game.event('multiplayer_smoke_set_unit_movement', {
				unit: game.get_um().get_unit(client_movement_unit_id),
				movement: 3.0,
			});
			if (!spawn_colony_probe()) {
				#print('MULTIPLAYER_SMOKE_FAIL_HOST: colony probe could not be spawned');
				glsmac.exit();
				return;
			}
			if (!spawn_terraform_probe()) {
				#print('MULTIPLAYER_SMOKE_FAIL_HOST: Former probe could not be spawned');
				glsmac.exit();
				return;
			}
			wait_for_client_live_visibility_probe();
		};

		const find_private_map_probe_tile = () => {
			const tm = game.get_tm();
			return tm.get_tile(tm.get_map_width() - 2, 0);
		};

		const start_host_private_map_projection_probe = () => {
			const tile = find_private_map_probe_tile();
			const base = find_base_for_player(0);
			if (tile == null || base == null) {
				#print('MULTIPLAYER_SMOKE_FAIL_HOST: private map projection target is unavailable');
				glsmac.exit();
				return;
			}
			const initial_fungus = tile.features.xenofungus;
			const initial_climate_level = game.get_tm().get_climate_state().level;
			game.event('multiplayer_smoke_private_map_probe_ready', {
				x: tile.x,
				y: tile.y,
				initial_fungus: initial_fungus,
				initial_climate_level: initial_climate_level,
			});
			game.event('multiplayer_smoke_private_map_projection', {
				base: base,
				tile: tile,
				fungus: !initial_fungus,
				climate_level: initial_climate_level + 1,
			});
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (private_map_projection_phase == 1 && !sea_level_change_requested) {
					sea_level_change_requested = true;
					#print('MULTIPLAYER_SMOKE_PRIVATE_MAP_PROJECTION_PASS_HOST');
					game.event('change_sea_level', {amount: 1});
				}
				if (sea_level_notification_seen && client_sea_level_acknowledged) {
					#print('MULTIPLAYER_SMOKE_SEA_LEVEL_PROJECTION_PASS_HOST');
					continue_host_turn_one();
					return false;
				}
				if (wait_ticks >= 300) {
					#print(
						'MULTIPLAYER_SMOKE_FAIL_HOST: private map projection probe timed out at phase ' +
						#to_string(private_map_projection_phase) + ', sea=' +
						#to_string(sea_level_notification_seen) + '/' +
						#to_string(client_sea_level_acknowledged)
					);
					glsmac.exit();
					return false;
				}
				return true;
			});
		};

		const start_host_mixed_unit_privacy_probe = () => {
			game.event('multiplayer_smoke_mixed_unit_privacy', {
				hidden_unit: game.get_um().get_unit(1),
				visible_unit: game.get_um().get_unit(client_movement_unit_id),
			});
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (mixed_unit_privacy_acknowledged) {
					#print('MULTIPLAYER_SMOKE_MIXED_UNIT_PRIVACY_PASS_HOST');
					start_host_private_map_projection_probe();
					return false;
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_HOST: mixed unit privacy probe timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
		};

		const wait_for_host_player_privacy_probe = () => {
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (client_player_privacy_acknowledged) {
					start_host_mixed_unit_privacy_probe();
					return false;
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_HOST: player privacy acknowledgement timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
		};

		const wait_for_client_turn_one_ready = () => {
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (client_turn_one_ready) {
					game.event('multiplayer_smoke_player_privacy_update', {});
					if (!prepare_client_movement_probe()) {
						#print('MULTIPLAYER_SMOKE_FAIL_HOST: movement probe could not be prepared');
						glsmac.exit();
						return false;
					}
					wait_for_host_player_privacy_probe();
					return false;
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_HOST: client turn-one readiness timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
		};

		const start_client_mixed_unit_privacy_probe = () => {
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (
					game.get_um().has_unit(client_movement_unit_id) &&
					game.get_um().get_unit(client_movement_unit_id).movement == 2.25
				) {
					if (game.get_um().has_unit(1)) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: mixed private event revealed the host unit');
						glsmac.exit();
						return false;
					}
					#print('MULTIPLAYER_SMOKE_MIXED_UNIT_PRIVACY_PASS_CLIENT');
					game.event('multiplayer_smoke_mixed_unit_privacy_seen', {});
					return false;
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: mixed unit privacy state timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
		};

		const start_client_private_map_projection_probe = () => {
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (private_map_probe != null) {
					const tile = game.get_tm().get_tile(private_map_probe.x, private_map_probe.y);
					const climate_level = game.get_tm().get_climate_state().level;
					if (
						tile.features.xenofungus != private_map_probe.initial_fungus &&
						climate_level == private_map_probe.initial_climate_level + 1
					) {
						for (base of game.get_bm().get_bases()) {
							if (base.get_owner().id == 0 && !base.is_redacted) {
								#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: map projection revealed private base state');
								glsmac.exit();
								return false;
							}
						}
						#print('MULTIPLAYER_SMOKE_PRIVATE_MAP_MUTATION_PASS_CLIENT');
						#print('MULTIPLAYER_SMOKE_PRIVATE_MAP_PROJECTION_PASS_CLIENT');
						start_client_live_visibility_probe();
						run_client_terraform_probe();
						game.event('multiplayer_smoke_private_map_projection_seen', {phase: 1});
						return false;
					}
				}
				if (wait_ticks >= 300) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: private map projection probe timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
		};

		const start_client_live_visibility_probe = () => {
			game.event('multiplayer_smoke_visibility_client_ready', {});
			let revealed = false;
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (!revealed && game.get_um().has_unit(1)) {
					const unit = game.get_um().get_unit(1);
					if (unit.owner != 0) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: revealed hidden unit owner is invalid');
						glsmac.exit();
						return false;
					}
					revealed = true;
					#print('MULTIPLAYER_SMOKE_LIVE_REVEAL_PASS_CLIENT');
					game.event('multiplayer_smoke_visibility_seen', {});
				}
				else if (revealed && !game.get_um().has_unit(1)) {
					#print('MULTIPLAYER_SMOKE_LIVE_HIDE_PASS_CLIENT');
					#print('MULTIPLAYER_SMOKE_LIVE_VISIBILITY_PASS_CLIENT');
					client_live_visibility_probe_complete = true;
					game.event('multiplayer_smoke_visibility_hidden', {});
					return false;
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: live visibility probe timed out');
					glsmac.exit();
					return false;
				}
				return true;
			});
		};

		const start_victory_poll = () => {
			if (victory_poll_started) {
				return;
			}
			victory_poll_started = true;
			let phase = 'wait_for_victory';
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (phase == 'wait_for_victory') {
					if (!game.is_game_over()) {
						if (wait_ticks >= 100) {
							#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': conquest victory timed out');
							glsmac.exit();
							return false;
						}
						return true;
					}
					const state = game.get_victory_state();
					if (state != {type: 'conquest', winner: get_client_player_id(), turn: 2}) {
						#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': synchronized victory state is invalid');
						glsmac.exit();
						return false;
					}
					game.event('multiplayer_smoke_mutate_after_victory', {});
					phase = 'verify_terminal';
					wait_ticks = 0;
					return true;
				}
				if (post_victory_mutations != 0) {
					#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': game state changed after victory');
					glsmac.exit();
					return false;
				}
				if (wait_ticks < 5) {
					return true;
				}
				const final_state = game.get_victory_state();
				if (
					!game.is_game_over() ||
					game.get_turn() != 2 ||
					final_state != {type: 'conquest', winner: get_client_player_id(), turn: 2}
				) {
					#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': terminal state did not remain stable');
					glsmac.exit();
					return false;
				}
				#print('MULTIPLAYER_SMOKE_VICTORY_PASS_' + role);
				if (!exit_scheduled) {
					exit_scheduled = true;
					#print('MULTIPLAYER_SMOKE_PASS_' + role + ': synchronized conquest victory is terminal');
					#async(game.is_master() ? 2500 : 1000, () => {
						glsmac.exit();
					});
				}
				return false;
			});
		};

		const wait_for_player_privacy_update = () => {
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				const host = game.get_player(0);
				if (
					host.get_major_atrocities() == 17 &&
					client_player_update_callback_seen &&
					client_council_projection_refresh
				) {
					if (!host.is_redacted || host.get_energy_credits() != 0) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: live rival player private state leaked');
						glsmac.exit();
						return false;
					}
					client_player_privacy_probe_complete = true;
					#print('MULTIPLAYER_SMOKE_PLAYER_PRIVACY_PASS_CLIENT');
					game.event('multiplayer_smoke_player_privacy_seen', {});
					return false;
				}
				if (wait_ticks >= 100) {
					#print(
						'MULTIPLAYER_SMOKE_FAIL_CLIENT: live player projection timed out ' +
						'(callback=' + #to_string(client_player_update_callback_seen) +
						', council=' + #to_string(client_council_projection_refresh) + ')'
					);
					glsmac.exit();
					return false;
				}
				return true;
			});
		};

		const run_client_combat_probe = () => {
			let phase = 'wait_for_defender';
			let wait_ticks = 0;
			const mark_immediate_combat_complete = () => {
				if (!client_immediate_combat_probe_complete) {
					client_immediate_combat_probe_complete = true;
					#print('MULTIPLAYER_SMOKE_IMMEDIATE_COMBAT_PASS_CLIENT');
				}
			};
			const finish_combat_probe = () => {
				client_combat_probe_complete = true;
				#print('MULTIPLAYER_SMOKE_COMBAT_PASS_CLIENT');
				run_client_founding_probe();
			};
			#async(100, () => {
				wait_ticks++;
				if (phase == 'wait_for_defender') {
					const attacker = game.get_um().get_unit(client_movement_unit_id);
					const defender = find_combat_defender();
					if (defender != null) {
						game.event('attack_unit', {
							attacker: attacker,
							defender: defender,
						});
						phase = 'wait_for_combat_apply';
					}
				}
				else {
					const attacker_exists = game.get_um().has_unit(client_movement_unit_id);
					const defender_exists = game.get_um().has_unit(combat_defender_id);
					if (!attacker_exists) {
						mark_immediate_combat_complete();
						finish_combat_probe();
						return false;
					}
					if (!defender_exists) {
						mark_immediate_combat_complete();
						const attacker_tile = game.get_um().get_unit(client_movement_unit_id).get_tile();
						if (
							attacker_tile.x == client_combat_target_x &&
							attacker_tile.y == client_combat_target_y
						) {
							const captured_base = attacker_tile.get_base();
							if (
								captured_base == null ||
								captured_base.name != combat_base_name ||
								captured_base.get_owner().id != get_client_player_id()
							) {
								#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: combat base was not captured');
								glsmac.exit();
								return false;
							}
							client_base_capture_probe_complete = true;
							#print('MULTIPLAYER_SMOKE_BASE_CAPTURE_PASS_CLIENT');
							#print('MULTIPLAYER_SMOKE_POST_COMBAT_ADVANCE_PASS_CLIENT');
							finish_combat_probe();
							return false;
						}
						phase = 'wait_for_post_combat_advance';
					}
					else if (phase == 'wait_for_combat_apply') {
						const attacker = game.get_um().get_unit(client_movement_unit_id);
						const defender = game.get_um().get_unit(combat_defender_id);
						if (attacker.movement == 0.0) {
							if (attacker.health > 0.0 && defender.health > 0.0) {
								#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: combat state waited for animation completion');
								glsmac.exit();
								return false;
							}
							mark_immediate_combat_complete();
							phase = 'combat';
						}
					}
				}
				if (wait_ticks >= 200) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: combat probe timed out in ' + phase);
					glsmac.exit();
					return false;
				}
				return true;
			});
			return true;
		};

		const run_client_movement_probe = () => {
			if (!prepare_client_movement_probe()) {
				return false;
			}
			const unit = game.get_um().get_unit(client_movement_unit_id);
			const target = game.get_tm().get_tile(
				client_movement_target_x,
				client_movement_target_y
			);
			const source = unit.get_tile();

			let phase = 'wait_for_movement';
			let movement_before = 0.0;
			let wait_ticks = 0;
			#async(10, () => {
				wait_ticks++;
				if (phase == 'wait_for_movement' && unit.movement >= 3.0) {
					movement_before = unit.movement;
					game.event('move_unit', {
						unit: unit,
						tile: target,
					});
					phase = 'wait_for_movement_apply';
				}
				else if (
					phase == 'wait_for_movement_apply' &&
					(source.is_locked() || target.is_locked())
				) {
					if (
						unit.get_tile() != target ||
						!unit.moved_this_turn ||
						unit.movement >= movement_before
					) {
						#print(
							'MULTIPLAYER_SMOKE_FAIL_CLIENT: movement state waited for animation completion (' +
							#to_string(movement_before) + ' -> ' + #to_string(unit.movement) +
							', moved=' + #to_string(unit.moved_this_turn) + ')'
						);
						glsmac.exit();
						return false;
					}
					client_immediate_movement_probe_complete = true;
					#print('MULTIPLAYER_SMOKE_IMMEDIATE_MOVEMENT_PASS_CLIENT');
					phase = 'movement';
				}
				else if (
					phase == 'movement' &&
					!source.is_locked() &&
					!target.is_locked()
				) {
					client_movement_probe_complete = true;
					#print('MULTIPLAYER_SMOKE_MOVEMENT_PASS_CLIENT');
					game.event('multiplayer_smoke_movement_ready_for_combat', {});
					if (!run_client_combat_probe()) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: combat probe could not start');
						glsmac.exit();
					}
					return false;
				}
				if (wait_ticks >= 1000) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: movement probe timed out in ' + phase);
					glsmac.exit();
					return false;
				}
				return true;
			});
			return true;
		};

		const run_client_worker_probe = () => {
			const player_id = game.get_player().id;
			const base = find_base_for_player(player_id);
			if (base == null) {
				return false;
			}
			const pops = base.get_pops();
			if (#sizeof(pops) == 0) {
				return false;
			}
			const unworked_tiles = base.get_unworked_tiles();
			if (#sizeof(unworked_tiles) == 0) {
				return false;
			}

			const pop = pops[0];
			const base_id = base.id;
			const pop_id = pop.id;
			const target_tile = unworked_tiles[0];
			const get_active_base = () => {
				for (candidate of game.get_bm().get_bases()) {
					if (candidate.id == base_id) {
						return candidate;
					}
				}
				return null;
			};
			const get_active_pop = (active_base) => {
				if (active_base == null) {
					return null;
				}
				for (candidate of active_base.get_pops()) {
					if (candidate.id == pop_id) {
						return candidate;
					}
				}
				return null;
			};
			game.event('work_base_tile', {
				base: base,
				pop: pop,
				tile: target_tile,
			});

			let phase = 'work';
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (phase == 'work' && target_tile.has('working_pop')) {
					const active_base = get_active_base();
					const active_pop = get_active_pop(active_base);
					const working_pop = target_tile.get('working_pop');
					if (
						active_base == null || active_pop == null ||
						working_pop != active_pop || working_pop.get_base() != active_base
					) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: worker assignment is inconsistent');
						glsmac.exit();
						return false;
					}
					phase = 'unwork';
					game.event('unwork_base_tile', {
						base: active_base,
						tile: target_tile,
					});
				}
				else if (phase == 'unwork' && !target_tile.has('working_pop')) {
					const active_base = get_active_base();
					const active_pop = get_active_pop(active_base);
					if (
						active_base == null || active_pop == null ||
						#sizeof(active_base.get_worked_tiles()) != 0 ||
						active_pop.get_type() != 'DOCTOR'
					) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: worker unassignment is inconsistent');
						glsmac.exit();
						return false;
					}
					client_worker_probe_complete = true;
					#print('MULTIPLAYER_SMOKE_WORKER_REASSIGN_PASS_CLIENT');
					if (!run_client_movement_probe()) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: movement probe could not start');
						glsmac.exit();
					}
					return false;
				}
				if (wait_ticks >= 100) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: worker probe timed out in ' + phase);
					glsmac.exit();
					return false;
				}
				return true;
			});
			return true;
		};

		let handle_turn = (turn_id) => {
			const turn_key = #to_string(turn_id);
			if (#is_defined(handled_turns[turn_key])) {
				return;
			}
			handled_turns[turn_key] = true;
			#print('MULTIPLAYER_SMOKE_TURN_' + role + ': ' + #to_string(turn_id));
			const players = game.get_players();
			const bases = game.get_bm().get_bases();
			if (
				#sizeof(players) != 2 ||
				#sizeof(bases) < (game.is_master() ? 2 : 1)
			) {
				#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': synchronized game state is incomplete');
				glsmac.exit();
				return;
			}
			if (
				game.get_player(0).difficulty_level != 'Thinker' ||
				game.get_player(1).difficulty_level != 'Librarian'
			) {
				#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': player difficulty state is invalid');
				glsmac.exit();
				return;
			}
			if (game.is_master() ? !game.get_um().has_unit(1) : game.get_um().has_unit(1)) {
				#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': hidden host unit snapshot visibility is invalid');
				glsmac.exit();
				return;
			}
			if (!game.is_master()) {
				let own_base_found = false;
				for (base of bases) {
					if (base.get_owner().id == game.get_player().id) {
						if (base.is_redacted || !#is_defined(base.get_production())) {
							#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: own base snapshot was redacted');
							glsmac.exit();
							return;
						}
						own_base_found = true;
					}
					else if (
						!base.is_redacted ||
						#is_defined(base.get_production()) ||
						#sizeof(base.get_production_queue()) != 0 ||
						base.get_accumulated_minerals() != 0 ||
						#sizeof(base.get_worked_tiles()) != 0
					) {
						#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: foreign base private snapshot state leaked');
						glsmac.exit();
						return;
					}
				}
				if (!own_base_found) {
					#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: own base snapshot is missing');
					glsmac.exit();
					return;
				}
				#print('MULTIPLAYER_SMOKE_BASE_PRIVACY_PASS_CLIENT');
				#print('MULTIPLAYER_SMOKE_SNAPSHOT_REDACTION_PASS_CLIENT');
			}
			if (!prepare_client_movement_probe()) {
				#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': client movement probe could not be prepared');
				glsmac.exit();
				return;
			}

			if (turn_id == 1) {
				#print('MULTIPLAYER_SMOKE_' + role + ': synchronized turn 1');
				#print('MULTIPLAYER_SMOKE_DIFFICULTY_PASS_' + role);
				if (game.get_um().get_unit_def('Former').required_technology != 'CentauriEcology') {
					#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': Former technology prerequisite is missing');
					glsmac.exit();
					return;
				}
				for (player of players) {
					if (!game.is_master() && player.id != game.get_player().id) {
						const state = player.get_research_state();
						if (
							!player.is_redacted || player.get_energy_credits() != 0 ||
							#sizeof(state.technologies) != 0 || state.target != '' ||
							state.progress != 0 || #sizeof(player.get_explored_tiles()) != 0
						) {
							#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: foreign player snapshot leaked private state');
							glsmac.exit();
							return;
						}
					}
					else {
						if (player.is_redacted) {
							#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': visible player snapshot was redacted');
							glsmac.exit();
							return;
						}
						const research_error = get_research_state_error(player, !game.is_master());
						if (#is_defined(research_error)) {
							#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': ' + research_error);
							glsmac.exit();
							return;
						}
					}
				}
				#print('MULTIPLAYER_SMOKE_RESEARCH_INITIAL_PASS_' + role);
				if (game.is_master()) {
					wait_for_client_turn_one_ready();
				}
				else {
					game.event('multiplayer_smoke_turn_one_ready', {});
					wait_for_player_privacy_update();
					start_client_mixed_unit_privacy_probe();
					start_client_private_map_projection_probe();
					game.event('multiplayer_smoke_accept_once', {});
					game.event('multiplayer_smoke_reject_and_rollback', {});
					let wait_ticks = 0;
					#async(100, () => {
						wait_ticks++;
						if (
							accepted_event_count == 1 && rejected_event_count == 0 &&
							client_base_snapshot_probe_complete &&
							client_base_infiltration_probe_complete &&
							client_player_privacy_probe_complete &&
							client_terraform_probe_complete &&
							client_live_visibility_probe_complete &&
							client_sea_level_probe_complete
						) {
							if (!client_event_probe_complete) {
								client_event_probe_complete = true;
								#print('MULTIPLAYER_SMOKE_EVENT_RESPONSE_PASS_CLIENT');
							}
							if (run_client_worker_probe()) {
								return false;
							}
						}
						if (accepted_event_count > 1 || wait_ticks >= 100) {
							#print(
								'MULTIPLAYER_SMOKE_FAIL_CLIENT: event response counts are ' +
								#to_string(accepted_event_count) + '/' +
								#to_string(rejected_event_count)
							);
							glsmac.exit();
							return false;
						}
						return true;
					});
				}
			}
			else if (turn_id == 2 && !exit_scheduled) {
				for (player of players) {
					if (!game.is_master() && player.id != game.get_player().id) {
						const state = player.get_research_state();
						if (
							!player.is_redacted || player.get_energy_credits() != 0 ||
							#sizeof(state.technologies) != 0 || state.target != '' ||
							state.progress != 0 || #sizeof(player.get_explored_tiles()) != 0
						) {
							#print('MULTIPLAYER_SMOKE_FAIL_CLIENT: foreign player live state leaked');
							glsmac.exit();
							return;
						}
					}
					else {
						const research_error = get_research_state_error(player, true);
						if (#is_defined(research_error)) {
							#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': ' + research_error);
							glsmac.exit();
							return;
						}
					}
				}
				#print('MULTIPLAYER_SMOKE_RESEARCH_SYNC_PASS_' + role);
				const client_player_id = get_client_player_id();
				const client_base = find_base_for_player(client_player_id);
				const captured_base = find_base_by_name(combat_base_name);
				const expansion_base = find_base_by_name(expansion_base_name);
				const client_former = find_client_former();
				let client_unit = null;
				if (game.get_um().has_unit(client_movement_unit_id)) {
					client_unit = game.get_um().get_unit(client_movement_unit_id);
				}
				let combat_defender = null;
				if (combat_defender_id != 0 && game.get_um().has_unit(combat_defender_id)) {
					combat_defender = game.get_um().get_unit(combat_defender_id);
				}
				let client_unit_invalid = false;
				if (client_unit != null) {
					client_unit_invalid =
						client_unit.owner != client_player_id ||
						client_unit.get_tile().x != client_combat_target_x ||
						client_unit.get_tile().y != client_combat_target_y;
				}
				let combat_defender_invalid = false;
				if (combat_defender != null) {
					combat_defender_invalid =
						combat_defender.owner == client_player_id ||
						combat_defender.get_tile().x != client_combat_target_x ||
						combat_defender.get_tile().y != client_combat_target_y;
				}
				let expansion_base_invalid = true;
				if (expansion_base != null) {
					const production = expansion_base.get_production();
					expansion_base_invalid =
						expansion_base.get_owner().id != client_player_id ||
						#sizeof(expansion_base.get_pops()) != 1 ||
						#sizeof(expansion_base.get_worked_tiles()) != 1 ||
						!#is_defined(production) ||
						production.id != 'ScoutPatrol';
				}
				if (
					accepted_event_count != 1 ||
					rejected_event_count != 0 ||
					(!game.is_master() && !client_event_probe_complete) ||
					(!game.is_master() && !client_worker_probe_complete) ||
					(!game.is_master() && !client_immediate_movement_probe_complete) ||
					(!game.is_master() && !client_movement_probe_complete) ||
					(!game.is_master() && !client_immediate_combat_probe_complete) ||
					(!game.is_master() && !client_combat_probe_complete) ||
					(!game.is_master() && !client_base_capture_probe_complete) ||
					(!game.is_master() && !client_base_founding_probe_complete) ||
					(!game.is_master() && !client_terraform_probe_complete) ||
					(!game.is_master() && !client_base_snapshot_probe_complete) ||
					(!game.is_master() && !client_base_infiltration_probe_complete) ||
					(!game.is_master() && !client_player_privacy_probe_complete) ||
					(!game.is_master() && !client_sea_level_probe_complete) ||
					!sea_level_notification_seen || sea_level_message_count != 1 ||
					client_base == null ||
					captured_base == null ||
					captured_base.get_owner().id != client_player_id ||
					#sizeof(client_base.get_worked_tiles()) != 0 ||
					combat_defender_id == 0 ||
					(client_unit != null && combat_defender != null) ||
					client_unit_invalid ||
					combat_defender_invalid ||
					expansion_base_invalid ||
					find_client_colony_pod() != null ||
					client_former == null ||
					client_former.terraforming != terraform_order ||
					client_former.terraforming_turns_remaining != 3 ||
					client_former.movement != 0.0 ||
					client_former.get_tile().terraforming[terraform_order]
				) {
					#print(
						'MULTIPLAYER_SMOKE_FAIL_' + role + ': event response state is ' +
						#to_string(accepted_event_count) + '/' +
						#to_string(rejected_event_count)
					);
					glsmac.exit();
					return;
				}
				#print('MULTIPLAYER_SMOKE_TERRAFORM_SYNC_PASS_' + role);
				if (game.is_game_over() || game.get_conquest_winner() != null) {
					#print('MULTIPLAYER_SMOKE_FAIL_' + role + ': conquest triggered before a faction was eliminated');
					glsmac.exit();
					return;
				}
				start_victory_poll();
				if (game.is_master()) {
					let wait_ticks = 0;
					#async(100, () => {
						wait_ticks++;
						if (client_conquest_ready && !conquest_prepare_requested) {
							conquest_prepare_requested = true;
							game.event('multiplayer_smoke_prepare_conquest', {
								winner_id: get_client_player_id(),
							});
							return false;
						}
						if (wait_ticks >= 100) {
							#print('MULTIPLAYER_SMOKE_FAIL_HOST: client conquest readiness timed out');
							glsmac.exit();
							return false;
						}
						return true;
					});
				}
				else {
					game.event('multiplayer_smoke_conquest_ready', {});
				}
			}
		};

		game.on('start_ui', (e) => {
			#print('MULTIPLAYER_SMOKE_UI_' + role);
			if (!game.is_master() && game.get_turn() > 0) {
				handle_turn(game.get_turn());
			}
		});

		game.on('turn', (e) => {
			handle_turn(e.year - 2100);
		});
	});

	glsmac.run();

});
