#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let finished = false;
	let ui_started = false;
	let start_runtime = null;
	let runtime_started = false;
	let operation_notified = false;
	let runtime_probe_id = 0;
	let probe_morale_before_operation = 0;
	let probe_morale_at_notification = 0;
	let interrogation_notified = false;
	let intercepted_probe_id = 0;
	let interceptor_id = 0;

	const fail = (message) => {
		if (!finished) {
			finished = true;
			#print('PROBE_RUNTIME_FAIL: ' + message);
			glsmac.exit();
		}
	};

	const start_if_ready = () => {
		if (ui_started && start_runtime != null && !runtime_started) {
			runtime_started = true;
			#async(250, () => { start_runtime(); });
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		game.on('probe_operation', (e) => {
			operation_notified = e.operation == 'subvert_unit' && e.success && e.detected;
			if (runtime_probe_id != 0 && game.get_um().has_unit(runtime_probe_id)) {
				probe_morale_at_notification = game.get_um().get_unit(runtime_probe_id).morale;
			}
		});
		game.on('probe_interrogated', (e) => {
			interrogation_notified =
				intercepted_probe_id != 0 && interceptor_id != 0 &&
				e.unit.id == intercepted_probe_id &&
				e.player.id == game.get_um().get_unit(interceptor_id).owner;
		});
		game.on('start_ui', (e) => {
			ui_started = true;
			start_if_ready();
		});

		game.on('turn', (e) => {
			if (e.year - 2100 != 1) {
				fail('runtime test exceeded one turn');
				return;
			}
			const actor = game.get_player();
			let target_player = null;
			for (candidate of game.get_players()) {
				if (candidate.id != actor.id) {
					target_player = candidate;
					break;
				}
			}
			if (target_player == null) {
				fail('quickstart did not create an opponent');
				return;
			}
			const operations = game.get('f_probe_get_operations')();
			if (
				!#is_defined(operations.incite_drone_riots) ||
				!#is_defined(operations.assassinate_researchers) ||
				!#is_defined(operations.genetic_plague) ||
				!game.get('f_probe_is_frameable_operation')('sabotage') ||
				game.get('f_probe_is_frameable_operation')('infiltrate')
			) {
				fail('advanced base-game probe operations are unavailable');
				return;
			}
			const atrocities_before = actor.get_major_atrocities();
			actor.set_major_atrocities(atrocities_before + 1);
			if (actor.get_major_atrocities() != atrocities_before + 1) {
				fail('major atrocity state did not update through the live player wrapper');
				return;
			}
			actor.set_major_atrocities(atrocities_before);

			let actor_base = null;
			let target_base = null;
			let target_base_count = 0;
			let target_population = 0;
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == actor.id && actor_base == null) {
					actor_base = base;
				} else if (base.get_owner().id == target_player.id) {
					target_base_count++;
					target_population += base.get_size();
					if (target_base == null) {
						target_base = base;
					}
				}
			}
			if (actor_base == null || target_base == null) {
				fail('quickstart bases are missing');
				return;
			}

			let probe_tile = null;
			let target_unit_tile = null;
			let subversion_probe_tile = null;
			let available_tiles = [];
			for (tile of target_base.get_tile().get_surrounding_tiles()) {
				if (
					tile != target_base.get_tile() && tile.is_land &&
					tile.get_base() == null && #sizeof(tile.get_units()) == 0 && !tile.is_locked()
				) {
					available_tiles :+tile;
				}
			}
			for (candidate_probe_tile of available_tiles) {
				for (candidate_target_tile of available_tiles) {
					if (
						candidate_probe_tile == candidate_target_tile ||
						!candidate_probe_tile.is_adjactent_to(candidate_target_tile)
					) {
						continue;
					}
					for (candidate_subversion_tile of available_tiles) {
						if (
							candidate_subversion_tile != candidate_probe_tile &&
							candidate_subversion_tile != candidate_target_tile &&
							candidate_subversion_tile.is_adjactent_to(candidate_target_tile)
						) {
							probe_tile = candidate_probe_tile;
							target_unit_tile = candidate_target_tile;
							subversion_probe_tile = candidate_subversion_tile;
							break;
						}
					}
					if (probe_tile != null) {
						break;
					}
				}
				if (probe_tile != null) {
					break;
				}
			}
			if (
				probe_tile == null || target_unit_tile == null || subversion_probe_tile == null
			) {
				fail('opponent base has no three-tile clear land test arrangement');
				return;
			}

			let probe_definition = null;
			for (definition of game.get_um().get_unit_defs()) {
				if (definition.id == 'ProbeTeam') {
					probe_definition = definition;
					break;
				}
			}
			const research = actor.get_research_state();
			let technologies = [];
			for (technology_id of research.technologies) {
				technologies :+technology_id;
			}
			technologies :+'PlanetaryNetworks';
			actor.set_research_state({
				technologies: technologies, target: research.target, progress: research.progress,
			});
			if (
				probe_definition == null || probe_definition.weapon != 'ProbeTeam' ||
				!actor_base.can_set_production('unit', 'ProbeTeam')
			) {
				fail('buildable Probe Team definition is unavailable');
				return;
			}

			const intercepted_probe_for_runtime = game.get_um().spawn_unit({
				def: 'ProbeTeam', owner: actor, tile: probe_tile, morale: 2, health: 1.0,
			});
			let probe = game.get_um().spawn_unit({
				def: 'ProbeTeam', owner: actor, tile: subversion_probe_tile,
				morale: 2, health: 1.0,
			});
			const target = game.get_um().spawn_unit({
				def: 'ScoutPatrol', owner: target_player, tile: target_unit_tile,
				morale: 2, health: 1.0, home_base_id: target_base.id,
			});
			const combat_attacker_for_runtime = game.get_um().spawn_unit({
				def: 'ProbeTeam', owner: actor, tile: subversion_probe_tile,
				morale: 2, health: 1.0,
			});
			runtime_probe_id = probe.id;
			const target_id = target.id;
			let probe_morale_expected = 0;
			actor.set_energy_credits(10000);
			target_player.set_energy_credits(200);
			actor.set_infiltrated(target_player, true);
			const report = game.get('f_probe_get_intelligence_report')(
				actor,
				target_player
			);
			if (report == null) {
				fail('live probe intelligence report returned null');
				return;
			}
			if (
				report.source != 'infiltrated_datalinks' ||
				report.energy_credits != target_player.get_energy_credits() ||
				report.bases.count != target_base_count ||
				report.bases.population != target_population ||
				report.units.total <= 0 ||
				#sizeof(report.social_choices) != 4
			) {
				fail(
					'live probe intelligence report is incomplete: source=' + report.source +
					' energy=' + #to_string(report.energy_credits) +
					' expected_energy=' + #to_string(target_player.get_energy_credits()) +
					' bases=' + #to_string(report.bases.count) +
					' expected_bases=' + #to_string(target_base_count) +
					' population=' + #to_string(report.bases.population) +
					' expected_population=' + #to_string(target_population) +
					' units=' + #to_string(report.units.total) +
					' social_choices=' + #to_string(#sizeof(report.social_choices))
				);
				return;
			}
			actor.set_infiltrated(target_player, false);
			const subversion_error = game.get('f_probe_get_subversion_error')(probe, target);
			if (subversion_error != '') {
				fail('live unit subversion setup is illegal: ' + subversion_error);
				return;
			}
			let energy_before = game.get_player(actor.id).energy_credits;
			let mind_control_before = actor.get_mind_control_total();
			let expected_cost = game.get('f_probe_get_subversion_cost')(actor, target);
			if (expected_cost == null || expected_cost <= 0 || expected_cost > energy_before) {
				fail(
					'live subversion cost is invalid: cost=' +
						(expected_cost == null ? 'null' : #to_string(expected_cost)) +
						' target_energy=' + #to_string(
							game.get_player(target_player.id).energy_credits
						) +
						' target_probe=' + #to_string(
							game.get('f_probe_get_effective_rating')(target_player)
						)
				);
				return;
			}

			const run_subversion = () => {
				energy_before = game.get_player(actor.id).energy_credits;
				mind_control_before = actor.get_mind_control_total();
				expected_cost = game.get('f_probe_get_subversion_cost')(actor, target);
				probe_morale_before_operation = probe.morale;
				probe_morale_expected = #min(
					probe_morale_before_operation + 1,
					#sizeof(game.get_um().get_moraleset(probe.get_def().morale_set)) - 1
				);
				game.event('probe_operation', {
					unit: probe,
					operation: 'subvert_unit',
					target: target,
				});
				let ticks = 0;
				#async(50, () => {
					ticks++;
					const transferred = game.get_um().has_unit(target_id)
						? game.get_um().get_unit(target_id)
						: null;
					if (transferred == null || transferred.owner != actor.id) {
						if (ticks >= 100) {
							fail('unit subversion did not complete');
							return false;
						}
						return true;
					}
					if (
						game.get_player(actor.id).energy_credits != energy_before - expected_cost ||
						actor.get_mind_control_total() != mind_control_before + 1 ||
						probe.movement != 0.0 ||
						probe_morale_at_notification != probe_morale_expected ||
						actor.get_diplomatic_relation(target_player) != 'vendetta' ||
						target_player.get_diplomatic_relation(actor) != 'vendetta' ||
						!operation_notified
					) {
						fail(
							'live subversion side effects are invalid: energy=' +
								#to_string(game.get_player(actor.id).energy_credits) +
							' expected=' + #to_string(energy_before - expected_cost) +
							' mind_control=' + #to_string(actor.get_mind_control_total()) +
							' expected_mind_control=' + #to_string(mind_control_before + 1) +
							' movement=' + #to_string(probe.movement) +
							' morale=' + #to_string(probe.morale) +
							' expected_morale=' + #to_string(probe_morale_expected) +
							' morale_before=' + #to_string(probe_morale_before_operation) +
							' morale_at_notification=' + #to_string(probe_morale_at_notification) +
							' actor_relation=' + actor.get_diplomatic_relation(target_player) +
							' target_relation=' + target_player.get_diplomatic_relation(actor) +
							' notified=' + #to_string(operation_notified)
						);
						return false;
					}
					finished = true;
					#print(
						'PROBE_RUNTIME_PASS: validated probe catalog, intelligence, neutral probe interrogation/repatriation, resident Probe combat, persisted subversion history, promotion, diplomacy, and notification'
					);
					#async(2500, () => { glsmac.exit(); });
					return false;
				});
			};

			const run_base_probe_combat = () => {
				const combat_attacker = combat_attacker_for_runtime;
				let existing_unit_ids = {};
				for (existing_unit of game.get_um().get_units()) {
					existing_unit_ids['u' + #to_string(existing_unit.id)] = true;
				}
				game.event('spawn_unit', {
					owner: target_player,
					tile: target_base.get_tile(),
					type: 'ProbeTeam',
					morale: 2,
					health: 1.0,
					movement: 0.0,
					moved_this_turn: true,
					home_base_id: target_base.id,
				});
				let resident_setup_ticks = 0;
				#async(50, () => {
					resident_setup_ticks++;
					let resident_probe = null;
					for (candidate of game.get_um().get_units()) {
						if (
							!#is_defined(existing_unit_ids['u' + #to_string(candidate.id)]) &&
							candidate.owner == target_player.id &&
							candidate.get_tile() == target_base.get_tile() &&
							game.get('f_probe_is_unit')(candidate)
						) {
							resident_probe = candidate;
							break;
						}
					}
					if (resident_probe == null) {
						if (resident_setup_ticks >= 100) {
							fail('resident Probe Team setup event did not complete');
							return false;
						}
						return true;
					}
					const combat_attacker_id = combat_attacker.id;
					const resident_probe_id = resident_probe.id;
					const combat_energy = actor.energy_credits;
					const actor_relation = actor.get_diplomatic_relation(target_player);
					const target_relation = target_player.get_diplomatic_relation(actor);
					game.event('probe_operation', {
						unit: combat_attacker,
						operation: 'infiltrate',
						target: target_base,
					});
					let combat_ticks = 0;
					#async(50, () => {
						combat_ticks++;
						const attacker_exists = game.get_um().has_unit(combat_attacker_id);
						const resident_exists = game.get_um().has_unit(resident_probe_id);
						if (attacker_exists == resident_exists) {
							if (combat_ticks >= 100) {
								fail('resident Probe Team combat did not resolve');
								return false;
							}
							return true;
						}
						const survivor = attacker_exists
							? game.get_um().get_unit(combat_attacker_id)
							: game.get_um().get_unit(resident_probe_id);
						if (
							survivor.morale != 3 || !survivor.moved_this_turn ||
							actor.energy_credits != combat_energy ||
							actor.has_infiltrated(target_player) ||
							actor.get_diplomatic_relation(target_player) != actor_relation ||
							target_player.get_diplomatic_relation(actor) != target_relation
						) {
							fail('resident Probe Team combat side effects are invalid');
							return false;
						}
						run_subversion();
						return false;
					});
					return false;
				});
			};

			start_runtime = () => {
				const interception_relation = target_player.get_diplomatic_relation(actor);
				if (interception_relation != 'neutral' && interception_relation != 'treaty') {
					fail('quickstart factions are not eligible for neutral probe interrogation');
					return;
				}
				const get_territory_owner = game.get('f_territory_get_owner');
				const territory_owner = get_territory_owner(probe_tile);
				if (territory_owner == null || territory_owner.id != target_player.id) {
					fail('probe operation tile is not inside the target faction territory');
					return;
				}
				const intercepted_probe = intercepted_probe_for_runtime;
				const interceptor = target;
				intercepted_probe_id = intercepted_probe.id;
				interceptor_id = interceptor.id;
				const intercepted_probe_movement = intercepted_probe.movement + 0.0;
				const intercepted_probe_moved = intercepted_probe.moved_this_turn == true;
				const interceptor_movement = interceptor.movement + 0.0;
				const interceptor_moved = interceptor.moved_this_turn == true;
				game.event_as(target_player.id, 'attack_unit', {
					attacker: interceptor,
					defender: intercepted_probe,
					probe_interception_action: 'interrogate',
				});
				let interrogation_ticks = 0;
				#async(50, () => {
					interrogation_ticks++;
					if (
						!game.get_um().has_unit(intercepted_probe_id) ||
						game.get_um().get_unit(intercepted_probe_id).get_tile() ==
							probe_tile
					) {
						if (interrogation_ticks >= 100) {
							fail('probe interrogation did not repatriate the intercepted unit');
							return false;
						}
						return true;
					}
					const returned_probe = game.get_um().get_unit(intercepted_probe_id);
					const return_base = returned_probe.get_tile().get_base();
					if (
						return_base == null || return_base.get_owner().id != actor.id ||
						returned_probe.movement != intercepted_probe_movement ||
						(returned_probe.moved_this_turn == true) != intercepted_probe_moved ||
						interceptor.movement != interceptor_movement ||
						(interceptor.moved_this_turn == true) != interceptor_moved ||
						actor.get_diplomatic_relation(target_player) != interception_relation ||
						target_player.get_diplomatic_relation(actor) != interception_relation ||
						!interrogation_notified
					) {
						fail('live probe interrogation side effects are invalid');
						return false;
					}
					run_base_probe_combat();
					return false;
				});
			};
			start_if_ready();
		});
	});

	glsmac.run();

});
