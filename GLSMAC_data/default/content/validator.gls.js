const MAX_DEFINITION_VALUE = 1000000;

const technology_fields = {
	id: true,
	name: true,
	cost: true,
	prerequisites: true,
};

const facility_fields = {
	name: true,
	mineral_cost: true,
	nutrient_bonus: true,
	mineral_bonus: true,
	energy_bonus: true,
	energy_maintenance: true,
	required_technology: true,
	psych_bonus: true,
	research_multiplier: true,
	defense_multiplier: true,
	economy_multiplier: true,
	unit_morale_bonus: true,
	research_bonus: true,
};

const unit_fields = {
	name: true,
	mineral_cost: true,
	is_native: true,
	offense: true,
	defense: true,
	can_found_base: true,
	can_terraform: true,
	required_technology: true,
	morale: true,
	type: true,
	movement_type: true,
	movement_per_turn: true,
	render: true,
};

const unit_render_fields = {
	type: true,
	file: true,
	x: true,
	y: true,
	w: true,
	h: true,
	cx: true,
	cy: true,
	morale_based_xshift: true,
};

const faction_fields = {
	starting_technologies: true,
	is_naval: true,
	is_progenitor: true,
};

const add_error = (errors, path, message) => {
	errors :+path + ': ' + message;
};

const is_number = (value) => {
	return #typeof(value) == 'Int' || #typeof(value) == 'Float';
};

const validate_string = (object, key, path, errors, required) => {
	if (!#is_defined(object[key])) {
		if (required) {
			add_error(errors, path + '.' + key, 'is required');
		}
		return;
	}
	if (#typeof(object[key]) != 'String' || object[key] == '') {
		add_error(errors, path + '.' + key, 'must be a non-empty string');
	}
};

const validate_optional_string = (object, key, path, errors) => {
	if (#is_defined(object[key]) && #typeof(object[key]) != 'String') {
		add_error(errors, path + '.' + key, 'must be a string');
	}
};

const validate_int = (object, key, path, errors, required, minimum, maximum) => {
	if (!#is_defined(object[key])) {
		if (required) {
			add_error(errors, path + '.' + key, 'is required');
		}
		return;
	}
	if (
		#typeof(object[key]) != 'Int' ||
		object[key] < minimum ||
		object[key] > maximum
	) {
		add_error(
			errors,
			path + '.' + key,
			'must be an integer from ' + #to_string(minimum) + ' through ' + #to_string(maximum)
		);
	}
};

const validate_number = (object, key, path, errors, required, minimum, maximum) => {
	if (!#is_defined(object[key])) {
		if (required) {
			add_error(errors, path + '.' + key, 'is required');
		}
		return;
	}
	if (!is_number(object[key])) {
		add_error(errors, path + '.' + key, 'must be a number');
		return;
	}
	const value = #to_float(object[key]);
	if (value < minimum || value > maximum) {
		add_error(
			errors,
			path + '.' + key,
			'must be a number from ' + #to_string(minimum) + ' through ' + #to_string(maximum)
		);
	}
};

const validate_bool = (object, key, path, errors, required) => {
	if (!#is_defined(object[key])) {
		if (required) {
			add_error(errors, path + '.' + key, 'is required');
		}
		return;
	}
	if (#typeof(object[key]) != 'Bool') {
		add_error(errors, path + '.' + key, 'must be a boolean');
	}
};

const validate_known_fields = (object, allowed, path, errors) => {
	for (key in object) {
		if (!#is_defined(allowed[key])) {
			add_error(errors, path + '.' + key, 'is not a supported field');
		}
	}
};

