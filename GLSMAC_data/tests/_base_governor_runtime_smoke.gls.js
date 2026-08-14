#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let game = null;
	let base_id = 0;
	let manual_kind = '';
	let manual_id = '';
	let initial_energy = 0;
	let wait_ticks = 0;
	let finished = false;

	const fail = (message) => {
		if (!finished) {
			finished = true;
			#print('BASE_GOVERNOR_RUNTIME_FAIL: ' + message);
			glsmac.exit();
		}
	};

	const find_base = () => {
		for (base of game.get_bm().get_bases()) {
			if (base.id == base_id) {
				return base;
			}
		}
		return null;
	};

	const verify_automated_production = () => {
		if (finished) {
			return false;
		}
		wait_ticks++;
		const base = find_base();
		if (base == null) {
			fail('governed base disappeared');
			return false;
		}
		const queue = base.get_production_queue();
		if (#sizeof(queue) > 0) {
			if (
				!base.get('governor_enabled') ||
				base.get('governor_priority') != 'discover'
			) {
				fail('governor state was not retained');
				return false;
			}
			if (base.get_owner().energy_credits != initial_energy) {
				fail('human governor spent energy without permission');
				return false;
			}
			finished = true;
			#print(
				'BASE_GOVERNOR_RUNTIME_PASS: preserved manual ' + manual_kind + ':' + manual_id +
				' and selected empty-queue ' + queue[0].production_kind + ':' + queue[0].id
			);
			#async(250, () => { glsmac.exit(); });
			return false;
		}
		if (wait_ticks >= 100) {
			fail('governor did not fill an empty production queue');
			return false;
		}
		return true;
	};

	glsmac.on('configure_game', (e) => {
		game = e.game;

		game.register_event('base_governor_runtime_prepare', {
			validate: (e) => {
				if (e.caller != e.data.base.get_owner().id) {
					return 'Only the base owner can prepare the governor smoke test';
				}
			},
			apply: (e) => {
				const base = e.data.base;
				let kind = '';
				let id = '';
				const queue = base.get_production_queue();
				if (#sizeof(queue) > 0) {
					kind = queue[0].production_kind;
					id = queue[0].id;
				} else {
					for (definition of e.game.get_um().get_unit_defs()) {
						if (base.can_set_production('unit', definition.id)) {
							kind = 'unit';
							id = definition.id;
							break;
						}
					}
					if (id == '') {
						throw Error('No legal manual production item is available');
					}
					base.set_production(kind, id);
				}
				e.game.trigger('base_governor_runtime_prepared', {
					base: base,
					kind: kind,
					id: id,
				});
				return {};
			},
			rollback: (e) => {
				throw Error('Accepted governor preparation was rolled back');
			},
		});

		game.register_event('base_governor_runtime_clear', {
			validate: (e) => {
				if (e.caller != e.data.base.get_owner().id) {
					return 'Only the base owner can clear governor test production';
				}
			},
			apply: (e) => {
				e.data.base.set_production_queue([]);
				e.game.trigger('base_governor_runtime_cleared', {base: e.data.base});
				return {};
			},
			rollback: (e) => {
				throw Error('Accepted governor queue clear was rolled back');
			},
		});

		game.on('base_governor_runtime_prepared', (e) => {
			manual_kind = e.kind;
			manual_id = e.id;
			initial_energy = e.base.get_owner().energy_credits;
			game.event('set_base_governor', {
				base: e.base,
				enabled: true,
				priority: 'discover',
			});
		});

		game.on('base_governor_changed', (e) => {
			if (!e.enabled || e.base.id != base_id) {
				return;
			}
			#async(100, () => {
				const base = find_base();
				const queue = base == null ? [] : base.get_production_queue();
				if (
					base == null || #sizeof(queue) == 0 ||
					queue[0].production_kind != manual_kind || queue[0].id != manual_id
				) {
					fail('governor replaced an existing manual production order');
					return;
				}
				game.event('base_governor_runtime_clear', {base: base});
			});
		});

		game.on('base_governor_runtime_cleared', (e) => {
			const managed = game.get('f_ai_manage_governed_bases')(e.base.get_owner());
			if (managed < 1) {
				fail('governed base was not included in production planning');
				return;
			}
			#async(50, verify_automated_production);
		});

		game.on('start_ui', (e) => {
			let base = null;
			for (candidate of game.get_bm().get_bases()) {
				if (candidate.get_owner().id == game.get_player().id) {
					base = candidate;
					break;
				}
			}
			if (base == null) {
				fail('local starting base is missing');
				return;
			}
			base_id = base.id;
			game.event('base_governor_runtime_prepare', {base: base});
		});
	});

	glsmac.run();

});
