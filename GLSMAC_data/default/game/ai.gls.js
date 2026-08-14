const MOVEMENT_ACTION_DELAY = 100;
const TURN_COMPLETION_POLL_DELAY = 50;
const TURN_COMPLETION_RETRY_CHECKS = 20;
const AI_TURN_START_DELAY = 100;
const COLONY_SEARCH_MAX_DISTANCE = 12;
const COMBAT_DETOUR_MAX_DISTANCE = 8;
const FORMER_SEARCH_MAX_DISTANCE = 16;
const action_state = #include('ai/action_state');
const turn_rules = #include('./turn_rules');
const airdrops = #include('ai/airdrops');
const base_trades = #include('ai/base_trades');
const colonization = #include('ai/colonization');
const combat = #include('ai/combat');
const diplomacy = #include('ai/diplomacy');
const economic_victory = #include('ai/economic_victory');
const orbitals = #include('ai/orbitals');
const pathfinding = #include('ai/pathfinding');
const probes = #include('ai/probes');
const planet_busters = #include('ai/planet_busters');
const psi_gates = #include('ai/psi_gates');
const production = #include('ai/production');
const research = #include('ai/research');
const social_engineering = #include('ai/social_engineering');
const strategy = #include('ai/strategy');
const terraforming = #include('ai/terraforming');
const unity_pods = #include('ai/unity_pods');
const movement_rules = #include('movement_rules');
const nerve_stapling = #include('ai/nerve_stapling');
const unit_abilities = #include('unit_abilities');
const artifact_rules = #include('artifact_rules');
const supply_rules = #include('supply_rules');
const technology_acquisition = #include('technology_acquisition');
const probe_interception = #include('probe_interception');
const visibility_rules = #include('visibility_rules');
const governor_rules = #include('base_governor_rules');
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

