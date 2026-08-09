const MOVEMENT_ACTION_DELAY = 200;
const action_state = #include('ai/action_state');
const colonization = #include('ai/colonization');
const combat = #include('ai/combat');
const diplomacy = #include('ai/diplomacy');
const pathfinding = #include('ai/pathfinding');
const production = #include('ai/production');
const research = #include('ai/research');
const social_engineering = #include('ai/social_engineering');
const strategy = #include('ai/strategy');
const terraforming = #include('ai/terraforming');
const movement_rules = #include('movement_rules');
const unit_abilities = #include('unit_abilities');
const air = #include('../units/air');

const owned_bases = (game, player) => {
	let result = [];
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			result :+base;
		}
	}
	return result;
};

const filter_owned_units = (units, player) => {
	let result = [];
	for (unit of units) {
		if (unit.owner == player.id) {
			result :+unit;
		}
	}
	return result;
};

const owned_units = (game, player) => {
	return filter_owned_units(game.get_um().get_units(), player);
};

const is_protected_partner = (game, player, other_player_id) => {
	if (other_player_id == player.id) {
		return false;
	}
	const relation = player.get_diplomatic_relation(game.get_player(other_player_id));
	return relation == 'treaty' || relation == 'pact';
};

const filter_hostile_units = (game, player, units) => {
	let result = [];
	for (unit of units) {
		if (!is_protected_partner(game, player, unit.owner)) {
			result :+unit;
		}
	}
	return result;
};

const filter_hostile_bases = (game, player, bases) => {
	let result = [];
	for (base of bases) {
		if (!is_protected_partner(game, player, base.get_owner().id)) {
			result :+base;
		}
	}
	return result;
};

const get_combat_power_metrics = (game, player) => {
	let own = 0.0;
	let strongest_rival = 0.0;
	for (candidate of game.get_players()) {
		let power = 0.0;
		for (unit of game.get_um().get_units()) {
			if (unit.owner == candidate.id) {
				power += combat.get_force_power(unit);
			}
		}
		if (candidate.id == player.id) {
			own = power;
		} else {
			strongest_rival = #max(strongest_rival, power);
		}
	}
	return {
		own: own,
		strongest_rival: strongest_rival,
	};
};

const get_player_power = (game, player) => {
	let power = 0.0;
	for (unit of game.get_um().get_units()) {
		if (unit.owner == player.id) {
			power += combat.get_force_power(unit);
		}
	}
	return power;
};

const get_player_base_count = (game, player) => {
	let count = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			count++;
		}
	}
	return count;
};

const update_diplomacy = (game, player) => {
	const own_power = get_player_power(game, player);
	const own_bases = get_player_base_count(game, player);
	for (other of game.get_players()) {
		if (other.id == player.id) {
			continue;
		}
		const offer = player.get_diplomatic_offer(other);
		if (offer != '') {
			game.event_as(player.id, 'respond_diplomatic_proposal', {
				player: player,
				proposer: other,
				accept: diplomacy.should_accept({
					offer: offer,
					relation: player.get_diplomatic_relation(other),
					own_power: own_power,
					other_power: get_player_power(game, other),
					own_bases: own_bases,
					other_bases: get_player_base_count(game, other),
				}),
			});
			return;
		}
	}

	if ((game.get_turn() + player.id) % 8 != 0) {
		return;
	}
	let best = null;
	let best_target = null;
	for (other of game.get_players()) {
		if (
			other.id == player.id ||
			other.get_diplomatic_offer(player) != '' ||
			player.get_diplomatic_offer(other) != ''
		) {
			continue;
		}
		const proposal = diplomacy.get_proposal({
			relation: player.get_diplomatic_relation(other),
			own_power: own_power,
			other_power: get_player_power(game, other),
			own_bases: own_bases,
			other_bases: get_player_base_count(game, other),
		});
		if (
			proposal != null &&
			(best == null || proposal.score > best.score ||
				(proposal.score == best.score && other.id < best_target.id))
		) {
			best = proposal;
			best_target = other;
		}
	}
	if (best != null) {
		game.event_as(player.id, 'propose_diplomatic_relation', {
			player: player,
			target: best_target,
			relation: best.relation,
		});
	}
};

