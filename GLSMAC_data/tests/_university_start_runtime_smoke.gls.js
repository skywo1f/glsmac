#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let exited = false;
	const fail = (message) => {
		if (exited) {
			return;
		}
		exited = true;
		#print('UNIVERSITY_START_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.on('start_ui', (event) => {
			const player = game.get_player();
			if (player.get_faction().id != 'UNIVERSITY') {
				fail('requested University faction was not assigned');
				return;
			}
			const state = player.get_research_state();
			if (#sizeof(state.technologies) != 2 || !player.has_technology('InformationNetworks')) {
			if (player.get_energy_credits() != 10) {
				fail('University starting energy is not 10');
				return;
			}
			let starting_base = null;
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == player.id) {
					starting_base = base;
					break;
				}
			}
			if (starting_base == null || !starting_base.has_facility('NetworkNode')) {
				fail('University starting base has no free Network Node');
				return;
			}
				let actual = '';
				for (id of state.technologies) {
					actual += (actual == '' ? '' : ',') + id;
				}
				fail(
					'fixed and bonus starting technology count is invalid: [' + actual + ']'
				);
				return;
			}
			const get_available = game.get('f_technology_get_available_targets');
			let bonus = '';
			for (id of state.technologies) {
				if (id != 'InformationNetworks') {
					bonus = id;
				}
			}
			let bonus_is_available = false;
			for (id of get_available(['InformationNetworks'])) {
				if (id == bonus) {
					bonus_is_available = true;
					break;
				}
			}
			if (!bonus_is_available || !player.has_technology(bonus)) {
				fail('bonus technology was not an available random discovery');
				return;
			}
			let target_is_available = false;
			for (id of get_available(state.technologies)) {
				if (id == state.target) {
					target_is_available = true;
					break;
				}
			}
			if (!target_is_available || state.progress != 0 || state.cost != 2) {
				fail('initial research target is invalid after the bonus discovery');
				return;
			}
			exited = true;
			#print(
				'UNIVERSITY_START_RUNTIME_PASS: bonus=' + bonus +
				' target=' + state.target
			);
			glsmac.exit();
		});
	});

	glsmac.run();

});
