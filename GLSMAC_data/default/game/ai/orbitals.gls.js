const get_defense_reserve = (game, player) => {
	let reserve = 0;
	for (other of game.get_players()) {
		if (
			other.id != player.id &&
			player.get_diplomatic_relation(other) == 'vendetta' &&
			other.has_technology('OrbitalSpaceflight')
		) {
			reserve++;
		}
	}
	return reserve;
};

const get_target_score = (game, player, target) => {
	const relation = player.get_diplomatic_relation(target.player);
	if (relation == 'treaty' || relation == 'pact') {
		return null;
	}
	let score = relation == 'vendetta' ? 100000 : 0;
	if (target.definition.id == 'OrbitalDefensePod') {
		score += 10000 + target.count * 100;
	} else {
		score += game.get('f_orbital_get_marginal_loss')(
			target.player,
			target.definition
		) * 1000;
		if (target.definition.orbital_resource == 'MINERALS') {
			score += 300;
		} else if (target.definition.orbital_resource == 'ENERGY') {
			score += 200;
		} else if (target.definition.orbital_resource == 'NUTRIENTS') {
			score += 100;
		}
	}
	return score;
};

const choose_target = (game, player) => {
	const available = game.get('f_orbital_get_available_defense_pods')(player);
	if (available <= get_defense_reserve(game, player)) {
		return null;
	}
	let best = null;
	let best_score = 0 - 1;
	for (target of game.get('f_orbital_get_attack_targets')(player)) {
		const score = get_target_score(game, player, target);
		if (score != null && score > best_score) {
			best = target;
			best_score = score;
		}
	}
	return best;
};

return {
	get_defense_reserve: get_defense_reserve,
	get_target_score: get_target_score,
	choose_target: choose_target,
};