const validate_technologies = (definitions, order, errors) => {
	let count = 0;
	if (#typeof(definitions) != 'Object') {
		add_error(errors, 'technologies.definitions', 'must be an object');
		return count;
	}
	if (#typeof(order) != 'Array') {
		add_error(errors, 'technologies.order', 'must be an array');
		return count;
	}

	let ordered = {};
	let graph_is_valid = true;
	for (let i = 0; i < #sizeof(order); i++) {
		const id = order[i];
		const path = 'technologies.order[' + #to_string(i) + ']';
		if (#typeof(id) != 'String' || id == '') {
			add_error(errors, path, 'must contain a non-empty technology id');
			graph_is_valid = false;
			continue;
		}
		if (#is_defined(ordered[id])) {
			add_error(errors, path, 'duplicates technology ' + id);
			graph_is_valid = false;
			continue;
		}
		ordered[id] = true;
		if (!#is_defined(definitions[id])) {
			add_error(errors, path, 'references missing technology ' + id);
			graph_is_valid = false;
		}
	}

	for (id in definitions) {
		count++;
		const definition = definitions[id];
		const path = 'technologies.' + id;
		if (!#is_defined(ordered[id])) {
			add_error(errors, path, 'is not listed in technologies.order');
			graph_is_valid = false;
		}
		if (#typeof(definition) != 'Object') {
			add_error(errors, path, 'must be an object');
			graph_is_valid = false;
			continue;
		}
		validate_known_fields(definition, technology_fields, path, errors);
		validate_string(definition, 'id', path, errors, true);
		if (#is_defined(definition.id) && definition.id != id) {
			add_error(errors, path + '.id', 'must match catalog key ' + id);
		}
		validate_string(definition, 'name', path, errors, true);
		validate_int(definition, 'cost', path, errors, true, 1, MAX_DEFINITION_VALUE);
		if (#typeof(definition.prerequisites) != 'Array') {
			add_error(errors, path + '.prerequisites', 'must be an array');
			graph_is_valid = false;
			continue;
		}
		let seen_prerequisites = {};
		for (let i = 0; i < #sizeof(definition.prerequisites); i++) {
			const prerequisite = definition.prerequisites[i];
			const prerequisite_path = path + '.prerequisites[' + #to_string(i) + ']';
			if (#typeof(prerequisite) != 'String' || prerequisite == '') {
				add_error(errors, prerequisite_path, 'must contain a non-empty technology id');
				graph_is_valid = false;
				continue;
			}
			if (#is_defined(seen_prerequisites[prerequisite])) {
				add_error(errors, prerequisite_path, 'duplicates prerequisite ' + prerequisite);
				graph_is_valid = false;
			}
			seen_prerequisites[prerequisite] = true;
			if (prerequisite == id) {
				add_error(errors, prerequisite_path, 'cannot reference itself');
				graph_is_valid = false;
			} else if (!#is_defined(definitions[prerequisite])) {
				add_error(errors, prerequisite_path, 'references missing technology ' + prerequisite);
				graph_is_valid = false;
			}
		}
	}

	if (graph_is_valid) {
		let resolved = {};
		let resolved_count = 0;
		let changed = true;
		while (changed) {
			changed = false;
			for (id of order) {
				if (#is_defined(resolved[id])) {
					continue;
				}
				let ready = true;
				for (prerequisite of definitions[id].prerequisites) {
					if (!#is_defined(resolved[prerequisite])) {
						ready = false;
						break;
					}
				}
				if (ready) {
					resolved[id] = true;
					resolved_count++;
					changed = true;
				}
			}
		}
		if (resolved_count != #sizeof(order)) {
			let blocked = '';
			for (id of order) {
				if (!#is_defined(resolved[id])) {
					blocked = blocked == '' ? id : blocked + ', ' + id;
				}
			}
			add_error(errors, 'technologies', 'dependency cycle prevents resolution of: ' + blocked);
		}
	}

	return count;
};

