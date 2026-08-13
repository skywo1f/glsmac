const get_player_base_count = (game, player) => {
	let count = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			count++;
		}
	}
	return count;
};

const get_strategic_value = (game, base, player) => {
	const get_trade_value = game.get('f_diplomacy_get_base_trade_value');
	if (base == null || #typeof(get_trade_value) != 'Callable') {
		return 0;
	}
	let value = get_trade_value(base);
	let nearest_distance = 0 - 1;
	for (candidate of game.get_bm().get_bases()) {
		if (candidate.id == base.id || candidate.get_owner().id != player.id) {
			continue;
		}
		const distance = game.get_tm().get_distance(base.get_tile(), candidate.get_tile());
		if (nearest_distance < 0 || distance < nearest_distance) {
			nearest_distance = distance;
		}
	}
	if (nearest_distance >= 0 && nearest_distance <= 8) {
		value += (9 - nearest_distance) * 25;
	} else if (nearest_distance > 8) {
		value -= #min(200, (nearest_distance - 8) * 25);
	}
	if (base.has('former_owner_id') && base.get('former_owner_id') == player.id) {
		value += 150;
	}
	return #ceil(#to_float(#max(25, value)) / 25.0) * 25;
};

const get_candidates = (game, source, recipient) => {
	let result = [];
	if (get_player_base_count(game, source) <= 1) {
		return result;
	}
	for (base of game.get_bm().get_bases()) {
		if (
			base.get_owner().id != source.id ||
			base.has_facility('Headquarters') ||
			(#typeof(recipient.has_explored) == 'Callable' &&
				!recipient.has_explored(base.get_tile()))
		) {
			continue;
		}
		let has_project = false;
		for (facility of base.get_facilities()) {
			if (facility.is_project) {
				has_project = true;
				break;
			}
		}
		if (has_project) {
			continue;
		}
		result :+{
			id: base.id,
			owner_value: get_strategic_value(game, base, source),
			recipient_value: get_strategic_value(game, base, recipient),
		};
	}
	return result;
};

return {
	get_strategic_value: get_strategic_value,
	get_candidates: get_candidates,
};
