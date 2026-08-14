#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);
	const turn_rules = #include('../default/game/turn_rules');

	const MINIMUM_TURN = 20;
	const FINAL_TURN = 30;
	const EXPECTED_AI_COUNT = 6;
	let game = null;
	let ui_started = false;
	let exit_scheduled = false;
	let ai_progress = {};
	let success_wait_ticks = 0;
	let current_turn = 0;
	let stall_ticks = 0;
	let last_completion_state = '';

	const fail = (message) => {
		#print('AI_ECONOMY_SOAK_FAIL: ' + message);
		glsmac.exit();
	};

	const complete_human_turn = () => {
		if (game.is_game_over() || exit_scheduled) {
			return false;
		}
		const player_id = game.get_player().id;
		if (
			!game.is_game_over() && !game.is_turn_complete(player_id) &&
			!turn_rules.has_pending_owned_animation(game, player_id)
		) {
			game.event('complete_turn', {});
		}
		return true;
	};

	const monitor_turn_progress = () => {
		if (!ui_started || exit_scheduled || game.is_game_over()) {
			return true;
		}
		let player_states = '';
		for (player of game.get_players()) {
			if (player_states != '') {
				player_states += ';';
			}
			player_states += #to_string(player.id) + ':' + player.type + ':' +
				#to_string(game.is_turn_complete(player.id));
		}
		if (player_states != last_completion_state) {
			last_completion_state = player_states;
			stall_ticks = 0;
			return true;
		}
		stall_ticks++;
		if (stall_ticks < 300) {
			return true;
		}
		let unit_states = '';
		for (unit of game.get_um().get_units()) {
			const tile = unit.get_tile();
			if (unit_states != '') {
				unit_states += ';';
			}
			unit_states += #to_string(unit.id) + ':' + #to_string(unit.owner) + ':' +
				unit.def + ':movement=' + #to_string(unit.movement) +
				':terraforming=' + unit.terraforming + ':tile=' +
				#to_string(tile.x) + ',' + #to_string(tile.y) +
				':locked=' + #to_string(tile.is_locked());
		}
		let locked_tiles = '';
		const tm = game.get_tm();
		for (let y = 0; y < tm.get_map_height(); y++) {
			for (let x = 0; x < tm.get_map_width(); x++) {
				if (x % 2 == y % 2 && tm.get_tile(x, y).is_locked()) {
					if (locked_tiles != '') {
						locked_tiles += ';';
					}
					locked_tiles += #to_string(x) + ',' + #to_string(y);
				}
			}
		}
		fail(
			'turn ' + #to_string(current_turn) + ' stalled for 30 seconds' +
			'; players=[' + player_states + ']' +
			'; locked_tiles=[' + locked_tiles + ']' +
			'; units=[' + unit_states + ']'
		);
		return false;
	};

	const finish_success = () => {
		success_wait_ticks++;
		let map_locked = false;
		const tm = game.get_tm();
		for (let y = 0; y < tm.get_map_height() && !map_locked; y++) {
			for (let x = 0; x < tm.get_map_width(); x++) {
				if (x % 2 == y % 2 && tm.get_tile(x, y).is_locked()) {
					map_locked = true;
					break;
				}
			}
		}
		if (map_locked) {
			if (success_wait_ticks >= 50) {
				fail('final AI turn or map animation did not settle before exit');
				return false;
			}
			return true;
		}
		#print(
			'AI_ECONOMY_SOAK_PASS: all six AI factions sustained growth, research, ' +
			'infrastructure, defense, production, and terraforming'
		);
		#async(2000, () => { glsmac.exit(); });
		return false;
	};

	const get_progress = (ai) => {
		const key = 'p' + #to_string(ai.id);
		if (!#is_defined(ai_progress[key])) {
			ai_progress[key] = {
				max_base_size: 0,
				saw_former: false,
				saw_active_former: false,
				saw_improvement: false,
			};
		}
		return ai_progress[key];
	};

	const get_snapshot = (ai) => {
		const progress = get_progress(ai);
		let bases = 0;
		let population = 0;
		let facilities = 0;
		let queued_bases = 0;
		let queued_formers = 0;
		let queued_colonies = 0;
		let queued_facilities = 0;
		let production = '';
		let garrisoned_bases = 0;
		let rioting_bases = 0;
		for (base of game.get_bm().get_bases()) {
			if (base.get_owner().id != ai.id) {
				continue;
			}
			bases++;
			population += base.get_size();
			progress.max_base_size = #max(progress.max_base_size, base.get_size());
			const base_facilities = #sizeof(base.get_facilities());
			facilities += base_facilities;
			const queue = base.get_production_queue();
			if (#sizeof(queue) > 0) {
				queued_bases++;
				if (production != '') { production += ','; }
				production += #to_string(base.id) + ':' + queue[0].id;
				if (queue[0].production_kind == 'unit') {
					const queued_def = game.get_um().get_unit_def(queue[0].id);
					if (queued_def.can_terraform) { queued_formers++; }
					if (queued_def.can_found_base) { queued_colonies++; }
				} else if (queue[0].production_kind == 'facility') {
					queued_facilities++;
				}
			}
			for (unit of base.get_tile().get_units()) {
				if (unit.owner == ai.id && unit.get_def().offense > 0) {
					garrisoned_bases++;
					break;
				}
			}
			if (game.get('f_base_get_psych')(base).is_rioting) {
				rioting_bases++;
			}
			for (tile of base.get_workable_tiles()) {
				if (
					tile.terraforming.road ||
					tile.terraforming.farm ||
					tile.terraforming.mine ||
					tile.terraforming.solar ||
					tile.terraforming.forest
				) {
					progress.saw_improvement = true;
				}
			}
		}
		let formers = 0;
		let colonies = 0;
		let combat = 0;
		for (unit of game.get_um().get_units()) {
			if (unit.owner != ai.id) {
				continue;
			}
			const def = unit.get_def();
			if (def.can_terraform) {
				formers++;
				progress.saw_former = true;
				if (unit.terraforming != 'none') {
					progress.saw_active_former = true;
				}
			}
			if (def.can_found_base) {
				colonies++;
			}
			if (def.offense > 0) {
				combat++;
			}
		}
		let technology_ids = '';
		for (technology_id of ai.get_research_state().technologies) {
			if (technology_ids != '') { technology_ids += ','; }
			technology_ids += technology_id;
		}
		return {
			id: ai.id,
			faction: ai.get_faction().id,
			bases: bases,
			population: population,
			facilities: facilities,
			queued_bases: queued_bases,
			queued_formers: queued_formers,
			queued_colonies: queued_colonies,
			queued_facilities: queued_facilities,
			garrisoned_bases: garrisoned_bases,
			rioting_bases: rioting_bases,
			formers: formers,
			colonies: colonies,
			combat: combat,
			technologies: #sizeof(ai.get_research_state().technologies),
			credits: ai.energy_credits,
			technology_ids: technology_ids,
			production: production,
			active_former_started: progress.saw_active_former,
			improvement_completed: progress.saw_improvement,
		};
	};

	const print_snapshot = (turn, snapshot) => {
		#print(
			'AI_ECONOMY_SOAK_TRACE: turn=' + #to_string(turn) +
			' player=' + #to_string(snapshot.id) +
			' faction=' + snapshot.faction +
			' bases=' + #to_string(snapshot.bases) +
			' pop=' + #to_string(snapshot.population) +
			' facilities=' + #to_string(snapshot.facilities) +
			' formers=' + #to_string(snapshot.formers) +
			' queued_formers=' + #to_string(snapshot.queued_formers) +
			' active_former_started=' + #to_string(snapshot.active_former_started) +
			' improvement_completed=' + #to_string(snapshot.improvement_completed) +
			' colonies=' + #to_string(snapshot.colonies) +
			' combat=' + #to_string(snapshot.combat) +
			' garrisons=' + #to_string(snapshot.garrisoned_bases) +
			' techs=' + #to_string(snapshot.technologies) +
			' credits=' + #to_string(snapshot.credits) +
			' known=[' + snapshot.technology_ids + ']' +
			' production=[' + snapshot.production + ']'
		);
	};

	const get_incomplete_reason = (snapshot) => {
		const progress = ai_progress['p' + #to_string(snapshot.id)];
		if (
			snapshot.bases <= 0 || snapshot.population < snapshot.bases ||
			progress.max_base_size < 2
		) {
			return 'did not sustain populated, growing bases';
		}
		if (snapshot.garrisoned_bases < #max(1, snapshot.bases - 1)) {
			return 'left too many bases without a garrison';
		}
		if (snapshot.queued_bases != snapshot.bases) {
			return 'left one or more bases without production';
		}
		if (snapshot.rioting_bases > 0) {
			return 'ended the soak with rioting bases';
		}
		if (snapshot.technologies < 2) {
			return 'did not complete enough research milestones';
		}
		if (snapshot.credits < 0) {
			return 'treasury became insolvent';
		}
		if (
			!progress.saw_former && !progress.saw_improvement &&
			snapshot.queued_formers == 0 && snapshot.colonies == 0 &&
			snapshot.queued_colonies == 0 && snapshot.facilities <= snapshot.bases &&
			snapshot.queued_facilities == 0
		) {
			return 'did not establish a terraforming, expansion, or infrastructure plan';
		}
		return null;
	};

	glsmac.on('configure_game', (e) => {
		game = e.game;
		game.set('f_ai_profile', (sample) => {
			#print(
				'AI_ECONOMY_PROFILE: turn=' + #to_string(current_turn) +
				' faction=' + sample.faction_id +
				' total_ms=' + #to_string(sample.total_ms) +
				' setup_ms=' + #to_string(sample.setup_ms) +
				' action_ms=' + #to_string(sample.action_ms) +
				' steps=' + #to_string(sample.steps) +
				' actions=' + #to_string(sample.actions_started) +
				' action_waits=' + #to_string(sample.action_wait_checks) +
				' animation_waits=' + #to_string(sample.animation_wait_checks) +
				' completion_requests=' + #to_string(sample.completion_requests) +
				' completion_ack_ms=' + #to_string(sample.completion_ack_ms) +
				' colony_ms=' + #to_string(sample.colony_ms) +
				' former_ms=' + #to_string(sample.former_ms) +
				' combat_ms=' + #to_string(sample.combat_ms) +
				' reason=' + sample.reason
			);
		});

		game.on('start_ui', (e) => {
			ui_started = true;
			#async(100, monitor_turn_progress);
			#async(250, complete_human_turn);
		});

		game.on('turn', (e) => {
			if (!ui_started || exit_scheduled) {
				return;
			}
			let snapshots = [];
			for (player of game.get_players()) {
				if (player.type == 'ai') {
					snapshots :+get_snapshot(player);
				}
			}
			if (#sizeof(snapshots) != EXPECTED_AI_COUNT) {
				fail(
					'expected ' + #to_string(EXPECTED_AI_COUNT) +
					' computer players, got ' + #to_string(#sizeof(snapshots))
				);
				return;
			}
			const turn = e.year - 2100;
			current_turn = turn;
			stall_ticks = 0;
			last_completion_state = '';
			if (turn == 1 || turn % 5 == 0 || turn >= FINAL_TURN) {
				for (snapshot of snapshots) {
					print_snapshot(turn, snapshot);
				}
			}
			if (turn >= MINIMUM_TURN) {
				let incomplete = null;
				for (snapshot of snapshots) {
					const reason = get_incomplete_reason(snapshot);
					if (reason != null) {
						incomplete = snapshot.faction + ' ' + reason;
						break;
					}
				}
				if (incomplete == null) {
					exit_scheduled = true;
					#async(100, finish_success);
					return;
				}
				if (turn >= FINAL_TURN) {
					fail(incomplete);
					return;
				}
			}
		});
	});

	glsmac.run();

});
