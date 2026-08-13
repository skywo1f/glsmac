const ORBITAL_DEFENSE = 'OrbitalDefensePod';

const get_definition = (game, id) => {
	for (definition of game.get_bm().get_facility_defs()) {
		if (definition.id == id) {
			return definition;
		}
	}
	return null;
};

return {
	player_visibility: 'private',

	validate: (e) => {
		const player = e.game.get_player(e.caller);
		return e.game.get('f_orbital_get_attack_error')(
			player,
			e.data.target,
			e.data.facility_id
		);
	},

	resolve: (e) => {
		return {success: e.game.random.get_int(0, 1) == 0};
	},

	apply: (e) => {
		const player = e.game.get_player(e.caller);
		const target = e.data.target;
		const facility_id = e.data.facility_id;
		const definition = get_definition(e.game, facility_id);
		const applied = {
			player: player,
			target: target,
			facility_id: facility_id,
			player_pods: player.get_orbital_facility_count(ORBITAL_DEFENSE),
			player_deployments: player.get_orbital_defense_deployments(),
			target_count: target.get_orbital_facility_count(facility_id),
			target_deployments: target.get_orbital_defense_deployments(),
			diplomacy: e.game.get('f_diplomacy_snapshot_pair')(player, target),
			success: e.resolved.success,
		};

		if (e.resolved.success) {
			const remaining = applied.target_count - 1;
			target.set_orbital_facility_count(facility_id, remaining);
			if (facility_id == ORBITAL_DEFENSE) {
				target.set_orbital_defense_deployments(#min(
					applied.target_deployments,
					remaining
				));
			}
			player.set_orbital_defense_deployments(applied.player_deployments + 1);
		} else {
			player.set_orbital_facility_count(ORBITAL_DEFENSE, applied.player_pods - 1);
		}

		e.game.get('f_diplomacy_set_bilateral_relation')(player, target, 'vendetta');
		e.game.get('f_diplomacy_clear_offers')(player, target);
		e.game.trigger('diplomacy_updated', {
			player: player,
			target: target,
			relation: 'vendetta',
		});
		e.game.trigger('orbital_attack', {
			player: player,
			target: target,
			definition: definition,
			success: e.resolved.success,
		});
		e.game.trigger('economy_updated', {player: target});
		e.game.trigger('orbital_state_updated', {player: player, target: target});

		if (e.resolved.success) {
			e.game.message(
				player.name + ' destroyed a ' + definition.name +
				' belonging to ' + target.name + '.'
			);
		} else {
			e.game.message(
				player.name + ' failed to destroy a ' + definition.name +
				' belonging to ' + target.name +
				'; the attacking Orbital Defense Pod was lost.'
			);
		}
		return applied;
	},

	rollback: (e) => {
		const applied = e.applied;
		applied.player.set_orbital_facility_count(ORBITAL_DEFENSE, applied.player_pods);
		applied.player.set_orbital_defense_deployments(applied.player_deployments);
		applied.target.set_orbital_facility_count(applied.facility_id, applied.target_count);
		applied.target.set_orbital_defense_deployments(applied.target_deployments);
		e.game.get('f_diplomacy_restore_pair')(
			applied.player,
			applied.target,
			applied.diplomacy
		);
		e.game.trigger('diplomacy_updated', {
			player: applied.player,
			target: applied.target,
			relation: applied.diplomacy.player_relation,
		});
		e.game.trigger('economy_updated', {player: applied.target});
		e.game.trigger('orbital_state_updated', {
			player: applied.player,
			target: applied.target,
		});
	},

};
