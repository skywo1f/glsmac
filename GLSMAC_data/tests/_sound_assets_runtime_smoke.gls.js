#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	glsmac.on('configure_game', (e) => {
		e.game.on('start_ui', (event) => {
			for (sound of [
				'alien non military.wav',
				'strine c4.wav',
				'wpn missile launcher.wav',
				'wpn singularity laser.wav',
				'wpn spore launcher.wav',
			]) {
				glsmac.ui.root.sound({sound: sound});
			}
			#print('SOUND_ASSETS_RUNTIME_PASS');
			glsmac.exit();
		});
	});

	glsmac.run();

});
