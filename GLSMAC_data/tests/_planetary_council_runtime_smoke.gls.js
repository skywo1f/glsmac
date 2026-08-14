#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	let started = false;
	let finished = false;
	let ui_started = false;
	let ui_state = null;
	let vote_requested = false;
	let vote_click_pending = false;
	let observed_session = null;
	let observed_accession = false;
	let contact_requests_sent = false;

	const fail = (message) => {
		if (!finished) {
			finished = true;
			#print('PLANETARY_COUNCIL_RUNTIME_FAIL: ' + message);
			glsmac.exit();
		}
	};

	const finish_if_ready = () => {
		if (finished && ui_started) {
			#print(
				'PLANETARY_COUNCIL_RUNTIME_PASS: installed assets, live Council popup vote, native Council state, AI ballot, Supreme Leader accession, and diplomatic victory verified'
			);
			#async(250, () => { glsmac.exit(); });
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;
		game.set('f_ui_ready', (state) => { ui_state = state; });

		game.on('council_updated', (event) => {
			if (finished) { return; }
			const get_supreme = game.get('f_council_get_supreme_state');
			if (#is_defined(get_supreme) && get_supreme() != null) {
				observed_accession = true;
			}
			if (vote_requested || vote_click_pending) { return; }
			const get_session = game.get('f_council_get_session');
			if (!#is_defined(get_session)) { return; }
			const session = get_session();
			if (session == null) { return; }
			const player = game.get_player();
			if (
				session.candidate_a_id != player.id &&
				session.candidate_b_id != player.id
			) {
				fail('quickstart player was not an election candidate');
				return;
			}
			const state = player.get_council_state();
			if (
				state.proposal != 'supreme' || state.caller_id != player.id ||
				state.last_session_turn != game.get_turn() || state.vote_id != -2 ||
				state.global_trade_pact || state.unity_core_salvaged ||
				state.un_charter_repealed || state.supreme_leader_id != -1 ||
				state.supreme_response != 0 || state.supreme_resolved
			) {
				fail('native player wrapper exposed invalid active Council state');
				return;
			}
			observed_session = #clone(state);
			vote_click_pending = true;
			let ui_ticks = 0;
			#async(50, () => {
				ui_ticks++;
				if (finished) { return false; }
				if (
					ui_state == null || ui_state.modules.popup.popup == null ||
					ui_state.modules.popup.popup.id != 'planetary_council'
				) {
					if (ui_ticks >= 200) {
						fail('live Planetary Council popup did not open for the pending vote');
						return false;
					}
					return true;
				}
				const council_popup = ui_state.modules.popup.popup_defs.planetary_council;
				const vote_button = session.candidate_a_id == player.id
					? council_popup.vote_first_button
					: council_popup.vote_second_button;
				if (vote_button == null || vote_button.text == '') {
					fail('live Planetary Council vote button was not initialized');
					return false;
				}
				vote_requested = true;
				vote_button.trigger('click');
				return false;
			});
		});

		game.on('start_ui', (e) => {
			ui_started = true;
			finish_if_ready();
		});

		game.on('turn', (e) => {
			if (started || e.year - 2100 != 1) { return; }
			started = true;
			const player = game.get_player();
			if (player.get_faction().id != 'PEACEKEEPERS') {
				fail('runtime did not start as the Peacekeepers');
				return;
			}

			const research = player.get_research_state();
			let technologies = [];
			for (id of research.technologies) { technologies :+id; }
			if (!player.has_technology('MindMachineInterface')) {
				technologies :+'MindMachineInterface';
			}
			player.set_research_state({
				technologies: technologies,
				target: research.target == 'MindMachineInterface' ? '' : research.target,
				progress: research.target == 'MindMachineInterface' ? 0 : research.progress,
			});

			const bm = game.get_bm();
			const tm = game.get_tm();
			let added_bases = 0;
			for (let y = 0; y < tm.get_map_height() && added_bases < 4; y++) {
				for (let x = 0; x < tm.get_map_width() && added_bases < 4; x++) {
					if (x % 2 != y % 2) { continue; }
					const tile = tm.get_tile(x, y);
					if (
						tile.is_land && tile.get_base() == null &&
						#sizeof(tile.get_units(true)) == 0
					) {
						game.event('spawn_base', {
							owner: player,
							tile: tile,
							name: 'Council Runtime Base ' + #to_string(added_bases + 1),
							production: 'ScoutPatrol',
							initial_population: true,
						});
						added_bases++;
					}
				}
			}
			if (added_bases != 4) {
				fail('could not create deterministic Council voting population');
				return;
			}

			let population_ticks = 0;
			#async(50, () => {
				population_ticks++;
				const get_voters = game.get('f_council_get_voters');
				if (
					game.get('f_council_get_votes')(player) < 10 ||
					#sizeof(get_voters()) < 2
				) {
					if (population_ticks >= 400) {
						fail('initial Council population events timed out');
						return false;
					}
					return true;
				}
				let contacts_ready = true;
				for (other of get_voters()) {
					if (
						other.id != player.id &&
						(!player.has_contact(other) || !other.has_contact(player))
					) {
						contacts_ready = false;
						if (!contact_requests_sent) {
							game.event('establish_diplomatic_contact', {
								player: player,
								target: other,
							});
						}
					}
				}
				if (!contacts_ready) {
					contact_requests_sent = true;
					return true;
				}
				const error = game.get('f_council_validate_call')(player, 'supreme');
				if (#is_defined(error)) {
					fail('Supreme Leader call was not eligible: ' + error);
					return false;
				}
				game.event('call_planetary_council', {
					player: player,
					proposal: 'supreme',
				});

				let victory_ticks = 0;
				#async(50, () => {
					victory_ticks++;
					if (!game.is_game_over()) {
						if (victory_ticks >= 200) {
							const session = game.get('f_council_get_session')();
							const tally = game.get('f_council_get_tally')();
							const supreme = game.get('f_council_get_supreme_state')();
							#print(
								'PLANETARY_COUNCIL_RUNTIME_DIAGNOSTIC: session=' +
								#to_string(session != null) + ' tally=' +
								#to_string(tally != null) + ' all_voted=' +
								#to_string(tally != null && tally.all_voted) + ' supreme=' +
								#to_string(supreme != null) + ' resolved=' +
								#to_string(supreme != null && supreme.resolved)
							);
							for (voter of game.get('f_council_get_voters')()) {
								const state = voter.get_council_state();
								#print(
									'PLANETARY_COUNCIL_RUNTIME_DIAGNOSTIC: player=' +
									#to_string(voter.id) + ' type=' + voter.type +
									' vote=' + #to_string(state.vote_id) +
									' leader=' + #to_string(state.supreme_leader_id) +
									' response=' + #to_string(state.supreme_response)
								);
							}
							fail('diplomatic victory resolution timed out');
							return false;
						}
						return true;
					}
					const victory = game.get_victory_state();
					const state = player.get_council_state();
					const supreme = game.get('f_council_get_supreme_state')();
					if (
						observed_session == null || !vote_requested || !observed_accession ||
						victory.type != 'diplomatic' || victory.winner != player.id ||
						victory.turn != game.get_turn() || state.proposal != '' ||
						state.last_session_turn != game.get_turn() || state.vote_id != -2 ||
						supreme == null || supreme.leader.id != player.id || !supreme.resolved ||
						state.supreme_leader_id != player.id || state.supreme_response != 2 ||
						!state.supreme_resolved
					) {
						fail('terminal diplomatic victory or Supreme Leader accession state is invalid');
						return false;
					}
					finished = true;
					finish_if_ready();
					return false;
				});
				return false;
			});
		});
	});

	glsmac.run();

});