const get_strategy_metrics = (game, player, bases, units) => {
	let former_count = 0;
	let colony_count = 0;
	let sea_colony_count = 0;
	let combat_count = 0;
	let mobile_combat_count = 0;
	for (unit of units) {
		const def = unit.get_def();
		if (def.can_terraform) {
			former_count++;
		}
		if (def.can_found_base) {
			colony_count++;
			if (def.is_water) {
				sea_colony_count++;
			}
		}
		if (def.offense > 0) {
			combat_count++;
			if (def.movement_per_turn > 1.0) {
				mobile_combat_count++;
			}
		}
	}

	const tm = game.get_tm();
	const all_units = game.get_um().get_units();
	const combat_power = get_combat_power_metrics(game, player);
	let underdefended_bases = 0;
	let growth_stalled_bases = 0;
	let unstable_bases = 0;
	let base_labs = 0;
	let sea_base_count = 0;
	for (base of bases) {
		if (base.get_tile().is_water) {
			sea_base_count++;
		}
		if (
			combat.get_garrison_count(base, player.id) <
			combat.get_required_garrison(tm, base, player.id, all_units)
		) {
			underdefended_bases++;
		}
		const intake = base.get_intake();
		const consumption = base.get_consumption();
		if (
			base.get_size() < 3 ||
			base.get_size() >= game.get('f_base_get_population_limit')(base) ||
			intake.NUTRIENTS - consumption.NUTRIENTS <= 0
		) {
			growth_stalled_bases++;
		}
		const psych = game.get('f_economy_get_base_psych')(game, base);
		if (game.get('f_base_get_stable_worker_count')(base, psych) < base.get_size()) {
			unstable_bases++;
		}
		base_labs += game.get('f_technology_get_base_labs')(base).total;
	}
	return {
		base_count: #sizeof(bases),
		desired_base_count: strategy.get_desired_base_count(
			game.get_turn(),
			tm.get_map_width(),
			tm.get_map_height(),
			#sizeof(game.get_players())
		),
		former_count: former_count,
		colony_count: colony_count,
		sea_colony_count: sea_colony_count,
		sea_base_count: sea_base_count,
		combat_count: combat_count,
		mobile_combat_count: mobile_combat_count,
		underdefended_bases: underdefended_bases,
		growth_stalled_bases: growth_stalled_bases,
		unstable_bases: unstable_bases,
		base_labs: base_labs,
		energy_income: game.get('f_economy_get_player')(game, player),
		own_combat_power: combat_power.own,
		strongest_rival_power: combat_power.strongest_rival,
	};
};

const get_strategy_priorities = (metrics, former_count, colony_count, combat_count, mobile_combat_count) => {
	return strategy.get_priorities({
		base_count: metrics.base_count,
		desired_base_count: metrics.desired_base_count,
		former_count: former_count,
		colony_count: colony_count,
		combat_count: combat_count,
		mobile_combat_count: mobile_combat_count,
		underdefended_bases: metrics.underdefended_bases,
		growth_stalled_bases: metrics.growth_stalled_bases,
		unstable_bases: metrics.unstable_bases,
		energy_income: metrics.energy_income,
		own_combat_power: metrics.own_combat_power,
		strongest_rival_power: metrics.strongest_rival_power,
	});
};

const choose_tile = (tiles, score) => {
	let best = null;
	let best_score = 0;
	for (tile of tiles) {
		const value = score(tile);
		if (
			best == null ||
			value > best_score ||
			(value == best_score && (tile.y < best.y || (tile.y == best.y && tile.x < best.x)))
		) {
			best = tile;
			best_score = value;
		}
	}
	return best;
};

