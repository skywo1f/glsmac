const ASCENT_PROJECT_ID = 'TheAscentToTranscendence';
const economic_victory = #include('economic_victory_rules');
const game_rules = #include('game_rules');

const get_population = (game, player) => {
	let result = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			result += base.get_size();
		}
	}
	return result;
};

const is_surviving = (game, player) => {
	if (get_population(game, player) > 0) {
		return true;
	}
	if (#typeof(game.get_um) != 'Callable') {
		return false;
	}
	for (unit of game.get_um().get_units(true)) {
		if (
			unit.owner == player.id && unit.health > 0.0 &&
			unit.get_def().can_found_base
		) {
			return true;
		}
	}
	return false;
};

const is_pact = (player, other) => {
	return player.get_diplomatic_relation(other) == 'pact' &&
		other.get_diplomatic_relation(player) == 'pact';
};

const is_submissive = (player) => {
	return #typeof(player.get_submissive_to_id) == 'Callable' &&
		player.get_submissive_to_id() >= 0;
};

const get_cooperative_winners = (game, primary) => {
	let result = [primary];
	if (!game_rules.get(game, 'allow_cooperative_victory')) {
		return result;
	}
	for (player of game.get_players()) {
		if (player.id == primary.id || is_submissive(player)) {
			continue;
		}
		const faction = #typeof(player.get_faction) == 'Callable'
			? player.get_faction() : null;
		if (
			(faction != null && #is_defined(faction.is_native) && faction.is_native) ||
			!is_surviving(game, player) || !is_pact(primary, player)
		) {
			continue;
		}
		result :+player;
	}
	return result;
};

const get_victory_winners = (game, victory) => {
	if (victory.type == '' || victory.winner < 0) {
		return [];
	}
	return get_cooperative_winners(game, game.get_player(victory.winner));
};

const is_victory_winner = (game, player, victory) => {
	for (winner of get_victory_winners(game, victory)) {
		if (winner.id == player.id) {
			return true;
		}
	}
	return false;
};

const get_transcendence_winner = (game) => {
	const base = game.get_bm().get_project_base(ASCENT_PROJECT_ID);
	return !#is_defined(base) || base == null ? null : base.get_owner();
};

return {
	get_population: get_population,
	is_surviving: is_surviving,
	get_cooperative_winners: get_cooperative_winners,
	get_victory_winners: get_victory_winners,
	is_victory_winner: is_victory_winner,
	get_transcendence_winner: get_transcendence_winner,
	get_economic_winner: economic_victory.get_winner,
};
