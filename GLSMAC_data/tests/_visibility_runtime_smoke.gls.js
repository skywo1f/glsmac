#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('./_full_unit_catalog_runtime')(glsmac, [
		'SelfAwareMachines', 'FrictionlessSurfaces', 'Nanometallurgy',
	]);
	#include('../default/ui/ui')(glsmac);

	let ui_started = false;
	let runtime_started = false;
	let run_ui_visibility = null;

	const fail = (message) => {
		#print('VISIBILITY_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const start_if_ready = () => {
		if (ui_started && run_ui_visibility != null && !runtime_started) {
			runtime_started = true;
			#async(500, () => { run_ui_visibility(); });
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.register_event('visibility_runtime_setup', {
			validate: (event) => {},
			apply: (event) => {
				const xenofungus = event.data.sensor_tile.features.xenofungus;
				event.data.sensor_tile.update_features({xenofungus: true});
				const radar = event.game.um.spawn_unit({
					def: event.data.radar_def_id,
					owner: event.data.player,
					tile: event.data.base_tile,
					morale: 2,
					health: 1.0,
					home_base_id: event.data.home_base_id,
				});
				const concealed = event.game.um.spawn_unit({
					def: event.data.cloaked_def_id,
					owner: event.data.opponent,
					tile: event.data.sensor_tile,
					morale: 2,
					health: 1.0,
				});
				const fungus_hidden = event.game.um.spawn_unit({
					def: event.data.ordinary_def_id,
					owner: event.data.opponent,
					tile: event.data.sensor_tile,
					morale: 2,
					health: 1.0,
				});
				concealed.movement = 0.0;
				fungus_hidden.movement = 0.0;
				const queue_exploration = event.game.get('f_exploration_queue_at_tile');
				if (#is_defined(queue_exploration)) {
					queue_exploration(event.data.player, radar.get_tile(), radar);
				}
				return {
					unit_ids: [radar.id, concealed.id, fungus_hidden.id],
					xenofungus: xenofungus,
				};
			},
			rollback: (event) => {
				for (let i = #sizeof(event.applied.unit_ids) - 1; i >= 0; i--) {
					const id = event.applied.unit_ids[i];
					if (event.game.um.has_unit(id)) {
						event.game.um.despawn_unit(event.game.um.get_unit(id));
					}
				}
				event.data.sensor_tile.update_features({xenofungus: event.applied.xenofungus});
			},
		});
		game.register_event('visibility_runtime_set_sensor', {
			validate: (event) => {},
			apply: (event) => {
				const previous = event.data.tile.terraforming.sensor;
				event.data.tile.update_terraforming({sensor: event.data.enabled});
				return {previous: previous};
			},
			rollback: (event) => {
				event.data.tile.update_terraforming({sensor: event.applied.previous});
			},
		});

		game.on('start_ui', (event) => {
			ui_started = true;
			start_if_ready();
		});

		game.on('turn', (event) => {
			if (event.year - 2100 != 1) {
				fail('runtime test exceeded one turn');
				return;
			}
			const player = game.get_player();
			const opponent = game.get_native_player();
			if (opponent == null) {
				fail('runtime opponent is missing');
				return;
			}
			let owned_base = null;
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == player.id) {
					owned_base = base;
					break;
				}
			}
			if (owned_base == null) {
				fail('quickstart player has no owned base');
				return;
			}

			let sensor_tile = null;
			for (candidate of owned_base.get_tile().get_surrounding_tiles()) {
				if (
					candidate.is_land && candidate.get_base() == null &&
					!candidate.terraforming.sensor &&
					#sizeof(candidate.get_units(true)) == 0
				) {
					sensor_tile = candidate;
					break;
				}
			}
			if (sensor_tile == null) {
				fail('could not find a valid Sensor Array tile near the owned base');
				return;
			}

			let radar_def = null;
			let cloaked_def = null;
			let submarine_def = null;
			let ordinary_def = null;
			for (def of game.get_um().get_unit_defs()) {
				let has_radar = false;
				let has_cloak = false;
				let has_hull = false;
				let has_carrier = false;
				for (ability of def.abilities) {
					has_radar = has_radar || ability == 'DeepRadar';
					has_cloak = has_cloak || ability == 'CloakingDevice';
					has_hull = has_hull || ability == 'DeepPressureHull';
					has_carrier = has_carrier || ability == 'CarrierDeck';
				}
				if (has_hull && has_carrier) {
					fail('generated submarine illegally combines Carrier Deck');
					return;
				}
				if (radar_def == null && has_radar && def.is_artillery && def.is_land) {
					radar_def = def;
				}
				if (cloaked_def == null && has_cloak && def.is_land) {
					cloaked_def = def;
				}
				if (submarine_def == null && has_hull && def.is_water) {
					submarine_def = def;
				}
				if (def.id == 'ScoutPatrol') {
					ordinary_def = def;
				}
			}
			if (
				radar_def == null || cloaked_def == null ||
				submarine_def == null || ordinary_def == null
			) {
				fail('generated recon and stealth definitions are incomplete');
				return;
			}

			run_ui_visibility = () => {
				game.event('visibility_runtime_setup', {
					radar_def_id: radar_def.id,
					cloaked_def_id: cloaked_def.id,
					ordinary_def_id: ordinary_def.id,
					player: player,
					opponent: opponent,
					base_tile: owned_base.get_tile(),
					sensor_tile: sensor_tile,
					home_base_id: owned_base.id,
				});
				#async(750, () => {
					game.event('visibility_runtime_set_sensor', {tile: sensor_tile, enabled: true});
				});
				#async(2250, () => {
					game.event('visibility_runtime_set_sensor', {tile: sensor_tile, enabled: false});
					#print(
						'VISIBILITY_RUNTIME_PASS: frontend processed fungus concealment, Deep Radar, ' +
						'ability concealment, and owned Sensor Array detection'
					);
					#async(500, () => { glsmac.exit(); });
				});
			};
			start_if_ready();
		});
	});

	glsmac.run();

});
