const clone_state = (state, target) => {
	let known = [];
	for (id of state.technologies) {
		known :+id;
	}
	return {
		technologies: known,
		target: target,
		progress: state.progress,
	};
};

return {

	validate: (e) => {
		if (
			#typeof(e.data.player) != 'Object' ||
			#typeof(e.data.player.get_research_state) != 'Callable' ||
			#typeof(e.data.player.set_research_state) != 'Callable'
		) {
			return 'Research selection requires a player';
		}
		if (e.caller != 0 && e.caller != e.data.player.id) {
			return 'Players may only select their own research';
		}
		if (#typeof(e.data.target) != 'String' || e.data.target == '') {
			return 'Research target must be a technology ID';
		}
		if (e.game.is_turn_complete(e.data.player.id)) {
			return 'Player has already completed this turn';
		}
		const state = e.data.player.get_research_state();
		let available = false;
		for (id of e.game.get('f_technology_get_available_targets')(state.technologies)) {
			if (id == e.data.target) {
				available = true;
				break;
			}
		}
		if (!available) {
			return 'Technology is not currently available for research';
		}
	},

	apply: (e) => {
		const previous = e.data.player.get_research_state();
		e.data.player.set_research_state(clone_state(previous, e.data.target));
		e.game.trigger('research_updated', {player: e.data.player});
		return clone_state(previous, previous.target);
	},

	rollback: (e) => {
		e.data.player.set_research_state(e.applied);
		e.game.trigger('research_updated', {player: e.data.player});
	},

};
