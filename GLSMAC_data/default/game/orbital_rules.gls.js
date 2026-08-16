const messages = #include('./message_rules');

const is_orbital = (definition) => {
	return #is_defined(definition) && (
		(
			#is_defined(definition.orbital_resource) &&
			definition.orbital_resource != ''
		) || (
			#is_defined(definition.orbital_defense) &&
			definition.orbital_defense
		)
	);
};

const has_space_elevator = (game, player) => {
	const has_project = #is_defined(game.get)
		? game.get('f_project_has')
		: #undefined;
	if (#is_defined(has_project)) {
		return has_project(player, 'TheSpaceElevator');
	}
	for (base of game.get_bm().get_bases()) {
		if (
			base.get_owner().id == player.id &&
			base.has_facility('TheSpaceElevator')
		) {
			return true;
		}
	}
	return false;
};

const has_full_access = (game, base) => {
	return base.has_facility('AerospaceComplex') ||
		has_space_elevator(game, base.get_owner());
};

const get_resource_count = (game, player, resource, changed_id, count_delta) => {
	let count = 0;
	for (definition of game.get_bm().get_facility_defs()) {
		if (
			#is_defined(definition.orbital_resource) &&
			definition.orbital_resource == resource
		) {
			count += player.get_orbital_facility_count(definition.id) +
				(definition.id == changed_id ? count_delta : 0);
		}
	}
	return #max(count, 0);
};

const get_base_resource_bonus_with_delta = (
	game,
	base,
	resource,
	changed_id,
	count_delta
) => {
	let count = get_resource_count(
		game,
		base.get_owner(),
		resource,
		changed_id,
		count_delta
	);
	if (!has_full_access(game, base)) {
		count = #floor(#to_float(count) / 2.0);
	}
	return #min(count, base.get_size());
};

const get_base_resource_bonus = (game, base, resource) => {
	return get_base_resource_bonus_with_delta(game, base, resource, '', 0);
};

const get_marginal_yield = (game, player, definition) => {
	if (
		!is_orbital(definition) ||
		!#is_defined(definition.orbital_resource) ||
		definition.orbital_resource == ''
	) {
		return 0;
	}
	let result = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id != player.id) {
			continue;
		}
		result += get_base_resource_bonus_with_delta(
			game,
			base,
			definition.orbital_resource,
			definition.id,
			1
		) - get_base_resource_bonus(
			game,
			base,
			definition.orbital_resource
		);
	}
	return result;
};

const get_marginal_loss = (game, player, definition) => {
	if (
		!is_orbital(definition) ||
		!#is_defined(definition.orbital_resource) ||
		definition.orbital_resource == '' ||
		player.get_orbital_facility_count(definition.id) <= 0
	) {
		return 0;
	}
	let result = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id != player.id) {
			continue;
		}
		result += get_base_resource_bonus(
			game,
			base,
			definition.orbital_resource
		) - get_base_resource_bonus_with_delta(
			game,
			base,
			definition.orbital_resource,
			definition.id,
			0 - 1
		);
	}
	return result;
};

const get_available_defense_pods = (player) => {
	return #max(
		0,
		player.get_orbital_facility_count('OrbitalDefensePod') -
			player.get_orbital_defense_deployments()
	);
};

const get_definition = (game, id) => {
	for (definition of game.get_bm().get_facility_defs()) {
		if (definition.id == id) {
			return definition;
		}
	}
	return null;
};

const get_attack_error = (game, player, target, facility_id) => {
	if (player == null || target == null || player.id == target.id) {
		return 'Orbital attacks require a rival faction target';
	}
	if (game.is_game_over()) {
		return 'The game is already over';
	}
	if (game.is_turn_complete(player.id)) {
		return 'Player has already completed this turn';
	}
	const get_forced_relation = game.get('f_council_get_forced_relation');
	if (
		#typeof(get_forced_relation) == 'Callable' &&
		get_forced_relation(player, target) == 'pact'
	) {
		return 'Factions loyal to the Supreme Leader cannot attack each other';
	}
	if (get_available_defense_pods(player) <= 0) {
		return player.get_orbital_facility_count('OrbitalDefensePod') <= 0
			? 'No Orbital Defense Pods are available'
			: 'All Orbital Defense Pods have been deployed this turn';
	}
	const definition = get_definition(game, facility_id);
	if (definition == null || !is_orbital(definition)) {
		return 'Orbital attack target is not a satellite';
	}
	if (target.get_orbital_facility_count(facility_id) <= 0) {
		return 'Target faction has no such satellite';
	}
};

const get_attack_targets = (game, player) => {
	let result = [];
	for (target of game.get_players()) {
		if (target.id == player.id) {
			continue;
		}
		for (definition of game.get_bm().get_facility_defs()) {
			const count = target.get_orbital_facility_count(definition.id);
			if (
				is_orbital(definition) && count > 0 &&
				!#is_defined(get_attack_error(game, player, target, definition.id))
			) {
				result :+{
					player: target,
					definition: definition,
					count: count,
				};
			}
		}
	}
	return result;
};

const apply_launch = (game, base, definition) => {
	if (!is_orbital(definition)) {
		throw Error('Cannot launch non-orbital production');
	}
	const player = base.get_owner();
	const count = player.get_orbital_facility_count(definition.id);
	player.set_orbital_facility_count(definition.id, count + 1);
	messages.to_player(
		game,
		player,
		player.name + ' launched ' + definition.name + ' (' +
		#to_string(count + 1) + ' in orbit).'
	);
	return {player: player, id: definition.id, count: count};
};

const rollback_launch = (applied) => {
	applied.player.set_orbital_facility_count(applied.id, applied.count);
};

return {
	is_orbital: is_orbital,
	has_space_elevator: has_space_elevator,
	has_full_access: has_full_access,
	get_base_resource_bonus: get_base_resource_bonus,
	get_marginal_yield: get_marginal_yield,
	get_marginal_loss: get_marginal_loss,
	get_available_defense_pods: get_available_defense_pods,
	get_attack_error: get_attack_error,
	get_attack_targets: get_attack_targets,
	apply_launch: apply_launch,
	rollback_launch: rollback_launch,
};