const is_planet_buster_production = (production_item, unit_defs) => {
	if (production_item.production_kind != 'unit') {
		return false;
	}
	for (definition of unit_defs) {
		if (definition.id == production_item.id) {
			return #is_defined(definition.weapon) && definition.weapon == 'PlanetBuster';
		}
	}
	return false;
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

const get_combat_power_metrics = (player, players, units) => {
	let own = 0.0;
	let strongest_rival = 0.0;
	for (candidate of players) {
		let power = 0.0;
		for (unit of units) {
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

const get_tradeable_technologies = (game, source, recipient) => {
	let result = [];
	for (id of source.get_research_state().technologies) {
		if (!recipient.has_technology(id)) {
			const definition = game.get('f_technology_get_definition')(id);
			if (definition != null) {
				result :+definition;
			}
		}
	}
	return result;
};

const get_contact_value = (game, player) => {
	return 25 + get_player_base_count(game, player) * 15 +
		#min(75, #floor(get_player_power(game, player) * 5.0));
};

const get_tradeable_contacts = (game, source, recipient) => {
	let result = [];
	for (contact of game.get_players()) {
		if (
			contact.id != source.id && contact.id != recipient.id &&
			source.has_contact(contact) && contact.has_contact(source) &&
			(!recipient.has_contact(contact) || !contact.has_contact(recipient))
		) {
			result :+{id: contact.id, value: get_contact_value(game, contact)};
		}
	}
	return result;
};

const update_diplomacy = (game, player) => {
	const own_power = get_player_power(game, player);
	const own_bases = get_player_base_count(game, player);
	const tm = game.get_tm();
	for (other of game.get_players()) {
		if (
			other.id != player.id &&
			#typeof(other.get_surrender_offer_to_id) == 'Callable' &&
			other.get_surrender_offer_to_id() == player.id
		) {
			game.event_as(player.id, 'respond_surrender', {
				player: player,
				proposer: other,
				accept: true,
			});
			return;
		}
	}
	if (
		#typeof(player.get_submissive_to_id) == 'Callable' &&
		player.get_submissive_to_id() >= 0
	) {
		return;
	}
	for (other of game.get_players()) {
		if (other.id == player.id || !player.has_contact(other)) {
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
					other_integrity_blemishes: other.get_integrity_blemishes(),
				}),
			});
			return;
		}
	}
	for (other of game.get_players()) {
		if (other.id == player.id || !player.has_contact(other)) {
			continue;
		}
		const trade = player.get_diplomatic_trade(other);
		if (trade != null) {
			const military_target = diplomacy.is_military_request(trade)
				? game.get_player(trade.request_vendetta_player) : null;
			const offer_definition = trade.offer_technology == ''
				? null
				: game.get('f_technology_get_definition')(trade.offer_technology);
			const request_definition = trade.request_technology == ''
				? null
				: game.get('f_technology_get_definition')(trade.request_technology);
			const offer_contact = (
				#typeof(trade.offer_contact) != 'Int' || trade.offer_contact < 0
			) ? null : game.get_player(trade.offer_contact);
			const request_contact = (
				#typeof(trade.request_contact) != 'Int' || trade.request_contact < 0
			) ? null : game.get_player(trade.request_contact);
			const find_trade_base = game.get('f_diplomacy_find_base');
			const offer_base = #typeof(trade.offer_base) == 'Int' && trade.offer_base >= 0
				? find_trade_base(trade.offer_base) : null;
			const request_base = #typeof(trade.request_base) == 'Int' && trade.request_base >= 0
				? find_trade_base(trade.request_base) : null;
			const count_shareable = game.get('f_exploration_count_shareable_tiles');
			const map_area = #max(
				1,
				#floor(#to_float(tm.get_map_width() * tm.get_map_height()) / 2.0)
			);
			const offer_map_tiles = #is_defined(count_shareable)
				? count_shareable(other, player)
				: 0;
			const request_map_tiles = #is_defined(count_shareable)
				? count_shareable(player, other)
				: 0;
			game.event_as(player.id, 'respond_diplomatic_trade', {
				player: player,
				proposer: other,
				accept: military_target != null
					? diplomacy.get_military_request_acceptance_score({
						relation: player.get_diplomatic_relation(other),
						own_power: own_power,
						other_power: get_player_power(game, other),
						target_power: get_player_power(game, military_target),
						target_relation: player.get_diplomatic_relation(military_target),
						other_integrity_blemishes: other.get_integrity_blemishes(),
					}) >= 0.0
					: diplomacy.is_ultimatum(trade)
					? diplomacy.get_ultimatum_compliance_score({
						relation: player.get_diplomatic_relation(other),
						own_power: own_power,
						other_power: get_player_power(game, other),
						own_bases: own_bases,
						other_bases: get_player_base_count(game, other),
						own_energy: player.energy_credits,
						other_integrity_blemishes: other.get_integrity_blemishes(),
						request_technology_cost: request_definition == null
							? 0 : request_definition.cost,
						terms: trade,
					}) >= 0.0
					: player.get_sanction_turns() == 0 && other.get_sanction_turns() == 0 &&
						diplomacy.get_trade_acceptance_score({
						relation: player.get_diplomatic_relation(other),
						own_power: own_power,
					other_power: get_player_power(game, other),
					terms: trade,
					offer_technology_cost: offer_definition == null ? 0 : offer_definition.cost,
					request_technology_cost: request_definition == null ? 0 : request_definition.cost,
					offer_contact_value: offer_contact == null ? 0 : get_contact_value(game, offer_contact),
					request_contact_value: request_contact == null ? 0 : get_contact_value(game, request_contact),
					offer_map_value: offer_map_tiles == 0
						? 0 : 20 + #ceil(#to_float(offer_map_tiles * 160) / #to_float(map_area)),
					request_map_value: request_map_tiles == 0
						? 0 : 20 + #ceil(#to_float(request_map_tiles * 160) / #to_float(map_area)),
					offer_base_value: offer_base == null
						? 0 : base_trades.get_strategic_value(game, offer_base, player),
					request_base_value: request_base == null
						? 0 : base_trades.get_strategic_value(game, request_base, player),
				}) >= 0.0,
			});
			return;
		}
	}
	for (other of game.get_players()) {
		if (other.id == player.id || !player.has_contact(other)) {
			continue;
		}
		const loan_offer = player.get_diplomatic_loan_offer(other);
		if (loan_offer != null) {
			game.event_as(player.id, 'respond_diplomatic_loan', {
				player: player,
				proposer: other,
				accept: player.get_sanction_turns() == 0 && other.get_sanction_turns() == 0 &&
					diplomacy.get_loan_acceptance_score({
					relation: player.get_diplomatic_relation(other),
					own_power: own_power,
					other_power: get_player_power(game, other),
					own_energy: player.energy_credits,
					own_is_lender: !loan_offer.proposer_is_lender,
					other_integrity_blemishes: other.get_integrity_blemishes(),
					terms: loan_offer,
				}) >= 0.0,
			});
			return;
		}
	}

	if (
		game.get_turn() >= 20 &&
		#typeof(player.get_surrender_offer_to_id) == 'Callable' &&
		player.get_surrender_offer_to_id() < 0
	) {
		let surrender_target = null;
		let surrender_score = 0.0 - 100000.0;
		for (other of game.get_players()) {
			if (
				other.id == player.id || !player.has_contact(other) ||
				player.get_diplomatic_relation(other) != 'vendetta' ||
				(#typeof(other.get_submissive_to_id) == 'Callable' &&
					other.get_submissive_to_id() >= 0)
			) {
				continue;
			}
			const state = {
				relation: 'vendetta',
				own_power: own_power,
				other_power: get_player_power(game, other),
				own_bases: own_bases,
				other_bases: get_player_base_count(game, other),
				other_integrity_blemishes: other.get_integrity_blemishes(),
			};
			const score = diplomacy.get_surrender_score(state);
			if (
				diplomacy.should_offer_surrender(state) &&
				(surrender_target == null || score > surrender_score ||
					(score == surrender_score && other.id < surrender_target.id))
			) {
				surrender_target = other;
				surrender_score = score;
			}
		}
		if (surrender_target != null) {
			game.event_as(player.id, 'offer_surrender', {
				player: player,
				target: surrender_target,
			});
			return;
		}
	}

	if ((game.get_turn() + player.id) % 8 != 0) {
		return;
	}
	if ((game.get_turn() + player.id) % 24 == 0) {
		let best_ultimatum = null;
		let best_ultimatum_target = null;
		for (other of game.get_players()) {
			if (
				other.id == player.id ||
				!player.has_contact(other) ||
				other.get_diplomatic_offer(player) != '' ||
				player.get_diplomatic_offer(other) != '' ||
				other.get_diplomatic_trade(player) != null ||
				player.get_diplomatic_trade(other) != null ||
				(#typeof(other.get_submissive_to_id) == 'Callable' &&
					other.get_submissive_to_id() >= 0)
			) {
				continue;
			}
			const proposal = diplomacy.get_ultimatum_proposal({
				relation: player.get_diplomatic_relation(other),
				own_power: own_power,
				other_power: get_player_power(game, other),
				own_bases: own_bases,
				other_bases: get_player_base_count(game, other),
				own_energy: player.energy_credits,
				other_energy: other.energy_credits,
				own_integrity_blemishes: player.get_integrity_blemishes(),
				other_technologies: get_tradeable_technologies(game, other, player),
			});
			if (
				proposal != null &&
				(best_ultimatum == null || proposal.score > best_ultimatum.score ||
					(proposal.score == best_ultimatum.score &&
						other.id < best_ultimatum_target.id))
			) {
				best_ultimatum = proposal;
				best_ultimatum_target = other;
			}
		}
		if (best_ultimatum != null) {
			game.event_as(player.id, 'propose_diplomatic_trade', {
				player: player,
				target: best_ultimatum_target,
				terms: best_ultimatum.terms,
			});
			return;
		}
	}
	let best = null;
	let best_target = null;
	for (other of game.get_players()) {
		if (
			other.id == player.id ||
			!player.has_contact(other) ||
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
			other_integrity_blemishes: other.get_integrity_blemishes(),
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
		return;
	}

	let best_military_request = null;
	let best_military_ally = null;
	for (other of game.get_players()) {
		if (
			other.id == player.id || !player.has_contact(other) ||
			player.get_diplomatic_relation(other) != 'pact' ||
			other.get_diplomatic_offer(player) != '' ||
			player.get_diplomatic_offer(other) != '' ||
			other.get_diplomatic_trade(player) != null ||
			player.get_diplomatic_trade(other) != null
		) {
			continue;
		}
		let military_targets = [];
		for (target of game.get_players()) {
			if (
				target.id == player.id || target.id == other.id ||
				!player.has_contact(target) || !target.has_contact(player) ||
				!other.has_contact(target) || !target.has_contact(other)
			) {
				continue;
			}
			military_targets :+{
				id: target.id,
				power: get_player_power(game, target),
				proposer_relation: player.get_diplomatic_relation(target),
				recipient_relation: other.get_diplomatic_relation(target),
			};
		}
		const request = diplomacy.get_military_request_proposal({
			relation: 'pact',
			own_power: own_power,
			other_power: get_player_power(game, other),
			other_integrity_blemishes: player.get_integrity_blemishes(),
			targets: military_targets,
		});
		if (
			request == null ||
			#is_defined(game.get('f_diplomacy_validate_trade')(player, other, request.terms))
		) {
			continue;
		}
		if (
			best_military_request == null || request.score > best_military_request.score ||
			(request.score == best_military_request.score && other.id < best_military_ally.id)
		) {
			best_military_request = request;
			best_military_ally = other;
		}
	}
	if (best_military_request != null) {
		game.event_as(player.id, 'propose_diplomatic_trade', {
			player: player,
			target: best_military_ally,
			terms: best_military_request.terms,
		});
		return;
	}

	let best_trade = null;
	let best_trade_target = null;
	for (other of game.get_players()) {
		if (
			other.id == player.id ||
			!player.has_contact(other) ||
			player.get_diplomatic_relation(other) == 'vendetta' ||
			player.get_sanction_turns() > 0 || other.get_sanction_turns() > 0 ||
			other.get_diplomatic_offer(player) != '' ||
			player.get_diplomatic_offer(other) != '' ||
			other.get_diplomatic_trade(player) != null ||
			player.get_diplomatic_trade(other) != null
		) {
			continue;
		}
		const proposal = diplomacy.get_trade_proposal({
			relation: player.get_diplomatic_relation(other),
			own_power: own_power,
			other_power: get_player_power(game, other),
			own_energy: player.energy_credits,
			other_energy: other.energy_credits,
			own_technologies: get_tradeable_technologies(game, player, other),
			other_technologies: get_tradeable_technologies(game, other, player),
			own_contacts: get_tradeable_contacts(game, player, other),
			other_contacts: get_tradeable_contacts(game, other, player),
			own_base_trades: base_trades.get_candidates(game, player, other),
			other_base_trades: base_trades.get_candidates(game, other, player),
			own_map_value: (() => {
				const count_shareable = game.get('f_exploration_count_shareable_tiles');
				if (!#is_defined(count_shareable)) { return 0; }
				const count = count_shareable(player, other);
				const area = #max(1, #floor(
					#to_float(tm.get_map_width() * tm.get_map_height()) / 2.0
				));
				return count == 0 ? 0 : 20 + #ceil(#to_float(count * 160) / #to_float(area));
			})(),
			other_map_value: (() => {
				const count_shareable = game.get('f_exploration_count_shareable_tiles');
				if (!#is_defined(count_shareable)) { return 0; }
				const count = count_shareable(other, player);
				const area = #max(1, #floor(
					#to_float(tm.get_map_width() * tm.get_map_height()) / 2.0
				));
				return count == 0 ? 0 : 20 + #ceil(#to_float(count * 160) / #to_float(area));
			})(),
		});
		if (
			proposal != null &&
			(best_trade == null || proposal.score > best_trade.score ||
				(proposal.score == best_trade.score && other.id < best_trade_target.id))
		) {
			best_trade = proposal;
			best_trade_target = other;
		}
	}
	if (best_trade != null) {
		game.event_as(player.id, 'propose_diplomatic_trade', {
			player: player,
			target: best_trade_target,
			terms: best_trade.terms,
		});
		return;
	}

	let best_loan = null;
	let best_loan_target = null;
	for (other of game.get_players()) {
		if (
			other.id == player.id ||
			!player.has_contact(other) ||
			player.get_sanction_turns() > 0 || other.get_sanction_turns() > 0 ||
			other.get_diplomatic_offer(player) != '' ||
			player.get_diplomatic_offer(other) != '' ||
			other.get_diplomatic_trade(player) != null ||
			player.get_diplomatic_trade(other) != null ||
			other.get_diplomatic_loan_offer(player) != null ||
			player.get_diplomatic_loan_offer(other) != null ||
			other.get_diplomatic_loan(player) != null ||
			player.get_diplomatic_loan(other) != null
		) {
			continue;
		}
		const proposal = diplomacy.get_loan_proposal({
			relation: player.get_diplomatic_relation(other),
			own_power: own_power,
			other_power: get_player_power(game, other),
			own_energy: player.energy_credits,
			other_energy: other.energy_credits,
			own_integrity_blemishes: player.get_integrity_blemishes(),
			other_integrity_blemishes: other.get_integrity_blemishes(),
		});
		if (
			proposal != null &&
			(best_loan == null || proposal.score > best_loan.score ||
				(proposal.score == best_loan.score && other.id < best_loan_target.id))
		) {
			best_loan = proposal;
			best_loan_target = other;
		}
	}
	if (best_loan != null) {
		game.event_as(player.id, 'propose_diplomatic_loan', {
			player: player,
			target: best_loan_target,
			terms: best_loan.terms,
		});
	}
};

