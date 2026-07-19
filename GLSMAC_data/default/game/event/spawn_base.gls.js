return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master is allowed to spawn bases';
		}
	},

	apply: (e) => {
		let info = {};
		if (#is_defined(e.data.name)) {
			info.name = e.data.name;
		}
		const base = e.game.bm.spawn_base(e.data.owner, e.data.tile, info);

		return {
			base: base,
		};
	},

	rollback: (e) => {
		e.game.bm.despawn_base(e.applied.base);
	},

};
