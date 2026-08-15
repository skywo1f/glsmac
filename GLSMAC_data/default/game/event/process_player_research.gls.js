const technology_acquisition = #include('../technology_acquisition');
const technology_effects = #include('../technology_effects');

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
		if (state.target != e.data.technology.id) {
			return 'Technology is not the player\'s current research target';
		}
		if (state.progress >= e.data.technology.cost) {
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
		let completed_names = [];
		let completed_ids = [];
		let free_technology_count = 0;
		while (target != '' && progress >= technology.cost) {
			progress -= technology.cost;
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
			if (target != '') {
				technology = e.game.get('f_technology_get_definition')(target);
				if (technology == null) {
					throw Error('Unknown research target: ' + target);
				}
			}
		}
		if (target == '') {
			progress = 0;
		}
		e.data.player.set_research_state({
			technologies: technologies,
			target: target,
			progress: progress,
		});
		const map_reveals = technology_effects.apply_map_reveals(
			e.game,
			e.data.player,
			completed_ids
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
		};
	},

	rollback: (e) => {
		if (#is_defined(e.applied.bonus_technologies)) {
			technology_acquisition.rollback(e.game, e.applied.bonus_technologies);
		}
		technology_effects.rollback_map_reveals(e.game, e.applied.map_reveals);
		e.data.player.set_research_state(e.applied.state);
		e.game.trigger('research_updated', {
			player: e.data.player,
		});
	},

};