const get_strategy_metrics = (game, player, bases, units) => {
	const is_profiling = #typeof(game.get('f_ai_profile')) == 'Callable';
	const profile_started = is_profiling ? #monotonic_ms() : 0;
	let profile_phase_started = profile_started;
	let former_count = 0;
	let land_former_count = 0;
	let sea_former_count = 0;
	let colony_count = 0;
	let sea_colony_count = 0;
	let combat_count = 0;
	let mobile_combat_count = 0;
	let probe_count = 0;
	for (unit of units) {
		const def = unit.get_def();
		if (def.can_terraform) {
			former_count++;
			if (def.is_water) {
				sea_former_count++;
			} else {
				land_former_count++;
			}
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
		if (#is_defined(def.weapon) && def.weapon == 'ProbeTeam') {
			probe_count++;
		}
	}
	const profile_units_ms = is_profiling ? #monotonic_ms() - profile_phase_started : 0;
	profile_phase_started = is_profiling ? #monotonic_ms() : 0;

	const tm = game.get_tm();
	const players = game.get_players();
	const all_units = game.get_um().get_units();
	const all_bases = game.get_bm().get_bases();
	const profile_lists_ms = is_profiling ? #monotonic_ms() - profile_phase_started : 0;
	profile_phase_started = is_profiling ? #monotonic_ms() : 0;
	const combat_power = get_combat_power_metrics(player, players, all_units);
	const profile_combat_power_ms = is_profiling ? #monotonic_ms() - profile_phase_started : 0;
	let underdefended_bases = 0;
	let growth_stalled_bases = 0;
	let unstable_bases = 0;
	let base_labs = 0;
	let sea_base_count = 0;
	let base_metrics = {};
	let base_allocations = {};
	let profile_base_garrison_ms = 0;
	let profile_base_yields_ms = 0;
	let profile_base_psych_ms = 0;
	for (base of bases) {
		if (base.get_tile().is_water) {
			sea_base_count++;
		}
		profile_phase_started = is_profiling ? #monotonic_ms() : 0;
		const garrison_count = combat.get_garrison_count(base, player.id);
		const required_garrison = combat.get_required_garrison(
			tm,
			base,
			player.id,
			all_units,
			game
		);
		if (garrison_count < required_garrison) {
			underdefended_bases++;
		}
		profile_base_garrison_ms += is_profiling ? #monotonic_ms() - profile_phase_started : 0;
		profile_phase_started = is_profiling ? #monotonic_ms() : 0;
		const intake = base.get_intake();
		const consumption = base.get_consumption();
		const population_limit = game.get('f_base_get_population_limit')(base);
		if (
			base.get_size() < 3 ||
			base.get_size() >= population_limit ||
			intake.NUTRIENTS - consumption.NUTRIENTS <= 0
		) {
			growth_stalled_bases++;
		}
		profile_base_yields_ms += is_profiling ? #monotonic_ms() - profile_phase_started : 0;
		profile_phase_started = is_profiling ? #monotonic_ms() : 0;
		const allocation = game.get('f_economy_get_base_allocation')(
			game,
			base,
			intake,
			consumption
		);
		base_allocations['b' + #to_string(base.id)] = allocation;
		const psych = allocation.psych.value + allocation.psych.bonus;
		const stable_worker_count = game.get('f_base_get_stable_worker_count')(base, psych);
		if (stable_worker_count < base.get_size()) {
			unstable_bases++;
		}
		base_labs += allocation.labs.total;
		base_metrics['b' + #to_string(base.id)] = {
			garrison_count: garrison_count,
			required_garrison: required_garrison,
			intake: intake,
			consumption: consumption,
			psych: psych,
			stable_worker_count: stable_worker_count,
			population_limit: population_limit,
			labs: allocation.labs.total,
		};
		profile_base_psych_ms += is_profiling ? #monotonic_ms() - profile_phase_started : 0;
	}
	profile_phase_started = is_profiling ? #monotonic_ms() : 0;
	const get_player_economy_from_allocations =
		game.get('f_economy_get_player_from_allocations');
	const energy_income = #is_defined(get_player_economy_from_allocations)
		? get_player_economy_from_allocations(game, player, base_allocations)
		: game.get('f_economy_get_player')(game, player);
	const profile_energy_ms = is_profiling ? #monotonic_ms() - profile_phase_started : 0;
	const profile_accounted_ms = profile_units_ms + profile_lists_ms + profile_combat_power_ms +
		profile_base_garrison_ms + profile_base_yields_ms + profile_base_psych_ms +
		profile_energy_ms;
	const profile_other_ms = is_profiling
		? #monotonic_ms() - profile_started - profile_accounted_ms
		: 0;
	return {
		base_count: #sizeof(bases),
		desired_base_count: strategy.get_desired_base_count(
			game.get_turn(),
			tm.get_map_width(),
			tm.get_map_height(),
			#sizeof(game.get_players())
		),
		former_count: former_count,
		land_former_count: land_former_count,
		sea_former_count: sea_former_count,
		colony_count: colony_count,
		sea_colony_count: sea_colony_count,
		sea_base_count: sea_base_count,
		combat_count: combat_count,
		mobile_combat_count: mobile_combat_count,
		probe_count: probe_count,
		underdefended_bases: underdefended_bases,
		growth_stalled_bases: growth_stalled_bases,
		unstable_bases: unstable_bases,
		base_labs: base_labs,
		energy_income: energy_income,
		own_combat_power: combat_power.own,
		strongest_rival_power: combat_power.strongest_rival,
		players: players,
		all_units: all_units,
		all_bases: all_bases,
		base_metrics: base_metrics,
		strategy_profile: {
			units_ms: profile_units_ms,
			lists_ms: profile_lists_ms,
			combat_power_ms: profile_combat_power_ms,
			base_garrison_ms: profile_base_garrison_ms,
			base_yields_ms: profile_base_yields_ms,
			base_psych_ms: profile_base_psych_ms,
			energy_ms: profile_energy_ms,
			other_ms: profile_other_ms,
		},
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

const get_planet_buster_minimum_target_size = (game) => {
	const is_charter_repealed = game.get('f_council_is_un_charter_repealed');
	return #is_defined(is_charter_repealed) && is_charter_repealed() ? 4 : 8;
};

const attack_enemy_in_tiles = (game, player, unit, tiles, units) => {
	let available_tiles = [];
	for (tile of tiles) {
		if (!tile.is_locked()) {
			available_tiles :+tile;
		}
	}
	if (unit.get_def().weapon == 'PlanetBuster') {
		const target = planet_busters.choose_target(
			unit,
			player,
			available_tiles,
			(owner_id) => {
				if (owner_id == player.id) {
					return true;
				}
				return player.get_diplomatic_relation(game.get_player(owner_id)) != 'vendetta';
			},
			get_planet_buster_minimum_target_size(game)
		);
		if (target == null) {
			return false;
		}
		game.event_as(player.id, 'planet_buster', {unit: unit, tile: target});
		return true;
	}
	const target = combat.choose_attack_target(
		unit,
		player.id,
		available_tiles,
		game.get_tm(),
		units,
		(owner_id) => { return !is_protected_partner(game, player, owner_id); },
		game
	);
	if (target == null) {
		return false;
	}
	game.event_as(player.id, 'attack_unit', {attacker: unit, defender: target});
	return true;
};

const interrogate_adjacent_probe = (game, player, unit) => {
	let target = null;
	for (tile of unit.get_tile().get_surrounding_tiles()) {
		if (tile.is_locked()) {
			continue;
		}
		for (other of tile.get_units()) {
			if (
				visibility_rules.can_target(game, player.id, unit, other) &&
				probe_interception.get_interception(game, unit, other) != null &&
				(target == null || other.id < target.id)
			) {
				target = other;
			}
		}
	}
	if (target == null) {
		return false;
	}
	game.event_as(player.id, 'attack_unit', {
		attacker: unit,
		defender: target,
		probe_interception_action: 'interrogate',
	});
	return true;
};

const queue_production = (
	game,
	player,
	managed_bases,
	bases,
	units,
	metrics,
	preserve_current,
	allow_hurry
) => {
	let former_count = metrics.former_count;
	let land_former_count = metrics.land_former_count;
	let sea_former_count = metrics.sea_former_count;
	let colony_count = metrics.colony_count;
	let sea_colony_count = metrics.sea_colony_count;
	let combat_count = metrics.combat_count;
	let mobile_combat_count = metrics.mobile_combat_count;
	let probe_count = metrics.probe_count;
	let supply_count = 0;
	const unit_defs = game.get_um().get_unit_defs();
	const facility_defs = game.get_bm().get_facility_defs();
	let known_technologies = {};
	for (id of player.get_research_state().technologies) {
		known_technologies[id] = true;
	}
	let available_unit_defs = [];
	for (def of unit_defs) {
		if (
			(#is_defined(def.required_technology) && def.required_technology != '' &&
				!#is_defined(known_technologies[def.required_technology])) ||
			(#is_defined(def.owner_player_id) && def.owner_player_id >= 0 &&
				def.owner_player_id != player.id) ||
			player.is_unit_design_obsolete(def.id)
		) {
			continue;
		}
		available_unit_defs :+def;
	}
	let available_facility_defs = [];
	let can_consider_planetary_datalinks = false;
	for (def of facility_defs) {
		if (
			#is_defined(def.required_technology) && def.required_technology != '' &&
			!#is_defined(known_technologies[def.required_technology])
		) {
			continue;
		}
		available_facility_defs :+def;
		if (def.id == 'ThePlanetaryDatalinks') {
			can_consider_planetary_datalinks = true;
		}
	}
	let available_energy = #max(metrics.energy_income, 0);
	const tm = game.get_tm();
	const all_units = metrics.all_units;
	let air_superiority_count = 0;
	let amphibious_count = 0;
	for (unit of units) {
		if (supply_rules.is_supply_transport(unit)) {
			supply_count++;
		}
		if (unit_abilities.has(unit, 'AirSuperiority')) {
			air_superiority_count++;
		}
		if (unit_abilities.has(unit, 'AmphibiousPods')) {
			amphibious_count++;
		}
	}
	let hostile_air_unit_count = 0;
	let hostile_coastal_base_count = 0;
	for (other of metrics.players) {
		if (other.id == player.id || is_protected_partner(game, player, other.id)) {
			continue;
		}
		for (unit of all_units) {
			if (unit.owner == other.id && unit.is_air) {
				hostile_air_unit_count++;
			}
		}
		for (candidate of metrics.all_bases) {
			if (candidate.get_owner().id != other.id) {
				continue;
			}
			const target_tile = candidate.get_tile();
			let coastal = target_tile.is_water;
			if (!coastal) {
				for (nearby of target_tile.get_surrounding_tiles()) {
					if (nearby.is_water) {
						coastal = true;
						break;
					}
				}
			}
			if (coastal) {
				hostile_coastal_base_count++;
			}
		}
	}
	const desired_air_superiority_count = hostile_air_unit_count == 0
		? 0
		: #max(1, #ceil(#to_float(hostile_air_unit_count) / 2.0));
	const desired_amphibious_count = hostile_coastal_base_count == 0
		? 0
		: #max(1, #ceil(#to_float(hostile_coastal_base_count) / 3.0));
	const planet_buster_minimum_target_size = get_planet_buster_minimum_target_size(game);
	let orbital_defense_threats = 0;
	let planet_buster_target_value = 0;
	for (other of metrics.players) {
		if (
			other.id == player.id ||
			player.get_diplomatic_relation(other) != 'vendetta'
		) {
			continue;
		}
		let has_planet_buster = other.has_technology('OrbitalSpaceflight');
		for (unit of all_units) {
			if (
				unit.owner == other.id &&
				unit.get_def().weapon == 'PlanetBuster'
			) {
				has_planet_buster = true;
				break;
			}
		}
		if (has_planet_buster) {
			orbital_defense_threats++;
		}
		for (candidate of metrics.all_bases) {
			if (candidate.get_owner().id == other.id) {
				planet_buster_target_value = #max(
					planet_buster_target_value,
					candidate.get_size()
				);
			}
		}
	}
	let orbital_defense_committed = player.get_orbital_facility_count('OrbitalDefensePod');
	let planet_busters_committed = 0;
	for (unit of units) {
		if (unit.get_def().weapon == 'PlanetBuster') {
			planet_busters_committed++;
		}
	}
	for (candidate of bases) {
		const queue = candidate.get_production_queue();
		if (#sizeof(queue) > 0) {
			if (queue[0].id == 'OrbitalDefensePod') {
				orbital_defense_committed++;
			}
			if (is_planet_buster_production(queue[0], unit_defs)) {
				planet_busters_committed++;
			}
		}
	}
	const get_datalinks_candidates = game.get(
		'f_project_get_planetary_datalinks_candidates'
	);
	const planetary_datalinks_technology_count =
		can_consider_planetary_datalinks && #is_defined(get_datalinks_candidates)
		? #sizeof(get_datalinks_candidates(player))
		: 0;
	let empath_guild_infiltration_count = 0;
	const has_intelligence = game.get('f_council_has_intelligence');
	for (other of metrics.players) {
		if (
			other.id != player.id &&
			!(#is_defined(has_intelligence)
				? has_intelligence(player, other)
				: player.has_infiltrated(other))
		) {
			empath_guild_infiltration_count++;
		}
	}
	let global_network_node_count = 0;
	for (candidate of metrics.all_bases) {
		if (candidate.has_facility('NetworkNode')) {
			global_network_node_count++;
		}
	}
	const get_commerce_ledger = game.get('f_economy_get_player_commerce_ledger');
	const commerce_ledger = #is_defined(get_commerce_ledger)
		? get_commerce_ledger(game, player)
		: {};
	let hurry_candidates = [];
	let has_headquarters = false;
	let headquarters_queue_base = null;
	for (candidate of bases) {
		if (candidate.has_facility('Headquarters')) {
			has_headquarters = true;
		}
		if (headquarters_queue_base == null) {
			for (queued of candidate.get_production_queue()) {
				if (queued.production_kind == 'facility' && queued.id == 'Headquarters') {
					headquarters_queue_base = candidate;
					break;
				}
			}
		}
	}
	for (base of managed_bases) {
		const queue = base.get_production_queue();
		if (preserve_current && #sizeof(queue) > 0) {
			continue;
		}
		if (#sizeof(queue) > 0) {
			if (queue[0].id == 'OrbitalDefensePod') {
				orbital_defense_committed--;
			}
			if (is_planet_buster_production(queue[0], unit_defs)) {
				planet_busters_committed--;
			}
		}
		const commerce_key = 'b' + #to_string(base.id);
		const base_metric = metrics.base_metrics[commerce_key];
		const base_commerce = #is_defined(commerce_ledger[commerce_key])
			? commerce_ledger[commerce_key].total
			: 0;
		const garrison_count = base_metric.garrison_count;
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
		const required_garrison = base_metric.required_garrison;
		const psych = base_metric.psych;
		const intake = base_metric.intake;
		const consumption = base_metric.consumption;
		const nutrient_surplus = intake.NUTRIENTS - consumption.NUTRIENTS;
		const mineral_surplus = intake.MINERALS - consumption.MINERALS;
		let priorities = get_strategy_priorities(
			metrics,
			former_count,
			colony_count,
			combat_count,
			mobile_combat_count
		);
		if (governor_rules.is_enabled(base)) {
			priorities = governor_rules.apply_priority(
				priorities,
				governor_rules.get_priority(base)
			);
		}
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
			needs_former: base_tile.is_water
				? sea_former_count < metrics.sea_base_count
				: land_former_count < #sizeof(bases) - metrics.sea_base_count,
			base_is_water: base_tile.is_water,
			needs_colony: needs_colony,
			needs_sea_colony:
				needs_colony && !base_tile.is_water && base_is_coastal &&
				metrics.sea_base_count + sea_colony_count == 0 &&
				#sizeof(bases) >= 2,
			needs_military:
				combat_count < #sizeof(bases) * 2 ||
				priorities.rival_pressure > 0 ||
				priorities.mobility > 0,
			needs_air_superiority:
				air_superiority_count < desired_air_superiority_count,
			hostile_air_unit_count: hostile_air_unit_count,
			needs_amphibious:
				base_is_coastal && amphibious_count < desired_amphibious_count,
			hostile_coastal_base_count: hostile_coastal_base_count,
			needs_probe:
				#sizeof(game.get_players()) > 1 &&
				probe_count < #max(1, #floor(#to_float(#sizeof(bases)) / 4.0)),
			needs_supply:
				#sizeof(bases) >= 2 &&
				supply_count < #max(1, #floor(#to_float(#sizeof(bases)) / 3.0)),
			needs_infrastructure: #sizeof(base.get_facilities()) == 0 && former_count >= #sizeof(bases),
			needs_headquarters:
				!has_headquarters &&
				(headquarters_queue_base == null || headquarters_queue_base == base),
			needs_psych: base_metric.stable_worker_count < base.get_size(),
			needs_growth: base.get_size() < 3 || nutrient_surplus <= 0,
			needs_population_capacity:
				base.get_size() >= base_metric.population_limit,
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
			get_orbital_marginal_yield: (def) => {
				const resolver = game.get('f_orbital_get_marginal_yield');
				return #is_defined(resolver) ? resolver(player, def) : 0;
			},
			needs_orbital_defense: orbital_defense_committed < orbital_defense_threats,
			orbital_defense_threats: orbital_defense_threats,
			needs_planet_buster:
				planet_busters_committed == 0 &&
				planet_buster_target_value >= planet_buster_minimum_target_size &&
				metrics.own_combat_power * 1.25 < metrics.strongest_rival_power,
			planet_buster_target_value: planet_buster_target_value,
			base_labs: base_metric.labs,
			planetary_datalinks_technology_count: planetary_datalinks_technology_count,
			empath_guild_infiltration_count: empath_guild_infiltration_count,
			network_backbone_research_bonus:
				global_network_node_count + base_commerce,
			available_energy: available_energy,
			priorities: priorities,
		};
		const selected = production.choose(
			base,
			available_unit_defs,
			available_facility_defs,
			context
		);
		if (headquarters_queue_base == base) {
			headquarters_queue_base = null;
		}
		if (
			selected != null && selected.kind == 'facility' &&
			selected.def.id == 'Headquarters'
		) {
			headquarters_queue_base = base;
		}
		if (selected != null && selected.kind == 'unit') {
			if (supply_rules.is_supply_transport(selected.def)) {
				supply_count++;
			}
			if (unit_abilities.has(selected.def, 'AirSuperiority')) {
				air_superiority_count++;
			}
			if (unit_abilities.has(selected.def, 'AmphibiousPods')) {
				amphibious_count++;
			}
			if (selected.def.can_terraform) {
				former_count++;
				if (selected.def.is_water) {
					sea_former_count++;
				} else {
					land_former_count++;
				}
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
			if (#is_defined(selected.def.weapon) && selected.def.weapon == 'ProbeTeam') {
				probe_count++;
			}
			if (#is_defined(selected.def.weapon) && selected.def.weapon == 'PlanetBuster') {
				planet_busters_committed++;
			}
		} else if (
			selected != null &&
			(selected.kind == 'facility' || selected.kind == 'project')
		) {
			available_energy = production.get_remaining_maintenance_budget(
				selected.def,
				available_energy
			);
			if (selected.def.id == 'OrbitalDefensePod') {
				orbital_defense_committed++;
			}
		}
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
			if (player.type == 'ai') {
				game.event_as(player.id, 'set_base_production', {
					base: base,
					kind: selected.kind,
					id: selected.id,
				});
			} else {
				game.event('set_governed_base_production', {
					base: base,
					kind: selected.kind,
					id: selected.id,
				});
			}
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
	const hurry = allow_hurry ? production.choose_hurry(hurry_candidates) : null;
	if (hurry != null) {
		const cost = game.get('f_economy_get_hurry_cost')(hurry.base);
		if (cost > 0 && player.energy_credits >= cost) {
			game.event_as(player.id, 'hurry_base_production', {base: hurry.base});
		}
	}
};

const manage_governed_bases = (game, player) => {
	const bases = owned_bases(game, player);
	let managed_bases = [];
	for (base of bases) {
		if (governor_rules.is_enabled(base)) {
			managed_bases :+base;
		}
	}
	if (#sizeof(managed_bases) == 0) {
		return 0;
	}
	const units = owned_units(game, player);
	const metrics = get_strategy_metrics(game, player, bases, units);
	queue_production(
		game,
		player,
		managed_bases,
		bases,
		units,
		metrics,
		true,
		false
	);
	return #sizeof(managed_bases);
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

const update_social_engineering = (game, player, metrics) => {
	const priorities = get_strategy_priorities(
		metrics,
		metrics.former_count,
		metrics.colony_count,
		metrics.combat_count,
		metrics.mobile_combat_count
	);
	const categories = game.get('f_social_get_categories')();
	const desired = social_engineering.choose(
		player,
		categories,
		game.get('f_social_get_available_choices'),
		game.get('f_social_get_ratings_for_choices'),
		priorities
	);
	const selected = social_engineering.choose_adoption(
		player,
		desired,
		categories,
		game.get('f_social_get_ratings_for_choices'),
		priorities,
		game.get('f_social_get_adoption_cost'),
		player.energy_credits
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
	}, COLONY_SEARCH_MAX_DISTANCE);
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

const move_artifact = (game, player, unit) => {
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		return false;
	}
	if (!#is_defined(artifact_rules.get_study_error(game, unit, player.id))) {
		game.event_as(player.id, 'study_alien_artifact', {unit: unit});
		return true;
	}
	const destination = pathfinding.find_best_reachable(
		game.get_tm(),
		unit,
		(source, candidate) => { return can_enter(unit, candidate, source); },
		(candidate, distance) => {
			const base = candidate.get_base();
			if (base == null || base.get_owner().id != player.id) {
				return null;
			}
			const can_study =
				technology_acquisition.can_grant(game, player) &&
				artifact_rules.get_study_method(base) != '';
			const contribution = artifact_rules.get_contribution_target(base);
			if (!can_study && contribution == null) {
				return null;
			}
			if (can_study) {
				return 200000 - distance * 100 + (
					base.has_facility('TheUniversalTranslator') ? 50000 : 0
				);
			}
			return (contribution.kind == 'project' ? 120000 : 100000) - distance * 100;
		}
	);
	if (destination == null) {
		return false;
	}
	if (destination.target == tile) {
		if (!#is_defined(artifact_rules.get_study_error(game, unit, player.id))) {
			game.event_as(player.id, 'study_alien_artifact', {unit: unit});
		} else {
			game.event_as(player.id, 'contribute_alien_artifact', {unit: unit});
		}
		return true;
	}
	if (destination.step != null && can_enter(unit, destination.step, tile)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: destination.step});
		return true;
	}
	return false;
};

const get_supply_choice = (home_base, tile, player) => {
	const resources = tile.get_resources(player);
	const intake = home_base.get_intake();
	const consumption = home_base.get_consumption();
	const nutrient_surplus = intake.NUTRIENTS - consumption.NUTRIENTS;
	const mineral_surplus = intake.MINERALS - consumption.MINERALS;
	const weights = {
		NUTRIENTS: nutrient_surplus <= 1 ? 7 : 2,
		MINERALS: mineral_surplus <= 2 ? 6 : 4,
		ENERGY: 3,
	};
	let best = null;
	for (resource of supply_rules.resource_types) {
		const value = resources[resource];
		const score = value * weights[resource];
		if (
			value > 0 &&
			(best == null || score > best.score ||
				(score == best.score && resource < best.resource))
		) {
			best = {resource: resource, value: value, score: score};
		}
	}
	return best;
};

const has_other_supply_convoy = (tile, unit) => {
	for (candidate of tile.get_units()) {
		if (
			candidate.id != unit.id && supply_rules.is_supply_transport(candidate) &&
			candidate.convoy_resource != 'none'
		) {
			return true;
		}
	}
	return false;
};

const move_supply = (game, player, unit) => {
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		return false;
	}
	const home_base = supply_rules.get_home_base(game, unit);
	if (unit.convoy_resource != 'none') {
		if (home_base == null) {
			game.event_as(player.id, 'set_supply_convoy', {
				unit: unit,
				resource: 'none',
			});
			return true;
		}
		return false;
	}
	if (home_base == null) {
		return false;
	}

	if (!#is_defined(supply_rules.get_contribution_error(game, unit, player.id))) {
		const target = supply_rules.get_contribution_target(unit);
		const base = tile.get_base();
		const missing = #max(
			target.production.mineral_cost - base.get_accumulated_minerals(),
			0
		);
		if (missing <= unit.get_def().mineral_cost * 2) {
			game.event_as(player.id, 'contribute_supply_transport', {unit: unit});
			return true;
		}
	}

	const territory_owner = game.get('f_territory_get_owner');
	const destination = pathfinding.find_best_reachable(
		game.get_tm(),
		unit,
		(source, candidate) => { return can_enter(unit, candidate, source); },
		(candidate, distance) => {
			if (candidate.get_base() != null || has_other_supply_convoy(candidate, unit)) {
				return null;
			}
			if (#is_defined(territory_owner)) {
				const owner = territory_owner(candidate);
				if (owner != null && owner.id != player.id) {
					return null;
				}
			}
			const choice = get_supply_choice(home_base, candidate, player);
			return choice == null ? null : choice.score * 10000 - distance * 100;
		}
	);
	if (destination == null) {
		return false;
	}
	if (destination.target == tile) {
		const choice = get_supply_choice(home_base, tile, player);
		if (choice != null) {
			game.event_as(player.id, 'set_supply_convoy', {
				unit: unit,
				resource: choice.resource,
			});
			return true;
		}
	}
	if (destination.step != null && can_enter(unit, destination.step, tile)) {
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
	let strategic_target_count = 0;
	const consider_target = (candidate, pending_growth, prioritize_nutrients, is_worked) => {
		if (candidate.is_locked()) {
			return;
		}
		if (
			(unit.is_land && candidate.is_water) ||
			(unit.is_water && candidate.is_land && candidate.get_base() == null)
		) {
			return;
		}
		for (other of candidate.get_units()) {
			if (other.owner != unit.owner) {
				return;
			}
		}
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
			if (!#is_defined(strategic_targets[key])) {
				strategic_target_count++;
			}
			strategic_targets[key] = {
				order: order,
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
		return target.score - distance * 100;
	}, FORMER_SEARCH_MAX_DISTANCE, strategic_target_count);
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

const move_probe = (game, player, unit, all_bases) => {
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		return false;
	}
	const action = probes.choose_adjacent_action(game, player, unit);
	if (action != null) {
		let data = {
			unit: unit,
			operation: action.operation,
			target: action.target,
		};
		if (#is_defined(action.frame_player_id)) {
			data.frame_player_id = action.frame_player_id;
		}
		game.event_as(player.id, 'probe_operation', data);
		return true;
	}
	const destination = probes.choose_target_base(game, player, unit, all_bases);
	if (destination == null) {
		return false;
	}
	const step = pathfinding.find_path_step(
		game.get_tm(),
		unit,
		destination.base.get_tile(),
		(source, candidate) => { return can_enter(unit, candidate, source); }
	);
	if (step != null && can_enter(unit, step)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: step});
		return true;
	}
	return false;
};

