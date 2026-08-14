const MAJOR_ERUPTION_EVENT = 14;
const RANDOM_EVENT_COUNT = 22;
const MAJOR_ERUPTION_YEAR = 2175;
const MAJOR_ERUPTION_BASES = 8;
const MAJOR_ERUPTION_DISTANCE = 5;

const get_all_tiles = (tm) => {
	let result = [];
	for (let y = 0; y < tm.get_map_height(); y++) {
		for (let x = y % 2; x < tm.get_map_width(); x += 2) {
			result :+tm.get_tile(x, y);
		}
	}
	return result;
};

const find_mount_planet_center = (tm) => {
	let result = null;
	for (tile of get_all_tiles(tm)) {
		if (
			#is_defined(tile.landmarks) && tile.landmarks.mount_planet &&
			(
				result == null || tile.elevation > result.elevation ||
				(tile.elevation == result.elevation && tile.y < result.y) ||
				(tile.elevation == result.elevation && tile.y == result.y && tile.x < result.x)
			)
		) {
			result = tile;
		}
	}
	return result;
};

const get_player_bases = (bases, player_id) => {
	let result = [];
	for (base of bases) {
		if (base.get_owner().id == player_id) {
			result :+base;
		}
	}
	return result;
};

const select_major_eruption = (game) => {
	if (game.get_year() < MAJOR_ERUPTION_YEAR) {
		return null;
	}
	const bases = game.get_bm().get_bases();
	if (#sizeof(bases) == 0) {
		return null;
	}
	const base_roll = game.random.get_int(0, #max(100, #sizeof(bases)) - 1);
	if (base_roll >= #sizeof(bases)) {
		return null;
	}
	const base = bases[base_roll];
	const owner = base.get_owner();
	const owner_bases = get_player_bases(bases, owner.id);
	if (base.get_size() <= 3 || #sizeof(owner_bases) <= 1) {
		return null;
	}
	if (game.random.get_int(0, RANDOM_EVENT_COUNT - 1) != MAJOR_ERUPTION_EVENT) {
		return null;
	}
	if (#sizeof(owner_bases) < MAJOR_ERUPTION_BASES) {
		return null;
	}
	const mount_planet = find_mount_planet_center(game.get_tm());
	if (
		mount_planet == null ||
		game.get_tm().get_distance(base.get_tile(), mount_planet) > MAJOR_ERUPTION_DISTANCE ||
		!owner.has_explored(mount_planet)
	) {
		return null;
	}
	return base;
};

const advance_dust_cloud = (tm) => {
	const state = tm.get_climate_state();
	const previous = #is_defined(state.dust_cloud_duration)
		? state.dust_cloud_duration
		: 0;
	if (previous <= 0) {
		return {previous: previous, current: 0, ended: false};
	}
	const current = previous - 1;
	tm.set_dust_cloud_duration(current);
	return {previous: previous, current: current, ended: current == 0};
};

return (game) => {
	game.register_event('advance_dust_cloud', {
		validate: (e) => {
			if (e.caller != 0) {
				return 'Only the host can advance the global dust cloud';
			}
		},
		apply: (e) => {
			const result = advance_dust_cloud(e.game.get_tm());
			if (result.ended) {
				e.game.message(
					'The global dust cloud has dispersed. Energy production has returned to normal.'
				);
			}
			return result.previous;
		},
		rollback: (e) => {
			e.game.get_tm().set_dust_cloud_duration(e.applied);
		},
	});

	game.on('start', (e) => {
		game.set('f_random_events_find_mount_planet_center', (tm) => {
			return find_mount_planet_center(tm);
		});
		game.set('f_random_events_select_major_eruption', () => {
			return select_major_eruption(game);
		});
		game.set('f_random_events_advance_dust_cloud', () => {
			return advance_dust_cloud(game.get_tm());
		});

		game.on('turn', (e) => {
			if ((#is_defined(e.initial) && e.initial) || !game.is_master()) {
				return;
			}
			const climate = game.get_tm().get_climate_state();
			if (
				#is_defined(climate.dust_cloud_duration) &&
				climate.dust_cloud_duration > 0
			) {
				game.event('advance_dust_cloud', {});
			}
			const base = select_major_eruption(game);
			if (base != null) {
				game.event('major_volcanic_eruption', {base: base});
			}
		});
	});
};
