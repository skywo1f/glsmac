#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let game = null;
	let finished = false;
	const fail = (message) => {
		if (!finished) {
			finished = true;
			#print('ORIGINAL_MAP_RUNTIME_FAIL: ' + message);
			glsmac.exit();
		}
	};

	glsmac.on('configure_game', (e) => {
		game = e.game;
		game.on('start_ui', (event) => {
			if (finished) { return; }
			const tm = game.get_tm();
			const width = tm.get_map_width();
			const height = tm.get_map_height();
			let expected = null;
			if (width == 80 && height == 80) {
				expected = {
					water: 1826,
					landmarks: [49, 23, 16, 53, 9, 53, 23, 69, 25, 15, 23],
				};
			} else if (width == 128 && height == 128) {
				expected = {
					water: 5143,
					landmarks: [49, 61, 13, 49, 9, 70, 34, 81, 25, 40, 68],
				};
			} else {
				fail('unexpected dimensions ' + #to_string(width) + 'x' + #to_string(height));
				return;
			}

			let water = 0;
			let landmarks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
			let expansion_landmarks = 0;
			for (let y = 0; y < height; y++) {
				for (let x = y % 2; x < width; x += 2) {
					const tile = tm.get_tile(x, y);
					if (tile.is_water) { water++; }
					if (tile.landmarks.sunny_mesa) { landmarks[0] = landmarks[0] + 1; }
					if (tile.landmarks.geothermal_shallows) { landmarks[1] = landmarks[1] + 1; }
					if (tile.landmarks.pholus_ridge) { landmarks[2] = landmarks[2] + 1; }
					if (tile.landmarks.garland_crater) { landmarks[3] = landmarks[3] + 1; }
					if (tile.landmarks.mount_planet) { landmarks[4] = landmarks[4] + 1; }
					if (tile.landmarks.monsoon_jungle) { landmarks[5] = landmarks[5] + 1; }
					if (tile.landmarks.uranium_flats) { landmarks[6] = landmarks[6] + 1; }
					if (tile.landmarks.new_sargasso) { landmarks[7] = landmarks[7] + 1; }
					if (tile.landmarks.the_ruins) { landmarks[8] = landmarks[8] + 1; }
					if (tile.landmarks.great_dunes) { landmarks[9] = landmarks[9] + 1; }
					if (tile.landmarks.freshwater_sea) { landmarks[10] = landmarks[10] + 1; }
					if (
						tile.landmarks.nessus_canyon ||
						tile.landmarks.borehole_cluster ||
						tile.landmarks.manifold_nexus
					) {
						expansion_landmarks++;
					}
				}
			}
			if (water != expected.water) {
				fail('water count ' + #to_string(water) + ' != ' + #to_string(expected.water));
				return;
			}
			if (landmarks != expected.landmarks) {
				fail('base landmark counts differ');
				return;
			}
			if (expansion_landmarks != 0) {
				fail('Crossfire landmarks were imported');
				return;
			}
			finished = true;
			#print(
				'ORIGINAL_MAP_RUNTIME_PASS: width=' + #to_string(width) +
				' height=' + #to_string(height) +
				' water=' + #to_string(water)
			);
			glsmac.exit();
		});
	});

	glsmac.run();

});
