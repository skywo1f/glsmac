#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	const fail = (message) => {
		#print('SMALL_MAP_FRONTEND_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
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
			}
			#print('SMALL_MAP_FRONTEND_RUNTIME_PASS');
			#async(100, () => { glsmac.exit(); });
		});
	});

	glsmac.run();

});