const move_combat = (
	game,
	player,
	unit,
	all_bases,
	strategic_bases,
	strategic_units,
	reinforcement_assignments,
	known_unity_pods,
	combat_profile
) => {
	let combat_phase_started = combat_profile == null ? 0 : #monotonic_ms();
	const finish_combat_phase = (phase) => {
		if (combat_profile == null) {
			return;
		}
		const now = #monotonic_ms();
		combat_profile[phase] = combat_profile[phase] + now - combat_phase_started;
		combat_phase_started = now;
	};
	const tile = unit.get_tile();
	if (tile.is_locked()) {
		finish_combat_phase('locked_ms');
		return 0;
	}
	const air_refuel_delay = move_air_to_refuel(game, player, unit, strategic_bases);
	finish_combat_phase('air_ms');
	if (air_refuel_delay >= 0) {
		return air_refuel_delay;
	}
	const repair_base = combat.get_repair_destination(game.get_tm(), unit, player.id, strategic_bases);
	if (repair_base != null) {
		const destination = repair_base.get_tile();
		if (tile == destination) {
			finish_combat_phase('repair_ms');
			return 0;
		}
		if (psi_gates.try_teleport(game, player, unit, destination, all_bases)) {
			finish_combat_phase('repair_ms');
			return 100;
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
			repair_step = pathfinding.find_path_step(
				game.get_tm(),
				unit,
				destination,
				(source, candidate) => { return can_enter(unit, candidate, source); },
				COMBAT_DETOUR_MAX_DISTANCE
			);
		}
		if (repair_step != null && can_enter(unit, repair_step)) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: repair_step});
			finish_combat_phase('repair_ms');
			return 100;
		}
	}
	finish_combat_phase('repair_ms');
	if (interrogate_adjacent_probe(game, player, unit)) {
		finish_combat_phase('probe_ms');
		return 100;
	}
	finish_combat_phase('probe_ms');
	const current_base = tile.get_base();
	if (current_base != null && current_base.get_owner().id == player.id) {
		const defenders = combat.get_garrison_count(current_base, player.id);
		const required_garrison = combat.get_required_garrison(
			game.get_tm(),
			current_base,
			player.id,
			strategic_units,
			game
		);
		if (defenders <= required_garrison) {
			finish_combat_phase('garrison_ms');
			return 0;
		}
	}
	finish_combat_phase('garrison_ms');
	if (attack_enemy_in_tiles(game, player, unit, tile.get_surrounding_tiles(), strategic_units)) {
		finish_combat_phase('attack_ms');
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
			finish_combat_phase('attack_ms');
			return 1000;
		}
	}
	finish_combat_phase('attack_ms');
	const pod_destination = unity_pods.choose_destination(
		game,
		unit,
		(source, candidate) => { return can_enter(unit, candidate, source); },
		known_unity_pods
	);
	finish_combat_phase('pod_ms');
	if (
		pod_destination != null && pod_destination.step != null &&
		can_enter(unit, pod_destination.step)
	) {
		game.event_as(player.id, 'move_unit', {
			unit: unit,
			tile: pod_destination.step,
		});
		return 100;
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
			reservations,
			game
		);
		if (reinforcement_base != null) {
			reinforcement_assignments[unit_key] = reinforcement_base.id;
		}
	}
	if (reinforcement_base != null) {
		const destination = reinforcement_base.get_tile();
		if (airdrops.try_drop(game, player, unit, destination)) {
			finish_combat_phase('reinforcement_ms');
			return 100;
		}
		if (psi_gates.try_teleport(game, player, unit, destination, all_bases)) {
			finish_combat_phase('reinforcement_ms');
			return 100;
		}
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
			reinforcement_step = pathfinding.find_path_step(
				game.get_tm(),
				unit,
				destination,
				(source, candidate) => { return can_enter(unit, candidate, source); },
				COMBAT_DETOUR_MAX_DISTANCE
			);
		}
		if (reinforcement_step != null && can_enter(unit, reinforcement_step)) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: reinforcement_step});
			finish_combat_phase('reinforcement_ms');
			return 100;
		}
		reinforcement_assignments[unit_key] = #undefined;
	}
	finish_combat_phase('reinforcement_ms');
	const assault_target_started = combat_profile == null ? 0 : #monotonic_ms();
	const enemy_base = combat.choose_assault_target(
		game.get_tm(),
		unit,
		player.id,
		strategic_bases,
		strategic_units,
		game
	);
	if (combat_profile != null) {
		combat_profile.assault_target_ms = combat_profile.assault_target_ms +
			#monotonic_ms() - assault_target_started;
	}
	const enemy_distance = enemy_base == null
		? 100000
		: game.get_tm().get_distance(tile, enemy_base.get_tile());
	if (
		enemy_base != null &&
		airdrops.try_drop(game, player, unit, enemy_base.get_tile())
	) {
		finish_combat_phase('assault_ms');
		return 100;
	}
	if (
		enemy_base != null &&
		psi_gates.try_teleport(game, player, unit, enemy_base.get_tile(), all_bases)
	) {
		finish_combat_phase('assault_ms');
		return 100;
	}
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
		const path_step = pathfinding.find_path_step(
			game.get_tm(),
			unit,
			enemy_base.get_tile(),
			(source, candidate) => { return can_enter(unit, candidate, source); },
			COMBAT_DETOUR_MAX_DISTANCE
		);
		if (path_step != null && can_enter(unit, path_step)) {
			game.event_as(player.id, 'move_unit', {unit: unit, tile: path_step});
			finish_combat_phase('assault_ms');
			return 100;
		}
	}
	if (target != null && can_enter(unit, target)) {
		game.event_as(player.id, 'move_unit', {unit: unit, tile: target});
		finish_combat_phase('assault_ms');
		return 100;
	}
	finish_combat_phase('assault_ms');
	return 0;
};

