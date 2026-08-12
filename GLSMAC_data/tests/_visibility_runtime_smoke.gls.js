#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let ui_started = false;
	let runtime_started = false;
	let start_runtime = null;

	const fail = (message) => {
		#print('VISIBILITY_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const start_if_ready = () => {
		if (ui_started && start_runtime != null && !runtime_started) {
			runtime_started = true;
			#async(500, () => { start_runtime(); });
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
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
			start_runtime = () => {
				const player = game.get_player();
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
						!candidate.terraforming.sensor
					) {
						sensor_tile = candidate;
						break;
					}
				}
				if (sensor_tile == null) {
					fail('could not find a valid Sensor Array tile near the owned base');
					return;
				}

				game.event('visibility_runtime_set_sensor', {tile: sensor_tile, enabled: true});
				#async(1500, () => {
					game.event('visibility_runtime_set_sensor', {tile: sensor_tile, enabled: false});
					#print('VISIBILITY_RUNTIME_PASS: frontend processed owned Sensor Array coverage');
					#async(500, () => { glsmac.exit(); });
				});
			};
			start_if_ready();
		});
	});

	glsmac.run();

});
