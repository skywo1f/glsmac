#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	const colonization = #include('../default/game/ai/colonization');
	const terraforming = #include('../default/game/ai/terraforming');
	const attack_orbital = #include('../default/game/event/attack_orbital');
	let game = null;
	let ai_id = 0 - 1;
	let initial_ai_bases = 0;
	let growth_base_id = 0;
	let former_spawned = false;
	let setup_complete = false;
	let ui_started = false;
	let exit_scheduled = false;
	let seven_player_orbital_requested = false;
	let seven_player_orbital_complete = false;
	let seven_player_orbital_error = null;

	const fail = (message) => {
		#print('AI_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const complete_human_turn = () => {
		if (!game.is_game_over() && !game.is_turn_complete(game.get_player().id)) {
			game.event('complete_turn', {});
		}
	};

	const find_former_site = (base, player) => {
		const pending_growth = game.get('f_base_get_pending_growth')(base);
		const prioritize_nutrients = pending_growth <= 0;
		let best = null;
		let best_score = null;
		const consider = (candidate, is_worked) => {
			if (
				candidate == base.get_tile() || !candidate.is_land || candidate.is_locked() ||
				candidate.get_base() != null ||
				terraforming.get_order(candidate, prioritize_nutrients, player) == null
			) {
				return;
			}
			for (unit of candidate.get_units()) {
				if (unit.owner != player.id) {
					return;
				}
			}
			const score = terraforming.get_target_score(
				candidate,
				player,
				pending_growth,
				0,
				is_worked
			);
			if (best_score == null || score > best_score) {
				best = candidate;
				best_score = score;
			}
		};
		for (candidate of base.get_worked_tiles()) {
			consider(candidate, true);
		}
		for (candidate of base.get_unworked_tiles()) {
			consider(candidate, false);
		}
		return best;
	};

	const validate_seven_player_start = () => {
		const players = game.get_players();
		let ai_count = 0;
		for (player of players) {
			if (player.type == 'ai') {
				ai_count++;
			}
			let faction_count = 0;
			let base_count = 0;
			for (other of players) {
				if (other.get_faction().id == player.get_faction().id) {
					faction_count++;
				}
			}
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == player.id) {
					base_count++;
				}
			}
			if (faction_count != 1 || base_count != 1) {
				fail('invalid seven-player faction or base ownership');
				return;
			}
		}
		if (ai_count != 6) {
			fail('expected six computer opponents');
			return;
		}

		if (seven_player_orbital_requested) {
			return;
		}
		seven_player_orbital_requested = true;
		game.event('ai_runtime_validate_orbital_attack', {});
		let wait_ticks = 0;
		#async(25, () => {
			wait_ticks++;
			if (seven_player_orbital_complete) {
				if (seven_player_orbital_error != null) {
					fail(seven_player_orbital_error);
				} else {
					#print(
						'SEVEN_PLAYER_RUNTIME_PASS: seven unique factions, orbital attack outcomes, diplomacy, and rollback verified'
					);
					glsmac.exit();
				}
				return false;
			}
			if (wait_ticks >= 200) {
				fail('native orbital attack event timed out');
				return false;
			}
			return true;
		});
	};

	glsmac.on('configure_game', (e) => {
		game = e.game;
		game.register_event('ai_runtime_validate_orbital_attack', {
			validate: (event) => {
				if (event.caller != 0) {
					return 'Only the host can run the native orbital attack check';
				}
			},
			apply: (event) => {
				const actor = event.game.get_player();
				let target = null;
				for (player of event.game.get_players()) {
					if (player.id != actor.id) {
						target = player;
						break;
					}
				}
				if (target == null) {
					seven_player_orbital_error = 'orbital attack target player is missing';
					seven_player_orbital_complete = true;
					return {verified: false};
				}

				const actor_pods = actor.get_orbital_facility_count('OrbitalDefensePod');
				const actor_deployments = actor.get_orbital_defense_deployments();
				const target_labs = target.get_orbital_facility_count('SkyHydroponicsLab');
				const diplomacy = event.game.get('f_diplomacy_snapshot_pair')(actor, target);
				const integrity = actor.get_integrity_blemishes();
				actor.set_orbital_facility_count('OrbitalDefensePod', 2);
				actor.set_orbital_defense_deployments(0);
				target.set_orbital_facility_count('SkyHydroponicsLab', 2);
				actor.set_contact(target, true);
				target.set_contact(actor, true);
				actor.set_diplomatic_relation(target, 'treaty');
				target.set_diplomatic_relation(actor, 'treaty');

				let orbital_event = {
					caller: actor.id,
					game: event.game,
					data: {target: target, facility_id: 'SkyHydroponicsLab'},
					resolved: {success: true},
				};
				const validation_error = attack_orbital.validate(orbital_event);
				if (#is_defined(validation_error)) {
					seven_player_orbital_error =
						'native orbital attack validation failed: ' + validation_error;
				} else {
					orbital_event.applied = attack_orbital.apply(orbital_event);
					if (
						actor.get_orbital_facility_count('OrbitalDefensePod') != 2 ||
						actor.get_orbital_defense_deployments() != 1 ||
						target.get_orbital_facility_count('SkyHydroponicsLab') != 1 ||
						actor.get_diplomatic_relation(target) != 'vendetta' ||
						target.get_diplomatic_relation(actor) != 'vendetta' ||
						actor.get_integrity_blemishes() != #min(7, integrity + 1)
					) {
						seven_player_orbital_error =
							'successful native orbital attack state is invalid';
					}
					attack_orbital.rollback(orbital_event);
					if (
						seven_player_orbital_error == null && (
							actor.get_orbital_facility_count('OrbitalDefensePod') != 2 ||
							actor.get_orbital_defense_deployments() != 0 ||
							target.get_orbital_facility_count('SkyHydroponicsLab') != 2 ||
							actor.get_diplomatic_relation(target) != 'treaty' ||
							actor.get_integrity_blemishes() != integrity
						)
					) {
						seven_player_orbital_error =
							'successful native orbital attack rollback is invalid';
					}

					if (seven_player_orbital_error == null) {
						orbital_event.resolved = {success: false};
						orbital_event.applied = attack_orbital.apply(orbital_event);
						if (
							actor.get_orbital_facility_count('OrbitalDefensePod') != 1 ||
							actor.get_orbital_defense_deployments() != 0 ||
							target.get_orbital_facility_count('SkyHydroponicsLab') != 2
						) {
							seven_player_orbital_error =
								'failed native orbital attack state is invalid';
						}
						attack_orbital.rollback(orbital_event);
						if (
							seven_player_orbital_error == null && (
								actor.get_orbital_facility_count('OrbitalDefensePod') != 2 ||
								actor.get_orbital_defense_deployments() != 0 ||
								target.get_orbital_facility_count('SkyHydroponicsLab') != 2 ||
								actor.get_diplomatic_relation(target) != 'treaty' ||
								actor.get_integrity_blemishes() != integrity
							)
						) {
							seven_player_orbital_error =
								'failed native orbital attack rollback is invalid';
						}
					}
				}

				actor.set_orbital_facility_count('OrbitalDefensePod', actor_pods);
				actor.set_orbital_defense_deployments(actor_deployments);
				target.set_orbital_facility_count('SkyHydroponicsLab', target_labs);
				event.game.get('f_diplomacy_restore_pair')(actor, target, diplomacy);
				seven_player_orbital_complete = true;
				return {verified: seven_player_orbital_error == null};
			},
			rollback: (event) => {},
		});

		game.on('start_ui', (e) => {
			ui_started = true;
			const players = game.get_players();
			const native_player = game.get_native_player();
			if (
				native_player.type != 'native' || native_player.id != 7 ||
				game.get_player(native_player.id) != native_player ||
				native_player.get_faction().id != 'PLANET' ||
				!native_player.get_faction().is_native
			) {
				fail('serialized Planet player identity is invalid');
				return;
			}
			if (#sizeof(players) == 7) {
				validate_seven_player_start();
				return;
			}
			if (#sizeof(players) != 2) {
				fail('expected two players, found ' + #to_string(#sizeof(players)));
				return;
			}

			let ai = null;
			let ai_base = null;
			const bases = game.get_bm().get_bases();
			for (player of players) {
				if (player.type == 'ai') {
					ai = player;
					break;
				}
			}
			if (ai == null || ai.id == game.get_player().id || ai.is_master) {
				fail('AI player identity or authority is invalid');
				return;
			}
			ai_id = ai.id;
			for (base of bases) {
				if (base.get_owner().id == ai_id) {
					initial_ai_bases++;
					if (ai_base == null) {
						ai_base = base;
					}
				}
			}
			if (ai_base == null || initial_ai_bases != 1) {
				fail('AI did not start with exactly one base');
				return;
			}
			growth_base_id = ai_base.id;

			const tm = game.get_tm();
			let colony_site = null;
			let colony_score = null;
			for (let y = 0; y < tm.get_map_height(); y++) {
				for (let x = 0; x < tm.get_map_width(); x++) {
					if (x % 2 != y % 2) {
						continue;
					}
					const candidate = tm.get_tile(x, y);
					if (#sizeof(candidate.get_units()) != 0) {
						continue;
					}
					const score = colonization.get_site_score(tm, candidate, ai, bases, false);
					if (score != null && (colony_score == null || score > colony_score)) {
						colony_site = candidate;
						colony_score = score;
					}
				}
			}
			if (colony_site == null) {
				fail('deterministic colony setup tile is unavailable');
				return;
			}

			ai_base.set('accumulated_nutrients', game.get('map_growth_base') * 2);
			game.event('spawn_unit', {
				owner: ai,
				tile: colony_site,
				type: 'ColonyPod',
				morale: 1,
				health: 1.0,
			});
			setup_complete = true;
			#async(100, complete_human_turn);
		});

		game.on('turn', (e) => {
			if (!ui_started || exit_scheduled) {
				return;
			}
			const players = game.get_players();
			if (#sizeof(players) == 7) {
				validate_seven_player_start();
				return;
			}
			if (!setup_complete) {
				return;
			}

			const turn = e.year - 2100;
			let ai_bases = 0;
			let ai_population = 0;
			let ai_terraforming = false;
			for (base of game.get_bm().get_bases()) {
				if (base.get_owner().id == ai_id) {
					ai_bases++;
					ai_population += base.get_size();
				}
			}
			for (unit of game.get_um().get_units()) {
				if (unit.owner == ai_id && unit.get_def().can_terraform && unit.terraforming != 'none') {
					ai_terraforming = true;
					break;
				}
			}
			const expanded = ai_bases > initial_ai_bases;
			const grew = ai_population > ai_bases;
			if (grew && !former_spawned) {
				let growth_base = null;
				for (base of game.get_bm().get_bases()) {
					if (base.id == growth_base_id && base.get_owner().id == ai_id) {
						growth_base = base;
						break;
					}
				}
				const former_site = growth_base == null
					? null
					: find_former_site(growth_base, game.get_player(ai_id));
				if (former_site == null) {
					fail('no legal strategic terraforming tile is available after growth');
					return;
				}
				game.event('spawn_unit', {
					owner: game.get_player(ai_id),
					tile: former_site,
					type: 'Former',
					morale: 1,
					health: 1.0,
				});
				former_spawned = true;
			}
			if (expanded && grew && ai_terraforming) {
				exit_scheduled = true;
				#print('AI_RUNTIME_PASS: AI founded a legal base, grew, and issued a useful terraforming order');
				#async(2000, () => { glsmac.exit(); });
				return;
			}
			if (turn >= 6) {
				#print('AI_RUNTIME_TRACE: turn=' + #to_string(turn) + ' bases=' + #to_string(ai_bases) + ' population=' + #to_string(ai_population) + ' terraforming=' + #to_string(ai_terraforming));
				fail('AI did not complete the focused expansion, growth, and terraforming scenario by turn six');
				return;
			}
			#async(100, complete_human_turn);
		});
	});

	glsmac.run();

});
