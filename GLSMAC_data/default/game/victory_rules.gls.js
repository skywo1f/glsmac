const ASCENT_PROJECT_ID = 'TheAscentToTranscendence';

const get_transcendence_winner = (game) => {
	const base = game.get_bm().get_project_base(ASCENT_PROJECT_ID);
	return !#is_defined(base) || base == null ? null : base.get_owner();
};

return {
	get_transcendence_winner: get_transcendence_winner,
};
