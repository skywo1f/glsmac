#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let starting_pop_count = 0;
	let state_verified = false;
	let ui_started = false;
	let exit_scheduled = false;

	const finish_if_ready = () => {
		if (state_verified && ui_started && !exit_scheduled) {
			exit_scheduled = true;
			#print('RUNTIME_SMOKE_PASS: reached turn 2 with unit and base state intact');
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
			if (turn_id == 1) {
				const um = game.get_um();
				const bases = game.get_bm().get_bases();
				if (!um.has_unit(1) || #sizeof(bases) == 0) {
					#print('RUNTIME_SMOKE_FAIL: starting unit or base is missing');
					glsmac.exit();
					return;
				}

				const smoke_unit = um.get_unit(1);
				const base = bases[0];
				starting_pop_count = #sizeof(base.get_pops());

				game.event('unit_skip_turn', {
					unit: smoke_unit,
				});
				game.event('add_base_pop', {
					base: base,
					type: 'WORKER',
				});
				game.event('complete_turn', {});
				#print('RUNTIME_SMOKE: queued unit, base, and turn events');
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

				state_verified = true;
				finish_if_ready();
			}
		});
	});

	glsmac.run();

});
