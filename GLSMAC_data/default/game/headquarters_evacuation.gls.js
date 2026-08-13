return (game) => {
	let pending = {};
	const keys = {
		player: 'headquarters_evacuation_player',
		destination: 'headquarters_evacuation_destination',
		cost: 'headquarters_evacuation_cost',
		bid_turn: 'headquarters_evacuation_bid_turn',
		bid_cost: 'headquarters_evacuation_bid_cost',
		owner_delta: 'headquarters_evacuation_owner_delta',
		conqueror_delta: 'headquarters_evacuation_conqueror_delta',
	};
	const key_names = [
		keys.player,
		keys.destination,
		keys.cost,
		keys.bid_turn,
		keys.bid_cost,
		keys.owner_delta,
		keys.conqueror_delta,
	];

	const get_key = (base) => {
		return 'b' + #to_string(base.id);
	};

	const clear = (base) => {
		const key = get_key(base);
		pending[key] = #undefined;
		for (name of key_names) {
			base.unset(name);
		}
	};

	const get_pending = (base) => {
		const key = get_key(base);
		if (#is_defined(pending[key])) {
			return pending[key];
		}
		if (!base.has(keys.player)) {
			return null;
		}
		let player = null;
		for (candidate of game.get_players()) {
			if (candidate.id == base.get(keys.player)) {
				player = candidate;
				break;
			}
		}
		let destination = null;
		for (candidate of game.get_bm().get_bases()) {
			if (candidate.id == base.get(keys.destination)) {
				destination = candidate;
				break;
			}
		}
		if (player == null || destination == null) {
			clear(base);
			return null;
		}
		const bid_turn = base.get(keys.bid_turn);
		const bid_cost = base.get(keys.bid_cost);
		const data = {
			base: base,
			player: player,
			new_owner: base.get_owner(),
			destination: destination,
			cost: base.get(keys.cost),
			economic_victory_state: bid_turn > 0
				? {turn: bid_turn, cost: bid_cost}
				: null,
			owner_capture_delta: base.get(keys.owner_delta),
			conqueror_capture_delta: base.get(keys.conqueror_delta),
		};
		pending[key] = data;
		return data;
	};

	const store = (data, notify) => {
		const key = get_key(data.base);
		const has_capture = #is_defined(data.economic_victory_capture);
		if (has_capture) {
			data.owner_capture_delta =
				data.post_owner_energy - data.economic_victory_capture.old_owner_energy;
			data.conqueror_capture_delta =
				data.post_new_owner_energy - data.economic_victory_capture.new_owner_energy;
		} else {
			if (!#is_defined(data.owner_capture_delta)) {
				data.owner_capture_delta = 0;
			}
			if (!#is_defined(data.conqueror_capture_delta)) {
				data.conqueror_capture_delta = 0;
			}
		}
		data.base.set(keys.player, data.player.id);
		data.base.set(keys.destination, data.destination.id);
		data.base.set(keys.cost, data.cost);
		data.base.set(
			keys.bid_turn,
			data.economic_victory_state == null ? 0 : data.economic_victory_state.turn
		);
		data.base.set(
			keys.bid_cost,
			data.economic_victory_state == null ? 0 : data.economic_victory_state.cost
		);
		data.base.set(keys.owner_delta, data.owner_capture_delta);
		data.base.set(keys.conqueror_delta, data.conqueror_capture_delta);
		pending[key] = data;
		if (notify) {
			game.trigger('headquarters_evacuation_requested', data);
		}
	};

	const offer = (data) => {
		store(data, true);
	};

	const cancel = (base) => {
		const data = get_pending(base);
		clear(base);
		return data;
	};

	const restore = (data, notify) => {
		store(data, notify);
	};

	const get_for_player = (player) => {
		for (base of game.get_bm().get_bases()) {
			const data = get_pending(base);
			if (data != null && data.player.id == player.id) {
				return data;
			}
		}
		return null;
	};

	game.set('f_headquarters_offer_evacuation', offer);
	game.set('f_headquarters_get_evacuation', get_pending);
	game.set('f_headquarters_cancel_evacuation', cancel);
	game.set('f_headquarters_restore_evacuation', restore);
	game.set('f_headquarters_get_player_evacuation', get_for_player);
};