const get_air_refuel_base = (tm, unit, player_id, bases) => {
	let best = null;
	let best_distance = 0;
	for (base of bases) {
		if (base.get_owner().id != player_id) {
			continue;
		}
		const distance = tm.get_distance(unit.get_tile(), base.get_tile());
		if (
			best == null || distance < best_distance ||
			(distance == best_distance && base.id < best.id)
		) {
			best = base;
			best_distance = distance;
		}
	}
	return best;
};

const move_air_to_refuel = (game, player, unit, bases) => {
	const def = unit.get_def();
	if (def.operational_range <= 0 || unit.fuel >= def.operational_range) {
		return 0 - 1;
	}
	if (air.is_refueling(unit)) {
		return 0;
	}
	const tm = game.get_tm();
	const base = get_air_refuel_base(tm, unit, player.id, bases);
	if (base == null || base.get_tile() == unit.get_tile()) {
		return 0;
	}
	const destination = base.get_tile();
	const current_distance = tm.get_distance(unit.get_tile(), destination);
	let step = choose_tile(unit.get_tile().get_surrounding_tiles(), (candidate) => {
		if (!can_enter(unit, candidate)) {
			return 0 - 100000;
		}
		return 10000 - tm.get_distance(candidate, destination) * 100;
	});
	if (step == null || tm.get_distance(step, destination) >= current_distance) {
		step = pathfinding.find_path_step(tm, unit, destination, (source, candidate) => {
			return can_enter(unit, candidate, source);
		});
	}
	if (step != null && can_enter(unit, step)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: step});
		return 100;
	}
	return 0;
};

const can_enter = (unit, tile, source) => {
	if (unit.get_tile() == tile || tile.is_locked()) {
		return false;
	}
	if (unit.is_land && tile.is_water) {
		return false;
	}
	if (unit.is_water && tile.is_land && tile.get_base() == null) {
		return false;
	}
	for (other of tile.get_units()) {
		if (other.owner != unit.owner) {
			return false;
		}
	}
	const source_tile = #is_defined(source) ? source : unit.get_tile();
	if (movement_rules.is_zoc_move_blocked(unit, source_tile, tile)) {
		return false;
	}
	return true;
};

const has_other_active_former = (tile, unit) => {
	for (other of tile.get_units()) {
		if (other.id != unit.id && other.terraforming != 'none') {
			return true;
		}
	}
	return false;
};

const has_other_former = (tile, unit) => {
	for (other of tile.get_units()) {
		if (other.id != unit.id && other.get_def().can_terraform) {
			return true;
		}
	}
	return false;
};

const attack_enemy_in_tiles = (game, player, unit, tiles, units) => {
	let available_tiles = [];
	for (tile of tiles) {
		if (!tile.is_locked()) {
			available_tiles :+tile;
		}
	}
	const target = combat.choose_attack_target(
		unit,
		player.id,
		available_tiles,
		game.get_tm(),
		units,
		(owner_id) => { return !is_protected_partner(game, player, owner_id); }
	);
	if (target == null) {
		return false;
	}
	game.event_as(player.id, 'attack_unit', {attacker: unit, defender: target});
	return true;
};

