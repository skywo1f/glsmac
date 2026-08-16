#main((glsmac) => {

	let finished = false;
	const finish = (result) => {
		if (finished) { return; }
		finished = true;
		#print(result);
		glsmac.exit();
	};

	glsmac.on('mainmenu_show', (e) => {
		try {
			const canonical = glsmac.get_original_map_path('planet.MP');
			const normalized = glsmac.get_map_file_path('  ' + canonical + '  ');
			if (normalized == '') {
				finish('MAP_FILE_PATH_RUNTIME_FAIL: canonical path was empty');
				return;
			}

			let expansion_rejected = false;
			try {
				glsmac.get_map_file_path(glsmac.config.smacpath + '/maps/xplanet.MP');
			} catch {
			:
				(error) => { expansion_rejected = true; }
			}
			if (!expansion_rejected) {
				finish('MAP_FILE_PATH_RUNTIME_FAIL: Crossfire map was accepted');
				return;
			}

			let missing_rejected = false;
			try {
				glsmac.get_map_file_path('missing-map.gsm');
			} catch {
			:
				(error) => { missing_rejected = true; }
			}
			if (!missing_rejected) {
				finish('MAP_FILE_PATH_RUNTIME_FAIL: missing map was accepted');
				return;
			}

			let unknown_original_rejected = false;
			try {
				glsmac.get_original_map_path('xplanet.MP');
			} catch {
			:
				(error) => { unknown_original_rejected = true; }
			}
			if (!unknown_original_rejected) {
				finish('MAP_FILE_PATH_RUNTIME_FAIL: Crossfire menu map was accepted');
				return;
			}

			finish('MAP_FILE_PATH_RUNTIME_PASS');
		} catch {
		:
			(error) => {
				finish('MAP_FILE_PATH_RUNTIME_FAIL: ' + error.reason);
			}
		}
	});

	glsmac.run();

});
