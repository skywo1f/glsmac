const ECOLOGICAL_IMPROVEMENTS = [
	'road', 'mag_tube', 'farm', 'soil_enricher', 'mine', 'solar',
	'condenser', 'mirror', 'borehole',
];

const has_facility = (facilities, id) => {
	return #is_defined(facilities[id]) && facilities[id];
};

const calculate = (context) => {
	let terraforming_raw = 0;
	for (tile of context.tiles) {
		const multiplier = tile.worked ? 2 : 1;
		for (id of ECOLOGICAL_IMPROVEMENTS) {
			if (tile.terraforming[id]) {
				terraforming_raw += multiplier;
			}
		}
		if (tile.terraforming.borehole) {
			terraforming_raw += 8;
		}
		if (tile.terraforming.mirror) {
			terraforming_raw += 6;
		}
		if (tile.terraforming.condenser) {
			terraforming_raw += 4;
		}
		if (tile.terraforming.forest) {
			terraforming_raw--;
		}
	}

	let terraforming_after_facilities = terraforming_raw;
	if (has_facility(context.facilities, 'TreeFarm')) {
		terraforming_after_facilities = has_facility(context.facilities, 'HybridForest')
			? 0
			: #floor(#to_float(terraforming_after_facilities) / 2.0);
	}
	const terraforming_before_clean = #max(
		#floor(#to_float(terraforming_after_facilities) / 8.0),
		0
	);
	const clean_allowance = 16 + context.previous_damages;
	const clean_terraforming = #min(terraforming_before_clean, clean_allowance);
	const terraforming_damage = terraforming_before_clean - clean_terraforming;
	const clean_minerals = #min(
		#max(context.minerals, 0),
		clean_allowance - clean_terraforming
	);
	const minerals_after_clean = #max(context.minerals - clean_minerals, 0);
	let facility_divisor = 1;
	for (id of ['CentauriPreserve', 'TempleOfPlanet', 'Nanoreplicator']) {
		if (has_facility(context.facilities, id)) {
			facility_divisor++;
		}
	}
	const mineral_damage = #floor(
		#to_float(minerals_after_clean) / #to_float(facility_divisor)
	);
	const value_before_perihelion = terraforming_damage + mineral_damage +
		context.major_atrocities * 5;
	const value = context.perihelion ? value_before_perihelion * 2 : value_before_perihelion;
	const percent = #max(#floor(
		#to_float(
			value * context.difficulty * context.technologies *
			(3 - context.planet) * context.life
		) / 300.0
	), 0);

	return {
		terraforming_raw: terraforming_raw,
		terraforming_after_facilities: terraforming_after_facilities,
		terraforming_before_clean: terraforming_before_clean,
		clean_allowance: clean_allowance,
		clean_terraforming: clean_terraforming,
		terraforming_damage: terraforming_damage,
		minerals: context.minerals,
		clean_minerals: clean_minerals,
		minerals_after_clean: minerals_after_clean,
		facility_divisor: facility_divisor,
		mineral_damage: mineral_damage,
		value_before_perihelion: value_before_perihelion,
		value: value,
		percent: percent,
	};
};

const get_life_level = (native_lifeforms) => {
	if (native_lifeforms <= 0.0) {
		return 0;
	}
	return #max(1, #min(3, #round(native_lifeforms * 4.0)));
};

const is_perihelion = (year) => {
	return year >= 2190 && (year - 2190) % 80 < 20;
};

const get_effective_facilities = (game, base) => {
	const resolver = game.get('f_base_get_effective_facilities');
	return #is_defined(resolver) ? resolver(base) : base.get_facilities();
};

const get_base_damage = (game, base) => {
	const owner = base.get_owner();
	let tiles = [];
	for (tile of base.get_workable_tiles()) {
		tiles :+{
			terraforming: tile.terraforming,
			worked: base.is_tile_worked(tile),
		};
	}
	let facility_ids = {};
	for (facility of get_effective_facilities(game, base)) {
		facility_ids[facility.id] = true;
	}
	const ratings_resolver = game.get('f_social_get_ratings');
	const ratings = #is_defined(ratings_resolver) ? ratings_resolver(owner) : {planet: 0};
	const settings = game.get_settings().global;
	const difficulty_level = #is_defined(owner.difficulty_level)
		? owner.difficulty_level
		: settings.difficulty_level;
	return calculate({
		tiles: tiles,
		facilities: facility_ids,
		minerals: base.get_intake().MINERALS,
		previous_damages: owner.get_ecological_damage_events(),
		major_atrocities: owner.get_major_atrocities(),
		technologies: #sizeof(owner.get_research_state().technologies),
		planet: ratings.planet,
		life: get_life_level(settings.map.native_lifeforms),
		difficulty: difficulty_level == 'Thinker' || difficulty_level == 'Transcend' ? 5 : 3,
		perihelion: is_perihelion(game.get_year()),
	});
};

const get_tile_key = (tile) => {
	return #to_string(tile.x) + '_' + #to_string(tile.y);
};

const select_bloom_tile = (game, base, reserved_tiles) => {
	let candidates = [];
	for (tile of base.get_workable_tiles()) {
		const key = get_tile_key(tile);
		if (
			tile.get_base() == null &&
			!tile.features.monolith &&
			!tile.features.xenofungus &&
			!#is_defined(reserved_tiles[key])
		) {
			candidates :+tile;
		}
	}
	if (#sizeof(candidates) == 0) {
		return null;
	}
	const index = game.random.get_int(0, #sizeof(candidates) - 1);
	return candidates[index];
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_ecology_calculate', calculate);
		game.set('f_ecology_get_base_damage', (base) => { return get_base_damage(game, base); });
		game.set('f_ecology_get_life_level', get_life_level);
		game.set('f_ecology_is_perihelion', is_perihelion);

		game.on('turn', (e) => {
			if (!game.is_master()) {
				return;
			}
			let reserved_tiles = {};
			for (base of game.get_bm().get_bases()) {
				const damage = get_base_damage(game, base);
				if (
					damage.percent > 0 &&
					game.random.get_int(0, 99) < damage.percent
				) {
					const tile = select_bloom_tile(game, base, reserved_tiles);
					if (tile != null) {
						const key = get_tile_key(tile);
						reserved_tiles[key] = true;
						game.event('fungal_bloom', {
							base: base,
							tile: tile,
							damage: damage.percent,
						});
					}
				}
			}
		});
	});
};
