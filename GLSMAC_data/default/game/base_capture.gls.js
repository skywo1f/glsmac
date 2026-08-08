const get_rehome_base = (game, unit, owner_id, lost_base) => {
	let best = null;
	let best_distance = 0;
	for (candidate of game.bm.get_bases()) {
		if (candidate.id == lost_base.id || candidate.get_owner().id != owner_id) {
			continue;
		}
		const distance = game.tm.get_distance(unit.get_tile(), candidate.get_tile());
		if (
			best == null ||
			distance < best_distance ||
			(distance == best_distance && candidate.id < best.id)
		) {
			best = candidate;
			best_distance = distance;
		}
	}
	return best;
};

const rehome_units = (game, lost_base, owner_id) => {
	let snapshots = [];
	for (unit of game.um.get_units()) {
		if (unit.owner != owner_id || unit.home_base_id != lost_base.id) {
			continue;
		}
		snapshots :+{
			unit: unit,
			home_base_id: unit.home_base_id,
		};
		const destination = get_rehome_base(game, unit, owner_id, lost_base);
		unit.set_home_base_id(destination == null ? 0 : destination.id);
	}
	return snapshots;
};

const restore_units = (snapshots) => {
	for (snapshot of snapshots) {
		snapshot.unit.set_home_base_id(snapshot.home_base_id);
	}
};

return {
	rehome_units: rehome_units,
	restore_units: restore_units,
};