const validate_facilities = (facilities, technologies, errors) => {
	let count = 0;
	if (#typeof(facilities) != 'Array') {
		add_error(errors, 'facilities', 'must be an array');
		return count;
	}
	let seen = {};
	for (let i = 0; i < #sizeof(facilities); i++) {
		const entry = facilities[i];
		const index_path = 'facilities[' + #to_string(i) + ']';
		if (#typeof(entry) != 'Object') {
			add_error(errors, index_path, 'must be an object');
			continue;
		}
		if (#typeof(entry.id) != 'String' || entry.id == '') {
			add_error(errors, index_path + '.id', 'must be a non-empty string');
			continue;
		}
		const path = 'facilities.' + entry.id;
		if (#is_defined(seen[entry.id])) {
			add_error(errors, path, 'duplicates facility id ' + entry.id);
			continue;
		}
		seen[entry.id] = true;
		count++;
		if (#typeof(entry.data) != 'Object') {
			add_error(errors, path + '.data', 'must be an object');
			continue;
		}
		const data = entry.data;
		validate_known_fields(data, facility_fields, path, errors);
		validate_string(data, 'name', path, errors, true);
		validate_int(data, 'mineral_cost', path, errors, true, 1, MAX_DEFINITION_VALUE);
		validate_int(data, 'nutrient_bonus', path, errors, true, 0, MAX_DEFINITION_VALUE);
		validate_int(data, 'mineral_bonus', path, errors, true, 0, MAX_DEFINITION_VALUE);
		validate_int(data, 'energy_bonus', path, errors, true, 0, MAX_DEFINITION_VALUE);
		validate_int(data, 'energy_maintenance', path, errors, true, 0, MAX_DEFINITION_VALUE);
		validate_int(data, 'psych_bonus', path, errors, false, 0, MAX_DEFINITION_VALUE);
		validate_number(data, 'research_multiplier', path, errors, false, 0.0, 10.0);
		validate_number(data, 'defense_multiplier', path, errors, false, 1.0, 10.0);
		validate_number(data, 'economy_multiplier', path, errors, false, 0.0, 10.0);
		validate_int(data, 'unit_morale_bonus', path, errors, false, 0, 10);
		validate_int(data, 'research_bonus', path, errors, false, 0, MAX_DEFINITION_VALUE);
		validate_optional_string(data, 'required_technology', path, errors);
		if (
			#is_defined(data.required_technology) &&
			data.required_technology != '' &&
			!#is_defined(technologies[data.required_technology])
		) {
			add_error(
				errors,
				path + '.required_technology',
				'references missing technology ' + data.required_technology
			);
		}
		const has_effect =
			data.nutrient_bonus > 0 ||
			data.mineral_bonus > 0 ||
			data.energy_bonus > 0 ||
			(#is_defined(data.psych_bonus) && data.psych_bonus > 0) ||
			(#is_defined(data.research_multiplier) && data.research_multiplier > 0.0) ||
			(#is_defined(data.defense_multiplier) && data.defense_multiplier > 1.0) ||
			(#is_defined(data.economy_multiplier) && data.economy_multiplier > 0.0) ||
			(#is_defined(data.unit_morale_bonus) && data.unit_morale_bonus > 0) ||
			(#is_defined(data.research_bonus) && data.research_bonus > 0);
		if (!has_effect) {
			add_error(errors, path, 'has no implemented gameplay effect');
		}
	}
	return count;
};

const validate_moralesets = (moralesets, errors) => {
	let count = 0;
	let ids = {};
	if (#typeof(moralesets) != 'Array') {
		add_error(errors, 'moralesets', 'must be an array');
		return {count: count, ids: ids};
	}
	for (let i = 0; i < #sizeof(moralesets); i++) {
		const entry = moralesets[i];
		const index_path = 'moralesets[' + #to_string(i) + ']';
		if (#typeof(entry) != 'Object' || #typeof(entry.id) != 'String' || entry.id == '') {
			add_error(errors, index_path, 'must have a non-empty id');
			continue;
		}
		const path = 'moralesets.' + entry.id;
		if (#is_defined(ids[entry.id])) {
			add_error(errors, path, 'duplicates morale set id ' + entry.id);
			continue;
		}
		ids[entry.id] = true;
		count++;
		if (#typeof(entry.data) != 'Array' || #sizeof(entry.data) != 7) {
			add_error(errors, path + '.data', 'must contain exactly seven morale levels');
			continue;
		}
		for (let level = 0; level < #sizeof(entry.data); level++) {
			const level_path = path + '.data[' + #to_string(level) + ']';
			if (#typeof(entry.data[level]) != 'Object') {
				add_error(errors, level_path, 'must be an object');
				continue;
			}
			validate_string(entry.data[level], 'name', level_path, errors, true);
		}
	}
	return {count: count, ids: ids};
};

const validate_unit_render = (render, path, errors) => {
	if (#typeof(render) != 'Object') {
		add_error(errors, path, 'must be an object');
		return;
	}
	validate_known_fields(render, unit_render_fields, path, errors);
	validate_string(render, 'type', path, errors, true);
	if (#is_defined(render.type) && render.type != 'sprite') {
		add_error(errors, path + '.type', 'must be sprite');
	}
	validate_string(render, 'file', path, errors, true);
	for (field of ['x', 'y', 'w', 'h', 'cx', 'cy']) {
		validate_int(render, field, path, errors, true, 0, MAX_DEFINITION_VALUE);
	}
	validate_int(render, 'morale_based_xshift', path, errors, false, 0, MAX_DEFINITION_VALUE);
};

const validate_units = (units, technologies, morale_ids, errors) => {
	let count = 0;
	if (#typeof(units) != 'Array') {
		add_error(errors, 'units', 'must be an array');
		return count;
	}
	let seen = {};
	const movement_types = {immovable: true, land: true, water: true, air: true};
	for (let i = 0; i < #sizeof(units); i++) {
		const entry = units[i];
		const index_path = 'units[' + #to_string(i) + ']';
		if (#typeof(entry) != 'Object' || #typeof(entry.id) != 'String' || entry.id == '') {
			add_error(errors, index_path, 'must have a non-empty id');
			continue;
		}
		const path = 'units.' + entry.id;
		if (#is_defined(seen[entry.id])) {
			add_error(errors, path, 'duplicates unit id ' + entry.id);
			continue;
		}
		seen[entry.id] = true;
		count++;
		if (#typeof(entry.data) != 'Object') {
			add_error(errors, path + '.data', 'must be an object');
			continue;
		}
		const data = entry.data;
		validate_known_fields(data, unit_fields, path, errors);
		validate_string(data, 'name', path, errors, true);
		validate_int(data, 'mineral_cost', path, errors, true, 0, MAX_DEFINITION_VALUE);
		validate_bool(data, 'is_native', path, errors, true);
		validate_int(data, 'offense', path, errors, true, 0, MAX_DEFINITION_VALUE);
		validate_int(data, 'defense', path, errors, true, 0, MAX_DEFINITION_VALUE);
		validate_bool(data, 'can_found_base', path, errors, false);
		validate_bool(data, 'can_terraform', path, errors, false);
		validate_optional_string(data, 'required_technology', path, errors);
		if (
			#is_defined(data.required_technology) &&
			data.required_technology != '' &&
			!#is_defined(technologies[data.required_technology])
		) {
			add_error(
				errors,
				path + '.required_technology',
				'references missing technology ' + data.required_technology
			);
		}
		validate_string(data, 'morale', path, errors, true);
		if (#is_defined(data.morale) && !#is_defined(morale_ids[data.morale])) {
			add_error(errors, path + '.morale', 'references missing morale set ' + data.morale);
		}
		validate_string(data, 'type', path, errors, true);
		if (#is_defined(data.type) && data.type != 'static') {
			add_error(errors, path + '.type', 'must be static');
		}
		validate_string(data, 'movement_type', path, errors, true);
		if (#is_defined(data.movement_type) && !#is_defined(movement_types[data.movement_type])) {
			add_error(errors, path + '.movement_type', 'is not supported');
		}
		validate_number(data, 'movement_per_turn', path, errors, true, 0.0, 1000.0);
		validate_unit_render(data.render, path + '.render', errors);
	}
	return count;
};

const validate_factions = (factions, technologies, errors) => {
	let count = 0;
	if (#typeof(factions) != 'Array') {
		add_error(errors, 'factions', 'must be an array');
		return count;
	}
	let seen = {};
	for (let i = 0; i < #sizeof(factions); i++) {
		const entry = factions[i];
		const index_path = 'factions[' + #to_string(i) + ']';
		if (#typeof(entry) != 'Object' || #typeof(entry.id) != 'String' || entry.id == '') {
			add_error(errors, index_path, 'must have a non-empty id');
			continue;
		}
		const path = 'factions.' + entry.id;
		if (#is_defined(seen[entry.id])) {
			add_error(errors, path, 'duplicates faction id ' + entry.id);
			continue;
		}
		seen[entry.id] = true;
		count++;
		validate_string(entry, 'name', path, errors, true);
		validate_string(entry, 'resource', path, errors, true);
		if (#typeof(entry.data) != 'Object') {
			add_error(errors, path + '.data', 'must be an object');
			continue;
		}
		validate_known_fields(entry.data, faction_fields, path, errors);
		validate_bool(entry.data, 'is_naval', path, errors, false);
		validate_bool(entry.data, 'is_progenitor', path, errors, false);
		if (#typeof(entry.data.starting_technologies) != 'Array') {
			add_error(errors, path + '.starting_technologies', 'must be an array');
			continue;
		}
		let starting = {};
		for (let tech_index = 0; tech_index < #sizeof(entry.data.starting_technologies); tech_index++) {
			const technology = entry.data.starting_technologies[tech_index];
			const technology_path = path + '.starting_technologies[' + #to_string(tech_index) + ']';
			if (#typeof(technology) != 'String' || technology == '') {
				add_error(errors, technology_path, 'must contain a non-empty technology id');
				continue;
			}
			if (#is_defined(starting[technology])) {
				add_error(errors, technology_path, 'duplicates starting technology ' + technology);
			}
			starting[technology] = true;
			if (!#is_defined(technologies[technology])) {
				add_error(errors, technology_path, 'references missing technology ' + technology);
			}
		}
	}
	return count;
};

const validate = (catalog) => {
	let errors = [];
	const technology_count = validate_technologies(
		catalog.technologies.definitions,
		catalog.technologies.order,
		errors
	);
	const morale_result = validate_moralesets(catalog.moralesets, errors);
	const facility_count = validate_facilities(
		catalog.facilities,
		catalog.technologies.definitions,
		errors
	);
	const unit_count = validate_units(
		catalog.units,
		catalog.technologies.definitions,
		morale_result.ids,
		errors
	);
	const faction_count = validate_factions(
		catalog.factions,
		catalog.technologies.definitions,
		errors
	);
	return {
		errors: errors,
		counts: {
			technologies: technology_count,
			facilities: facility_count,
			units: unit_count,
			moralesets: morale_result.count,
			factions: faction_count,
		},
	};
};

return {
	validate: validate,
};
