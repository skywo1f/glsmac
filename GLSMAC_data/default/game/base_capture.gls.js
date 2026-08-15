const project_acquisition = #include('./project_acquisition');
const economic_victory = #include('./economic_victory_rules');
const game_rules = #include('./game_rules');
const technology_effects = #include('./technology_effects');
const MAX_ENERGY_CREDITS = 1000000000;
const HEADQUARTERS_EVACUATION_COST = 1000;
const RESEARCH_DATA_STOLEN_KEY = 'probe_research_data_stolen';
const FORMER_OWNER_KEY = 'former_owner_id';
const GOVERNOR_ENABLED_KEY = 'governor_enabled';
const GOVERNOR_PRIORITY_KEY = 'governor_priority';

const snapshot_base_value = (base, key) => {
	if (#typeof(base.has) != 'Callable') {
		return {key: key, supported: false, defined: false, value: null};
	}
	return base.has(key)
		? {key: key, supported: true, defined: true, value: base.get(key)}
		: {key: key, supported: true, defined: false, value: null};
};

const restore_base_value = (base, snapshot) => {
	if (#is_defined(snapshot.supported) && !snapshot.supported) {
		return;
	}
	if (snapshot.defined) {
		base.set(snapshot.key, snapshot.value);
	} else if (base.has(snapshot.key)) {
		base.unset(snapshot.key);
	}
};

const get_base_manager = (game) => {
	return #typeof(game.get_bm) == 'Callable' ? game.get_bm() : game.bm;
};

const get_unit_manager = (game) => {
	return #typeof(game.get_um) == 'Callable' ? game.get_um() : game.um;
};

const get_tile_manager = (game) => {
	return #typeof(game.get_tm) == 'Callable' ? game.get_tm() : game.tm;
};

const get_energy_credits = (player) => {
	if (#typeof(player.get_energy_credits) == 'Callable') {
		return player.get_energy_credits();
	}
	return #typeof(player.energy_credits) == 'Int' ? player.energy_credits : 0;
};

