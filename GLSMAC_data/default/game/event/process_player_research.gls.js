const technology_acquisition = #include('../technology_acquisition');
const technology_effects = #include('../technology_effects');

const get_research_cost = (game, player, state, technology) => {
	if (#is_defined(state.cost) && state.cost > 0) {
		return state.cost;
	}
	const resolver = game.get('f_technology_get_research_cost');
	return #typeof(resolver) == 'Callable' ? resolver(player) : technology.cost;
};

const get_state_cost = (game, player, known, target, previous) => {
	if (target == '') {
		return 0;
	}
	const resolver = game.get('f_technology_get_state_cost');
	if (#typeof(resolver) == 'Callable') {
		return resolver(player, known, target, previous);
	}
	const technology = game.get('f_technology_get_definition')(target);
	return technology == null ? 0 : technology.cost;
};

return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master is allowed to process research';
		}
		if (#typeof(e.data.technology) != 'Object') {
			return 'Research technology must be an object';
		}
		if (#typeof(e.data.labs) != 'Int' || e.data.labs < 0) {
			return 'Research labs must be a non-negative whole number';
		}
		if (#typeof(e.data.technology.id) != 'String' || e.data.technology.id == '') {
			return 'Technology ID must be a non-empty string';
		}
		if (#typeof(e.data.technology.name) != 'String' || e.data.technology.name == '') {
			return 'Technology name must be a non-empty string';
		}
		if (#typeof(e.data.technology.cost) != 'Int' || e.data.technology.cost <= 0) {
			return 'Technology cost must be a positive whole number';
		}
		const state = e.data.player.get_research_state();
		const cost = get_research_cost(
			e.game,
			e.data.player,
			state,
			e.data.technology
		);
		if (state.target != e.data.technology.id) {
			return 'Technology is not the player\'s current research target';
		}
		if (state.progress >= cost) {
			return 'Research progress must remain below the technology cost';
		}
	},

	apply: (e) => {
		const previous = e.data.player.get_research_state();
		let technologies = [];
		for (id of previous.technologies) {
			technologies :+id;
		}
		let target = previous.target;
		let progress = previous.progress + e.data.labs;
		let technology = e.data.technology;
		const cost = get_research_cost(e.game, e.data.player, previous, technology);
		let completed_names = [];
		let completed_ids = [];
		let free_technology_count = 0;
		if (target != '' && progress >= cost) {
			progress = 0;
			if (
				technology_effects.grants_first_discoverer_technology(
					e.game,
					e.data.player,
					technology.id
				)
			) {
				free_technology_count++;
			}
			technologies :+technology.id;
			completed_names :+technology.name;
			completed_ids :+technology.id;
			target = e.game.get('f_technology_get_next_target')(technologies, e.data.player);
			if (
				target != '' &&
				e.game.get('f_technology_get_definition')(target) == null
			) {
				throw Error('Unknown research target: ' + target);
			}
		}
		e.data.player.set_research_state({
			technologies: technologies,
			target: target,
			progress: progress,
			cost: get_state_cost(
				e.game,
				e.data.player,
				technologies,
				target,
				previous
			),
		});
		const map_reveals = technology_effects.apply_map_reveals(
			e.game,
			e.data.player,
			completed_ids
		);
		const specialist_updates = technology_effects.apply_specialist_updates(
			e.game,
			e.data.player
		);
		const bonus_technologies = free_technology_count > 0
			? technology_acquisition.apply(e.game, e.data.player, free_technology_count)
			: #undefined;
		e.game.trigger('research_updated', {
			player: e.data.player,
		});
		for (name of completed_names) {
			e.game.get('f_message_to_contacts')(
				e.data.player,
				e.data.player.name + ' has discovered ' + name + '.'
			);
		}
		if (#is_defined(bonus_technologies)) {
			for (name of bonus_technologies.completed_names) {
				e.game.get('f_message_to_contacts')(
					e.data.player,
					e.data.player.name + ' has gained ' + name +
						' as the first discoverer.'
				);
			}
		}
		if (#sizeof(completed_names) > 0) {
			e.game.trigger('research_selection_requested', {
				player: e.data.player,
			});
			const queue_datalinks = e.game.get('f_project_queue_planetary_datalinks');
			if (#is_defined(queue_datalinks)) {
				queue_datalinks();
			}
		}
		return {
			state: previous,
			completed: #sizeof(completed_names) > 0,
			completed_count: #sizeof(completed_names),
			bonus_technologies: bonus_technologies,
			map_reveals: map_reveals,
			specialist_updates: specialist_updates,
		};
	},

	rollback: (e) => {
		if (#is_defined(e.applied.bonus_technologies)) {
			technology_acquisition.rollback(e.game, e.applied.bonus_technologies);
		}
		technology_effects.rollback_specialist_updates(e.applied.specialist_updates);
		technology_effects.rollback_map_reveals(e.game, e.applied.map_reveals);
		e.data.player.set_research_state(e.applied.state);
		e.game.trigger('research_updated', {
			player: e.data.player,
		});
	},

};
