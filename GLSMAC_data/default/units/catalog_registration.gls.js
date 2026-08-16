const get_known_technologies = (players) => {
	let known = {};
	for (player of players) {
		for (technology_id of player.get_research_state().technologies) {
			known[technology_id] = true;
		}
	}
	return known;
};

const has_new_technology = (known, player) => {
	for (technology_id of player.get_research_state().technologies) {
		if (!#is_defined(known[technology_id])) {
			return true;
		}
	}
	return false;
};

return {
	get_known_technologies: get_known_technologies,
	has_new_technology: has_new_technology,
};
