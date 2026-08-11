#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let runtime_complete = false;
	let ui_started = false;
	let exit_scheduled = false;

	const fail = (message) => {
		#print('SUPPLY_CRAWLER_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const finish_if_ready = () => {
		if (runtime_complete && ui_started && !exit_scheduled) {
			exit_scheduled = true;
			#print(
				'SUPPLY_CRAWLER_RUNTIME_PASS: convoy order changed base intake and ' +
				'cancelled cleanly'
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
			if (e.year - 2100 != 1) {
				fail('runtime test exceeded one turn');
				return;
			}
			let player = null;
			for (candidate of game.get_players()) {
				if (candidate.type == 'ai') {
					player = candidate;
					break;
				}
			}
			if (player == null) {
				fail('computer player is missing');
				return;
			}
			let base = null;
			for (candidate of game.get_bm().get_bases()) {
				if (candidate.get_owner().id == player.id && !candidate.get_tile().is_water) {
					base = candidate;
					break;
				}
			}
			if (base == null) {
				fail('no owned land base is available');
				return;
			}
			let source = null;
			let resource = '';
			for (candidate of base.get_unworked_tiles()) {
				if (!candidate.is_land || candidate.get_base() != null || candidate.is_locked()) {
					continue;
				}
				const yields = candidate.get_resources(player);
				if (yields.MINERALS > 0) {
					source = candidate;
					resource = 'MINERALS';
					break;
				}
				if (source == null && yields.NUTRIENTS > 0) {
					source = candidate;
					resource = 'NUTRIENTS';
				}
			}
			if (source == null) {
				fail('no usable convoy source tile is available');
				return;
			}
			let crawler_def = null;
			for (candidate of game.get_um().get_unit_defs()) {
				if (
					candidate.weapon == 'SupplyTransport' && candidate.is_land &&
					(candidate.reactor_power == 1) &&
					(crawler_def == null || candidate.mineral_cost < crawler_def.mineral_cost)
				) {
					crawler_def = candidate;
				}
			}
			if (crawler_def == null) {
				fail('no generated Supply Transport definition is available');
				return;
			}

			game.event('spawn_unit', {
				owner: player,
				tile: source,
				type: crawler_def.id,
				health: 1.0,
				morale: 2,
				home_base_id: base.id,
			});

			let crawler = null;
			let crawler_id = 0;
			let baseline = null;
			let phase = 0;
			let wait_ticks = 0;
			#async(100, () => {
				wait_ticks++;
				if (crawler_id > 0) {
					crawler = game.get_um().get_unit(crawler_id);
				}
				if (crawler == null) {
					for (candidate of source.get_units()) {
						if (
							candidate.owner == player.id &&
							candidate.get_def().weapon == 'SupplyTransport'
						) {
							crawler = candidate;
							break;
						}
					}
					if (crawler == null) {
						if (wait_ticks >= 100) {
							fail('Supply Crawler spawn timed out');
							return false;
						}
						return true;
					}
					crawler_id = crawler.id;
					if (
						crawler.convoy_resource != 'none' ||
						crawler.home_base_id != base.id ||
						crawler.get_def().mineral_cost <= 0
					) {
						fail('spawned Supply Crawler state is invalid');
						return false;
					}
					baseline = base.get_intake();
					game.event_as(player.id, 'set_supply_convoy', {
						unit: crawler,
						resource: resource,
					});
					phase = 1;
					return true;
				}

				if (phase == 1 && crawler.convoy_resource == resource) {
					const intake = base.get_intake();
					const source_resources = source.get_resources(player);
					const source_yield = source_resources[resource];
					if (
						crawler.movement != 0.0 || !crawler.moved_this_turn ||
						intake[resource] != baseline[resource] + source_yield
					) {
						fail('active convoy did not add the selected tile yield');
						return false;
					}
					game.event_as(player.id, 'set_supply_convoy', {
						unit: crawler,
						resource: 'none',
					});
					phase = 2;
					return true;
				}
				if (phase == 2 && crawler.convoy_resource == 'none') {
					const intake = base.get_intake();
					if (intake != baseline) {
						fail('cancelled convoy still changes base intake');
						return false;
					}
					runtime_complete = true;
					finish_if_ready();
					return false;
				}
				if (wait_ticks >= 100) {
					fail('convoy event timed out');
					return false;
				}
				return true;
			});
		});
	});

	glsmac.run();

});
