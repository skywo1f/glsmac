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

const get_queue_specs = (base) => {
	let result = [];
	for (production of base.get_production_queue()) {
		result :+{
			kind: production.production_kind,
			id: production.id,
		};
	}
	return result;
};

const capture_base = (game, base, new_owner) => {
	const old_owner = base.get_owner();
	const old_queue = get_queue_specs(base);
	const rehomed_units = rehome_units(game, base, old_owner.id);
	const captured_headquarters = base.has_facility('Headquarters');
	if (captured_headquarters) {
		base.remove_facility('Headquarters');
	}

	base.set_owner(new_owner);
	let valid_queue = [];
	for (production of old_queue) {
		if (base.can_produce(production.kind, production.id)) {
			valid_queue :+production;
		}
	}
	base.set_production_queue(valid_queue);

	return {
		old_owner: old_owner,
		old_queue: old_queue,
		rehomed_units: rehomed_units,
		captured_headquarters: captured_headquarters,
	};
};

const restore_base = (base, snapshot) => {
	if (base.get_owner().id != snapshot.old_owner.id) {
		base.set_owner(snapshot.old_owner);
	}
	if (snapshot.captured_headquarters && !base.has_facility('Headquarters')) {
		base.add_facility('Headquarters');
	}
	base.set_production_queue(snapshot.old_queue);
	restore_units(snapshot.rehomed_units);
};

return {
	rehome_units: rehome_units,
	restore_units: restore_units,
	capture_base: capture_base,
	restore_base: restore_base,
};
