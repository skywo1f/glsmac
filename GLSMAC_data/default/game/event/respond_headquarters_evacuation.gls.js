const economic_victory = #include('../economic_victory_rules');

const get_pending = (game, base) => {
	const getter = game.get('f_headquarters_get_evacuation');
	return #typeof(getter) == 'Callable' ? getter(base) : null;
};

const has_economic_capture = (offer) => {
	return offer.economic_victory_state != null;
};

const get_capture_delta = (offer) => {
	return {
		owner: offer.owner_capture_delta,
		conqueror: offer.conqueror_capture_delta,
	};
};

return {
	validate: (e) => {
		if (e.data.action != 'abandon' && e.data.action != 'evacuate') {
			return 'Unknown Headquarters evacuation response';
		}
		if (
			!#is_defined(e.data.base) ||
			#typeof(e.data.base.get_owner) != 'Callable'
		) {
			return 'Headquarters evacuation base is invalid';
		}
		const offer = get_pending(e.game, e.data.base);
		if (offer == null) {
			return 'Headquarters evacuation is no longer available';
		}
		if (offer.player.id != e.caller) {
			return 'Only the displaced Headquarters owner can respond';
		}
		if (e.data.action == 'abandon') {
			return;
		}
		if (
			e.data.base.get_owner().id != offer.new_owner.id ||
			offer.destination.get_owner().id != offer.player.id
		) {
			return 'Headquarters evacuation destination is no longer available';
		}
		for (base of e.game.get_bm().get_bases()) {
			if (
				base.get_owner().id == offer.player.id &&
				base.has_facility('Headquarters')
			) {
				return 'Faction already has a Headquarters';
			}
		}
		const delta = get_capture_delta(offer);
		if (offer.player.get_energy_credits() < offer.cost + delta.owner) {
			return 'Insufficient energy credits to evacuate Headquarters';
		}
		if (offer.new_owner.get_energy_credits() < delta.conqueror) {
			return 'Headquarters capture proceeds are no longer available';
		}
	},

	resolve: (e) => {
		return {action: e.data.action};
	},

	apply: (e) => {
		const cancel = e.game.get('f_headquarters_cancel_evacuation');
		const offer = cancel(e.data.base);
		const applied = {
			action: e.resolved.action,
			offer: offer,
			owner_energy: offer.player.get_energy_credits(),
			new_owner_energy: offer.new_owner.get_energy_credits(),
		};
		if (e.resolved.action == 'abandon') {
			if (has_economic_capture(offer)) {
				e.game.message(
					offer.new_owner.get_faction().name + ' has captured ' +
					offer.player.get_faction().name +
					'\'s Headquarters and foiled its Global Energy Market bid.'
				);
			}
			return applied;
		}

		const delta = get_capture_delta(offer);
		offer.player.set_energy_credits(
			applied.owner_energy - delta.owner - offer.cost
		);
		offer.new_owner.set_energy_credits(
			applied.new_owner_energy - delta.conqueror
		);
		offer.destination.add_facility('Headquarters');
		if (offer.economic_victory_state != null) {
			economic_victory.set_base_state(
				offer.destination,
				offer.economic_victory_state.turn,
				offer.economic_victory_state.cost
			);
			e.game.trigger('economic_victory_updated', {player: offer.player});
		}
		e.game.message(
			offer.player.get_faction().name + ' has safely evacuated its Headquarters to ' +
			offer.destination.name + ' for ' + #to_string(offer.cost) +
			' energy credits.'
		);
		e.game.trigger('economy_updated', {player: offer.player});
		if (delta.conqueror > 0) {
			e.game.trigger('economy_updated', {player: offer.new_owner});
		}
		return applied;
	},

	rollback: (e) => {
		const applied = e.applied;
		if (applied.action == 'evacuate') {
			const had_capture_proceeds = has_economic_capture(applied.offer);
			if (applied.offer.destination.has_facility('Headquarters')) {
				applied.offer.destination.remove_facility('Headquarters');
			}
			if (applied.offer.economic_victory_state != null) {
				economic_victory.clear_base_state(applied.offer.destination);
				e.game.trigger(
					'economic_victory_updated',
					{player: applied.offer.player}
				);
			}
			applied.offer.player.set_energy_credits(applied.owner_energy);
			applied.offer.new_owner.set_energy_credits(applied.new_owner_energy);
			e.game.trigger('economy_updated', {player: applied.offer.player});
			if (had_capture_proceeds) {
				e.game.trigger('economy_updated', {player: applied.offer.new_owner});
			}
		}
		const restore = e.game.get('f_headquarters_restore_evacuation');
		restore(applied.offer, true);
	},
};
