const technology_effects = #include('technology_effects');
const REPEATABLE_TECHNOLOGY_ID = 'TranscendentThought';

const clone_state = (state) => {
	let technologies = [];
	for (id of state.technologies) {
		technologies :+id;
	}
	const result = {
		technologies: technologies,
		target: state.target,
		progress: state.progress,
	};
	if (#is_defined(state.cost)) {
		result.cost = state.cost;
	}
	return result;
};

const get_state_cost = (game, player, known, target, previous) => {
	if (target == '') {
		return 0;
	}
	const resolver = game.get('f_technology_get_state_cost');
	if (#typeof(resolver) == 'Callable') {
		return resolver(player, known, target, previous);
	}
	if (
		#is_defined(previous) && target == previous.target &&
		#is_defined(previous.cost) && previous.cost > 0
	) {
		return previous.cost;
	}
	const get_definition = game.get('f_technology_get_definition');
	if (#typeof(get_definition) != 'Callable') {
		return 0;
	}
	const technology = get_definition(target);
	return technology == null ? 0 : technology.cost;
};

const get_next_target = (game, player, known, target) => {
	return target != ''
		? target
		: game.get('f_technology_get_next_target')(known, player);
};

const has_technology = (technologies, technology_id) => {
	for (known of technologies) {
		if (known == technology_id) {
			return true;
		}
	}
	return false;
};

const can_grant = (game, player) => {
	const state = player.get_research_state();
	return get_next_target(game, player, state.technologies, state.target) != '';
};

const apply = (game, player, count) => {
	const previous = clone_state(player.get_research_state());
	const previous_transcendent_thoughts =
		#typeof(player.get_transcendent_thoughts) == 'Callable'
			? player.get_transcendent_thoughts() : 0;
	let transcendent_thoughts = previous_transcendent_thoughts;
	let technologies = [];
	for (id of previous.technologies) {
		technologies :+id;
	}
	let target = previous.target;
	let progress = previous.progress;
	let completed_names = [];
	let completed_ids = [];
	let remaining = count;
	while (remaining > 0) {
		target = get_next_target(game, player, technologies, target);
		if (target == '') {
			break;
		}
		const definition = game.get('f_technology_get_definition')(target);
		if (definition == null) {
			throw Error('Unknown free technology target: ' + target);
		}
		remaining--;
		if (technology_effects.grants_first_discoverer_technology(game, player, target)) {
			remaining++;
		}
		if (target == REPEATABLE_TECHNOLOGY_ID) {
			transcendent_thoughts++;
			if (!has_technology(technologies, target)) {
				technologies :+target;
			}
		} else {
			technologies :+target;
		}
		completed_names :+definition.name;
		completed_ids :+target;
		target = game.get('f_technology_get_next_target')(technologies, player);
	}
	if (#sizeof(completed_names) == 0) {
		return #undefined;
	}
	if (target == '') {
		progress = 0;
	}
	if (#typeof(player.set_transcendent_thoughts) == 'Callable') {
		player.set_transcendent_thoughts(transcendent_thoughts);
	}
	player.set_research_state({
		technologies: technologies,
		target: target,
		progress: progress,
		cost: get_state_cost(
			game,
			player,
			technologies,
			target,
			transcendent_thoughts != previous_transcendent_thoughts
				? #undefined : previous
		),
	});
	const map_reveals = technology_effects.apply_map_reveals(game, player, completed_ids);
	const specialist_updates = technology_effects.apply_specialist_updates(game, player);
	game.trigger('research_updated', {player: player});
	const queue_datalinks = game.get('f_project_queue_planetary_datalinks');
	if (#is_defined(queue_datalinks)) {
		queue_datalinks();
	}
	return {
		player: player,
		state: previous,
		completed_names: completed_names,
		completed_ids: completed_ids,
		completed_count: #sizeof(completed_names),
		transcendent_thoughts: previous_transcendent_thoughts,
		map_reveals: map_reveals,
		specialist_updates: specialist_updates,
	};
};

const rollback = (game, applied) => {
	technology_effects.rollback_specialist_updates(applied.specialist_updates);
	technology_effects.rollback_map_reveals(game, applied.map_reveals);
	applied.player.set_research_state(applied.state);
	if (#typeof(applied.player.set_transcendent_thoughts) == 'Callable') {
		applied.player.set_transcendent_thoughts(applied.transcendent_thoughts);
	}
	game.trigger('research_updated', {player: applied.player});
};

return {
	can_grant: can_grant,
	get_state_cost: get_state_cost,
	apply: apply,
	rollback: rollback,
};
