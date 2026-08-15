const technologies = #include('../content/base_technologies');
const pops = #include('pops');

const is_first_discoverer = (game, player, technology_id) => {
	if (#typeof(game.get_players) != 'Callable') {
		return true;
	}
	for (other of game.get_players()) {
		if (
			other.id != player.id && #typeof(other.has_technology) == 'Callable' &&
			other.has_technology(technology_id)
		) {
			return false;
		}
	}
	return true;
};

const grants_first_discoverer_technology = (game, player, technology_id) => {
	const definition = technologies.definitions[technology_id];
	return #is_defined(definition) &&
		definition.free_technology_for_first_discoverer &&
		is_first_discoverer(game, player, technology_id);
};

const apply_map_reveals = (game, player, technology_ids) => {
	let snapshots = [];
	let revealing_ids = [];
	for (technology_id of technology_ids) {
		const definition = technologies.definitions[technology_id];
		if (#is_defined(definition) && definition.reveals_map) {
			revealing_ids :+technology_id;
		}
	}
	if (#sizeof(revealing_ids) == 0) {
		return snapshots;
	}
	const get_tiles = game.get('f_exploration_get_all_tiles');
	const apply_reveal = game.get('f_exploration_apply_reveal');
	if (#typeof(get_tiles) != 'Callable' || #typeof(apply_reveal) != 'Callable') {
		return snapshots;
	}
	for (technology_id of revealing_ids) {
		snapshots :+apply_reveal(player, get_tiles());
	}
	return snapshots;
};

const rollback_map_reveals = (game, snapshots) => {
	if (!#is_defined(snapshots) || #sizeof(snapshots) == 0) {
		return;
	}
	const rollback_reveal = game.get('f_exploration_rollback_reveal');
	if (#typeof(rollback_reveal) != 'Callable') {
		return;
	}
	for (let i = #sizeof(snapshots) - 1; i >= 0; i--) {
		rollback_reveal(snapshots[i]);
	}
};

const apply_specialist_updates = (game, player) => {
	return #typeof(game.get_bm) == 'Callable' ? pops.normalize(game, player) : [];
};

const rollback_specialist_updates = (snapshots) => {
	pops.rollback_normalize(snapshots);
};

return {
	is_first_discoverer: is_first_discoverer,
	grants_first_discoverer_technology: grants_first_discoverer_technology,
	apply_map_reveals: apply_map_reveals,
	rollback_map_reveals: rollback_map_reveals,
	apply_specialist_updates: apply_specialist_updates,
	rollback_specialist_updates: rollback_specialist_updates,
};
