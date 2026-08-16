const base_capture = #include('../base_capture');
const snapshots = #include('../entity_snapshots');
const technology_acquisition = #include('../technology_acquisition');
const technology_effects = #include('../technology_effects');
const message_rules = #include('../message_rules');
const unit_order_rules = #include('../unit_order_rules');
const snapshot_unit = snapshots.snapshot_unit;
const RESEARCH_DATA_STOLEN_KEY = 'probe_research_data_stolen';
const ENERGY_RESERVES_DRAINED_KEY = 'probe_energy_reserves_drained';
const GENETIC_PLAGUE_KEY = 'probe_genetic_plague_introduced';

const is_un_charter_active = (game) => {
	const is_repealed = game.get('f_council_is_un_charter_repealed');
	return !#is_defined(is_repealed) || !is_repealed();
};

const get_target_player = (game, operation, target) => {
	return operation == 'subvert_unit'
		? game.get_player(target.owner)
		: target.get_owner();
};

const get_sabotage_facilities = (game, base) => {
	return game.get('f_probe_get_sabotage_facilities')(base);
};

const has_value = (values, value) => {
	for (candidate of values) {
		if (candidate == value) {
			return true;
		}
	}
	return false;
};

const snapshot_base_value = (base, key) => {
	return base.has(key)
		? {key: key, defined: true, value: base.get(key)}
		: {key: key, defined: false, value: null};
};

const restore_base_value = (base, snapshot) => {
	if (snapshot.defined) {
		base.set(snapshot.key, snapshot.value);
	} else if (base.has(snapshot.key)) {
		base.unset(snapshot.key);
	}
};

const spawn_snapshot = (game, snapshot, owner_id, transferred) => {
	return snapshots.spawn_unit_snapshot_as(
		game,
		snapshot,
		game.get_player(owner_id),
		transferred
	);
};

const despawn_snapshots = (game, snapshots) => {
	for (let i = #sizeof(snapshots) - 1; i >= 0; i--) {
		if (game.um.has_unit(snapshots[i].id)) {
			game.um.despawn_unit(game.um.get_unit(snapshots[i].id));
		}
	}
};

const spawn_snapshots = (game, snapshots, owner_id, transferred) => {
	for (snapshot of snapshots) {
		if (snapshot.transport_id == 0) {
			spawn_snapshot(game, snapshot, owner_id, transferred);
		}
	}
	for (snapshot of snapshots) {
		if (snapshot.transport_id != 0) {
			spawn_snapshot(game, snapshot, owner_id, transferred);
		}
	}
};

const restore_unit = (game, snapshot) => {
	if (game.um.has_unit(snapshot.id)) {
		game.um.despawn_unit(game.um.get_unit(snapshot.id));
	}
	return spawn_snapshot(game, snapshot, snapshot.owner, false);
};

const snapshot_pop_types = (base) => {
	let result = [];
	for (pop of base.get_pops()) {
		result :+{pop: pop, type: pop.get_type()};
	}
	return result;
};

const restore_pop_types = (snapshots) => {
	for (snapshot of snapshots) {
		snapshot.pop.set_type(snapshot.type);
	}
};

const get_riot_pop = (base) => {
	for (pop of base.get_pops()) {
		if (pop.get_type() != 'DRONE') {
			return pop;
		}
	}
	return null;
};

const snapshot_surviving_pop_types = (base, removed_count) => {
	let result = [];
	const pops = base.get_pops();
	for (let i = 0; i < #sizeof(pops) - removed_count; i++) {
		result :+{pop: pops[i], type: pops[i].get_type()};
	}
	return result;
};

