const ENABLED_KEY = 'governor_enabled';
const PRIORITY_KEY = 'governor_priority';
const PRIORITIES = ['explore', 'discover', 'build', 'conquer'];
const DEFAULT_PRIORITY = 'build';

const is_priority = (priority) => {
	for (candidate of PRIORITIES) {
		if (candidate == priority) {
			return true;
		}
	}
	return false;
};

const is_enabled = (base) => {
	return base.has(ENABLED_KEY) && base.get(ENABLED_KEY) == true;
};

const get_priority = (base) => {
	if (base.has(PRIORITY_KEY)) {
		const priority = base.get(PRIORITY_KEY);
		if (#typeof(priority) == 'String' && is_priority(priority)) {
			return priority;
		}
	}
	return DEFAULT_PRIORITY;
};

const get_next_priority = (priority, direction) => {
	let index = 0;
	for (let i = 0; i < #sizeof(PRIORITIES); i++) {
		if (PRIORITIES[i] == priority) {
			index = i;
			break;
		}
	}
	index += direction < 0 ? 0 - 1 : 1;
	if (index < 0) {
		index = #sizeof(PRIORITIES) - 1;
	} else if (index >= #sizeof(PRIORITIES)) {
		index = 0;
	}
	return PRIORITIES[index];
};

const apply_priority = (priorities, priority) => {
	const result = #clone(priorities);
	switch (priority) {
		case 'explore': {
			result.expansion = 100;
			result.terraforming = #max(result.terraforming, 90);
			result.mobility = #max(result.mobility, 85);
			result.growth = #max(result.growth, 65);
			break;
		}
		case 'discover': {
			result.research = 100;
			result.development = 90;
			result.growth = #max(result.growth, 55);
			break;
		}
		case 'build': {
			result.development = 100;
			result.growth = #max(result.growth, 90);
			result.terraforming = #max(result.terraforming, 75);
			result.defense = #max(result.defense, 60);
			break;
		}
		case 'conquer': {
			result.military = 100;
			result.defense = 100;
			result.mobility = 100;
			result.rival_pressure = 100;
			break;
		}
	}
	return result;
};

return {
	enabled_key: ENABLED_KEY,
	priority_key: PRIORITY_KEY,
	priorities: PRIORITIES,
	default_priority: DEFAULT_PRIORITY,
	is_priority: is_priority,
	is_enabled: is_enabled,
	get_priority: get_priority,
	get_next_priority: get_next_priority,
	apply_priority: apply_priority,
};