const queue_production = (game, player, bases, units) => {
	const metrics = get_strategy_metrics(game, player, bases, units);
	let former_count = metrics.former_count;
	let colony_count = metrics.colony_count;
	let sea_colony_count = metrics.sea_colony_count;
	let combat_count = metrics.combat_count;
	let mobile_combat_count = metrics.mobile_combat_count;
	const unit_defs = game.get_um().get_unit_defs();
	const facility_defs = game.get_bm().get_facility_defs();
	let available_energy = #max(metrics.energy_income, 0);
	const tm = game.get_tm();
	const all_units = game.get_um().get_units();
	let hurry_candidates = [];
	for (base of bases) {
		const garrison_count = combat.get_garrison_count(base, player.id);
		const support_cost_resolver = game.get('f_social_get_support_cost');
		const free_support_resolver = game.get('f_social_get_free_support');
		const social_support_cost = #is_defined(support_cost_resolver)
			? support_cost_resolver(player)
			: 1;
		let supported_units = 0;
		for (unit of units) {
			if (unit.home_base_id == base.id) {
				supported_units += unit_abilities.get_support_cost(unit) * social_support_cost;
			}
		}
		const required_garrison = combat.get_required_garrison(tm, base, player.id, all_units);
		const psych = game.get('f_economy_get_base_psych')(game, base);
		const intake = base.get_intake();
		const consumption = base.get_consumption();
		const nutrient_surplus = intake.NUTRIENTS - consumption.NUTRIENTS;
		const mineral_surplus = intake.MINERALS - consumption.MINERALS;
		const priorities = get_strategy_priorities(
			metrics,
			former_count,
			colony_count,
			combat_count,
			mobile_combat_count
		);
		const can_start_project =
			#sizeof(bases) >= 3 &&
			former_count >= #sizeof(bases) &&
			metrics.underdefended_bases == 0 &&
			#sizeof(bases) + colony_count >= metrics.desired_base_count;
		const get_project_effects = game.get('f_project_get_effects');
		const project_effects = #is_defined(get_project_effects)
			? get_project_effects(base)
			: {support_bonus: 0};
		const needs_colony =
			#sizeof(bases) + colony_count < metrics.desired_base_count &&
			strategy.can_expand_safely(
				#sizeof(bases),
				colony_count,
				combat_count,
				metrics.underdefended_bases
			);
		const base_tile = base.get_tile();
		let base_is_coastal = base_tile.is_water;
		if (!base_is_coastal) {
			for (nearby of base_tile.get_surrounding_tiles()) {
				if (nearby.is_water) {
					base_is_coastal = true;
					break;
				}
			}
		}
		const context = {
			needs_garrison: garrison_count < required_garrison,
			needs_former: former_count < #sizeof(bases),
			needs_colony: needs_colony,
			needs_sea_colony:
				needs_colony && !base_tile.is_water && base_is_coastal &&
				metrics.sea_base_count + sea_colony_count == 0 &&
				#sizeof(bases) >= 2,
			needs_military:
				combat_count < #sizeof(bases) * 2 ||
				priorities.rival_pressure > 0 ||
				priorities.mobility > 0,
			needs_infrastructure: #sizeof(base.get_facilities()) == 0 && former_count >= #sizeof(bases),
			needs_psych: game.get('f_base_get_stable_worker_count')(base, psych) < base.get_size(),
			needs_growth: base.get_size() < 3 || nutrient_surplus <= 0,
			needs_population_capacity:
				base.get_size() >= game.get('f_base_get_population_limit')(base),
			base_size: base.get_size(),
			can_expand: base.get_size() > 1,
			can_start_project: can_start_project,
			nutrient_surplus: nutrient_surplus,
			mineral_surplus: mineral_surplus,
			supported_units: supported_units,
			free_support: (
				#is_defined(free_support_resolver)
					? free_support_resolver(player, base.get_size())
					: #max(base.get_size(), 1)
			) + project_effects.support_bonus,
			get_mineral_cost: (def) => {
				return game.get('f_base_get_production_cost')(base, def);
			},
			base_labs: game.get('f_technology_get_base_labs')(base).total,
			available_energy: available_energy,
			priorities: priorities,
		};
		const selected = production.choose(
			base,
			unit_defs,
			facility_defs,
			context
		);
		if (selected != null && selected.kind == 'unit') {
			if (selected.def.can_terraform) {
				former_count++;
			}
			if (selected.def.can_found_base) {
				colony_count++;
				if (selected.def.is_water) {
					sea_colony_count++;
				}
			}
			if (selected.def.offense > 0) {
				combat_count++;
				if (selected.def.movement_per_turn > 1.0) {
					mobile_combat_count++;
				}
			}
		} else if (
			selected != null &&
			(selected.kind == 'facility' || selected.kind == 'project')
		) {
			available_energy = production.get_remaining_maintenance_budget(
				selected.def,
				available_energy
			);
		}
		const queue = base.get_production_queue();
		let production_changed = false;
		if (selected == null) {
			if (#sizeof(queue) > 0) {
				game.event_as(player.id, 'remove_base_production', {base: base, index: 0});
				production_changed = true;
			}
		} else if (
			#sizeof(queue) == 0 ||
			queue[0].production_kind != selected.kind ||
			queue[0].id != selected.id
		) {
			game.event_as(player.id, 'set_base_production', {
				base: base,
				kind: selected.kind,
				id: selected.id,
			});
			production_changed = true;
		}
		if (selected != null && !production_changed) {
			context.kind = selected.kind;
			context.hurry_cost = game.get('f_economy_get_hurry_cost')(base);
			context.energy_credits = player.energy_credits;
			context.energy_income = available_energy;
			context.accumulated_minerals = base.get_accumulated_minerals();
			context.production_score = selected.score;
			const hurry_score = production.score_hurry(selected.def, context);
			if (hurry_score != null) {
				hurry_candidates :+{base: base, score: hurry_score};
			}
		}
	}
	const hurry = production.choose_hurry(hurry_candidates);
	if (hurry != null) {
		const cost = game.get('f_economy_get_hurry_cost')(hurry.base);
		if (cost > 0 && player.energy_credits >= cost) {
			game.event_as(player.id, 'hurry_base_production', {base: hurry.base});
		}
	}
};

