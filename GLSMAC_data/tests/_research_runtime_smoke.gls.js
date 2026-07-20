#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let last_progress = 0 - 1;
	let research_complete = false;
	let ui_started = false;
	let exit_scheduled = false;

	const finish_if_ready = () => {
		if (research_complete && ui_started && !exit_scheduled) {
			exit_scheduled = true;
			#print('RESEARCH_RUNTIME_PASS: Centauri Ecology completed and unlocked Former production');
			#async(500, () => {
				glsmac.exit();
			});
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		game.on('start_ui', (e) => {
			ui_started = true;
			finish_if_ready();
		});

		game.on('turn', (e) => {
			const turn_id = e.year - 2100;
			const player = game.get_player();
			let base = null;
			for (candidate of game.get_bm().get_bases()) {
				if (candidate.get_owner().id == player.id) {
					base = candidate;
					break;
				}
			}
			if (base == null) {
				#print('RESEARCH_RUNTIME_FAIL: player base is missing');
				glsmac.exit();
				return;
			}

			const former = game.get_um().get_unit_def('Former');
			if (former.required_technology != 'CentauriEcology') {
				#print('RESEARCH_RUNTIME_FAIL: Former technology prerequisite is missing');
				glsmac.exit();
				return;
			}

			const state = player.get_research_state();
			if (turn_id == 1) {
				if (
					player.get_faction().id != 'HIVE' ||
					player.has_technology('CentauriEcology') ||
					state.technologies != [] ||
					state.target != 'CentauriEcology' ||
					state.progress != 0 ||
					base.can_set_production('unit', 'Former')
				) {
					#print('RESEARCH_RUNTIME_FAIL: initial Hive research or production gate is invalid');
					glsmac.exit();
					return;
				}
			}

			if (player.has_technology('CentauriEcology')) {
				if (
					state.technologies != ['CentauriEcology'] ||
					state.target != '' ||
					state.progress != 0 ||
					!base.can_set_production('unit', 'Former')
				) {
					#print('RESEARCH_RUNTIME_FAIL: completed research did not unlock Former production');
					glsmac.exit();
					return;
				}
				research_complete = true;
				finish_if_ready();
				return;
			}

			if (
				state.target != 'CentauriEcology' ||
				state.progress <= last_progress ||
				base.can_set_production('unit', 'Former')
			) {
				#print('RESEARCH_RUNTIME_FAIL: research did not advance monotonically behind the production gate');
				glsmac.exit();
				return;
			}
			last_progress = state.progress;
			if (turn_id >= 12) {
				#print('RESEARCH_RUNTIME_FAIL: Centauri Ecology did not complete within twelve turns');
				glsmac.exit();
				return;
			}
			game.event('complete_turn', {});
		});
	});

	glsmac.run();

});
