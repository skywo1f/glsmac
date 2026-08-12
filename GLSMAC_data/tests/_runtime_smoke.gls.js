#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);
	const process_base_production = #include('../default/game/event/process_base_production');

	let starting_pop_count = 0;
	let starting_base_unit_count = 0;
	let starting_intake = #undefined;
	let queued_unit_id = #undefined;
	let lifecycle_verified = false;
	let expansion_verified = false;
	let terraforming_verified = false;
	let repair_verified = false;
	let turn_three_advance_requested = false;
	let former_id = 0;
	let fungus_former_id = 0;
	let field_repair_unit_id = 0;
	let terraform_site = null;
	let fungus_site = null;
	let terraform_site_resources = null;
	let ui_started = false;
	let exit_scheduled = false;
	const lifecycle_base_name = 'Runtime Smoke Base';
	const expansion_base_name = 'Runtime Expansion Base';

	const tile_key = (tile) => {
		return #to_string(tile.x) + ':' + #to_string(tile.y);
	};

	const get_tiles_in_radius = (center, radius) => {
		let result = [center];
		let frontier = [center];
		let seen = {};
		const center_key = tile_key(center);
		seen[center_key] = true;
		for (let distance = 0; distance < radius; distance++) {
			let next = [];
			for (tile of frontier) {
				for (nearby of tile.get_surrounding_tiles()) {
					const key = tile_key(nearby);
					if (!#is_defined(seen[key])) {
						seen[key] = true;
						result :+nearby;
						next :+nearby;
					}
				}
			}
			frontier = next;
		}
		return result;
	};

	const has_landmark = (tile) => {
		for (id in tile.landmarks) {
			if (tile.landmarks[id]) {
				return true;
			}
		}
		return false;
	};

	const has_terraforming = (tile) => {
		for (id in tile.terraforming) {
			if (tile.terraforming[id]) {
				return true;
			}
		}
		return false;
	};

	const verify_volcano_runtime = (game) => {
		const tm = game.get_tm();
		let center = null;
		for (let y = 4; y < tm.get_map_height() - 4 && center == null; y++) {
			for (let x = y % 2; x < tm.get_map_width(); x += 2) {
				const candidate = tm.get_tile(x, y);
				if (!candidate.is_water || candidate.features.volcano) {
					continue;
				}
				let clear = true;
				for (tile of get_tiles_in_radius(candidate, 1)) {
					if (
						tile.is_locked() || tile.get_base() != null ||
						#sizeof(tile.get_units(true)) > 0 || has_landmark(tile)
					) {
						clear = false;
						break;
					}
				}
				if (clear) {
					center = candidate;
					break;
				}
			}
		}
		if (center == null) {
			return 'no clear ocean site was available for volcano verification';
		}

		const previous = {
			elevation: center.elevation + 0,
			rockiness: center.rockiness + 0,
			features: #clone(center.features),
			terraforming: #clone(center.terraforming),
		};
		const snapshot = tm.apply_volcano(center);
		let error = null;
		if (!center.is_land || !center.features.volcano || center.elevation <= previous.elevation) {
			error = 'volcano center did not rise into valid land';
		}
		const volcano_tiles = get_tiles_in_radius(center, 1);
		if (error == null && #sizeof(volcano_tiles) != 9) {
			error = 'volcano did not cover nine tiles';
		}
		if (error == null) {
			for (tile of volcano_tiles) {
				if (!tile.features.volcano || tile.rockiness != 3 || has_landmark(tile)) {
					error = 'volcanic terrain state is inconsistent';
					break;
				}
				if (has_terraforming(tile)) {
					error = 'a volcanic tile retained terraforming';
					break;
				}
			}
		}

		tm.restore_terrain(snapshot);
		if (
			error == null &&
			(
				!center.is_water || center.elevation != previous.elevation ||
				center.rockiness != previous.rockiness ||
				center.features != previous.features ||
				center.terraforming != previous.terraforming
			)
		) {
			error = 'terrain rollback did not restore the ocean site';
		}
		return error;
	};

	const verify_major_eruption_runtime = (game) => {
		const tm = game.get_tm();
		let center = null;
		for (let y = 4; y < tm.get_map_height() - 4 && center == null; y++) {
			for (let x = y % 2; x < tm.get_map_width(); x += 2) {
				const candidate = tm.get_tile(x, y);
				if (!candidate.is_locked()) {
					center = candidate;
					break;
				}
			}
		}
		if (center == null) {
			return 'no unlocked center was available for major-eruption verification';
		}

		let affected = [];
		let unaffected = [];
		for (let scan_y = 0; scan_y < tm.get_map_height(); scan_y++) {
			for (let scan_x = scan_y % 2; scan_x < tm.get_map_width(); scan_x += 2) {
				const tile = tm.get_tile(scan_x, scan_y);
				const tile_state = {
					tile: tile,
					features: #clone(tile.features),
					terraforming: #clone(tile.terraforming),
					rockiness: tile.rockiness + 0,
				};
				if (tm.get_distance(center, tile) <= 4) {
					affected :+tile_state;
				} else {
					unaffected :+tile_state;
				}
			}
		}
		if (#sizeof(affected) == 0 || #sizeof(unaffected) == 0) {
			return 'major-eruption radius did not partition the smoke map';
		}

		const original_center_features = #clone(center.features);
		const original_center_terraforming = #clone(center.terraforming);
		center.update_features({xenofungus: true});
		center.update_terraforming({
			road: true,
			mag_tube: true,
			forest: true,
			farm: true,
			soil_enricher: true,
			solar: true,
			mine: true,
			condenser: true,
			mirror: true,
			borehole: true,
			sensor: true,
			bunker: true,
			airbase: true,
			remove_fungus: true,
			plant_fungus: true,
		});

		const snapshot = tm.apply_major_eruption(center);
		let error = null;
		for (affected_state of affected) {
			const eruption_tile = affected_state.tile;
			if (eruption_tile.rockiness != 3 || eruption_tile.features.xenofungus) {
				error = 'major eruption did not make every affected tile rocky and fungus-free';
				break;
			}
			for (id of [
				'road', 'mag_tube', 'forest', 'farm', 'soil_enricher', 'solar',
				'mine', 'condenser', 'mirror', 'borehole', 'sensor', 'bunker',
				'remove_fungus', 'plant_fungus',
			]) {
				if (eruption_tile.terraforming[id]) {
					error = 'major eruption retained destructible terraforming';
					break;
				}
			}
			if (error != null) { break; }
		}
		if (error == null && !center.terraforming.airbase) {
			error = 'major eruption destroyed an airbase contrary to base-game rules';
		}
		if (error == null) {
			for (outside_state of unaffected) {
				if (
					outside_state.tile.rockiness != outside_state.rockiness ||
					outside_state.tile.features != outside_state.features ||
					outside_state.tile.terraforming != outside_state.terraforming
				) {
					error = 'major eruption changed terrain outside its radius';
					break;
				}
			}
		}

		tm.restore_terrain(snapshot);
		if (error == null) {
			for (restored_state of affected) {
				if (
					restored_state.tile.rockiness != restored_state.rockiness ||
					(restored_state.tile == center
						? !restored_state.tile.features.xenofungus || !restored_state.tile.terraforming.airbase
						: restored_state.tile.features != restored_state.features ||
							restored_state.tile.terraforming != restored_state.terraforming)
				) {
					error = 'major-eruption terrain rollback was not exact';
					break;
				}
			}
		}
		center.update_features(original_center_features);
		center.update_terraforming(original_center_terraforming);
		if (
			error == null &&
			(
				center.features != original_center_features ||
				center.terraforming != original_center_terraforming
			)
		) {
			error = 'major-eruption verification did not restore its temporary setup';
		}

		const initial_climate = tm.get_climate_state();
		let energy_tile = null;
		let normal_resources = null;
		for (resource_state of affected) {
			const resources = resource_state.tile.get_resources();
			if (resources.ENERGY > 0) {
				energy_tile = resource_state.tile;
				normal_resources = resources;
				break;
			}
		}
		if (error == null && energy_tile == null) {
			error = 'no producing tile was available for dust-cloud verification';
		}
		if (energy_tile != null) {
			tm.set_dust_cloud_duration(10);
			const dusty_resources = energy_tile.get_resources();
			const dusty_climate = tm.get_climate_state();
			if (
				dusty_climate.dust_cloud_duration != 10 ||
				dusty_resources.NUTRIENTS != normal_resources.NUTRIENTS ||
				dusty_resources.MINERALS != normal_resources.MINERALS ||
				dusty_resources.ENERGY != normal_resources.ENERGY - 1
			) {
				error = 'dust cloud did not reduce live tile energy by exactly one';
			}
			tm.set_climate_state(
				initial_climate.level,
				initial_climate.future_change,
				initial_climate.progress
			);
			if (tm.get_climate_state().dust_cloud_duration != 10) {
				error = 'ordinary climate updates did not preserve dust-cloud duration';
			}
		}
		tm.set_dust_cloud_duration(initial_climate.dust_cloud_duration);
		return error;
	};

	const finish_if_ready = () => {
		if (lifecycle_verified && expansion_verified && terraforming_verified && repair_verified && ui_started && !exit_scheduled) {
			exit_scheduled = true;
			#print('RUNTIME_SMOKE_PASS: reached turn 5 with production, lifecycle, expansion, and terraforming state intact');
			#async(500, () => {
				glsmac.exit();
			});
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		const find_founding_site_coords = () => {
			const tm = game.get_tm();
			let result = null;
			for (let y = 0; y < tm.get_map_height(); y++) {
				for (let x = 0; x < tm.get_map_width(); x++) {
					if (x % 2 != y % 2) {
						continue;
					}
					const tile = tm.get_tile(x, y);
					if (!tile.is_land) {
						continue;
					}
					if (tile.is_locked() || tile.get_base() != null) {
						continue;
					}
					if (#sizeof(tile.get_units()) != 0) {
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

		const advance_from_turn_three_if_ready = () => {
			if (lifecycle_verified && expansion_verified && !turn_three_advance_requested) {
				turn_three_advance_requested = true;
				game.event('complete_turn', {});
			}
		};

		game.register_event('runtime_smoke_replace_base', {
			validate: (e) => {
				if (e.caller != 0) {
					return 'Only the host can replace the lifecycle test base';
				}
			},
			apply: (e) => {
				e.game.bm.despawn_base(e.data.base_id);
				const replacement = e.game.bm.spawn_base(e.data.owner, e.data.tile, {
					name: e.data.name,
				});
				return {
					replacement_id: replacement.id,
				};
			},
			rollback: (e) => {
				throw Error('Accepted lifecycle test event was rolled back');
			},
		});

		game.on('start_ui', (e) => {
			if (game.get_player().difficulty_level != 'Transcend') {
				#print('RUNTIME_SMOKE_FAIL: quickstart player difficulty was not preserved');
				glsmac.exit();
				return;
			}
			const bases = game.get_bm().get_bases();
			if (#sizeof(bases) == 0) {
				#print('RUNTIME_SMOKE_FAIL: no starting base was available for the base screen');
				glsmac.exit();
				return;
			}
			#async(0, () => {
				game.select_base(bases[0]);
			});
			ui_started = true;
			finish_if_ready();
		});

		game.on('turn', (e) => {
			const turn_id = e.year - 2100;
			if (turn_id == 1) {
				const landmark_tm = game.get_tm();
				let mount_planet_tiles = 0;
				let landmark_garland_tiles = 0;
				let landmark_monsoon_tiles = 0;
				let landmark_uranium_tiles = 0;
				let landmark_sargasso_tiles = 0;
				let landmark_ruins_tiles = 0;
				let landmark_ruins_monolith_tiles = 0;
				let landmark_dunes_tiles = 0;
				let landmark_freshwater_tiles = 0;
				let landmark_mesa_tiles = 0;
				let landmark_canyon_tiles = 0;
				let landmark_geothermal_tiles = 0;
				let landmark_ridge_tiles = 0;
				let generated_landmark_tiles = 0;
				for (let landmark_y = 0; landmark_y < landmark_tm.get_map_height(); landmark_y++) {
					for (
						let landmark_x = landmark_y % 2;
						landmark_x < landmark_tm.get_map_width();
						landmark_x += 2
					) {
						const landmark_tile = landmark_tm.get_tile(landmark_x, landmark_y);
						let tile_landmark_count = 0;
						for (landmark_key in landmark_tile.landmarks) {
							if (landmark_tile.landmarks[landmark_key]) {
								tile_landmark_count++;
							}
						}
						if (tile_landmark_count > 1) {
							#print('RUNTIME_SMOKE_FAIL: generated landmarks overlap');
							glsmac.exit();
							return;
						}
						if (tile_landmark_count == 1) {
							generated_landmark_tiles++;
						}
						if (landmark_tile.features.jungle && !landmark_tile.landmarks.monsoon_jungle) {
							#print('RUNTIME_SMOKE_FAIL: generic jungle was generated outside Monsoon Jungle');
							glsmac.exit();
							return;
						}
						if (landmark_tile.landmarks.mount_planet) {
							if (
								!landmark_tile.is_land || !landmark_tile.features.volcano ||
								landmark_tile.rockiness < 2
							) {
								#print('RUNTIME_SMOKE_FAIL: Mount Planet has invalid physical terrain');
								glsmac.exit();
								return;
							}
							mount_planet_tiles++;
						}
						if (landmark_tile.landmarks.garland_crater) {
							if (
								!landmark_tile.is_land || !landmark_tile.features.garland_crater ||
								landmark_tile.rockiness != 2
							) {
								#print('RUNTIME_SMOKE_FAIL: Garland Crater has invalid physical terrain');
								glsmac.exit();
								return;
							}
							landmark_garland_tiles++;
						}
						if (landmark_tile.landmarks.monsoon_jungle) {
							if (!landmark_tile.is_land || !landmark_tile.features.jungle || landmark_tile.moisture != 3) {
								#print('RUNTIME_SMOKE_FAIL: Monsoon Jungle has invalid physical terrain');
								glsmac.exit();
								return;
							}
							landmark_monsoon_tiles++;
						}
						if (landmark_tile.landmarks.uranium_flats) {
							if (
								!landmark_tile.is_land || !landmark_tile.features.uranium ||
								landmark_tile.rockiness != 1
							) {
								#print('RUNTIME_SMOKE_FAIL: Uranium Flats has invalid physical terrain');
								glsmac.exit();
								return;
							}
							landmark_uranium_tiles++;
						}
						if (landmark_tile.landmarks.new_sargasso) {
							if (!landmark_tile.is_water || !landmark_tile.features.xenofungus) {
								#print('RUNTIME_SMOKE_FAIL: New Sargasso has invalid physical terrain');
								glsmac.exit();
								return;
							}
							landmark_sargasso_tiles++;
						}
						if (landmark_tile.landmarks.the_ruins) {
							if (!landmark_tile.is_land) {
								#print('RUNTIME_SMOKE_FAIL: The Ruins contains water');
								glsmac.exit();
								return;
							}
							if (landmark_tile.features.monolith) {
								landmark_ruins_monolith_tiles++;
							}
							landmark_ruins_tiles++;
						}
						if (landmark_tile.landmarks.great_dunes) {
							if (
								!landmark_tile.is_land || !landmark_tile.features.dunes ||
								landmark_tile.moisture != 1 || landmark_tile.rockiness != 1
							) {
								#print('RUNTIME_SMOKE_FAIL: Great Dunes has invalid physical terrain');
								glsmac.exit();
								return;
							}
							landmark_dunes_tiles++;
						}
						if (landmark_tile.landmarks.freshwater_sea) {
							if (!landmark_tile.is_water) {
								#print('RUNTIME_SMOKE_FAIL: Freshwater Sea contains land');
								glsmac.exit();
								return;
							}
							landmark_freshwater_tiles++;
						}
						if (landmark_tile.landmarks.sunny_mesa) {
							if (
								!landmark_tile.is_land || !landmark_tile.features.sunny_mesa ||
								landmark_tile.rockiness < 2
							) {
								#print('RUNTIME_SMOKE_FAIL: Sunny Mesa has invalid physical terrain');
								glsmac.exit();
								return;
							}
							landmark_mesa_tiles++;
						}
						if (landmark_tile.landmarks.nessus_canyon) {
							if (!landmark_tile.is_land || landmark_tile.rockiness != 2) {
								#print('RUNTIME_SMOKE_FAIL: Nessus Canyon has invalid physical terrain');
								glsmac.exit();
								return;
							}
							landmark_canyon_tiles++;
						}
						if (landmark_tile.landmarks.geothermal_shallows) {
							if (!landmark_tile.is_water || !landmark_tile.features.geothermal) {
								#print('RUNTIME_SMOKE_FAIL: Geothermal Shallows has invalid physical terrain');
								glsmac.exit();
								return;
							}
							landmark_geothermal_tiles++;
						}
						if (landmark_tile.landmarks.pholus_ridge) {
							if (!landmark_tile.is_land || landmark_tile.rockiness < 2) {
								#print('RUNTIME_SMOKE_FAIL: Pholus Ridge has invalid physical terrain');
								glsmac.exit();
								return;
							}
							landmark_ridge_tiles++;
						}
					}
				}
				if (
					mount_planet_tiles < 2 || landmark_garland_tiles == 0 ||
					landmark_monsoon_tiles == 0 || landmark_uranium_tiles == 0 ||
					landmark_sargasso_tiles == 0 || landmark_ruins_tiles == 0 ||
					landmark_ruins_monolith_tiles == 0 ||
					landmark_dunes_tiles == 0 || landmark_freshwater_tiles == 0 ||
					landmark_mesa_tiles == 0 || landmark_canyon_tiles == 0 ||
					landmark_geothermal_tiles == 0 || landmark_ridge_tiles == 0
				) {
					#print('RUNTIME_SMOKE_FAIL: one or more base-game landmarks were not generated');
					glsmac.exit();
					return;
				}
				#print(
					'RUNTIME_SMOKE_LANDMARKS_PASS: all 12 types across ' +
					#to_string(generated_landmark_tiles) + ' separated tiles'
				);
				const volcano_error = verify_volcano_runtime(game);
				if (volcano_error != null) {
					#print('RUNTIME_SMOKE_FAIL: ' + volcano_error);
					glsmac.exit();
					return;
				}
				#print('RUNTIME_SMOKE_VOLCANO_PASS: live nine-tile eruption and exact rollback verified');
				const major_eruption_error = verify_major_eruption_runtime(game);
				if (major_eruption_error != null) {
					#print('RUNTIME_SMOKE_FAIL: ' + major_eruption_error);
					glsmac.exit();
					return;
				}
				#print('RUNTIME_SMOKE_MAJOR_ERUPTION_PASS: terrain, rollback, and dust yield verified');
				const victory_state = game.get_victory_state();
				if (
					game.is_game_over() ||
					game.get_conquest_winner() != null ||
					victory_state != {type: '', winner: -1, turn: 0}
				) {
					#print('RUNTIME_SMOKE_FAIL: one-player game was treated as a conquest victory');
					glsmac.exit();
					return;
				}
				#print('RUNTIME_SMOKE_SINGLE_PLAYER_CONQUEST_GUARD_PASS');
				const um = game.get_um();
				const bases = game.get_bm().get_bases();
				if (!um.has_unit(1) || #sizeof(bases) == 0) {
					#print('RUNTIME_SMOKE_FAIL: starting unit or base is missing');
					glsmac.exit();
					return;
				}

				const smoke_unit = um.get_unit(1);
				const base = bases[0];
				const capital_energy = game.get('f_economy_get_base_energy')(base);
				if (
					!base.has_facility('Headquarters') ||
					base.get_accumulated_minerals() != 10 ||
					capital_energy.distance != 0 ||
					capital_energy.inefficiency != 0 ||
					capital_energy.net != capital_energy.gross
				) {
					#print('RUNTIME_SMOKE_FAIL: starting headquarters or capital energy loss is invalid');
					glsmac.exit();
					return;
				}
				#print('RUNTIME_SMOKE_HEADQUARTERS_PASS');
				let invalid_home_base_rejected = false;
				try {
					um.spawn_unit({
						def: 'Former',
						owner: game.get_player(),
						tile: base.get_tile(),
						morale: 1,
						health: 1.0,
						home_base_id: base.id + 1000000,
					});
				}
				catch {
					: (e) => {
						invalid_home_base_rejected = true;
					}
				}
				if (!invalid_home_base_rejected) {
					#print('RUNTIME_SMOKE_FAIL: invalid unit home base was accepted');
					glsmac.exit();
					return;
				}
				smoke_unit.health = 0.5;
				const research_state = game.get_player().get_research_state();
				const rover = um.get_unit_def('ReconRover');
				if (smoke_unit.home_base_id != base.id) {
					#print('RUNTIME_SMOKE_FAIL: starting scout has no home base');
					glsmac.exit();
					return;
				}
				if (base.get_consumption().MINERALS != 0) {
					#print('RUNTIME_SMOKE_FAIL: starting base has unexpected unit support');
					glsmac.exit();
					return;
				}
				if (
					!game.get_player().has_technology('CentauriEcology') ||
					research_state.technologies != ['CentauriEcology'] ||
					research_state.target != 'Biogenetics' ||
					research_state.progress != 0 ||
					!base.can_set_production('unit', 'Former') ||
					base.can_set_production('unit', 'ReconRover') ||
					rover.required_technology != 'DoctrineMobility' ||
					rover.movement_per_turn != 2.0
				) {
					#print('RUNTIME_SMOKE_FAIL: Gaians did not receive their Centauri Ecology starting technology');
					glsmac.exit();
					return;
				}
				starting_pop_count = #sizeof(base.get_pops());
				starting_base_unit_count = #sizeof(base.get_tile().get_units());
				const production = base.get_production();
				if (!#is_defined(production) || production.mineral_cost <= 0) {
					#print('RUNTIME_SMOKE_FAIL: starting base has no valid production');
					glsmac.exit();
					return;
				}
				const recycling_tanks = game.get_bm().get_facility_def('RecyclingTanks');
				if (
					recycling_tanks.production_kind != 'facility' ||
					recycling_tanks.mineral_cost != 40 ||
					recycling_tanks.required_technology != 'Biogenetics' ||
					base.can_set_production('facility', recycling_tanks.id) ||
					base.has_facility(recycling_tanks.id)
				) {
					#print('RUNTIME_SMOKE_FAIL: Recycling Tanks definition or starting state is invalid');
					glsmac.exit();
					return;
				}
				game.get_player().set_research_state({
					technologies: ['CentauriEcology', 'Biogenetics'],
					target: 'IndustrialBase',
					progress: 0,
				});
				if (!base.can_set_production('facility', recycling_tanks.id)) {
					#print('RUNTIME_SMOKE_FAIL: Biogenetics did not unlock Recycling Tanks');
					glsmac.exit();
					return;
				}
				queued_unit_id = production.id;
				const intake = base.get_intake();
				starting_intake = {
					nutrients: intake.NUTRIENTS,
					minerals: intake.MINERALS,
					energy: intake.ENERGY,
				};
				base.set_production_queue([
					{kind: 'facility', id: recycling_tanks.id},
					{kind: 'unit', id: queued_unit_id},
				]);
				base.set_accumulated_minerals(recycling_tanks.mineral_cost);
				const unworked_tiles = base.get_unworked_tiles();
				if (#sizeof(unworked_tiles) == 0) {
					#print('RUNTIME_SMOKE_FAIL: no free tile for base lifecycle coverage');
					glsmac.exit();
					return;
				}
				const lifecycle_tile = unworked_tiles[0];
				for (candidate of unworked_tiles) {
					if (
						candidate != lifecycle_tile &&
						candidate.is_land &&
						candidate.rockiness < 3 &&
						!candidate.features.xenofungus &&
						candidate.get_resources().NUTRIENTS < 2 &&
						candidate.get_base() == null &&
						#sizeof(candidate.get_units()) == 0
					) {
						terraform_site = candidate;
						break;
					}
				}
				if (terraform_site == null) {
					#print('RUNTIME_SMOKE_FAIL: no legal Former test tile is available');
					glsmac.exit();
					return;
				}
				terraform_site_resources = terraform_site.get_resources();
				const former = um.spawn_unit({
					def: 'Former',
					owner: game.get_player(),
					tile: terraform_site,
					morale: 2,
					health: 0.5,
				});
				const former_def = former.get_def();
				if (
					former_def.is_native ||
					former_def.offense != 0 ||
					former_def.defense != 1 ||
					former_def.morale_set != 'STANDARD' ||
					former_def.required_technology != 'CentauriEcology' ||
					former_def.can_found_base ||
					!former_def.can_terraform
				) {
					#print('RUNTIME_SMOKE_FAIL: Former definition metadata is invalid');
					glsmac.exit();
					return;
				}
				former.set_terraforming_order('road', 1);
				former.set_terraforming_order('forest', 1);
				former.set_terraforming_order('none', 0);
				former_id = former.id;
				const field_repair_unit = um.spawn_unit({
					def: 'ScoutPatrol',
					owner: game.get_player(),
					tile: terraform_site,
					morale: 2,
					health: 0.75,
				});
				field_repair_unit_id = field_repair_unit.id;

				const tm = game.get_tm();
				for (let y = 0; y < tm.get_map_height(); y++) {
					for (let x = 0; x < tm.get_map_width(); x++) {
						if (x % 2 != y % 2) {
							continue;
						}
						const candidate = tm.get_tile(x, y);
						if (
							candidate.is_land &&
							candidate.features.xenofungus &&
							!candidate.is_locked() &&
							candidate.get_base() == null &&
							#sizeof(candidate.get_units()) == 0
						) {
							fungus_site = candidate;
							break;
						}
					}
					if (fungus_site != null) {
						break;
					}
				}
				if (fungus_site == null) {
					#print('RUNTIME_SMOKE_FAIL: no fungus removal site is available');
					glsmac.exit();
					return;
				}
				const fungus_former = um.spawn_unit({
					def: 'Former',
					owner: game.get_player(),
					tile: fungus_site,
					morale: 1,
					health: 1.0,
				});
				fungus_former.set_terraforming_order('remove_fungus', 1);
				fungus_former_id = fungus_former.id;

				game.event('unit_skip_turn', {
					unit: smoke_unit,
				});
				game.event('add_base_pop', {
					base: base,
					type: 'WORKER',
				});
				game.event('spawn_base', {
					owner: game.get_player(),
					tile: lifecycle_tile,
					name: lifecycle_base_name,
				});
				game.event('terraform_tile', {
					unit: former,
					type: 'farm',
				});
				game.event('complete_turn', {});
				#print('RUNTIME_SMOKE: queued facility, unit, base lifecycle, terraforming, and turn events');
			}
			else if (turn_id == 2) {
				const bases = game.get_bm().get_bases();
				if (
					#sizeof(bases) == 0 ||
					#sizeof(bases[0].get_pops()) <= starting_pop_count ||
					!game.get_um().has_unit(1)
				) {
					#print('RUNTIME_SMOKE_FAIL: state did not survive turn advancement');
					glsmac.exit();
					return;
				}
				const base = bases[0];
				const queue = base.get_production_queue();
				const intake = base.get_intake();
				if (
					!base.has_facility('RecyclingTanks') ||
					#sizeof(queue) != 1 ||
					queue[0].production_kind != 'unit' ||
					queue[0].id != queued_unit_id ||
					intake.NUTRIENTS != starting_intake.nutrients + 1 ||
					intake.MINERALS != starting_intake.minerals + 1 ||
					intake.ENERGY != starting_intake.energy + 1
				) {
					#print('RUNTIME_SMOKE_FAIL: facility completion, queue advancement, or resource bonus is invalid');
					glsmac.exit();
					return;
				}
				const former = game.get_um().get_unit(former_id);
				const fungus_former = game.get_um().get_unit(fungus_former_id);
				const field_repair_unit = game.get_um().get_unit(field_repair_unit_id);
				if (
					game.get_um().get_unit(1).health < 0.699 ||
					game.get_um().get_unit(1).health > 0.701 ||
					field_repair_unit.health < 0.799 ||
					field_repair_unit.health > 0.801 ||
					former.health != 0.5 ||
					former.terraforming != 'farm' ||
					former.terraforming_turns_remaining != 3 ||
					former.movement != 0.0 ||
					terraform_site.terraforming.farm
				) {
					#print('RUNTIME_SMOKE_FAIL: Former order did not advance into turn 2');
					glsmac.exit();
					return;
				}
				if (
					fungus_former.terraforming != 'none' ||
					fungus_former.terraforming_turns_remaining != 0
				) {
					#print('RUNTIME_SMOKE_FAIL: xenofungus removal order did not complete');
					glsmac.exit();
					return;
				}
				if (fungus_site.features.xenofungus) {
					#print('RUNTIME_SMOKE_FAIL: xenofungus removal did not update the wrapped tile feature');
					glsmac.exit();
					return;
				}
				#print('RUNTIME_SMOKE_TERRAFORM_ORDER_PASS');
				#print('RUNTIME_SMOKE_FUNGUS_REMOVAL_PASS');
				#print('RUNTIME_SMOKE_FACILITY_PRODUCTION_PASS');
				const command_center = game.get_bm().get_facility_def('CommandCenter');
				if (!command_center.full_repair_land) {
					#print('RUNTIME_SMOKE_FAIL: Command Center repair definition is invalid');
					glsmac.exit();
					return;
				}
				base.add_facility(command_center.id);
				const repair_unit = game.get_um().get_unit(1);
				repair_unit.health = 0.3;
				base.set_accumulated_minerals(queue[0].mineral_cost);
				game.event('complete_turn', {});
			}
			else if (turn_id == 3) {
				const bases = game.get_bm().get_bases();
				const former = game.get_um().get_unit(former_id);
				let produced_unit_has_home_base = false;
				if (#sizeof(bases) > 0) {
					for (unit of bases[0].get_tile().get_units()) {
						if (unit.id != 1 && unit.home_base_id == bases[0].id) {
							produced_unit_has_home_base = true;
						}
					}
				}
				if (
					#sizeof(bases) == 0 ||
					!bases[0].has_facility('RecyclingTanks') ||
					!bases[0].has_facility('CommandCenter') ||
					#sizeof(bases[0].get_tile().get_units()) <= starting_base_unit_count ||
					game.get_um().get_unit(1).health != 1.0 ||
					game.get_um().get_unit(field_repair_unit_id).health < 0.799 ||
					game.get_um().get_unit(field_repair_unit_id).health > 0.801 ||
					former.health != 0.5 ||
					!produced_unit_has_home_base
				) {
					#print('RUNTIME_SMOKE_FAIL: queued unit production or facility persistence failed');
					glsmac.exit();
					return;
				}
				repair_verified = true;
				#print('RUNTIME_SMOKE_UNIT_REPAIR_PASS');
				#print('RUNTIME_SMOKE_BASE_PRODUCTION_PASS');

				let lifecycle_base = null;
				for (base of bases) {
					if (base.name == lifecycle_base_name) {
						lifecycle_base = base;
						break;
					}
				}
				if (lifecycle_base == null) {
					#print('RUNTIME_SMOKE_FAIL: named lifecycle base is missing');
					glsmac.exit();
					return;
				}
				const remote_energy = game.get('f_economy_get_base_energy')(lifecycle_base);
				if (
					lifecycle_base.has_facility('Headquarters') ||
					remote_energy.distance <= 0 ||
					remote_energy.net != remote_energy.gross - remote_energy.inefficiency
				) {
					#print('RUNTIME_SMOKE_FAIL: remote-base efficiency calculation is invalid');
					glsmac.exit();
					return;
				}
				#print('RUNTIME_SMOKE_EFFICIENCY_PASS');
				const capital = bases[0];
				const headquarters = game.get_bm().get_facility_def('Headquarters');
				lifecycle_base.set_production('facility', headquarters.id);
				lifecycle_base.set_accumulated_minerals(headquarters.mineral_cost);
				let headquarters_event = {caller: 0, game: game, data: {base: lifecycle_base}};
				headquarters_event.applied = process_base_production.apply(headquarters_event);
				if (
					!lifecycle_base.has_facility('Headquarters') ||
					capital.has_facility('Headquarters') ||
					#sizeof(headquarters_event.applied.previous_headquarters) != 1
				) {
					#print('RUNTIME_SMOKE_FAIL: Headquarters relocation did not complete');
					glsmac.exit();
					return;
				}
				process_base_production.rollback(headquarters_event);
				if (
					lifecycle_base.has_facility('Headquarters') ||
					!capital.has_facility('Headquarters')
				) {
					#print('RUNTIME_SMOKE_FAIL: Headquarters relocation did not roll back');
					glsmac.exit();
					return;
				}
				#print('RUNTIME_SMOKE_HEADQUARTERS_RELOCATION_PASS');

				const old_base_id = lifecycle_base.id;
				const founding_site_coords = find_founding_site_coords();
				if (founding_site_coords == null) {
					#print('RUNTIME_SMOKE_FAIL: no legal colony founding site is available');
					glsmac.exit();
					return;
				}
				const founding_site = game.get_tm().get_tile(
					founding_site_coords.x,
					founding_site_coords.y
				);
				game.event('runtime_smoke_replace_base', {
					base_id: old_base_id,
					owner: lifecycle_base.get_owner(),
					tile: lifecycle_base.get_tile(),
					name: lifecycle_base.name,
				});
				game.event('spawn_unit', {
					owner: game.get_player(),
					tile: founding_site,
					type: 'ColonyPod',
					health: 1.0,
					morale: 2,
				});

				let wait_ticks = 0;
				#async(100, () => {
					wait_ticks++;
					for (base of game.get_bm().get_bases()) {
						if (base.name == lifecycle_base_name && base.id != old_base_id) {
							#print('RUNTIME_SMOKE_BASE_LIFECYCLE_PASS');
							lifecycle_verified = true;
							advance_from_turn_three_if_ready();
							finish_if_ready();
							return false;
						}
					}
					if (wait_ticks >= 100) {
						#print('RUNTIME_SMOKE_FAIL: named base was not reusable after despawn');
						glsmac.exit();
						return false;
					}
					return true;
				});

				let founding_requested = false;
				let founding_wait_ticks = 0;
				let colony_pod_id = 0;
				#async(100, () => {
					founding_wait_ticks++;
					if (!founding_requested) {
						for (unit of founding_site.get_units()) {
							if (unit.owner == game.get_player().id && unit.def == 'ColonyPod') {
								const def = unit.get_def();
								if (
									def.is_native ||
									def.offense != 0 ||
									def.defense != 1 ||
									def.morale_set != 'STANDARD' ||
									!def.can_found_base
								) {
									#print('RUNTIME_SMOKE_FAIL: Colony Pod definition metadata is invalid');
									glsmac.exit();
									return false;
								}
								colony_pod_id = unit.id;
								founding_requested = true;
								game.event('found_base', {
									unit: unit,
									name: expansion_base_name,
								});
								break;
							}
						}
					}
					else {
						for (base of game.get_bm().get_bases()) {
							if (base.name == expansion_base_name) {
								const production = base.get_production();
								if (
									game.get_um().has_unit(colony_pod_id) ||
									base.get_owner().id != game.get_player().id ||
									base.get_tile() != founding_site ||
									#sizeof(base.get_pops()) != 1 ||
									#sizeof(base.get_worked_tiles()) != 1 ||
									base.get_accumulated_minerals() != 10 ||
									!#is_defined(production) ||
									production.id != 'ScoutPatrol'
								) {
									#print('RUNTIME_SMOKE_FAIL: founded base state is invalid');
									glsmac.exit();
									return false;
								}
								#print('RUNTIME_SMOKE_BASE_FOUNDING_PASS');
								expansion_verified = true;
								advance_from_turn_three_if_ready();
								finish_if_ready();
								return false;
							}
						}
					}
					if (founding_wait_ticks >= 100) {
						#print('RUNTIME_SMOKE_FAIL: colony founding timed out');
						glsmac.exit();
						return false;
					}
					return true;
				});
			}
			else if (turn_id == 4) {
				const former = game.get_um().get_unit(former_id);
				if (
					former.terraforming != 'farm' ||
					former.terraforming_turns_remaining != 1 ||
					terraform_site.terraforming.farm
				) {
					#print('RUNTIME_SMOKE_FAIL: Former order did not advance into turn 4');
					glsmac.exit();
					return;
				}
				game.event('complete_turn', {});
			}
			else if (turn_id == 5) {
				const former = game.get_um().get_unit(former_id);
				const updated_resources = terraform_site.get_resources();
				if (
					former.terraforming != 'none' ||
					former.terraforming_turns_remaining != 0 ||
					former.movement != former.get_def().movement_per_turn ||
					!terraform_site.terraforming.farm ||
					updated_resources.NUTRIENTS != terraform_site_resources.NUTRIENTS + 1 ||
					updated_resources.MINERALS != terraform_site_resources.MINERALS ||
					updated_resources.ENERGY != terraform_site_resources.ENERGY
				) {
					#print('RUNTIME_SMOKE_FAIL: Farm completion or resource yields are invalid');
					glsmac.exit();
					return;
				}
				game.select_tile(terraform_site);
				terraforming_verified = true;
				#print('RUNTIME_SMOKE_TERRAFORMING_PASS');
				finish_if_ready();
			}
		});
	});

	glsmac.run();

});
