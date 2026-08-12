const rules = #include('../council_rules');

const snapshot_diplomacy = (game, players) => {
	let result = [];
	for (let i = 0; i < #sizeof(players); i++) {
		for (let j = i + 1; j < #sizeof(players); j++) {
			result :+{
				player: players[i],
				other: players[j],
				state: game.get('f_diplomacy_snapshot_pair')(players[i], players[j]),
			};
		}
	}
	return result;
};

const set_relation = (game, player, other, relation) => {
	game.get('f_diplomacy_set_bilateral_relation')(player, other, relation);
	game.get('f_diplomacy_clear_offers')(player, other);
	game.trigger('diplomacy_updated', {
		player: player,
		target: other,
		relation: relation,
	});
};

const restore_diplomacy = (game, snapshot) => {
	for (entry of snapshot) {
		game.get('f_diplomacy_restore_pair')(entry.player, entry.other, entry.state);
		game.trigger('diplomacy_updated', {
			player: entry.player,
			target: entry.other,
			relation: entry.state.player_relation,
		});
	}
};

return {
	validate: (e) => {
		if (e.caller != 0) {
			return 'Only the game master can resolve Supreme Leader accession';
		}
		if (e.game.is_game_over()) {
			return 'Game already has a winner';
		}
		const supreme = rules.get_supreme_state(e.game);
		if (supreme == null || supreme.resolved) {
			return 'No Supreme Leader accession is ready to resolve';
		}
		if (
			rules.has_surviving_faction(e.game, supreme.leader) &&
			#sizeof(rules.get_pending_supreme_players(e.game)) > 0
		) {
			return 'Supreme Leader accession is still waiting for faction responses';
		}
	},

	apply: (e) => {
		const states = rules.snapshot_states(e.game);
		const supreme = rules.get_supreme_state(e.game);
		if (!rules.has_surviving_faction(e.game, supreme.leader)) {
			rules.clear_supreme_state(e.game);
			e.game.message('The Supreme Leader accession has collapsed after the leader\'s defeat.');
			e.game.trigger('council_updated', {});
			return {states: states, diplomacy: [], terminal: false};
		}

		const participants = rules.get_supreme_participants(e.game);
		const diplomacy = snapshot_diplomacy(e.game, participants);
		const loyal = rules.get_loyal_supreme_players(e.game);
		const defiant = rules.get_defiant_supreme_players(e.game);
		rules.set_supreme_resolved(e.game, true);
		if (#sizeof(defiant) == 0) {
			e.game.declare_victory('diplomatic', supreme.leader.id);
			e.game.message(
				'All surviving factions have united behind ' + supreme.leader.name +
				' as Supreme Leader.'
			);
			return {states: states, diplomacy: diplomacy, terminal: true};
		}

		for (let i = 0; i < #sizeof(loyal); i++) {
			for (let j = i + 1; j < #sizeof(loyal); j++) {
				set_relation(e.game, loyal[i], loyal[j], 'pact');
			}
		}
		for (holdout of defiant) {
			for (ally of loyal) {
				set_relation(e.game, holdout, ally, 'vendetta');
			}
		}
		e.game.message(
			#to_string(#sizeof(defiant)) +
			' faction(s) have defied the Supreme Leader. The loyal factions have united against them.'
		);
		e.game.trigger('council_updated', {supreme_defiance: true});
		return {states: states, diplomacy: diplomacy, terminal: false};
	},

	rollback: (e) => {
		if (e.applied.terminal) { return; }
		rules.restore_states(e.applied.states);
		restore_diplomacy(e.game, e.applied.diplomacy);
		e.game.trigger('council_updated', {});
	},
};
