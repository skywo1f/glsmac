#main((glsmac) => {

	let base_screen_completions = 0;
	let base_screen_total_ms = 0;

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	const fail = (message) => {
		#print('SMALL_MAP_FRONTEND_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.set('f_base_screen_profile', (sample) => {
			#print(
				'BASE_SCREEN_PROFILE: phase=' + sample.phase +
				' elapsed_ms=' + #to_string(sample.elapsed_ms) +
				' total_ms=' + #to_string(sample.total_ms)
			);
			if (sample.phase == 'bottom_bar') {
				base_screen_completions++;
				base_screen_total_ms = sample.total_ms;
			}
		});
		game.on('start_ui', (event) => {
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
			let human_base = null;
			for (candidate of game.get_players()) {
				if (candidate.type == 'ai') {
					ai_count++;
				}
			}
			if (#sizeof(game.get_players()) != 7 || ai_count != 6) {
				fail('seven-player starting roster is invalid');
				return;
			}
			for (base of game.get_bm().get_bases()) {
				if (base.get_size() != 1) {
					fail('starting bases must begin at population one');
					return;
				}
				if (base.get_owner().id == player.id) {
					human_base = base;
				}
			}
			if (human_base == null) {
				fail('human starting base was not found');
				return;
			}
			const base_screen_started = #monotonic_ms();
			game.select_base(human_base);
			let base_screen_wait_ticks = 0;
			let first_base_screen_set_ms = 0;
			let first_base_screen_observed_ms = 0;
			let refresh_started = 0;
			#async(50, () => {
				base_screen_wait_ticks++;
				if (base_screen_completions == 0) {
					if (base_screen_wait_ticks >= 100) {
						fail('base screen did not finish opening');
						return false;
					}
					return true;
				}
				if (refresh_started == 0) {
					first_base_screen_set_ms = base_screen_total_ms;
					first_base_screen_observed_ms = #monotonic_ms() - base_screen_started;
					refresh_started = #monotonic_ms();
					game.select_base(human_base);
					return true;
				}
				if (base_screen_completions < 2) {
					if (base_screen_wait_ticks >= 200) {
						fail('base screen did not finish refreshing');
						return false;
					}
					return true;
				}
				#print(
					'SMALL_MAP_FRONTEND_RUNTIME_PASS: first_set_ms=' +
					#to_string(first_base_screen_set_ms) + ' first_observed_ms=' +
					#to_string(first_base_screen_observed_ms) + ' refresh_set_ms=' +
					#to_string(base_screen_total_ms) + ' refresh_observed_ms=' +
					#to_string(#monotonic_ms() - refresh_started)
				);
				glsmac.exit();
				return false;
			});
		});
	});

	glsmac.run();

});
