#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let ui_started = false;
	let runtime_complete = false;
	let exit_scheduled = false;

	const fail = (message) => {
		#print('UNIT_WORKSHOP_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const finish_if_ready = () => {
		if (ui_started && runtime_complete && !exit_scheduled) {
			exit_scheduled = true;
			#print(
				'UNIT_WORKSHOP_RUNTIME_PASS: faction design synchronized, remained private, ' +
				'entered production, and completed an obsolescence cycle'
			);
			#async(500, () => { glsmac.exit(); });
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.on('start_ui', (e) => {
			ui_started = true;
			finish_if_ready();
		});

		game.on('turn', (e) => {
			if (!game.is_master()) {
				return;
			}
			if (e.year - 2100 != 1) {
				fail('runtime test exceeded one turn');
				return;
			}
			const player = game.get_player();
			let own_base = null;
			let other_base = null;
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == player.id && !base.get_tile().is_water) {
					own_base = base;
				} else if (!base.get_tile().is_water) {
					other_base = base;
				}
			}
			if (own_base == null || other_base == null) {
				fail('two land bases are required');
				return;
			}

			const selection = {
				chassis: 'Infantry',
				weapon: 'HandWeapons',
				armor: 'NoArmor',
				reactor: 'FissionPlant',
				abilities: [],
			};
			const preview = game.get('f_unit_design_get_preview')(player, selection);
			if (#is_defined(preview.error) || preview.exists) {
				fail('basic Workshop preview is invalid');
				return;
			}
			game.event('create_unit_design', {
				name: '  Reconnect Workshop Patrol  ',
				selection: selection,
			});

			let phase = 0;
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				let definition = null;
				for (candidate of game.get_um().get_unit_defs()) {
					if (candidate.id == preview.id) {
						definition = candidate;
						break;
					}
				}
				if (phase == 0 && definition != null) {
					if (
						definition.name != 'Reconnect Workshop Patrol' ||
						definition.owner_player_id != player.id ||
						!own_base.can_set_production('unit', definition.id) ||
						other_base.can_set_production('unit', definition.id)
					) {
						fail('custom definition ownership or production access is invalid');
						return false;
					}
					game.event('set_base_production', {
						base: own_base,
						kind: 'unit',
						id: definition.id,
					});
					phase = 1;
					return true;
				}
				if (phase == 1) {
					const production = own_base.get_production();
					if (#is_defined(production) && production.id == preview.id) {
						phase = 2;
						game.event('set_unit_design_obsolete', {
							id: preview.id,
							obsolete: true,
						});
						return true;
					}
				}
				if (phase == 2 && player.is_unit_design_obsolete(preview.id)) {
					const production = own_base.get_production();
					if (
						own_base.can_set_production('unit', preview.id) ||
						other_base.can_set_production('unit', preview.id) ||
						(#is_defined(production) && production.id == preview.id)
					) {
						fail('obsolete design remains available or queued');
						return false;
					}
					phase = 3;
					game.event('set_unit_design_obsolete', {
						id: preview.id,
						obsolete: false,
					});
					return true;
				}
				if (phase == 3 && !player.is_unit_design_obsolete(preview.id)) {
					if (
						!own_base.can_set_production('unit', preview.id) ||
						other_base.can_set_production('unit', preview.id)
					) {
						fail('reactivated design production access is invalid');
						return false;
					}
					game.event('set_base_production', {
						base: own_base,
						kind: 'unit',
						id: preview.id,
					});
					phase = 4;
					return true;
				}
				if (phase == 4) {
					const production = own_base.get_production();
					if (#is_defined(production) && production.id == preview.id) {
						runtime_complete = true;
						finish_if_ready();
						return false;
					}
				}
				if (wait_ticks >= 100) {
					fail('Workshop event or production update timed out');
					return false;
				}
				return true;
			});
		});
	});

	glsmac.run();

});
