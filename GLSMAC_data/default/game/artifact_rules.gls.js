const LINKED_KEY = 'network_node_artifact_linked';
const technology_acquisition = #include('./technology_acquisition');

const is_node_linked = (base) => {
	const value = base.get(LINKED_KEY);
	return #is_defined(value) && value;
};

const get_study_method = (base) => {
	if (base.has_facility('TheUniversalTranslator')) {
		return 'universal_translator';
	}
	if (base.has_facility('NetworkNode') && !is_node_linked(base)) {
		return 'network_node';
	}
	return '';
};

const get_study_error = (game, unit, caller) => {
	if (unit.owner != caller) {
		return 'Alien Artifact can only be studied by its owner';
	}
	if (game.is_turn_complete(caller)) {
		return 'Player has already completed this turn';
	}
	if (unit.health <= 0.0) {
		return 'Destroyed Alien Artifact cannot be studied';
	}
	if (#is_defined(unit.transport_id) && unit.transport_id > 0) {
		return 'Embarked Alien Artifact cannot be studied';
	}
	if (unit.get_def().weapon != 'AlienArtifact') {
		return 'Unit is not an Alien Artifact';
	}
	const base = unit.get_tile().get_base();
	if (base == null) {
		return 'Alien Artifact must be inside a base';
	}
	if (base.get_owner().id != caller) {
		return 'Alien Artifact must be inside an owned base';
	}
	if (get_study_method(base) == '') {
		return base.has_facility('NetworkNode')
			? 'This Network Node has already studied an Alien Artifact'
			: 'Base needs an unused Network Node or The Universal Translator';
	}
	if (!technology_acquisition.can_grant(game, base.get_owner())) {
		return 'No technology remains to discover';
	}
};

return {
	linked_key: LINKED_KEY,
	is_node_linked: is_node_linked,
	get_study_method: get_study_method,
	get_study_error: get_study_error,
};