const play_turn = (game, player, done) => {
	const profile_callback = game.get('f_ai_profile');
	const is_profiling = #typeof(profile_callback) == 'Callable';
	const profile_started = is_profiling ? #monotonic_ms() : 0;
	let phase_started = profile_started;
	const bases = owned_bases(game, player);
	const units = owned_units(game, player);
	const ownership_ms = is_profiling ? #monotonic_ms() - phase_started : 0;
	phase_started = is_profiling ? #monotonic_ms() : 0;
	const turn_id = game.get_turn();
	const metrics = get_strategy_metrics(game, player, bases, units);
	const strategy_ms = is_profiling ? #monotonic_ms() - phase_started : 0;
	phase_started = is_profiling ? #monotonic_ms() : 0;
	update_diplomacy(game, player);
	const diplomacy_ms = is_profiling ? #monotonic_ms() - phase_started : 0;
	phase_started = is_profiling ? #monotonic_ms() : 0;
	update_social_engineering(game, player, metrics);
	const social_ms = is_profiling ? #monotonic_ms() - phase_started : 0;
	phase_started = is_profiling ? #monotonic_ms() : 0;
	nerve_stapling.manage(game, player, bases);
	const nerve_ms = is_profiling ? #monotonic_ms() - phase_started : 0;
	phase_started = is_profiling ? #monotonic_ms() : 0;
	economic_victory.update(game, player);
	const economic_ms = is_profiling ? #monotonic_ms() - phase_started : 0;
	phase_started = is_profiling ? #monotonic_ms() : 0;
	queue_production(game, player, bases, bases, units, metrics, false, true);
	const production_ms = is_profiling ? #monotonic_ms() - phase_started : 0;
	const setup_ms = is_profiling ? #monotonic_ms() - profile_started : 0;

	let steps = 0;
	let completion_ready_checks = 0;
	let action_attempts = {};
	let reinforcement_assignments = {};
	let actions_started = 0;
	let action_wait_checks = 0;
	let animation_wait_checks = 0;
	let completion_requested = false;
	let completion_poll_checks = 0;
	let completion_requests = 0;
	let completion_requested_at = 0;
	let profile_finished = false;
	let action_state_ms = 0;
	let orbital_ms = 0;
	let upgrade_ms = 0;
	let artifact_ms = 0;
	let supply_ms = 0;
	let colony_ms = 0;
	let probe_ms = 0;
	let former_ms = 0;
	let combat_ms = 0;
	let combat_profile = is_profiling ? {
		prepare_ms: 0,
		locked_ms: 0,
		air_ms: 0,
		repair_ms: 0,
		probe_ms: 0,
		garrison_ms: 0,
		attack_ms: 0,
		pod_ms: 0,
		reinforcement_ms: 0,
		assault_ms: 0,
		assault_target_ms: 0,
		known_pod_max: 0,
	} : null;
	let completion_check_ms = 0;
	let action_phase_started = 0;
	const finish_action_phase = (phase) => {
		if (!is_profiling) {
			return;
		}
		const action_phase_now = #monotonic_ms();
		const action_phase_elapsed = action_phase_now - action_phase_started;
		switch (phase) {
			case 'state': { action_state_ms += action_phase_elapsed; break; }
			case 'orbitals': { orbital_ms += action_phase_elapsed; break; }
			case 'upgrades': { upgrade_ms += action_phase_elapsed; break; }
			case 'artifacts': { artifact_ms += action_phase_elapsed; break; }
			case 'supply': { supply_ms += action_phase_elapsed; break; }
			case 'colonies': { colony_ms += action_phase_elapsed; break; }
			case 'probes': { probe_ms += action_phase_elapsed; break; }
			case 'formers': { former_ms += action_phase_elapsed; break; }
			case 'combat': { combat_ms += action_phase_elapsed; break; }
			case 'completion': { completion_check_ms += action_phase_elapsed; break; }
		}
		action_phase_started = action_phase_now;
	};
	const finish_profile = (reason) => {
		if (!is_profiling || profile_finished) {
			return;
		}
		profile_finished = true;
		profile_callback({
			player_id: player.id,
			faction_id: player.get_faction().id,
			reason: reason,
			ownership_ms: ownership_ms,
			strategy_ms: strategy_ms,
			strategy_profile: metrics.strategy_profile,
			diplomacy_ms: diplomacy_ms,
			social_ms: social_ms,
			nerve_ms: nerve_ms,
			economic_ms: economic_ms,
			production_ms: production_ms,
			setup_ms: setup_ms,
			action_ms: #monotonic_ms() - profile_started - setup_ms,
			total_ms: #monotonic_ms() - profile_started,
			steps: steps,
			actions_started: actions_started,
			action_wait_checks: action_wait_checks,
			animation_wait_checks: animation_wait_checks,
			action_state_ms: action_state_ms,
			orbital_ms: orbital_ms,
			upgrade_ms: upgrade_ms,
			artifact_ms: artifact_ms,
			supply_ms: supply_ms,
			colony_ms: colony_ms,
			probe_ms: probe_ms,
			former_ms: former_ms,
			combat_ms: combat_ms,
			combat_prepare_ms: combat_profile == null ? 0 : combat_profile.prepare_ms,
			combat_locked_ms: combat_profile == null ? 0 : combat_profile.locked_ms,
			combat_air_ms: combat_profile == null ? 0 : combat_profile.air_ms,
			combat_repair_ms: combat_profile == null ? 0 : combat_profile.repair_ms,
			combat_probe_ms: combat_profile == null ? 0 : combat_profile.probe_ms,
			combat_garrison_ms: combat_profile == null ? 0 : combat_profile.garrison_ms,
			combat_attack_ms: combat_profile == null ? 0 : combat_profile.attack_ms,
			combat_pod_ms: combat_profile == null ? 0 : combat_profile.pod_ms,
			combat_reinforcement_ms: combat_profile == null ? 0 : combat_profile.reinforcement_ms,
			combat_assault_ms: combat_profile == null ? 0 : combat_profile.assault_ms,
			combat_assault_target_ms: combat_profile == null ? 0 : combat_profile.assault_target_ms,
			combat_assault_route_ms: combat_profile == null
				? 0
				: combat_profile.assault_ms - combat_profile.assault_target_ms,
			combat_known_pod_max: combat_profile == null ? 0 : combat_profile.known_pod_max,
			completion_check_ms: completion_check_ms,
			completion_requests: completion_requests,
			completion_ack_ms: completion_requested_at == 0
				? 0
				: #monotonic_ms() - completion_requested_at,
		});
	};
	const play_next_action = () => {
		action_phase_started = is_profiling ? #monotonic_ms() : 0;
		if (
			!game.is_master() || game.is_game_over() || game.get_turn() != turn_id ||
			game.is_turn_complete(player.id)
		) {
			finish_profile(game.is_turn_complete(player.id) ? 'complete' : 'aborted');
			done();
			return;
		}
		if (completion_requested) {
			completion_poll_checks++;
			if (completion_poll_checks >= TURN_COMPLETION_RETRY_CHECKS) {
				completion_poll_checks = 0;
				completion_requests++;
				game.event_as(player.id, 'complete_turn', {turn_id: turn_id});
			}
			#async(TURN_COMPLETION_POLL_DELAY, play_next_action);
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
			if (action_state.has_nearby_animation(unit)) {
				waiting_for_animation = true;
				break;
			}
		}
		finish_action_phase('state');
		if (!waiting_for_action) {
			const orbital_target = orbitals.choose_target(game, player);
			if (orbital_target != null) {
				game.event_as(player.id, 'attack_orbital', {
					target: orbital_target.player,
					facility_id: orbital_target.definition.id,
				});
				action_started = true;
				action_delay = 100;
			}
		}
		finish_action_phase('orbitals');
		if (!action_started && !waiting_for_action) {
			const choose_upgrade = game.get('f_unit_upgrade_choose_ai_target');
			if (#is_defined(choose_upgrade)) {
				for (unit of current_units) {
					if (
						!action_state.can_attempt_action(unit, action_attempts) ||
						action_state.has_nearby_animation(unit)
					) {
						continue;
					}
					const target = choose_upgrade(player, unit);
					if (target != null) {
						game.event_as(player.id, 'upgrade_unit', {
							unit: unit,
							target_def_id: target.id,
						});
						action_started = true;
						action_delay = 100;
						action_state.record_action_attempt(unit, action_attempts);
						break;
					}
				}
			}
		}
		finish_action_phase('upgrades');
		if (!action_started && !waiting_for_action) {
			for (unit of current_units) {
				if (
					!action_state.can_attempt_action(unit, action_attempts) ||
					action_state.has_nearby_animation(unit)
				) {
					continue;
				}
				if (unit.get_def().weapon == 'AlienArtifact') {
					action_started = move_artifact(game, player, unit);
				}
				if (action_started) {
					action_state.record_action_attempt(unit, action_attempts);
					break;
				}
			}
		}
		finish_action_phase('artifacts');
		if (!action_started && !waiting_for_action) {
			for (unit of current_units) {
				if (
					!action_state.can_attempt_action(unit, action_attempts) ||
					action_state.has_nearby_animation(unit)
				) {
					continue;
				}
				if (supply_rules.is_supply_transport(unit)) {
					action_started = move_supply(game, player, unit);
				}
				if (action_started) {
					action_state.record_action_attempt(unit, action_attempts);
					break;
				}
			}
		}
		finish_action_phase('supply');
		if (!action_started && !waiting_for_action) {
			for (unit of current_units) {
				if (
					!action_state.can_attempt_action(unit, action_attempts) ||
					action_state.has_nearby_animation(unit)
				) {
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
		finish_action_phase('colonies');
		if (!action_started && !waiting_for_action) {
			for (unit of current_units) {
				if (
					!action_state.can_attempt_action(unit, action_attempts) ||
					action_state.has_nearby_animation(unit)
				) {
					continue;
				}
				if (unit.get_def().weapon == 'ProbeTeam') {
					action_started = move_probe(game, player, unit, all_bases);
				}
				if (action_started) {
					action_state.record_action_attempt(unit, action_attempts);
					break;
				}
			}
		}
		finish_action_phase('probes');
		if (!action_started && !waiting_for_action) {
			for (unit of current_units) {
				if (
					!action_state.can_attempt_action(unit, action_attempts) ||
					action_state.has_nearby_animation(unit)
				) {
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
		finish_action_phase('formers');
		if (!action_started && !waiting_for_action) {
			const combat_prepare_started = combat_profile == null ? 0 : #monotonic_ms();
			const strategic_bases = filter_hostile_bases(game, player, all_bases);
			const strategic_units = filter_hostile_units(game, player, all_units);
			const known_unity_pods = unity_pods.get_known_pods(player);
			if (combat_profile != null) {
				combat_profile.prepare_ms = combat_profile.prepare_ms +
					#monotonic_ms() - combat_prepare_started;
			}
			if (
				combat_profile != null && known_unity_pods != null &&
				#sizeof(known_unity_pods) > combat_profile.known_pod_max
			) {
				combat_profile.known_pod_max = #sizeof(known_unity_pods);
			}
			for (unit of current_units) {
				if (
					!action_state.can_attempt_action(unit, action_attempts) ||
					action_state.has_nearby_animation(unit)
				) {
					continue;
				}
				if (unit.get_def().offense > 0) {
					const combat_delay = move_combat(
						game,
						player,
						unit,
						all_bases,
						strategic_bases,
						strategic_units,
						reinforcement_assignments,
						known_unity_pods,
						combat_profile
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
		finish_action_phase('combat');
		steps++;
		if (action_started && steps < 1000) {
			actions_started++;
			completion_ready_checks = 0;
			#async(action_delay, play_next_action);
			return;
		}
		if ((waiting_for_animation || waiting_for_action) && steps < 1000) {
			if (waiting_for_action) { action_wait_checks++; }
			if (waiting_for_animation) { animation_wait_checks++; }
			completion_ready_checks = 0;
			#async(MOVEMENT_ACTION_DELAY, play_next_action);
			return;
		}
		const has_pending_animation = turn_rules.has_pending_owned_animation(game, player.id);
		finish_action_phase('completion');
		if (has_pending_animation) {
			completion_ready_checks = 0;
			#async(MOVEMENT_ACTION_DELAY, play_next_action);
			return;
		}
		completion_ready_checks++;
		const required_completion_checks = actions_started == 0 ? 1 : 2;
		if (completion_ready_checks < required_completion_checks) {
			#async(MOVEMENT_ACTION_DELAY, play_next_action);
			return;
		}
		completion_requested = true;
		completion_requests = 1;
		completion_requested_at = is_profiling ? #monotonic_ms() : 0;
		game.event_as(player.id, 'complete_turn', {turn_id: turn_id});
		#async(TURN_COMPLETION_POLL_DELAY, play_next_action);
	};
	#async(0, play_next_action);
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_ai_choose_research_target', (player, available) => {
			return choose_research_target(game, player, available);
		});
		game.set('f_ai_manage_governed_bases', (player) => {
			return manage_governed_bases(game, player);
		});
		let ui_started = false;
		let ai_running = false;
		const manage_human_governors = () => {
			if (!game.is_master() || game.is_game_over()) {
				return;
			}
			for (player of game.get_players()) {
				if (player.type != 'ai' && !game.is_turn_complete(player.id)) {
					manage_governed_bases(game, player);
				}
			}
		};
		const human_turns_complete = () => {
			for (player of game.get_players()) {
				if (player.type != 'ai' && !game.is_turn_complete(player.id)) {
					return false;
				}
			}
			return true;
		};
		const play_ai_players = () => {
			if (ai_running || !game.is_master() || game.is_game_over()) {
				return;
			}
			if (!human_turns_complete()) {
				#async(250, play_ai_players);
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
			#async(0, manage_human_governors);
			#async(AI_TURN_START_DELAY, play_ai_players);
		});
		game.on('base_governor_changed', (e) => {
			if (e.enabled) {
				#async(0, manage_human_governors);
			}
		});
		game.on('turn', (e) => {
			manage_human_governors();
			if (ui_started) {
				#async(AI_TURN_START_DELAY, play_ai_players);
			}
		});
	});
};