const choose_research_target = (game, player, available) => {
	const bases = owned_bases(game, player);
	const units = owned_units(game, player);
	const metrics = get_strategy_metrics(game, player, bases, units);
	const priorities = get_strategy_priorities(
		metrics,
		metrics.former_count,
		metrics.colony_count,
		metrics.combat_count,
		metrics.mobile_combat_count
	);
	return research.choose_id(
		available,
		(id) => { return game.get('f_technology_get_definition')(id); },
		game.get_um().get_unit_defs(),
		game.get_bm().get_facility_defs(),
		{
			needs_colony: metrics.base_count + metrics.colony_count < metrics.desired_base_count,
			needs_former: metrics.former_count < metrics.base_count,
			needs_military: priorities.military > 0,
			needs_growth: metrics.growth_stalled_bases > 0,
			needs_psych: metrics.unstable_bases > 0,
			base_labs: metrics.base_labs,
			priorities: priorities,
		}
	);
};

const update_social_engineering = (game, player, bases, units) => {
	const metrics = get_strategy_metrics(game, player, bases, units);
	const priorities = get_strategy_priorities(
		metrics,
		metrics.former_count,
		metrics.colony_count,
		metrics.combat_count,
		metrics.mobile_combat_count
	);
	const selected = social_engineering.choose(
		player,
		game.get('f_social_get_categories')(),
		game.get('f_social_get_available_choices'),
		game.get('f_social_get_ratings_for_choices'),
		priorities
	);
	if (!social_engineering.choices_equal(selected, player.get_social_engineering())) {
		game.event_as(player.id, 'set_social_engineering', {
			player: player,
			choices: selected,
		});
	}
};

const move_colony = (game, player, unit, all_bases) => {
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		return false;
	}
	const tm = game.get_tm();
	const destination = pathfinding.find_best_reachable(tm, unit, (source, candidate) => {
		return can_enter(unit, candidate, source);
	}, (candidate, distance) => {
		return colonization.get_destination_score(
			tm,
			candidate,
			player,
			all_bases,
			distance,
			unit.is_water
		);
	});
	if (destination == null) {
		return false;
	}
	if (destination.target == tile) {
		game.event_as(player.id, 'found_base', {unit: unit});
		return true;
	}
	if (destination.step != null && can_enter(unit, destination.step)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: destination.step});
		return true;
	}
	return false;
};

