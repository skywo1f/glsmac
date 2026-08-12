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
				'entered production, completed an obsolescence cycle, bulk-upgraded units, ' +
				'and retired permanently without invalidating field units'
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
			let bulk_units = [];
			let bulk_energy = 0;
			let bulk_cost = 0;
			const first = game.get_um().spawn_unit({
				def: 'ScoutPatrol', owner: player, tile: own_base.get_tile(),
				morale: 4, health: 0.7, home_base_id: own_base.id,
			});
			first.movement = 0.25;
			first.moved_this_turn = true;
			first.airdropped_this_turn = true;
			game.get_um().spawn_unit({
				def: 'ScoutPatrol', owner: player, tile: own_base.get_tile(),
				morale: 2, health: 1.0, home_base_id: own_base.id,
			});
			player.set_energy_credits(10000);

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
						bulk_units = [];
						for (unit of game.get_um().get_units(true)) {
							if (unit.owner == player.id && unit.def == 'ScoutPatrol') {
								bulk_units :+{
									id: unit.id,
									movement: unit.movement,
									moved_this_turn: unit.moved_this_turn,
									airdropped_this_turn: unit.airdropped_this_turn,
									morale: unit.morale,
									health: unit.health,
								};
							}
						}
						bulk_energy = player.get_energy_credits();
						const bulk = game.get('f_unit_upgrade_get_bulk_preview')(
							player,
							game.get_um().get_unit(bulk_units[0].id).get_def(),
							definition
						);
						if (#is_defined(bulk.error) || bulk.count != #sizeof(bulk_units)) {
							fail(
								#is_defined(bulk.error)
									? 'bulk-upgrade preview is invalid: ' + bulk.error
									: 'bulk-upgrade count is ' + #to_string(bulk.count) +
										', expected ' + #to_string(#sizeof(bulk_units))
							);
							return false;
						}
						bulk_cost = bulk.total_cost;
						phase = 5;
						game.event('upgrade_unit_design', {
							source_def_id: 'ScoutPatrol',
							target_def_id: preview.id,
						});
						return true;
					}
				}
				if (phase == 5) {
					for (snapshot of bulk_units) {
						if (!game.get_um().has_unit(snapshot.id)) { return true; }
						const unit = game.get_um().get_unit(snapshot.id);
						if (unit.def == 'ScoutPatrol') { return true; }
						if (
							unit.def != preview.id || unit.movement != snapshot.movement ||
							unit.moved_this_turn != snapshot.moved_this_turn ||
							unit.airdropped_this_turn != snapshot.airdropped_this_turn ||
							unit.morale != snapshot.morale || unit.health != snapshot.health
						) {
							fail('bulk upgrade did not preserve unit state');
							return false;
						}
					}
					if (player.get_energy_credits() != bulk_energy - bulk_cost) {
						fail('bulk upgrade energy charge is invalid');
						return false;
					}
					phase = 6;
					game.event('set_unit_design_obsolete', {
						id: preview.id,
						obsolete: true,
					});
					return true;
				}
				if (phase == 6 && player.is_unit_design_obsolete(preview.id)) {
					const production = own_base.get_production();
					if (
						own_base.can_set_production('unit', preview.id) ||
						(#is_defined(production) && production.id == preview.id)
					) {
						fail('design remained available or queued before retirement');
						return false;
					}
					phase = 7;
					game.event('retire_unit_design', {id: preview.id});
					return true;
				}
				if (phase == 7 && player.is_unit_design_retired(preview.id)) {
					if (
						!player.is_unit_design_obsolete(preview.id) ||
						own_base.can_set_production('unit', preview.id)
					) {
						fail('retired design did not remain unavailable and obsolete');
						return false;
					}
					for (snapshot of bulk_units) {
						if (
							!game.get_um().has_unit(snapshot.id) ||
							game.get_um().get_unit(snapshot.id).get_def().id != preview.id
						) {
							fail('retirement invalidated an existing field unit');
							return false;
						}
					}
					for (existing of game.get('f_unit_design_get_existing')(player)) {
						if (existing.id == preview.id) {
							fail('retired design remains visible in the Workshop list');
							return false;
						}
					}
					const retired_preview = game.get('f_unit_design_get_preview')(player, selection);
					if (!retired_preview.exists || retired_preview.id != preview.id) {
						fail('retired component combination can be recreated');
						return false;
					}
					runtime_complete = true;
					finish_if_ready();
					return false;
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