const remove_base_population = (game, base, count) => {
	let removed = [];
	const old_nutrients = base.get('accumulated_nutrients');
	game.get('f_base_reset_nutrients')(game, base);
	for (let i = 0; i < count; i++) {
		const pops = base.get_pops();
		const pop = pops[#sizeof(pops) - 1];
		const worked_tile = pop.get('worked_tile');
		removed :+{type: pop.get_type(), worked_tile: worked_tile};
		if (#is_defined(worked_tile)) {
			game.get('f_base_pop_unwork_tile')(base, pop);
		}
		base.destroy_pop(pop);
	}
	return {pops: removed, nutrients: old_nutrients};
};

const restore_base_population = (game, base, snapshot) => {
	for (let i = #sizeof(snapshot.pops) - 1; i >= 0; i--) {
		const pop = base.create_pop({type: snapshot.pops[i].type});
		if (#is_defined(snapshot.pops[i].worked_tile)) {
			game.get('f_base_pop_work_tile')(base, pop, snapshot.pops[i].worked_tile);
		}
	}
	base.set('accumulated_nutrients', snapshot.nutrients);
};

const refresh_base_psych = (game, base) => {
	const get_psych = game.get('f_economy_get_base_psych');
	const process_psych = game.get('f_base_process_psych');
	if (#is_defined(get_psych) && #is_defined(process_psych)) {
		process_psych(game, base, get_psych(game, base));
	}
};

const snapshot_base_units = (game, base, owner_id) => {
	let result = [];
	const base_tile = base.get_tile();
	for (unit of game.um.get_units()) {
		const unit_tile = unit.get_tile();
		if (
			unit.owner == owner_id &&
			(unit_tile == base_tile || unit_tile.is_adjactent_to(base_tile))
		) {
			result :+snapshot_unit(unit);
		}
	}
	return result;
};

const promote_probe = (game, probe) => {
	const morale_set = game.um.get_moraleset(probe.get_def().morale_set);
	probe.morale = #min(probe.morale + 1, #sizeof(morale_set) - 1);
};

const get_result_message = (game, operation, target, resolved) => {
	let message = '';
	if (!resolved.success) {
		message = 'Probe operation failed.';
	} else if (operation == 'infiltrate') {
		message = 'Datalinks infiltrated.';
	} else if (operation == 'steal_technology') {
		if (#is_defined(resolved.stole_map) && resolved.stole_map) {
			message = 'Downloaded the target faction world map.';
		} else {
			const resolver = game.get('f_technology_get_definition');
			const definition = #is_defined(resolver) ? resolver(resolved.technology_id) : null;
			message = 'Acquired ' + (
				definition == null ? resolved.technology_id : definition.name
			) + '.';
		}
	} else if (operation == 'sabotage') {
		message = resolved.sabotage_facility_id == ''
			? 'Destroyed accumulated minerals at ' + target.name + '.'
			: 'Sabotaged ' + resolved.sabotage_facility_id + ' at ' + target.name + '.';
	} else if (operation == 'drain_energy') {
		message = 'Drained ' + #to_string(resolved.drain_amount) + ' energy credits.';
	} else if (operation == 'incite_drone_riots') {
		message = 'Drone riots incited at ' + target.name + '.';
	} else if (operation == 'assassinate_researchers') {
		message = 'Prominent researchers assassinated; ' +
			#to_string(resolved.research_loss) + ' research points lost.';
	} else if (operation == 'genetic_plague') {
		message = 'Genetic plague caused ' + #to_string(resolved.population_loss) +
			' population casualties at ' + target.name + '.';
	} else if (operation == 'subvert_unit') {
		const definition = target.get_def();
		message = 'Subverted ' + (
			#is_defined(definition.name) ? definition.name : definition.id
		) + ' for ' + #to_string(resolved.cost) + ' energy credits.';
	} else if (operation == 'mind_control_base') {
		message = 'Mind controlled ' + target.name + ' for ' +
			#to_string(resolved.cost) + ' energy credits.';
	}
	if (#is_defined(resolved.frame_player_id) && resolved.frame_player_id >= 0) {
		const framed_player = game.get_player(resolved.frame_player_id);
		message += resolved.success
			? ' Evidence implicated ' + framed_player.name + '.'
			: ' The attempt to implicate ' + framed_player.name + ' was exposed.';
	} else if (resolved.detected) {
		message += ' The operation was detected.';
	}
	if (!resolved.survives) {
		message += ' Probe Team lost.';
	}
	return message;
};

const validate_base_operation = (e, actor, target_player) => {
	const operation = e.data.operation;
	const base = e.data.target;
	if (
		#typeof(base) != 'Object' || #typeof(base.get_owner) != 'Callable' ||
		#typeof(base.get_size) != 'Callable' || #typeof(base.get_facilities) != 'Callable'
	) {
		return 'Probe operation target must be a base';
	}
	const has_intelligence = e.game.get('f_council_has_intelligence');
	if (
		operation == 'infiltrate' &&
		(#is_defined(has_intelligence)
			? has_intelligence(actor, target_player)
			: actor.has_infiltrated(target_player))
	) {
		return 'Target faction datalinks are already infiltrated';
	}
	if (
		operation == 'steal_technology' &&
		#sizeof(e.game.get('f_probe_get_unknown_technologies')(actor, target_player)) == 0 &&
		e.game.get('f_probe_get_map_data_count')(actor, target_player) == 0
	) {
		return 'Target faction has no research or map data available to steal';
	}
	if (operation == 'steal_technology' && #is_defined(e.data.target_technology_id)) {
		if (#typeof(e.data.target_technology_id) != 'String') {
			return 'Target technology must be a technology identifier';
		}
		if (
			e.data.target_technology_id != '' &&
			!has_value(
				e.game.get('f_probe_get_unknown_technologies')(actor, target_player),
				e.data.target_technology_id
			)
		) {
			return 'Target technology is not available to steal';
		}
	}
	if (
		operation == 'sabotage' && !e.game.get('f_probe_can_sabotage')(base)
	) {
		return 'Target base has nothing available to sabotage';
	}
	if (operation == 'sabotage' && #is_defined(e.data.sabotage_target_id)) {
		if (#typeof(e.data.sabotage_target_id) != 'String') {
			return 'Sabotage target must be a facility or production';
		}
		if (
			e.data.sabotage_target_id == 'production' &&
			base.get_accumulated_minerals() <= 0
		) {
			return 'Target base has no accumulated production to sabotage';
		}
		if (
			e.data.sabotage_target_id != '' &&
			e.data.sabotage_target_id != 'production' &&
			!has_value(get_sabotage_facilities(e.game, base), e.data.sabotage_target_id)
		) {
			return 'Target facility is not available to sabotage';
		}
	}
	if (
		operation == 'drain_energy' &&
		(
			target_player.energy_credits <= 0 || actor.energy_credits >= 1000000000 ||
			e.game.get('f_probe_get_energy_drain_limit')(base) <= 0
		)
	) {
		return 'No energy credits can be drained from the target';
	}
	if (
		operation == 'incite_drone_riots' &&
		!e.game.get('f_probe_can_incite_drone_riots')(base)
	) {
		return 'Target base has no population available to incite';
	}
	if (operation == 'assassinate_researchers') {
		if (!base.has_facility('Headquarters')) {
			return 'Prominent researchers can only be targeted at faction headquarters';
		}
		if (e.game.get('f_probe_get_assassination_research_loss')(target_player) <= 0) {
			return 'Target faction has no active research to disrupt';
		}
	}
	if (operation == 'genetic_plague') {
		if (!actor.has_technology('RetroviralEngineering')) {
			return 'Retroviral Engineering is required for genetic warfare';
		}
		if (e.game.get('f_probe_get_plague_population_loss')(base) <= 0) {
			return 'Target base is too small for a genetic plague';
		}
		if (actor.get_major_atrocities() >= 1000000) {
			return 'Major atrocity limit has been reached';
		}
	}
	if (operation == 'mind_control_base') {
		const cost = e.game.get('f_probe_get_mind_control_cost')(actor, base);
		if (cost == null) {
			return base.has_facility('Headquarters')
				? 'A headquarters base cannot be mind controlled'
				: 'Target faction is immune to mind control';
		}
		if (actor.energy_credits < cost) {
			return 'Not enough energy credits to mind control this base';
		}
	}
};

return {
	unit_visibility: 'private',
	player_visibility: 'private',

	validate: (e) => {
		const probe = e.data.unit;
		if (#typeof(probe) != 'Object' || #typeof(probe.get_def) != 'Callable') {
			return 'Probe operation requires a unit';
		}
		const order_error = unit_order_rules.get_unavailable_reason(probe);
		if (order_error != null) {
			return order_error;
		}
		if (probe.owner != e.caller) {
			return 'Probe Team can only be ordered by its owner';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (!e.game.get('f_probe_is_unit')(probe)) {
			return 'Only a Probe Team can perform probe operations';
		}
		if (probe.health <= 0.0 || probe.movement <= 0.0) {
			return 'Probe Team is unable to act';
		}
		if (#is_defined(probe.transport_id) && probe.transport_id > 0) {
			return 'Embarked Probe Team must disembark before acting';
		}
		if (probe.terraforming != 'none') {
			return 'Probe Team cannot act while terraforming';
		}

		const operations = e.game.get('f_probe_get_operations')();
		const operation = e.data.operation;
		if (#typeof(operation) != 'String' || !#is_defined(operations[operation])) {
			return 'Unknown probe operation';
		}
		if (#is_defined(e.data.untraceable)) {
			if (#typeof(e.data.untraceable) != 'Bool') {
				return 'Untraceable probe option must be a boolean';
			}
			if (e.data.untraceable && !operations[operation].cost) {
				return 'Only capture operations can be made untraceable';
			}
		}
		const target = e.data.target;
		if (#typeof(target) != 'Object' || #typeof(target.get_tile) != 'Callable') {
			return 'Probe operation requires a target';
		}
		if (!probe.get_tile().is_adjactent_to(target.get_tile())) {
			return 'Probe operation target must be adjacent';
		}
		const actor = e.game.get_player(e.caller);
		if (
			operations[operation].target == 'base' &&
			#typeof(target.get_owner) != 'Callable'
		) {
			return 'Probe operation target must be a base';
		}
		const target_player = get_target_player(e.game, operation, target);
		if (target_player.id == actor.id) {
			return 'Probe Team cannot target its own faction';
		}
		const get_forced_relation = e.game.get('f_council_get_forced_relation');
		if (
			#typeof(get_forced_relation) == 'Callable' &&
			get_forced_relation(actor, target_player) == 'pact'
		) {
			return 'Factions loyal to the Supreme Leader cannot target each other with Probe Teams';
		}
		if (
			operations[operation].target == 'base' &&
			e.game.get('f_probe_get_defending_probe')(target_player, target) != null
		) {
			return;
		}
		if (e.game.get('f_probe_has_project')(target_player, 'TheHunterSeekerAlgorithm')) {
			return 'The Hunter-Seeker Algorithm blocks this probe operation';
		}
		if (#is_defined(e.data.frame_player_id)) {
			if (#typeof(e.data.frame_player_id) != 'Int') {
				return 'Framed faction must be a player identifier';
			}
			if (!e.game.get('f_probe_is_frameable_operation')(operation)) {
				return 'This probe operation cannot be used to frame another faction';
			}
			let valid_frame = false;
			for (candidate of e.game.get('f_probe_get_frame_candidates')(
				actor,
				target_player,
				operation
			)) {
				if (candidate.id == e.data.frame_player_id) {
					valid_frame = true;
				}
			}
			if (!valid_frame) {
				return 'Selected faction cannot be framed for this operation';
			}
			if (e.game.get('f_probe_get_success_chance')(
				probe,
				target_player,
				operation,
				target,
				e.data
			) <= 0) {
				return 'Probe Team morale is too low to frame another faction';
			}
		}

		if (operations[operation].target == 'base') {
			return validate_base_operation(e, actor, target_player);
		}
		const subversion_error = e.game.get('f_probe_get_subversion_error')(probe, target);
		if (subversion_error != '') {
			return subversion_error;
		}
		const cost = e.game.get('f_probe_get_subversion_cost')(actor, target);
		if (cost == null) {
			return 'Target faction is immune to unit subversion';
		}
		if (actor.energy_credits < cost) {
			return 'Not enough energy credits to subvert this unit';
		}
	},

	resolve: (e) => {
		const operation = e.data.operation;
		const actor = e.game.get_player(e.caller);
		const target_player = get_target_player(e.game, operation, e.data.target);
		const operations = e.game.get('f_probe_get_operations')();
		const defender = operations[operation].target == 'base'
			? e.game.get('f_probe_get_defending_probe')(target_player, e.data.target)
			: null;
		if (defender != null) {
			const combat = e.game.get('f_probe_resolve_combat')(e.data.unit, defender);
			return {
				success: false,
				detected: false,
				survives: !combat.attacker_dead,
				chance: 0,
				survival_chance: 0,
				cost: 0,
				technology_id: '',
				stole_map: false,
				sabotage_facility_id: '',
				drain_amount: 0,
				research_loss: 0,
				population_loss: 0,
				unit_damage: [],
				defender_id: defender.id,
				frame_player_id: #is_defined(e.data.frame_player_id)
					? e.data.frame_player_id : 0 - 1,
				probe_combat: combat,
			};
		}
		const chance = e.game.get('f_probe_get_success_chance')(
			e.data.unit,
			target_player,
			operation,
			e.data.target,
			e.data
		);
		const success = e.game.random.get_int(1, 100) <= chance;
		const survival_chance = e.game.get('f_probe_get_survival_chance')(
			e.data.unit,
			target_player,
			operation,
			e.data.target,
			e.data
		);
		const paid = operation == 'subvert_unit' || operation == 'mind_control_base';
		const untraceable = paid && #is_defined(e.data.untraceable) && e.data.untraceable;
		const detected = operation == 'genetic_plague' || !success ||
			(!untraceable && (paid || e.game.random.get_int(1, 100) <= 35));
		const survives = success && e.game.random.get_int(1, 100) <= survival_chance;
		let result = {
			success: success,
			detected: detected,
			survives: survives,
			chance: chance,
			survival_chance: survival_chance,
			cost: 0,
			technology_id: '',
			stole_map: false,
			sabotage_facility_id: '',
			drain_amount: 0,
			research_loss: 0,
			population_loss: 0,
			unit_damage: [],
			defender_id: defender == null ? 0 : defender.id,
			frame_player_id: #is_defined(e.data.frame_player_id)
				? e.data.frame_player_id : 0 - 1,
		};
		if (operation == 'subvert_unit') {
			result.cost = e.game.get('f_probe_get_subversion_cost')(actor, e.data.target);
		} else if (operation == 'mind_control_base') {
			result.cost = e.game.get('f_probe_get_mind_control_cost')(actor, e.data.target);
		} else if (success && operation == 'steal_technology') {
			const unknown = e.game.get('f_probe_get_unknown_technologies')(actor, target_player);
			if (#sizeof(unknown) == 0) {
				result.stole_map = true;
			} else {
				result.technology_id = #is_defined(e.data.target_technology_id) &&
					e.data.target_technology_id != ''
					? e.data.target_technology_id
					: unknown[e.game.random.get_int(0, #sizeof(unknown) - 1)];
			}
		} else if (success && operation == 'sabotage') {
			const facilities = get_sabotage_facilities(e.game, e.data.target);
			if (#is_defined(e.data.sabotage_target_id) && e.data.sabotage_target_id != '') {
				result.sabotage_facility_id = e.data.sabotage_target_id == 'production'
					? '' : e.data.sabotage_target_id;
			} else if (
				#sizeof(facilities) > 0 &&
				(e.data.target.get_accumulated_minerals() <= 0 || e.game.random.get_int(0, 1) == 1)
			) {
				result.sabotage_facility_id = facilities[
					e.game.random.get_int(0, #sizeof(facilities) - 1)
				];
			}
		} else if (success && operation == 'drain_energy') {
			const room = 1000000000 - actor.energy_credits;
			const limit = e.game.get('f_probe_get_energy_drain_limit')(e.data.target);
			const morale = e.game.get('f_probe_get_morale')(e.data.unit);
			const minimum = #floor(#to_float(limit * morale) / 6.0);
			const spread = #max(0, limit - minimum);
			const random_bonus = spread == 0
				? 0
				: #floor(#to_float(e.game.random.get_int(0, spread - 1)) / 2.0);
			result.drain_amount = #min(
				room,
				#min(target_player.energy_credits, minimum + random_bonus)
			);
			if (result.drain_amount == 1) {
				result.drain_amount = 0;
			}
		} else if (success && operation == 'assassinate_researchers') {
			result.research_loss = e.game.get('f_probe_get_assassination_research_loss')(
				target_player,
				e.game.random
			);
		} else if (success && operation == 'genetic_plague') {
			result.population_loss = e.game.get('f_probe_get_plague_population_loss')(
				e.data.target
			);
			result.unit_damage = e.game.get('f_probe_get_plague_unit_damage')(
				e.data.target,
				e.game.random
			);
		}
		return result;
	},

	apply: (e) => {
		const operation = e.data.operation;
		const probe = e.data.unit;
		const actor = e.game.get_player(e.caller);
		const target_player = get_target_player(e.game, operation, e.data.target);
		const frame_player_id = #is_defined(e.resolved.frame_player_id)
			? e.resolved.frame_player_id : 0 - 1;
		let applied = {
			probe: snapshot_unit(probe),
			target_player_id: target_player.id,
			actor_energy: actor.energy_credits,
			target_energy: target_player.energy_credits,
			infiltrated: actor.has_infiltrated(target_player),
			actor_atrocities: actor.get_major_atrocities(),
			actor_sanction_turns: actor.get_sanction_turns(),
			frame_player_id: frame_player_id,
		};
		if (
			#typeof(actor.get_mind_control_total) == 'Callable' &&
			#typeof(actor.set_mind_control_total) == 'Callable'
		) {
			applied.actor_mind_control_total = actor.get_mind_control_total();
		}

		if (e.resolved.cost > 0) {
			actor.set_energy_credits(actor.energy_credits - e.resolved.cost);
		}
		probe.movement = 0.0;
		probe.moved_this_turn = true;
		if (#is_defined(e.resolved.probe_combat)) {
			const defender = e.game.um.get_unit(e.resolved.defender_id);
			applied.defending_probe = snapshot_unit(defender);
			defender.movement = 0.0;
			defender.moved_this_turn = true;
			for (step of e.resolved.probe_combat.sequence) {
				if (step[0]) {
					defender.health = #max(0.0, defender.health - step[1]);
				} else {
					probe.health = #max(0.0, probe.health - step[1]);
				}
			}
			if (e.resolved.probe_combat.attacker_dead) {
				probe.health = 0.0;
			}
			if (e.resolved.probe_combat.defender_dead) {
				defender.health = 0.0;
			}
			const attacker_won = !e.resolved.probe_combat.attacker_dead &&
				e.resolved.probe_combat.defender_dead;
			if (attacker_won) {
				promote_probe(e.game, probe);
			} else {
				promote_probe(e.game, defender);
			}
			e.game.trigger('probe_operation', {
				player: actor,
				target: target_player,
				operation: operation,
				success: false,
				detected: false,
				probe_combat: true,
				attacker_id: probe.id,
				defender_id: defender.id,
				attacker_won: attacker_won,
			});
			if (e.resolved.probe_combat.attacker_dead) {
				e.game.um.despawn_unit(probe);
			}
			if (e.resolved.probe_combat.defender_dead) {
				e.game.um.despawn_unit(defender);
			}
			message_rules.to_players(e.game, [actor, target_player], attacker_won
				? 'Infiltrating Probe Team defeated the resident Probe Team. Operation delayed.'
				: 'Resident Probe Team defeated the infiltrating Probe Team. Operation aborted.'
			);
			return applied;
		}
		const result_message = get_result_message(
			e.game,
			operation,
			e.data.target,
			e.resolved
		);

		if (e.resolved.success && operation == 'infiltrate') {
			actor.set_infiltrated(target_player, true);
		} else if (e.resolved.success && operation == 'steal_technology') {
			applied.research_data_stolen = snapshot_base_value(
				e.data.target,
				RESEARCH_DATA_STOLEN_KEY
			);
			e.data.target.set(RESEARCH_DATA_STOLEN_KEY, true);
			if (#is_defined(e.resolved.stole_map) && e.resolved.stole_map) {
				applied.map_reveal = e.game.get('f_exploration_apply_map_share')(
					target_player,
					actor
				);
			} else {
				applied.research = actor.get_research_state();
				let technologies = [];
				for (id of applied.research.technologies) {
					technologies :+id;
				}
				technologies :+e.resolved.technology_id;
				let target = applied.research.target;
				let progress = applied.research.progress;
				if (target == e.resolved.technology_id) {
					target = e.game.get('f_technology_get_next_target')(technologies, actor);
					if (target == '') {
						progress = 0;
					}
				}
				actor.set_research_state({
					technologies: technologies,
					target: target,
					progress: progress,
					cost: technology_acquisition.get_state_cost(
						e.game,
						actor,
						technologies,
						target,
						applied.research
					),
				});
				applied.technology_map_reveals = technology_effects.apply_map_reveals(
					e.game,
					actor,
					[e.resolved.technology_id]
				);
				applied.technology_specialist_updates =
					technology_effects.apply_specialist_updates(e.game, actor);
				e.game.trigger('research_updated', {player: actor});
				const queue_datalinks = e.game.get('f_project_queue_planetary_datalinks');
				if (#is_defined(queue_datalinks)) {
					queue_datalinks();
				}
			}
		} else if (e.resolved.success && operation == 'sabotage') {
			const base = e.data.target;
			applied.base_minerals = base.get_accumulated_minerals();
			applied.pop_types = snapshot_pop_types(base);
			if (e.resolved.sabotage_facility_id == '') {
				base.set_accumulated_minerals(0);
			} else {
				base.remove_facility(e.resolved.sabotage_facility_id);
				refresh_base_psych(e.game, base);
			}
			e.game.trigger('update_base', {base: base});
		} else if (e.resolved.success && operation == 'drain_energy') {
			applied.energy_reserves_drained = snapshot_base_value(
				e.data.target,
				ENERGY_RESERVES_DRAINED_KEY
			);
			e.data.target.set(ENERGY_RESERVES_DRAINED_KEY, true);
			actor.set_energy_credits(actor.energy_credits + e.resolved.drain_amount);
			target_player.set_energy_credits(target_player.energy_credits - e.resolved.drain_amount);
		} else if (e.resolved.success && operation == 'incite_drone_riots') {
			const base = e.data.target;
			applied.pop_types = snapshot_pop_types(base);
			get_riot_pop(base).set_type('DRONE');
			e.game.trigger('update_base', {base: base});
		} else if (e.resolved.success && operation == 'assassinate_researchers') {
			applied.target_research = target_player.get_research_state();
			target_player.set_research_state({
				technologies: applied.target_research.technologies,
				target: applied.target_research.target,
				progress: #max(0, applied.target_research.progress - e.resolved.research_loss),
			});
			e.game.trigger('research_updated', {player: target_player});
		} else if (e.resolved.success && operation == 'genetic_plague') {
			const base = e.data.target;
			applied.genetic_plague = snapshot_base_value(base, GENETIC_PLAGUE_KEY);
			base.set(GENETIC_PLAGUE_KEY, true);
			applied.plague_units = [];
			if (#is_defined(e.resolved.unit_damage)) {
				for (damage of e.resolved.unit_damage) {
					if (!e.game.um.has_unit(damage.unit_id)) {
						continue;
					}
					const unit = e.game.um.get_unit(damage.unit_id);
					applied.plague_units :+{unit_id: unit.id, health: unit.health};
					unit.health = damage.health;
				}
			}
			applied.pop_types = snapshot_surviving_pop_types(base, e.resolved.population_loss);
			applied.population = remove_base_population(e.game, base, e.resolved.population_loss);
			actor.set_major_atrocities(applied.actor_atrocities + 1);
			if (is_un_charter_active(e.game)) {
				actor.set_sanction_turns(#min(1000000, applied.actor_sanction_turns + 10));
				e.game.trigger('diplomatic_sanctions_updated', {
					player: actor,
					turns: actor.get_sanction_turns(),
				});
				e.game.message(
					'Economic sanctions imposed against ' + actor.name + ' for 10 years.'
				);
			}
			refresh_base_psych(e.game, base);
			e.game.trigger('update_base', {base: base});
		} else if (e.resolved.success && operation == 'subvert_unit') {
			applied.transferred_units = [snapshot_unit(e.data.target)];
			despawn_snapshots(e.game, applied.transferred_units);
			spawn_snapshots(e.game, applied.transferred_units, actor.id, true);
		} else if (e.resolved.success && operation == 'mind_control_base') {
			const base = e.data.target;
			applied.pop_types = snapshot_pop_types(base);
			applied.transferred_units = snapshot_base_units(e.game, base, target_player.id);
			despawn_snapshots(e.game, applied.transferred_units);
			applied.base_capture = base_capture.capture_base(e.game, base, actor);
			spawn_snapshots(e.game, applied.transferred_units, actor.id, true);
			refresh_base_psych(e.game, base);
			e.game.trigger('update_base', {base: base});
		}
		if (
			e.resolved.success && #is_defined(applied.actor_mind_control_total) &&
			(operation == 'subvert_unit' || operation == 'mind_control_base')
		) {
			actor.set_mind_control_total(#min(
				1000000,
				applied.actor_mind_control_total + (operation == 'mind_control_base' ? 4 : 1)
			));
		}

		if (e.resolved.success && e.resolved.survives && e.game.um.has_unit(probe.id)) {
			promote_probe(e.game, probe);
		}
		if (!e.resolved.survives && e.game.um.has_unit(probe.id)) {
			e.game.um.despawn_unit(probe);
		}

		if (frame_player_id >= 0) {
			const framed_player = e.game.get_player(frame_player_id);
			if (e.resolved.success) {
				applied.framed_diplomacy = e.game.get('f_diplomacy_snapshot_pair')(
					framed_player,
					target_player
				);
				e.game.get('f_diplomacy_set_bilateral_relation')(
					target_player,
					framed_player,
					'vendetta',
					true
				);
				e.game.get('f_diplomacy_clear_offers')(framed_player, target_player);
				e.game.trigger('diplomacy_updated', {
					player: target_player,
					target: framed_player,
					relation: 'vendetta',
				});
			} else {
				applied.diplomacy = e.game.get('f_diplomacy_snapshot_pair')(
					actor,
					target_player
				);
				e.game.get('f_diplomacy_set_bilateral_relation')(
					target_player,
					actor,
					'vendetta',
					true
				);
				e.game.get('f_diplomacy_clear_offers')(actor, target_player);
				e.game.trigger('diplomacy_updated', {
					player: target_player,
					target: actor,
					relation: 'vendetta',
				});
				applied.exposed_diplomacy = e.game.get('f_diplomacy_snapshot_pair')(
					actor,
					framed_player
				);
				if (framed_player.type == 'ai') {
					e.game.get('f_diplomacy_set_bilateral_relation')(
						framed_player,
						actor,
						'vendetta',
						true
					);
					e.game.get('f_diplomacy_clear_offers')(actor, framed_player);
					e.game.trigger('diplomacy_updated', {
						player: framed_player,
						target: actor,
						relation: 'vendetta',
					});
				} else if (framed_player.get_diplomatic_relation(actor) != 'vendetta') {
					const expiry_turn = #min(1000000, e.game.get_turn() + 1);
					framed_player.set_diplomatic_excuse_turn(actor, expiry_turn);
					applied.exposed_excuse = true;
					e.game.trigger('diplomatic_excuse_updated', {
						player: framed_player,
						target: actor,
						expiry_turn: expiry_turn,
						used: false,
					});
					message_rules.to_players(
						e.game,
						[actor, target_player, framed_player],
						framed_player.name + ' has cause against ' + actor.name +
						' after the exposed framing attempt.'
					);
				}
			}
		} else if (e.resolved.detected) {
			applied.diplomacy = e.game.get('f_diplomacy_snapshot_pair')(actor, target_player);
			e.game.get('f_diplomacy_set_bilateral_relation')(
				target_player,
				actor,
				'vendetta',
				true
			);
			e.game.get('f_diplomacy_clear_offers')(actor, target_player);
			e.game.trigger('diplomacy_updated', {
				player: target_player,
				target: actor,
				relation: 'vendetta',
			});
		}
		if (e.resolved.success && operation == 'genetic_plague') {
			e.game.get('f_diplomacy_add_grievance')(
				target_player,
				actor,
				true,
				true,
				false
			);
			e.game.trigger('diplomatic_grievance_updated', {
				player: target_player,
				target: actor,
			});
		}
		e.game.trigger('economy_updated', {player: actor});
		e.game.trigger('economy_updated', {player: target_player});
		e.game.trigger('probe_operation', {
			player: actor,
			target: target_player,
			operation: operation,
			success: e.resolved.success,
			detected: e.resolved.detected,
			frame_player_id: frame_player_id,
			framing_exposed: frame_player_id >= 0 && !e.resolved.success,
			atrocity: operation == 'genetic_plague' && e.resolved.success,
		});
		let result_players = [actor];
		if (e.resolved.detected) {
			result_players :+target_player;
		}
		message_rules.to_players(e.game, result_players, result_message);
		return applied;
	},

	rollback: (e) => {
		const operation = e.data.operation;
		const actor = e.game.get_player(e.caller);
		const target_player = e.game.get_player(e.applied.target_player_id);
		if (#is_defined(e.applied.transferred_units)) {
			despawn_snapshots(e.game, e.applied.transferred_units);
			spawn_snapshots(e.game, e.applied.transferred_units, target_player.id, false);
		}
		if (#is_defined(e.applied.base_capture)) {
			base_capture.restore_base(e.game, e.data.target, e.applied.base_capture);
		}
		if (#is_defined(e.applied.population)) {
			restore_base_population(e.game, e.data.target, e.applied.population);
		}
		if (#is_defined(e.applied.genetic_plague)) {
			restore_base_value(e.data.target, e.applied.genetic_plague);
		}
		if (#is_defined(e.applied.plague_units)) {
			for (snapshot of e.applied.plague_units) {
				if (e.game.um.has_unit(snapshot.unit_id)) {
					const unit = e.game.um.get_unit(snapshot.unit_id);
					unit.health = snapshot.health;
				}
			}
		}
		if (#is_defined(e.applied.defending_probe)) {
			restore_unit(e.game, e.applied.defending_probe);
		}
		if (#is_defined(e.applied.base_minerals)) {
			e.data.target.set_accumulated_minerals(e.applied.base_minerals);
		}
		if (
			operation == 'sabotage' && e.resolved.sabotage_facility_id != '' &&
			!e.data.target.has_facility(e.resolved.sabotage_facility_id)
		) {
			e.data.target.add_facility(e.resolved.sabotage_facility_id);
		}
		if (#is_defined(e.applied.pop_types)) {
			restore_pop_types(e.applied.pop_types);
		}
		if (#is_defined(e.applied.research)) {
			technology_effects.rollback_specialist_updates(
				e.applied.technology_specialist_updates
			);
			technology_effects.rollback_map_reveals(
				e.game,
				e.applied.technology_map_reveals
			);
			actor.set_research_state(e.applied.research);
			e.game.trigger('research_updated', {player: actor});
		}
		if (#is_defined(e.applied.map_reveal)) {
			e.game.get('f_exploration_rollback_reveal')(e.applied.map_reveal);
		}
		if (#is_defined(e.applied.research_data_stolen)) {
			restore_base_value(e.data.target, e.applied.research_data_stolen);
		}
		if (#is_defined(e.applied.energy_reserves_drained)) {
			restore_base_value(e.data.target, e.applied.energy_reserves_drained);
		}
		if (#is_defined(e.applied.target_research)) {
			target_player.set_research_state(e.applied.target_research);
			e.game.trigger('research_updated', {player: target_player});
		}
		actor.set_infiltrated(target_player, e.applied.infiltrated);
		actor.set_energy_credits(e.applied.actor_energy);
		actor.set_major_atrocities(e.applied.actor_atrocities);
		actor.set_sanction_turns(e.applied.actor_sanction_turns);
		if (#is_defined(e.applied.actor_mind_control_total)) {
			actor.set_mind_control_total(e.applied.actor_mind_control_total);
		}
		target_player.set_energy_credits(e.applied.target_energy);
		e.game.trigger('diplomatic_sanctions_updated', {
			player: actor,
			turns: e.applied.actor_sanction_turns,
		});
		restore_unit(e.game, e.applied.probe);
		if (#is_defined(e.applied.diplomacy)) {
			e.game.get('f_diplomacy_restore_pair')(actor, target_player, e.applied.diplomacy);
			e.game.trigger('diplomacy_updated', {
				player: actor,
				target: target_player,
				relation: e.applied.diplomacy.player_relation,
			});
		}
		if (#is_defined(e.applied.exposed_diplomacy)) {
			const framed_player = e.game.get_player(e.applied.frame_player_id);
			e.game.get('f_diplomacy_restore_pair')(
				actor,
				framed_player,
				e.applied.exposed_diplomacy
			);
			e.game.trigger('diplomacy_updated', {
				player: actor,
				target: framed_player,
				relation: e.applied.exposed_diplomacy.player_relation,
			});
			if (#is_defined(e.applied.exposed_excuse) && e.applied.exposed_excuse) {
				e.game.trigger('diplomatic_excuse_updated', {
					player: framed_player,
					target: actor,
					expiry_turn: e.applied.exposed_diplomacy.other_excuse_turn,
					used: false,
				});
			}
		}
		if (#is_defined(e.applied.framed_diplomacy)) {
			const framed_player = e.game.get_player(e.applied.frame_player_id);
			e.game.get('f_diplomacy_restore_pair')(
				framed_player,
				target_player,
				e.applied.framed_diplomacy
			);
			e.game.trigger('diplomacy_updated', {
				player: target_player,
				target: framed_player,
				relation: e.applied.framed_diplomacy.other_relation,
			});
		}
		if (operation == 'genetic_plague') {
			e.game.trigger('diplomatic_grievance_updated', {
				player: target_player,
				target: actor,
			});
		}
		e.game.trigger('economy_updated', {player: actor});
		e.game.trigger('economy_updated', {player: target_player});
		if (
			operation == 'sabotage' || operation == 'mind_control_base' ||
			operation == 'incite_drone_riots' || operation == 'genetic_plague'
		) {
			e.game.trigger('update_base', {base: e.data.target});
		}
	},
};