const move_former = (game, player, unit, all_bases) => {
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		return false;
	}
	const tm = game.get_tm();
	let strategic_targets = {};
	const consider_target = (candidate, pending_growth, prioritize_nutrients, is_worked) => {
		if (has_other_former(candidate, unit)) {
			return;
		}
		const order = terraforming.get_order(candidate, prioritize_nutrients, player);
		if (order == null) {
			return;
		}
		const key = #to_string(candidate.x) + '_' + #to_string(candidate.y);
		const worked = is_worked || candidate.has('working_pop');
		const score = terraforming.get_target_score(candidate, player, pending_growth, 0, worked);
		if (!#is_defined(strategic_targets[key]) || score > strategic_targets[key].score) {
			strategic_targets[key] = {
				order: order,
				pending_growth: pending_growth,
				is_worked: worked,
				score: score,
			};
		}
	};
	for (base of all_bases) {
		if (base.get_owner().id != player.id) {
			continue;
		}
		const pending_growth = game.get('f_base_get_pending_growth')(base);
		const prioritize_nutrients = pending_growth <= 0;
		for (worked_tile of base.get_worked_tiles()) {
			consider_target(worked_tile, pending_growth, prioritize_nutrients, true);
		}
		for (unworked_tile of base.get_unworked_tiles()) {
			consider_target(unworked_tile, pending_growth, prioritize_nutrients, false);
		}
	}
	const destination = pathfinding.find_best_reachable(tm, unit, (source, candidate) => {
		return can_enter(unit, candidate, source);
	}, (candidate, distance) => {
		const key = #to_string(candidate.x) + '_' + #to_string(candidate.y);
		if (!#is_defined(strategic_targets[key])) {
			return null;
		}
		const target = strategic_targets[key];
		return terraforming.get_target_score(
			candidate,
			player,
			target.pending_growth,
			distance,
			target.is_worked
		);
	});
	if (destination != null) {
		const key = #to_string(destination.target.x) + '_' + #to_string(destination.target.y);
		const target = strategic_targets[key];
		if (destination.target == tile && !has_other_active_former(tile, unit)) {
			game.event_as(player.id, 'terraform_tile', {unit: unit, type: target.order});
			return true;
		}
		if (destination.step != null && can_enter(unit, destination.step)) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: destination.step});
			return true;
		}
	}
	const local_order = terraforming.get_order(tile, false, player);
	if (local_order != null && !has_other_active_former(tile, unit)) {
		game.event_as(player.id, 'terraform_tile', {unit: unit, type: local_order});
		return true;
	}
	const is_candidate = (candidate) => {
		return can_enter(unit, candidate) &&
			terraforming.get_order(candidate, false, player) != null &&
			!has_other_former(candidate, unit);
	};
	const target = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
		if (!is_candidate(candidate)) {
			return 0 - 100000;
		}
		return terraforming.get_target_score(candidate, player, 1, 1);
	});
	if (target != null && is_candidate(target)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: target});
		return true;
	}
	return false;
};

