const TURNS_KEY = 'nerve_stapling_turns';
const ATTEMPTS_KEY = 'nerve_stapling_count';
const MAX_STATE_VALUE = 1000000;

const snapshot_base_value = (base, key) => {
	return {
		present: base.has(key),
		value: base.has(key) ? base.get(key) : 0,
	};
};

const restore_base_value = (base, key, snapshot) => {
	if (snapshot.present) {
		base.set(key, snapshot.value);
	} else {
		base.unset(key);
	}
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

const find_player = (game, id) => {
	for (player of game.get_players()) {
		if (player.id == id) {
			return player;
		}
	}
	return null;
};

const refresh_psych = (game, base) => {
	const psych = game.get('f_economy_get_base_psych')(game, base);
	game.get('f_base_process_psych')(game, base, psych);
};

return {
	validate: (e) => {
		return e.game.get('f_nerve_stapling_get_error')(e.data.base, e.caller);
	},

	resolve: (e) => {
		const attempts = e.game.get('f_nerve_stapling_get_attempts')(e.data.base) + 1;
		return {
			attempts: attempts,
			success: attempts <= 2 || (
				attempts <= 8 && e.game.random.get_int(0, 1) == 1
			),
		};
	},

	apply: (e) => {
		const base = e.data.base;
		const actor = base.get_owner();
		const applied = {
			attempts: snapshot_base_value(base, ATTEMPTS_KEY),
			turns: snapshot_base_value(base, TURNS_KEY),
			pop_types: snapshot_pop_types(base),
			actor_atrocities: actor.get_major_atrocities(),
			actor_sanction_turns: actor.get_sanction_turns(),
			victim_id: 0 - 1,
		};
		base.set(ATTEMPTS_KEY, e.resolved.attempts);
		actor.set_major_atrocities(applied.actor_atrocities + 1);
		if (e.game.get('f_nerve_stapling_is_un_charter_active')()) {
			actor.set_sanction_turns(#min(
				MAX_STATE_VALUE,
				applied.actor_sanction_turns + 10
			));
			e.game.trigger('diplomatic_sanctions_updated', {
				player: actor,
				turns: actor.get_sanction_turns(),
			});
			e.game.message(
				'Economic sanctions imposed against ' + actor.name + ' for 10 years.'
			);
		}

		if (base.has('former_owner_id')) {
			const victim = find_player(e.game, base.get('former_owner_id'));
			if (victim != null && victim.id != actor.id) {
				applied.victim_id = victim.id;
				applied.diplomacy = e.game.get('f_diplomacy_snapshot_pair')(victim, actor);
				e.game.get('f_diplomacy_add_grievance')(victim, actor, true, true, false);
				e.game.trigger('diplomatic_grievance_updated', {
					player: victim,
					target: actor,
				});
			}
		}

		if (e.resolved.success) {
			const turns = e.game.get('f_nerve_stapling_get_turns')(base);
			base.set(TURNS_KEY, #min(
				MAX_STATE_VALUE,
				turns + e.game.get('f_nerve_stapling_turns_per_success')()
			));
			refresh_psych(e.game, base);
			e.game.message(
				base.name + ' has been nerve stapled for 10 years.'
			);
		} else {
			e.game.message(
				'Nerve stapling failed to pacify the population of ' + base.name + '.'
			);
		}
		e.game.trigger('update_base', {base: base});
		e.game.trigger('nerve_stapling', {
			player: actor,
			base: base,
			success: e.resolved.success,
			attempts: e.resolved.attempts,
			turns: e.game.get('f_nerve_stapling_get_turns')(base),
			atrocity: true,
		});
		return applied;
	},

	rollback: (e) => {
		const base = e.data.base;
		const actor = base.get_owner();
		restore_base_value(base, ATTEMPTS_KEY, e.applied.attempts);
		restore_base_value(base, TURNS_KEY, e.applied.turns);
		restore_pop_types(e.applied.pop_types);
		actor.set_major_atrocities(e.applied.actor_atrocities);
		actor.set_sanction_turns(e.applied.actor_sanction_turns);
		e.game.trigger('diplomatic_sanctions_updated', {
			player: actor,
			turns: e.applied.actor_sanction_turns,
		});
		if (#is_defined(e.applied.diplomacy)) {
			const victim = find_player(e.game, e.applied.victim_id);
			if (victim != null) {
				e.game.get('f_diplomacy_restore_pair')(victim, actor, e.applied.diplomacy);
				e.game.trigger('diplomatic_grievance_updated', {
					player: victim,
					target: actor,
				});
			}
		}
		e.game.trigger('update_base', {base: base});
	},
};
