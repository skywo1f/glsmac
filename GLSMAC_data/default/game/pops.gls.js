const define = (game, id, name, renders_human_x, renders_progenitor_x, properties) => {
	// TODO: if (!properties) { ... }
	let rh = [];
	for (x of renders_human_x) {
		rh :+{
			type: 'sprite',
			file: 'newicons.pcx',
			x: x, y: 501,
			w: 38, h: 48,
		};
	}
	let rp = [];
	for (x of renders_progenitor_x) {
		rp :+{
			type: 'sprite',
			file: 'aliencit.pcx',
			x: x, y: 41,
			w: 38, h: 48,
		};
	}
	game.event('define_base_pop', {
		id: id,
		def: {
			name: name,
			renders_human: rh,
			renders_progenitor: rp,
		} + properties
	});
};

const specialists = [
	{
		id: 'TECHNICIAN', name: 'Technician', required_technology: '',
		obsolete_technology: 'FusionPower', replacement: 'ENGINEER',
		economy: 3, psych: 0, labs: 0,
	},
	{
		id: 'DOCTOR', name: 'Doctor', required_technology: '',
		obsolete_technology: 'CentauriMeditation', replacement: 'EMPATH',
		economy: 0, psych: 2, labs: 0,
	},
	{
		id: 'LIBRARIAN', name: 'Librarian', required_technology: 'PlanetaryNetworks',
		obsolete_technology: 'MindMachineInterface', replacement: 'THINKER',
		economy: 0, psych: 0, labs: 3,
	},
	{
		id: 'ENGINEER', name: 'Engineer', required_technology: 'FusionPower',
		obsolete_technology: '', replacement: '', economy: 3, psych: 0, labs: 2,
	},
	{
		id: 'EMPATH', name: 'Empath', required_technology: 'CentauriMeditation',
		obsolete_technology: 'SecretsOfAlphaCentauri', replacement: 'TRANSCEND',
		economy: 2, psych: 2, labs: 0,
	},
	{
		id: 'THINKER', name: 'Thinker', required_technology: 'MindMachineInterface',
		obsolete_technology: 'SecretsOfAlphaCentauri', replacement: 'TRANSCEND',
		economy: 0, psych: 1, labs: 3,
	},
	{
		id: 'TRANSCEND', name: 'Transcend', required_technology: 'SecretsOfAlphaCentauri',
		obsolete_technology: '', replacement: '', economy: 2, psych: 2, labs: 4,
	},
];

let specialists_by_id = {};
for (specialist of specialists) {
	specialists_by_id[specialist.id] = specialist;
}

const is_available = (player, specialist) => {
	const has_technology = (technology_id) => {
		return technology_id != '' && player != null &&
			#typeof(player.has_technology) == 'Callable' &&
			player.has_technology(technology_id);
	};
	return (
		(specialist.required_technology == '' || has_technology(
			specialist.required_technology
		)) && !has_technology(specialist.obsolete_technology)
	);
};

const get_available = (player) => {
	let result = [];
	for (specialist of specialists) {
		if (is_available(player, specialist)) {
			result :+specialist;
		}
	}
	return result;
};

const get_default = (player) => {
	let result = null;
	for (specialist of get_available(player)) {
		const output = specialist.economy + specialist.psych + specialist.labs;
		const result_output = result == null
			? 0
			: result.economy + result.psych + result.labs;
		if (
			result == null || specialist.psych > result.psych ||
			(specialist.psych == result.psych && output > result_output)
		) {
			result = specialist;
		}
	}
	return result;
};

const get_next = (player, current_id) => {
	const available = get_available(player);
	if (#sizeof(available) == 0) {
		return null;
	}
	for (let i = 0; i < #sizeof(available); i++) {
		if (available[i].id == current_id) {
			return available[(i + 1) % #sizeof(available)];
		}
	}
	return available[0];
};

const get_replacement = (player, current_id) => {
	const current = #is_defined(specialists_by_id[current_id])
		? specialists_by_id[current_id]
		: null;
	if (current != null && current.replacement != '') {
		const replacement_id = current.replacement;
		const replacement = specialists_by_id[replacement_id];
		if (#is_defined(replacement) && is_available(player, replacement)) {
			return replacement;
		}
	}
	return get_default(player);
};

const normalize = (game, player) => {
	let snapshots = [];
	for (base of game.get_bm().get_bases()) {
		if (
			#typeof(base.get_owner) != 'Callable' ||
			#typeof(base.get_pops) != 'Callable' ||
			base.get_owner().id != player.id
		) {
			continue;
		}
		for (pop of base.get_pops()) {
			if (
				#typeof(pop.has) != 'Callable' ||
				#typeof(pop.get_type) != 'Callable' ||
				#typeof(pop.set_type) != 'Callable'
			) {
				continue;
			}
			if (pop.has('worked_tile')) {
				continue;
			}
			const type = pop.get_type();
			const specialist = #is_defined(specialists_by_id[type])
				? specialists_by_id[type]
				: null;
			if (specialist == null || !is_available(player, specialist)) {
				const replacement = get_replacement(player, type);
				if (replacement != null) {
					snapshots :+{pop: pop, type: type};
					pop.set_type(replacement.id);
				}
			}
		}
	}
	return snapshots;
};

const rollback_normalize = (snapshots) => {
	if (!#is_defined(snapshots)) {
		return;
	}
	for (let i = #sizeof(snapshots) - 1; i >= 0; i--) {
		snapshots[i].pop.set_type(snapshots[i].type);
	}
};

const get_yields = (base) => {
	let result = {economy: 0, psych: 0, labs: 0};
	for (pop of base.get_pops()) {
		if (
			#typeof(pop.has) != 'Callable' || #typeof(pop.get_type) != 'Callable' ||
			pop.has('worked_tile')
		) {
			continue;
		}
		const type = pop.get_type();
		const specialist = specialists_by_id[type];
		if (#is_defined(specialist)) {
			result.economy = result.economy + specialist.economy;
			result.psych = result.psych + specialist.psych;
			result.labs = result.labs + specialist.labs;
		}
	}
	return result;
};

const result = {
	specialists: specialists,
	get_definition: (id) => {
		return #is_defined(specialists_by_id[id]) ? specialists_by_id[id] : null;
	},
	get_available: get_available,
	get_default: get_default,
	get_next: get_next,
	get_replacement: get_replacement,
	get_yields: get_yields,
	is_available: is_available,
	normalize: normalize,
	rollback_normalize: rollback_normalize,

	define: (game) => {

		define(game, 'WORKER', 'Worker', [79, 118], [40], {tile_worker: true});
		define(game, 'TALENT', 'Talent', [1, 40], [1], {tile_worker: true});
		define(game, 'DOCTOR', 'Doctor', [352], [196], {});
		define(game, 'TECHNICIAN', 'Technician', [313], [157], {});
		define(game, 'LIBRARIAN', 'Librarian', [391], [235], {});
		define(game, 'ENGINEER', 'Engineer', [430], [274], {});
		define(game, 'EMPATH', 'Empath', [469], [313], {});
		define(game, 'THINKER', 'Thinker', [508], [352], {});
		define(game, 'TRANSCEND', 'Transcend', [547], [391], {});
		define(game, 'DRONE', 'Drone', [157, 196], [79], {});
		define(game, 'DRONEPLUS', 'Drone', [235, 274], [118], {});

	},
};

return result;