const move_combat = (game, player, unit, all_bases, all_units, reinforcement_assignments) => {
	const tile = unit.get_tile();
	const strategic_bases = filter_hostile_bases(game, player, all_bases);
	const strategic_units = filter_hostile_units(game, player, all_units);
	if (tile.is_locked()) {
		return 0;
	}
	const air_refuel_delay = move_air_to_refuel(game, player, unit, strategic_bases);
	if (air_refuel_delay >= 0) {
		return air_refuel_delay;
	}
	const repair_base = combat.get_repair_destination(game.get_tm(), unit, player.id, strategic_bases);
	if (repair_base != null) {
		const destination = repair_base.get_tile();
		if (tile == destination) {
			return 0;
		}
		const current_distance = game.get_tm().get_distance(tile, destination);
		let repair_step = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
			if (!can_enter(unit, candidate)) {
				return 0 - 100000;
			}
			return 10000 - game.get_tm().get_distance(candidate, destination) * 100;
		});
		if (
			repair_step == null ||
			game.get_tm().get_distance(repair_step, destination) >= current_distance
		) {
			repair_step = pathfinding.find_path_step(game.get_tm(), unit, destination, (source, candidate) => {
				return can_enter(unit, candidate, source);
			});
		}
		if (repair_step != null && can_enter(unit, repair_step)) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: repair_step});
			return 100;
		}
	}
	const current_base = tile.get_base();
	if (current_base != null && current_base.get_owner().id == player.id) {
		const defenders = combat.get_garrison_count(current_base, player.id);
		const required_garrison = combat.get_required_garrison(
			game.get_tm(),
			current_base,
			player.id,
			strategic_units
		);
		if (defenders <= required_garrison) {
			return 0;
		}
	}
	if (attack_enemy_in_tiles(game, player, unit, tile.get_surrounding_tiles(), strategic_units)) {
		return 1000;
	}
	if (unit.get_def().id == 'SporeLauncher') {
		let ranged_tiles = [];
		for (nearby of tile.get_surrounding_tiles()) {
			for (ranged of nearby.get_surrounding_tiles()) {
				if (game.get_tm().get_distance(tile, ranged) == 2) {
					ranged_tiles :+ranged;
				}
			}
		}
		if (attack_enemy_in_tiles(game, player, unit, ranged_tiles, strategic_units)) {
			return 1000;
		}
	}
	const unit_key = #to_string(unit.id);
	let reinforcement_base = null;
	if (#is_defined(reinforcement_assignments[unit_key])) {
		for (base of strategic_bases) {
			if (
				base.id == reinforcement_assignments[unit_key] &&
				base.get_owner().id == player.id &&
				base.get_tile() != tile
			) {
				reinforcement_base = base;
				break;
			}
		}
		if (reinforcement_base == null) {
			reinforcement_assignments[unit_key] = #undefined;
		}
	}
	if (reinforcement_base == null) {
		let reservations = {};
		for (other of strategic_units) {
			if (other.owner != player.id) {
				continue;
			}
			const other_key = #to_string(other.id);
			if (#is_defined(reinforcement_assignments[other_key])) {
				const base_key = #to_string(reinforcement_assignments[other_key]);
				reservations[base_key] = #is_defined(reservations[base_key])
					? reservations[base_key] + 1
					: 1;
			}
		}
		reinforcement_base = combat.choose_reinforcement_target(
			game.get_tm(),
			unit,
			player.id,
			strategic_bases,
			strategic_units,
			reservations
		);
		if (reinforcement_base != null) {
			reinforcement_assignments[unit_key] = reinforcement_base.id;
		}
	}
	if (reinforcement_base != null) {
		const destination = reinforcement_base.get_tile();
		const current_distance = game.get_tm().get_distance(tile, destination);
		let reinforcement_step = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
			if (!can_enter(unit, candidate)) {
				return 0 - 100000;
			}
			return 10000 - game.get_tm().get_distance(candidate, destination) * 100;
		});
		if (
			reinforcement_step == null ||
			game.get_tm().get_distance(reinforcement_step, destination) >= current_distance
		) {
			reinforcement_step = pathfinding.find_path_step(game.get_tm(), unit, destination, (source, candidate) => {
				return can_enter(unit, candidate, source);
			});
		}
		if (reinforcement_step != null && can_enter(unit, reinforcement_step)) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: reinforcement_step});
			return 100;
		}
		reinforcement_assignments[unit_key] = #undefined;
	}
	const enemy_base = combat.choose_assault_target(
		game.get_tm(),
		unit,
		player.id,
		strategic_bases,
		strategic_units
	);
	const enemy_distance = enemy_base == null
		? 100000
		: game.get_tm().get_distance(tile, enemy_base.get_tile());
	const target = choose_tile(tile.get_surrounding_tiles(), (candidate) => {
		if (!can_enter(unit, candidate)) {
			return 0 - 100000;
		}
		if (enemy_base != null) {
			return 10000 - game.get_tm().get_distance(candidate, enemy_base.get_tile()) * 100;
		}
		const resources = candidate.get_resources(player);
		return resources.NUTRIENTS * 3 + resources.MINERALS * 2 + resources.ENERGY;
	});
	if (
		enemy_base != null &&
		(target == null || game.get_tm().get_distance(target, enemy_base.get_tile()) >= enemy_distance)
	) {
		const path_step = pathfinding.find_path_step(game.get_tm(), unit, enemy_base.get_tile(), (source, candidate) => {
			return can_enter(unit, candidate, source);
		});
		if (path_step != null) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: path_step});
			return 100;
		}
	}
	if (target != null && can_enter(unit, target)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: target});
		return 100;
	}
	return 0;
};

