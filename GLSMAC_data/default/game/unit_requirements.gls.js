const get_all = (def) => {
	if (#is_defined(def.required_technologies)) {
		return def.required_technologies;
	}
	if (
		#is_defined(def.required_technology) &&
		def.required_technology != ''
	) {
		return [def.required_technology];
	}
	return [];
};

const known_has_all = (known, def) => {
	for (technology_id of get_all(def)) {
		if (!#is_defined(known[technology_id])) {
			return false;
		}
	}
	return true;
};

const player_has_all = (player, def) => {
	for (technology_id of get_all(def)) {
		if (!player.has_technology(technology_id)) {
			return false;
		}
	}
	return true;
};

const requires = (def, technology_id) => {
	for (required_id of get_all(def)) {
		if (required_id == technology_id) {
			return true;
		}
	}
	return false;
};

const unlocked_by = (known, def, technology_id) => {
	if (!#is_defined(known)) {
		return requires(def, technology_id);
	}
	let requires_candidate = false;
	for (required_id of get_all(def)) {
		if (required_id == technology_id) {
			requires_candidate = true;
		} else if (!#is_defined(known[required_id])) {
			return false;
		}
	}
	return requires_candidate;
};

return {
	get_all: get_all,
	known_has_all: known_has_all,
	player_has_all: player_has_all,
	requires: requires,
	unlocked_by: unlocked_by,
};
