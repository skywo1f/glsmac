const TURNS_PER_SUCCESS = 10;
const MAX_STATE_VALUE = 1000000;
const TURNS_KEY = 'nerve_stapling_turns';
const ATTEMPTS_KEY = 'nerve_stapling_count';

const get_base_int = (base, key) => {
	if (!base.has(key)) {
		return 0;
	}
	const value = base.get(key);
	return #typeof(value) == 'Int' ? value : 0;
};

const get_turns = (base) => {
	return get_base_int(base, TURNS_KEY);
};

const get_attempts = (base) => {
	return get_base_int(base, ATTEMPTS_KEY);
};

const is_un_charter_active = (game) => {
	const is_repealed = game.get('f_council_is_un_charter_repealed');
	return !#is_defined(is_repealed) || !is_repealed();
};

const get_error = (game, base, caller) => {
	if (#typeof(base) != 'Object' || #typeof(base.get_owner) != 'Callable') {
		return 'Nerve stapling requires a base';
	}
	const owner = base.get_owner();
	if (owner.id != caller) {
		return 'Only the base owner can order nerve stapling';
	}
	if (game.is_turn_complete(caller)) {
		return 'Player has already completed this turn';
	}
	if (
		(base.has(ATTEMPTS_KEY) && #typeof(base.get(ATTEMPTS_KEY)) != 'Int') ||
		(base.has(TURNS_KEY) && #typeof(base.get(TURNS_KEY)) != 'Int')
	) {
		return 'Base has invalid nerve-stapling state';
	}
	const ratings_resolver = game.get('f_social_get_ratings');
	if (!#is_defined(ratings_resolver) || ratings_resolver(owner).police < 0) {
		return 'Current Police rating does not permit nerve stapling';
	}
	const attempts = get_attempts(base);
	const turns = get_turns(base);
	if (attempts < 0 || attempts >= MAX_STATE_VALUE) {
		return 'Nerve-stapling attempt limit has been reached';
	}
	if (turns < 0 || turns > MAX_STATE_VALUE) {
		return 'Base has invalid nerve-stapling state';
	}
	if (owner.get_major_atrocities() >= MAX_STATE_VALUE) {
		return 'Atrocity limit has been reached';
	}
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_nerve_stapling_get_turns', get_turns);
		game.set('f_nerve_stapling_get_attempts', get_attempts);
		game.set('f_nerve_stapling_get_error', (base, caller) => {
			return get_error(game, base, caller);
		});
		game.set('f_nerve_stapling_is_un_charter_active', () => {
			return is_un_charter_active(game);
		});
		game.set('f_nerve_stapling_turns_per_success', () => {
			return TURNS_PER_SUCCESS;
		});
	});
};