const play_turn = (game, player, done) => {
	const bases = owned_bases(game, player);
	const units = owned_units(game, player);
	update_diplomacy(game, player);
	update_social_engineering(game, player, bases, units);
	queue_production(game, player, bases, units);

	let steps = 0;
	let action_attempts = {};
	let reinforcement_assignments = {};
	const play_next_action = () => {
		if (!game.is_master() || game.is_game_over() || game.is_turn_complete(player.id)) {
			done();
			return;
		}
		const all_units = game.get_um().get_units();
		const current_units = filter_owned_units(all_units, player);
		const all_bases = game.get_bm().get_bases();
		const waiting_for_action = action_state.refresh_pending_actions(current_units, action_attempts);
		let action_started = false;
		let action_delay = MOVEMENT_ACTION_DELAY;
		let waiting_for_animation = false;
		for (unit of current_units) {
			if (unit.get_tile().is_locked()) {
				waiting_for_animation = true;
				break;
			}
		}
		if (!waiting_for_action && !waiting_for_animation) {
			for (unit of current_units) {
				if (!action_state.can_attempt_action(unit, action_attempts)) {
					continue;
				}
				const def = unit.get_def();
				if (def.can_found_base) {
					action_started = move_colony(game, player, unit, all_bases);
				}
				if (action_started) {
					action_state.record_action_attempt(unit, action_attempts);
					break;
				}
			}
		}
		if (!action_started && !waiting_for_action && !waiting_for_animation) {
			for (unit of current_units) {
				if (!action_state.can_attempt_action(unit, action_attempts)) {
					continue;
				}
				const def = unit.get_def();
				if (def.can_terraform) {
					action_started = move_former(game, player, unit, all_bases);
				}
				if (action_started) {
					action_state.record_action_attempt(unit, action_attempts);
					break;
				}
			}
		}
		if (!action_started && !waiting_for_action && !waiting_for_animation) {
			for (unit of current_units) {
				if (!action_state.can_attempt_action(unit, action_attempts)) {
					continue;
				}
				if (unit.get_def().offense > 0) {
					const combat_delay = move_combat(
						game,
						player,
						unit,
						all_bases,
						all_units,
						reinforcement_assignments
					);
					if (combat_delay > 0) {
						action_started = true;
						action_delay = combat_delay;
					}
				}
				if (action_started) {
					action_state.record_action_attempt(unit, action_attempts);
					break;
				}
			}
		}
		steps++;
		if (action_started && steps < 1000) {
			#async(action_delay, play_next_action);
			return;
		}
		if ((waiting_for_animation || waiting_for_action) && steps < 1000) {
			#async(MOVEMENT_ACTION_DELAY, play_next_action);
			return;
		}
		game.event_as(player.id, 'complete_turn', {});
		#async(100, done);
	};
	#async(100, play_next_action);
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_ai_choose_research_target', (player, available) => {
			return choose_research_target(game, player, available);
		});
		let ui_started = false;
		let ai_running = false;
		const play_ai_players = () => {
			if (ai_running || !game.is_master() || game.is_game_over()) {
				return;
			}
			let players = [];
			for (player of game.get_players()) {
				if (player.type == 'ai' && !game.is_turn_complete(player.id)) {
					players :+player;
				}
			}
			if (#sizeof(players) == 0) {
				return;
			}
			ai_running = true;
			let index = 0;
			const play_next_player = () => {
				if (index >= #sizeof(players)) {
					ai_running = false;
					return;
				}
				const player = players[index];
				index++;
				play_turn(game, player, play_next_player);
			};
			play_next_player();
		};
		game.on('start_ui', (e) => {
			ui_started = true;
			#async(500, play_ai_players);
		});
		game.on('turn', (e) => {
			if (ui_started) {
				#async(500, play_ai_players);
			}
		});
	});
};