const apply_spoils_of_war = (game, winner, loser) => {
	if (
		!game_rules.get(game, 'spoils_of_war') ||
		#typeof(winner.has_technology) != 'Callable' ||
		#typeof(loser.get_research_state) != 'Callable' ||
		#typeof(winner.get_research_state) != 'Callable' ||
		#typeof(winner.set_research_state) != 'Callable' ||
		#typeof(game.get) != 'Callable'
	) {
		return #undefined;
	}
	const grant = game.get('f_diplomacy_grant_technology');
	if (#typeof(grant) != 'Callable') {
		return #undefined;
	}
	let technology = '';
	for (id of loser.get_research_state().technologies) {
		if (!winner.has_technology(id)) {
			technology = id;
			break;
		}
	}
	if (technology == '') {
		return #undefined;
	}
	const state = winner.get_research_state();
	const granted = grant(winner, technology);
	if (
		!#is_defined(granted) ||
		(#typeof(granted) == 'Bool' && !granted)
	) {
		return #undefined;
	}
	game.trigger('research_updated', {player: winner});
	const get_definition = game.get('f_technology_get_definition');
	const definition = #typeof(get_definition) == 'Callable'
		? get_definition(technology)
		: null;
	const winner_name = #typeof(winner.get_faction) == 'Callable'
		? winner.get_faction().name
		: winner.name;
	game.message(
		winner_name + ' captured research data for ' +
		(definition == null ? technology : definition.name) + '.'
	);
	return {
		player: winner,
		state: state,
		map_reveals: #typeof(granted) == 'Object' ? granted.map_reveals : [],
		specialist_updates: #typeof(granted) == 'Object'
			? granted.specialist_updates : [],
	};
};

const rollback_spoils_of_war = (game, snapshot) => {
	if (!#is_defined(snapshot)) {
		return;
	}
	technology_effects.rollback_specialist_updates(snapshot.specialist_updates);
	technology_effects.rollback_map_reveals(game, snapshot.map_reveals);
	snapshot.player.set_research_state(snapshot.state);
	game.trigger('research_updated', {player: snapshot.player});
};

const get_headquarters_destination = (game, lost_base, owner) => {
	let best = null;
	let best_distance = 0;
	for (candidate of get_base_manager(game).get_bases()) {
		if (candidate.id == lost_base.id || candidate.get_owner().id != owner.id) {
			continue;
		}
		const distance = get_tile_manager(game).get_distance(
			lost_base.get_tile(),
			candidate.get_tile()
		);
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

const get_headquarters_evacuation_candidate = (
	game,
	base,
	owner,
	economic_victory_state
) => {
	const destination = get_headquarters_destination(game, base, owner);
	if (
		destination == null ||
		#typeof(owner.set_energy_credits) != 'Callable' ||
		get_energy_credits(owner) < HEADQUARTERS_EVACUATION_COST
	) {
		return null;
	}
	return {
		base: base,
		player: owner,
		destination: destination,
		energy_credits: get_energy_credits(owner),
		cost: HEADQUARTERS_EVACUATION_COST,
		economic_victory_state: economic_victory_state,
	};
};

const get_headquarters_evacuation = (game, candidate) => {
	if (candidate == null) {
		return null;
	}
	const resolver = #typeof(game.get) == 'Callable'
		? game.get('f_base_should_evacuate_headquarters')
		: #undefined;
	const offer = #typeof(game.get) == 'Callable'
		? game.get('f_headquarters_offer_evacuation')
		: #undefined;
	if (#typeof(resolver) == 'Callable') {
		return resolver(
			candidate.base,
			candidate.destination,
			candidate.player,
			candidate.cost
		) ? candidate : null;
	}
	if (
		#typeof(offer) == 'Callable' && #is_defined(candidate.player.type) &&
		candidate.player.type == 'human'
	) {
		return null;
	}
	return candidate;
};

const apply_headquarters_evacuation = (base, owner, evacuation) => {
	base.remove_facility('Headquarters');
	evacuation.destination.add_facility('Headquarters');
	owner.set_energy_credits(evacuation.energy_credits - evacuation.cost);
	if (evacuation.economic_victory_state != null) {
		economic_victory.clear_base_state(base);
		economic_victory.set_base_state(
			evacuation.destination,
			evacuation.economic_victory_state.turn,
			evacuation.economic_victory_state.cost
		);
	}
};

const get_rehome_base = (game, unit, owner_id, lost_base) => {
	let best = null;
	let best_distance = 0;
	for (candidate of get_base_manager(game).get_bases()) {
		if (candidate.id == lost_base.id || candidate.get_owner().id != owner_id) {
			continue;
		}
		const distance = get_tile_manager(game).get_distance(
			unit.get_tile(),
			candidate.get_tile()
		);
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
	for (unit of get_unit_manager(game).get_units()) {
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
	const research_data_stolen = snapshot_base_value(base, RESEARCH_DATA_STOLEN_KEY);
	const former_owner = snapshot_base_value(base, FORMER_OWNER_KEY);
	const governor_enabled = snapshot_base_value(base, GOVERNOR_ENABLED_KEY);
	const governor_priority = snapshot_base_value(base, GOVERNOR_PRIORITY_KEY);
	if (research_data_stolen.defined && #typeof(base.unset) == 'Callable') {
		base.unset(RESEARCH_DATA_STOLEN_KEY);
	}
	if (#typeof(base.unset) == 'Callable') {
		if (governor_enabled.defined) {
			base.unset(GOVERNOR_ENABLED_KEY);
		}
		if (governor_priority.defined) {
			base.unset(GOVERNOR_PRIORITY_KEY);
		}
	}
	const rehomed_units = rehome_units(game, base, old_owner.id);
	const captured_headquarters = base.has_facility('Headquarters');
	const economic_victory_state = captured_headquarters
		? economic_victory.get_base_state(base)
		: null;
	const headquarters_evacuation_candidate = captured_headquarters
		? get_headquarters_evacuation_candidate(
			game,
			base,
			old_owner,
			economic_victory_state
		)
		: null;
	const headquarters_evacuation = captured_headquarters
		? get_headquarters_evacuation(game, headquarters_evacuation_candidate)
		: null;
	const headquarters_evacuation_offer =
		headquarters_evacuation_candidate != null &&
		headquarters_evacuation == null &&
		#is_defined(old_owner.type) && old_owner.type == 'human' &&
		#typeof(game.get) == 'Callable'
			? game.get('f_headquarters_offer_evacuation')
			: #undefined;
	let economic_victory_capture = #undefined;
	if (headquarters_evacuation != null) {
		apply_headquarters_evacuation(base, old_owner, headquarters_evacuation);
	} else if (captured_headquarters) {
		base.remove_facility('Headquarters');
	}
	if (economic_victory_state != null && headquarters_evacuation == null) {
		economic_victory_capture = {
			state: economic_victory_state,
			old_owner_energy: old_owner.get_energy_credits(),
			new_owner_energy: new_owner.get_energy_credits(),
			new_owner: new_owner,
		};
		economic_victory.clear_base_state(base);
		const captured_energy = #floor(#to_float(economic_victory_state.cost) / 2.0);
		old_owner.set_energy_credits(#min(
			MAX_ENERGY_CREDITS,
			old_owner.get_energy_credits() + economic_victory_state.cost - captured_energy
		));
		new_owner.set_energy_credits(#min(
			MAX_ENERGY_CREDITS,
			new_owner.get_energy_credits() + captured_energy
		));
	}

	if (#typeof(base.set) == 'Callable') {
		base.set(FORMER_OWNER_KEY, old_owner.id);
	}
	base.set_owner(new_owner);
	const spoils_of_war = apply_spoils_of_war(game, new_owner, old_owner);
	if (headquarters_evacuation != null) {
		game.message(
			old_owner.get_faction().name + ' has safely evacuated its Headquarters to ' +
			headquarters_evacuation.destination.name + ' for ' +
			#to_string(headquarters_evacuation.cost) + ' energy credits.'
		);
		if (economic_victory_state != null) {
			game.trigger('economic_victory_updated', {player: old_owner});
		}
		game.trigger('economy_updated', {player: old_owner});
	} else if (#is_defined(economic_victory_capture)) {
		if (#typeof(headquarters_evacuation_offer) != 'Callable') {
			game.message(
				new_owner.get_faction().name + ' has captured ' +
				old_owner.get_faction().name +
				'\'s Headquarters and foiled its Global Energy Market bid.'
			);
		}
		game.trigger('economic_victory_updated', {player: old_owner});
		game.trigger('economy_updated', {player: old_owner});
		game.trigger('economy_updated', {player: new_owner});
	}
	const empath_guild_infiltration = base.has_facility('TheEmpathGuild')
		? project_acquisition.apply_empath_guild(game, base)
		: #undefined;
	if (#is_defined(game.get) && base.has_facility('ThePlanetaryDatalinks')) {
		const queue_datalinks = game.get('f_project_queue_planetary_datalinks');
		if (#is_defined(queue_datalinks)) {
			queue_datalinks();
		}
	}
	let valid_queue = [];
	for (production of old_queue) {
		if (base.can_produce(production.kind, production.id)) {
			valid_queue :+production;
		}
	}
	base.set_production_queue(valid_queue);

	const snapshot = {
		old_owner: old_owner,
		old_queue: old_queue,
		research_data_stolen: research_data_stolen,
		former_owner: former_owner,
		governor_enabled: governor_enabled,
		governor_priority: governor_priority,
		rehomed_units: rehomed_units,
		captured_headquarters: captured_headquarters,
		headquarters_evacuation: headquarters_evacuation,
		empath_guild_infiltration: empath_guild_infiltration,
		economic_victory_capture: economic_victory_capture,
		spoils_of_war: spoils_of_war,
	};
	if (#typeof(headquarters_evacuation_offer) == 'Callable') {
		headquarters_evacuation_candidate.new_owner = new_owner;
		headquarters_evacuation_candidate.economic_victory_capture =
			economic_victory_capture;
		headquarters_evacuation_candidate.post_owner_energy =
			get_energy_credits(old_owner);
		headquarters_evacuation_candidate.post_new_owner_energy =
			get_energy_credits(new_owner);
		snapshot.headquarters_evacuation_offer =
			headquarters_evacuation_candidate;
		headquarters_evacuation_offer(headquarters_evacuation_candidate);
	}
	return snapshot;
};

const restore_base = (game, base, snapshot) => {
	if (
		#is_defined(snapshot.headquarters_evacuation_offer) &&
		snapshot.headquarters_evacuation_offer != null &&
		#typeof(game.get) == 'Callable'
	) {
		const cancel_offer = game.get('f_headquarters_cancel_evacuation');
		if (#typeof(cancel_offer) == 'Callable') {
			cancel_offer(base);
		}
	}
	if (#is_defined(snapshot.empath_guild_infiltration)) {
		project_acquisition.rollback_empath_guild(snapshot.empath_guild_infiltration);
	}
	if (#is_defined(snapshot.spoils_of_war)) {
		rollback_spoils_of_war(game, snapshot.spoils_of_war);
	}
	if (base.get_owner().id != snapshot.old_owner.id) {
		base.set_owner(snapshot.old_owner);
	}
	if (
		#is_defined(snapshot.headquarters_evacuation) &&
		snapshot.headquarters_evacuation != null
	) {
		const evacuation = snapshot.headquarters_evacuation;
		if (evacuation.destination.has_facility('Headquarters')) {
			evacuation.destination.remove_facility('Headquarters');
		}
		if (evacuation.economic_victory_state != null) {
			economic_victory.clear_base_state(evacuation.destination);
		}
		snapshot.old_owner.set_energy_credits(evacuation.energy_credits);
	}
	if (snapshot.captured_headquarters && !base.has_facility('Headquarters')) {
		base.add_facility('Headquarters');
	}
	if (#is_defined(snapshot.economic_victory_capture)) {
		const capture = snapshot.economic_victory_capture;
		snapshot.old_owner.set_energy_credits(capture.old_owner_energy);
		capture.new_owner.set_energy_credits(capture.new_owner_energy);
		economic_victory.set_base_state(
			base,
			capture.state.turn,
			capture.state.cost
		);
	} else if (
		#is_defined(snapshot.headquarters_evacuation) &&
		snapshot.headquarters_evacuation != null &&
		snapshot.headquarters_evacuation.economic_victory_state != null
	) {
		const state = snapshot.headquarters_evacuation.economic_victory_state;
		economic_victory.set_base_state(base, state.turn, state.cost);
	}
	base.set_production_queue(snapshot.old_queue);
	if (#is_defined(snapshot.research_data_stolen)) {
		restore_base_value(base, snapshot.research_data_stolen);
	}
	if (#is_defined(snapshot.former_owner)) {
		restore_base_value(base, snapshot.former_owner);
	}
	if (#is_defined(snapshot.governor_enabled)) {
		restore_base_value(base, snapshot.governor_enabled);
	}
	if (#is_defined(snapshot.governor_priority)) {
		restore_base_value(base, snapshot.governor_priority);
	}
	restore_units(snapshot.rehomed_units);
};

return {
	headquarters_evacuation_cost: HEADQUARTERS_EVACUATION_COST,
	get_headquarters_destination: get_headquarters_destination,
	rehome_units: rehome_units,
	restore_units: restore_units,
	apply_spoils_of_war: apply_spoils_of_war,
	rollback_spoils_of_war: rollback_spoils_of_war,
	capture_base: capture_base,
	restore_base: restore_base,
};
