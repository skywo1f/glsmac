#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	const EXPECTED_AI_COUNT = 6;
	let game = null;
	let finished = false;
	let samples = {};
	let sample_count = 0;
	let turn_started = 0;

	const fail = (message) => {
		#print('AI_TURN_PROFILE_FAIL: ' + message);
		finished = true;
		glsmac.exit();
	};

	glsmac.on('configure_game', (e) => {
		game = e.game;
		game.set('f_turn_profile', (sample) => {
			#print(
				'AI_TURN_PHASE_PROFILE: phase=' + sample.phase +
				' elapsed_ms=' + #to_string(sample.elapsed_ms)
			);
		});
		game.set('f_ai_profile', (sample) => {
			if (finished) {
				return;
			}
			const sample_key = 'p' + #to_string(sample.player_id);
			if (!#is_defined(samples[sample_key])) {
				sample_count++;
			}
			samples[sample_key] = sample;
			#print(
				'AI_TURN_PROFILE_SAMPLE: faction=' + sample.faction_id +
				' total_ms=' + #to_string(sample.total_ms) +
				' setup_ms=' + #to_string(sample.setup_ms) +
				' action_ms=' + #to_string(sample.action_ms) +
				' production_ms=' + #to_string(sample.production_ms) +
				' colony_ms=' + #to_string(sample.colony_ms) +
				' former_ms=' + #to_string(sample.former_ms) +
				' combat_ms=' + #to_string(sample.combat_ms) +
				' completion_ms=' + #to_string(sample.completion_check_ms) +
				' completion_ack_ms=' + #to_string(sample.completion_ack_ms) +
				' steps=' + #to_string(sample.steps) +
				' actions=' + #to_string(sample.actions_started) +
				' action_waits=' + #to_string(sample.action_wait_checks) +
				' animation_waits=' + #to_string(sample.animation_wait_checks)
			);
			if (sample_count >= EXPECTED_AI_COUNT) {
				finished = true;
				#print(
					'AI_TURN_PROFILE_PASS: elapsed_ms=' +
					#to_string(#monotonic_ms() - turn_started)
				);
				#async(0, () => { glsmac.exit(); });
			}
		});

		game.on('start_ui', (event) => {
			let ai_count = 0;
			for (player of game.get_players()) {
				if (player.type == 'ai') {
					ai_count++;
				}
			}
			if (ai_count != EXPECTED_AI_COUNT) {
				fail('expected six computer players');
				return;
			}
			turn_started = #monotonic_ms();
			#async(100, () => {
				game.event('complete_turn', {});
			});
			let wait_ticks = 0;
			#async(100, () => {
				if (finished) {
					return false;
				}
				wait_ticks++;
				if (wait_ticks >= 300) {
					fail(
						'first AI turn timed out after ' + #to_string(sample_count) +
						' of ' + #to_string(EXPECTED_AI_COUNT) + ' profiles'
					);
					return false;
				}
				return true;
			});
		});
		game.on('turn', (event) => {
			if (event.year == 2102 && turn_started > 0) {
				#async(0, () => {
					#print(
						'AI_TURN_CALLBACK_PROFILE: elapsed_ms=' +
						#to_string(#monotonic_ms() - turn_started)
					);
				});
			}
		});
	});

	glsmac.run();

});
