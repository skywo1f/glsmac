const DIFFICULTY_RANKS = {
	Citizen: 0,
	Specialist: 1,
	Talent: 2,
	Librarian: 3,
	Thinker: 4,
	Transcend: 5,
};

const find_player = (game, id) => {
	for (player of game.get_players()) {
		if (player.id == id) {
			return player;
		}
	}
	return null;
};

const can_accept_former_owner_grievance = (game, player, base) => {
	if (!base.has('former_owner_id') || base.get('former_owner_id') == player.id) {
		return true;
	}
	const former_owner = find_player(game, base.get('former_owner_id'));
	if (former_owner == null) {
		return true;
	}
	return former_owner.get_diplomatic_grievance(player).wants_revenge;
};

const should_staple = (game, player, base) => {
	const charter_active = game.get('f_nerve_stapling_is_un_charter_active')();
	if (charter_active) {
		const difficulty = #is_defined(DIFFICULTY_RANKS[player.difficulty_level])
			? DIFFICULTY_RANKS[player.difficulty_level]
			: DIFFICULTY_RANKS.Transcend;
		if (
			difficulty < DIFFICULTY_RANKS.Librarian || base.get_size() < 4 ||
			player.get_sanction_turns() > 0
		) {
			return false;
		}
	}
	const error = game.get('f_nerve_stapling_get_error')(base, player.id);
	if (#is_defined(error) || game.get('f_nerve_stapling_get_turns')(base) > 0) {
		return false;
	}
	const attempts = game.get('f_nerve_stapling_get_attempts')(base);
	if (
		attempts >= 4 ||
		#floor(#to_float(base.get_size()) / 4.0) < attempts ||
		!can_accept_former_owner_grievance(game, player, base)
	) {
		return false;
	}
	const psych = game.get('f_base_get_psych')(base);
	if (psych.drones <= 0 || psych.drones <= psych.talents) {
		return false;
	}
	if (!charter_active) {
		return psych.is_rioting || psych.drones > psych.talents + 1;
	}
	return psych.is_rioting;
};

const manage = (game, player, bases) => {
	for (base of bases) {
		if (should_staple(game, player, base)) {
			game.event_as(player.id, 'nerve_staple_base', {base: base});
		}
	}
};

return {
	should_staple: should_staple,
	manage: manage,
};
