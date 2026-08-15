const REPEATABLE_TECHNOLOGY_ID = 'TranscendentThought';

const get_population = (game, player) => {
	let result = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			result += base.get_size();
		}
	}
	return result;
};

const is_pact = (player, other) => {
	return player.get_diplomatic_relation(other) == 'pact' &&
		other.get_diplomatic_relation(player) == 'pact';
};

const get_victory_population = (game, player, victory) => {
	if (
		victory.winner != player.id ||
		(victory.type != 'diplomatic' && victory.type != 'economic')
	) {
		return 0;
	}
	let pact_population = 0;
	let other_population = 0;
	for (base of game.get_bm().get_bases()) {
		const owner = base.get_owner();
		if (owner.id == player.id) {
			continue;
		}
		if (is_pact(player, owner)) {
			pact_population += base.get_size();
		} else {
			other_population += base.get_size();
		}
	}
	return pact_population + #floor(#to_float(other_population) / 2.0);
};

const get_surrendered_population = (game, player) => {
	const get_submission_master = game.get('f_diplomacy_get_submission_master');
	let result = 0;
	for (base of game.get_bm().get_bases()) {
		const owner = base.get_owner();
		if (owner.id == player.id) {
			continue;
		}
		let surrendered_to_player = false;
		if (#typeof(get_submission_master) == 'Callable') {
			const master = get_submission_master(owner);
			surrendered_to_player = master != null && master.id == player.id;
		} else if (#typeof(owner.get_submissive_to_id) == 'Callable') {
			surrendered_to_player = owner.get_submissive_to_id() == player.id;
		}
		if (surrendered_to_player) {
			result += base.get_size();
		}
	}
	return result;
};

const get_technology_score = (player) => {
	let result = 0;
	for (technology_id of player.get_research_state().technologies) {
		if (technology_id != REPEATABLE_TECHNOLOGY_ID) {
			result++;
		}
	}
	return result;
};

const get_transcendent_thoughts = (player) => {
	if (#typeof(player.get_transcendent_thoughts) == 'Callable') {
		return player.get_transcendent_thoughts();
	}
	for (technology_id of player.get_research_state().technologies) {
		if (technology_id == REPEATABLE_TECHNOLOGY_ID) {
			return 1;
		}
	}
	return 0;
};

const get_secret_projects = (game, player) => {
	let result = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id != player.id) {
			continue;
		}
		for (facility of base.get_facilities()) {
			if (facility.is_project) {
				result++;
			}
		}
	}
	return result;
};

const get_victory_bonus = (player, victory) => {
	if (victory.winner != player.id) {
		return 0;
	}
	let maximum = 0;
	if (victory.type == 'conquest') {
		maximum = 1000;
	} else if (victory.type == 'diplomatic' || victory.type == 'economic') {
		maximum = 1200;
	} else if (victory.type == 'transcendence') {
		maximum = 2000;
	}
	return #max(0, maximum - victory.turn * 2);
};

const get_breakdown = (game, player) => {
	const victory = game.get_victory_state();
	const commerce_resolver = game.get('f_economy_get_player_commerce');
	const population = get_population(game, player);
	const victory_population = get_victory_population(game, player, victory);
	const surrendered_population = get_surrendered_population(game, player);
	const commerce = #typeof(commerce_resolver) == 'Callable'
		? commerce_resolver(game, player) : 0;
	const technology = get_technology_score(player);
	const transcendent_thought = get_transcendent_thoughts(player) * 10;
	const secret_projects = get_secret_projects(game, player) * 25;
	const victory_bonus = get_victory_bonus(player, victory);
	return {
		population: population,
		victory_population: victory_population,
		surrendered_population: surrendered_population,
		commerce: commerce,
		technology: technology,
		transcendent_thought: transcendent_thought,
		secret_projects: secret_projects,
		victory_bonus: victory_bonus,
		total: population + victory_population + surrendered_population + commerce +
			technology + transcendent_thought + secret_projects + victory_bonus,
	};
};

return {
	get_breakdown: get_breakdown,
	get_victory_bonus: get_victory_bonus,
};
