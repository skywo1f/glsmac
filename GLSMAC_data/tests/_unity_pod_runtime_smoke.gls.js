#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);
	const terraforming = #include('../default/units/terraforming');

	let runtime_complete = false;
	let ui_started = false;
	let exit_scheduled = false;
	let start_runtime = null;
	let runtime_started = false;
	let expected_explorer_id = 0;
	let pod_events = 0;
	let pod_outcome = '';

	const fail = (message) => {
		#print('UNITY_POD_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const finish_if_ready = () => {
		if (runtime_complete && ui_started && !exit_scheduled) {
			exit_scheduled = true;
			#print(
				'UNITY_POD_RUNTIME_PASS: installed assets, Unity reward definitions, ' +
				'live sea refresh, bonus mutation, native Former orders, Aquifer courses, Condenser rainfall, coastline conversion, elevation rollback, earthquake rollback, ' +
				'and movement resolution verified'
			);
			#async(500, () => { glsmac.exit(); });
		}
	};

	const wait_for_pod_ready = (tile, on_ready, attempts) => {
		if (tile.features.unity_pod && !tile.is_locked()) {
			on_ready();
			return;
		}
		if (attempts >= 120) {
			fail('timed out waiting for synchronized Unity Pod preparation');
			return;
		}
		#async(50, () => { wait_for_pod_ready(tile, on_ready, attempts + 1); });
	};

	const wait_for_arrival = (unit, tile, on_ready, attempts) => {
		if (unit.get_tile() == tile && !tile.is_locked()) {
			on_ready();
			return;
		}
		if (attempts >= 120) {
			fail('timed out waiting for Unity Pod movement');
			return;
		}
		#async(50, () => { wait_for_arrival(unit, tile, on_ready, attempts + 1); });
	};

	const get_bonus_name = (tile) => {
		if (tile.bonuses.nutrient) { return 'nutrient'; }
		if (tile.bonuses.energy) { return 'energy'; }
		if (tile.bonuses.minerals) { return 'minerals'; }
		return 'none';
	};

	const is_supported_outcome = (outcome) => {
		for (candidate of [
			'energy', 'river', 'earthquake', 'production', 'artifact', 'fungus',
			'monolith', 'vehicle', 'technology', 'terraforming', 'clone', 'native',
			'resource'
		]) {
			if (candidate == outcome) {
				return true;
			}
		}
		return false;
	};

	const start_if_ready = () => {
		if (ui_started && start_runtime != null && !runtime_started) {
			runtime_started = true;
			#async(500, () => { start_runtime(); });
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		game.register_event('unity_pod_runtime_prepare', {
			validate: (e) => {},
			apply: (e) => {
				const tm = e.game.get_tm();
				const source = e.data.source;
				const destination = e.data.destination;
				const sea_tile = e.data.sea_tile;
				const earthquake_tile = e.data.earthquake_tile;
				const elevation_raise_tile = e.data.elevation_raise_tile;
				const elevation_lower_tile = e.data.elevation_lower_tile;
				const former = e.data.former;

				for (type of ['aquifer', 'raise_land', 'lower_land', 'level_terrain']) {
					former.set_terraforming_order(type, 2);
					if (former.terraforming != type || former.terraforming_turns_remaining != 2) {
						throw Error('UNITY_POD_RUNTIME_FAIL: native Former rejected ' + type);
					}
					former.set_terraforming_order('none', 0);
				}
				if (
					#is_defined(source.terraforming.aquifer) ||
					#is_defined(source.terraforming.raise_land) ||
					#is_defined(source.terraforming.lower_land) ||
					#is_defined(source.terraforming.level_terrain)
				) {
					throw Error('UNITY_POD_RUNTIME_FAIL: transient Former orders leaked into tile improvements');
				}

				let river_source = null;
				for (
					let river_y = 0;
					river_y < tm.get_map_height() && river_source == null;
					river_y++
				) {
					for (
						let river_x = river_y % 2;
						river_x < tm.get_map_width();
						river_x += 2
					) {
						const river_candidate = tm.get_tile(river_x, river_y);
						if (river_candidate.is_water || river_candidate.features.river) {
							continue;
						}
						let has_exit = false;
						for (nearby of river_candidate.get_surrounding_tiles()) {
							if (nearby.is_water || nearby.features.river) {
								has_exit = true;
								break;
							}
						}
						if (!has_exit) {
							river_source = river_candidate;
							break;
						}
					}
				}
				if (river_source == null) {
					throw Error('UNITY_POD_RUNTIME_FAIL: no inland Aquifer test tile is available');
				}
				const artificial_river = terraforming.create_aquifer_river(river_source);
				if (#sizeof(artificial_river) < 2) {
					throw Error('UNITY_POD_RUNTIME_FAIL: Aquifer did not create a river course');
				}
				for (river_tile of artificial_river) {
					if (!river_tile.features.river) {
						throw Error('UNITY_POD_RUNTIME_FAIL: Aquifer river course was not applied');
					}
				}
				for (river_tile of artificial_river) {
					river_tile.update_features({river: false});
				}

				const get_effective_moisture = game.get('f_resource_get_effective_moisture');
				if (#typeof(get_effective_moisture) != 'Callable') {
					throw Error('UNITY_POD_RUNTIME_FAIL: effective rainfall resolver is unavailable');
				}
				let condenser_source = null;
				let condenser_target = null;
				for (
					let condenser_y = 0;
					condenser_y < tm.get_map_height() && condenser_source == null;
					condenser_y++
				) {
					for (
						let condenser_x = condenser_y % 2;
						condenser_x < tm.get_map_width();
						condenser_x += 2
					) {
						const condenser_candidate = tm.get_tile(condenser_x, condenser_y);
						if (condenser_candidate.is_water || condenser_candidate.terraforming.condenser) {
							continue;
						}
						for (nearby of condenser_candidate.get_surrounding_tiles()) {
							if (!nearby.is_water && nearby.moisture < 3) {
								condenser_source = condenser_candidate;
								condenser_target = nearby;
								break;
							}
						}
						if (condenser_source != null) {
							break;
						}
					}
				}
				if (condenser_source == null) {
					throw Error('UNITY_POD_RUNTIME_FAIL: no Condenser rainfall test tiles are available');
				}
				const moisture_before = get_effective_moisture(condenser_target);
				condenser_source.update_terraforming({condenser: true});
				if (get_effective_moisture(condenser_target) != #min(3, moisture_before + 1)) {
					throw Error('UNITY_POD_RUNTIME_FAIL: Condenser did not increase adjacent rainfall');
				}
				condenser_source.update_terraforming({condenser: false});
				if (get_effective_moisture(condenser_target) != moisture_before) {
					throw Error('UNITY_POD_RUNTIME_FAIL: Condenser rainfall did not reverse');
				}

				let land_candidates = [];
				const add_ranked = (ranked, info) => {
					if (#sizeof(ranked) < 6) {
						ranked :+info;
						return ranked;
					}
					let worst = 0;
					for (let i = 1; i < #sizeof(ranked); i++) {
						if (ranked[i].elevation > ranked[worst].elevation) {
							worst = i;
						}
					}
					if (info.elevation < ranked[worst].elevation) {
						ranked[worst] = info;
					}
					return ranked;
				};
				for (let y = 0; y < tm.get_map_height(); y++) {
					for (let x = 0; x < tm.get_map_width(); x++) {
						if (x % 2 != y % 2) {
							continue;
						}
						let candidate = tm.get_tile(x, y);
						if (candidate.get_base() != null || #sizeof(candidate.get_units(true)) > 0) {
							continue;
						}
						let borders_other_domain = false;
						for (nearby of candidate.get_surrounding_tiles()) {
							if (nearby.is_water != candidate.is_water) {
								borders_other_domain = true;
								break;
							}
						}
						if (!borders_other_domain) {
							continue;
						}
						if (!candidate.is_water) {
							land_candidates = add_ranked(
								land_candidates,
								{x: x, y: y, elevation: candidate.elevation}
							);
						}
					}
				}
				let coastline = null;
				for (info of land_candidates) {
					let candidate = tm.get_tile(info.x, info.y);
					const error = candidate.get_elevation_change_error(0 - 1000);
					if (error != '') {
						continue;
					}
					const snapshot = candidate.apply_elevation_change(0 - 1000);
					candidate = tm.get_tile(info.x, info.y);
					if (candidate.is_water) {
						coastline = {x: info.x, y: info.y};
						tm.restore_terrain(snapshot);
						break;
					}
					tm.restore_terrain(snapshot);
				}
				if (coastline == null) {
					throw Error('UNITY_POD_RUNTIME_FAIL: no safe shoreline land tile could be lowered');
				}
				const coastline_tile = tm.get_tile(coastline.x, coastline.y);
				const coastline_former = e.game.get_um().spawn_unit({
					def: 'Former',
					owner: e.game.get_player(),
					tile: coastline_tile,
					morale: 2,
					health: 1.0,
				});
				coastline_former.set_terraforming_order('lower_land', 1);
				const coastline_result = terraforming.advance_order_result(coastline_former, e.game);
				if (!coastline_result.completed || coastline_result.unit_survived) {
					throw Error('UNITY_POD_RUNTIME_FAIL: coastline conversion did not remove its stranded Former');
				}
				if (!tm.get_tile(coastline.x, coastline.y).is_water) {
					throw Error('UNITY_POD_RUNTIME_FAIL: Lower Land did not create ocean');
				}

				const old_bonus = get_bonus_name(source);
				source.set_bonus('minerals');
				if (!source.bonuses.minerals) {
					throw Error('UNITY_POD_RUNTIME_FAIL: resource bonus mutation was not reflected');
				}
				source.set_bonus(old_bonus);

				sea_tile.update_features({unity_pod: true});
				if (!sea_tile.features.unity_pod) {
					throw Error('UNITY_POD_RUNTIME_FAIL: live sea tile did not accept a Unity Pod');
				}
				sea_tile.update_features({unity_pod: false});
				if (sea_tile.features.unity_pod) {
					throw Error('UNITY_POD_RUNTIME_FAIL: live sea tile did not remove a Unity Pod');
				}

				let live_raise_tile = tm.get_tile(elevation_raise_tile.x, elevation_raise_tile.y);
				const old_raise_elevation = live_raise_tile.elevation + 0;
				const raise_snapshot = live_raise_tile.apply_elevation_change(1000);
				if (live_raise_tile.elevation != old_raise_elevation + 1000) {
					throw Error('UNITY_POD_RUNTIME_FAIL: former raise did not update live elevation');
				}
				tm.restore_terrain(raise_snapshot);
				live_raise_tile = tm.get_tile(elevation_raise_tile.x, elevation_raise_tile.y);
				if (live_raise_tile.elevation != old_raise_elevation) {
					throw Error('UNITY_POD_RUNTIME_FAIL: former raise snapshot did not restore terrain');
				}
				let live_lower_tile = tm.get_tile(elevation_lower_tile.x, elevation_lower_tile.y);
				const old_lower_elevation = live_lower_tile.elevation + 0;
				const lower_snapshot = live_lower_tile.apply_elevation_change(-1000);
				if (live_lower_tile.elevation != old_lower_elevation - 1000) {
					throw Error('UNITY_POD_RUNTIME_FAIL: former lower did not update live elevation');
				}
				tm.restore_terrain(lower_snapshot);
				live_lower_tile = tm.get_tile(elevation_lower_tile.x, elevation_lower_tile.y);
				if (live_lower_tile.elevation != old_lower_elevation) {
					throw Error('UNITY_POD_RUNTIME_FAIL: former lower snapshot did not restore terrain');
				}

				const live_earthquake_tile = tm.get_tile(earthquake_tile.x, earthquake_tile.y);
				const old_elevation = live_earthquake_tile.elevation + 0;
				const snapshot = tm.apply_earthquake(live_earthquake_tile, 1);
				const raised_earthquake_tile = tm.get_tile(earthquake_tile.x, earthquake_tile.y);
				const raised_elevation = raised_earthquake_tile.elevation + 0;
				if (raised_elevation <= old_elevation) {
					fail(
						'native earthquake did not raise its center at ' +
						#to_string(earthquake_tile.x) + 'x' + #to_string(earthquake_tile.y) +
						': before=' + #to_string(old_elevation) +
						' after=' + #to_string(raised_elevation)
					);
					return {};
				}
				tm.restore_terrain(snapshot);
				const restored_earthquake_tile = tm.get_tile(earthquake_tile.x, earthquake_tile.y);
				if (restored_earthquake_tile.elevation + 0 != old_elevation) {
					throw Error('UNITY_POD_RUNTIME_FAIL: earthquake snapshot did not restore terrain');
				}

				destination.update_features({unity_pod: true});
				return {};
			},
			rollback: (e) => {
				throw Error('UNITY_POD_RUNTIME_FAIL: preparation event was rolled back');
			},
		});

		game.on('unity_pod_opened', (opened) => {
			pod_events++;
			pod_outcome = opened.outcome;
			if (
			expected_explorer_id == 0 || opened.unit.id != expected_explorer_id ||
			opened.player.id != game.get_player().id
			) {
				fail('Unity Pod notification identified the wrong explorer or player');
			}
		});

		game.on('start_ui', (e) => {
			const um = game.get_um();
			const rover = um.get_unit_def('UnityRover');
			const chopper = um.get_unit_def('UnityScoutChopper');
			const foil = um.get_unit_def('UnityFoil');
			const isle = um.get_unit_def('IsleOfTheDeep');
			if (
				rover == null || rover.buildable || rover.movement_per_turn != 2.0 ||
				chopper == null || chopper.buildable || chopper.movement_per_turn != 8.0 ||
				chopper.operational_range != 1 ||
				foil == null || foil.buildable || foil.cargo_capacity != 2 ||
				isle == null || !isle.is_native || isle.cargo_capacity != 4
			) {
				fail('Unity reward unit metadata did not survive native serialization');
				return;
			}
			ui_started = true;
			start_if_ready();
			finish_if_ready();
		});

		game.on('turn', (e) => {
			if (e.year - 2100 != 1) {
				fail('runtime test exceeded one turn');
				return;
			}
			if (start_runtime != null) {
				return;
			}

			const tm = game.get_tm();
			const um = game.get_um();
			let route = null;
			let sea_tile = null;
			let earthquake_tile = null;
			let elevation_raise_tile = null;
			let elevation_lower_tile = null;
			for (let y = 0; y < tm.get_map_height(); y++) {
				for (let x = 0; x < tm.get_map_width(); x++) {
					if (x % 2 != y % 2) {
						continue;
					}
					const tile = tm.get_tile(x, y);
					if (#typeof(tile.get_elevation_change_error) == 'Callable') {
						if (
							elevation_raise_tile == null &&
							tile.get_elevation_change_error(1000) == ''
						) {
							elevation_raise_tile = tile;
						}
						if (
							elevation_lower_tile == null &&
							tile.get_elevation_change_error(-1000) == ''
						) {
							elevation_lower_tile = tile;
						}
					}
					if (
						sea_tile == null && tile.is_water && tile.get_base() == null &&
						#sizeof(tile.get_units(true)) == 0
					) {
						sea_tile = tile;
					}
					if (tile.is_land && tile.get_base() == null && #sizeof(tile.get_units(true)) == 0) {
						if (route == null) {
							for (destination of tile.get_surrounding_tiles()) {
								if (
									destination.is_land && destination.get_base() == null &&
									#sizeof(destination.get_units(true)) == 0
								) {
									route = {source: tile, destination: destination};
									break;
								}
							}
						}
						if (earthquake_tile == null && tile.elevation <= 1000) {
							let inland = true;
							let neighbours = 0;
							for (nearby of tile.get_surrounding_tiles()) {
								neighbours++;
								if (nearby.is_water) {
									inland = false;
								}
							}
							if (inland && neighbours == 8) {
								earthquake_tile = tile;
							}
						}
					}
				}
			}
			if (
				route == null || sea_tile == null || earthquake_tile == null ||
				elevation_raise_tile == null || elevation_lower_tile == null
			) {
				fail('quickstart map lacks the required movement or terrain test tiles');
				return;
			}
			if (
				#typeof(route.source.set_bonus) != 'Callable' ||
				#typeof(elevation_raise_tile.apply_elevation_change) != 'Callable' ||
				#typeof(elevation_lower_tile.apply_elevation_change) != 'Callable' ||
				#typeof(tm.apply_earthquake) != 'Callable' ||
				#typeof(tm.restore_terrain) != 'Callable'
			) {
				fail('Unity Pod native map bindings are unavailable');
				return;
			}

			const explorer = um.spawn_unit({
				def: 'ScoutPatrol',
				owner: game.get_player(),
				tile: route.source,
				morale: 2,
				health: 1.0,
			});
			const former = um.spawn_unit({
				def: 'Former',
				owner: game.get_player(),
				tile: route.source,
				morale: 2,
				health: 1.0,
			});
			explorer.movement = 10.0;
			explorer.moved_this_turn = false;
			expected_explorer_id = explorer.id;

			start_runtime = () => {
				game.event('unity_pod_runtime_prepare', {
					source: route.source,
					destination: route.destination,
					sea_tile: sea_tile,
					earthquake_tile: earthquake_tile,
					elevation_raise_tile: elevation_raise_tile,
					elevation_lower_tile: elevation_lower_tile,
					former: former,
				});
				wait_for_pod_ready(route.destination, () => {
					game.event('move_unit', {unit: explorer, tile: route.destination});
					wait_for_arrival(explorer, route.destination, () => {
						if (
							route.destination.features.unity_pod || pod_events != 1 ||
							!is_supported_outcome(pod_outcome)
						) {
							fail('real movement did not resolve exactly one supported Unity Pod outcome');
							return;
						}
						runtime_complete = true;
						finish_if_ready();
					}, 0);
				}, 0);
			};
			start_if_ready();
		});
	});

	glsmac.run();

});
