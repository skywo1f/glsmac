const get_priority = (priorities, name, fallback) => {
	return #is_defined(priorities[name]) ? priorities[name] : fallback;
};

const score_ratings = (ratings, priorities) => {
	const development = get_priority(priorities, 'development', 50);
	const growth = get_priority(priorities, 'growth', 50);
	const psych = get_priority(priorities, 'psych', 25);
	const military = get_priority(priorities, 'military', 25);
	const expansion = get_priority(priorities, 'expansion', 25);
	const terraforming = get_priority(priorities, 'terraforming', 25);
	return ratings.economy * (100 + development * 4) +
		ratings.effic * (100 + development * 2) +
		ratings.support * (100 + military * 3 + expansion) +
		ratings.talent * (100 + psych * 5) +
		ratings.morale * (100 + military * 5) +
		ratings.police * (100 + psych * 3 + military * 2) +
		ratings.growth * (100 + growth * 5 + expansion * 2) +
		ratings.planet * (100 + terraforming * 3) +
		ratings.probe * (100 + development * 2 + military) +
		ratings.industry * (200 + development * 2 + military * 2 + expansion * 2) +
		ratings.research * (100 + development * 5);
};

const choices_equal = (left, right) => {
	return (
		left.politics == right.politics &&
		left.economics == right.economics &&
		left.values == right.values &&
		left.future_society == right.future_society
	);
};

const choose = (player, categories, get_available, get_ratings, priorities) => {
	const current = player.get_social_engineering();
	let selected = {
		politics: current.politics,
		economics: current.economics,
		values: current.values,
		future_society: current.future_society,
	};
	// Four passes make each category respond to choices made in the other three.
	for (let pass = 0; pass < 4; pass++) {
		for (category of categories) {
			let best_id = selected[category.id];
			let best_score = 0;
			let has_best = false;
			for (choice of get_available(player, category.id)) {
				let candidate = {
					politics: selected.politics,
					economics: selected.economics,
					values: selected.values,
					future_society: selected.future_society,
				};
				candidate[category.id] = choice.id;
				const score = score_ratings(get_ratings(player, candidate), priorities);
				if (
					!has_best || score > best_score ||
					(score == best_score && choice.id < best_id)
				) {
					has_best = true;
					best_id = choice.id;
					best_score = score;
				}
			}
			selected[category.id] = best_id;
		}
	}
	return selected;
};

return {
	score_ratings: score_ratings,
	choices_equal: choices_equal,
	choose: choose,
};
