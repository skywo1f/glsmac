#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let starting_pop_count = 0;
	let state_verified = false;
	let ui_started = false;
	let exit_scheduled = false;
	const lifecycle_base_name = 'Runtime Smoke Base';

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
				const unworked_tiles = base.get_unworked_tiles();
				if (#sizeof(unworked_tiles) == 0) {
					#print('RUNTIME_SMOKE_FAIL: no free tile for base lifecycle coverage');
					glsmac.exit();
					return;
				}

				game.event('unit_skip_turn', {
					unit: smoke_unit,
				});
				game.event('add_base_pop', {
					base: base,
					type: 'WORKER',
				});
				game.event('spawn_base', {
					owner: game.get_player(),
					tile: unworked_tiles[0],
					name: lifecycle_base_name,
				});
				game.event('complete_turn', {});
				#print('RUNTIME_SMOKE: queued unit, base lifecycle, and turn events');
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

				const old_base_id = lifecycle_base.id;
				game.event('runtime_smoke_replace_base', {
					base_id: old_base_id,
					owner: lifecycle_base.get_owner(),
					tile: lifecycle_base.get_tile(),
					name: lifecycle_base.name,
				});

				let wait_ticks = 0;
				#async(100, () => {
					wait_ticks++;
					for (base of game.get_bm().get_bases()) {
						if (base.name == lifecycle_base_name && base.id != old_base_id) {
							#print('RUNTIME_SMOKE_BASE_LIFECYCLE_PASS');
							state_verified = true;
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
			}
		});
	});

	glsmac.run();

});
