return {

	validate: (e) => {
		const error = e.game.get('f_diplomacy_validate_pair')(e.data.player, e.data.target);
		if (#is_defined(error)) {
			return error;
		}
		if (e.caller != 0 && e.data.player.id != e.caller) {
			return 'Players may only make their own diplomatic trades';
		}
		if (e.game.is_turn_complete(e.data.player.id)) {
			return 'Player has already completed this turn';
		}
		const trade_error = e.game.get('f_diplomacy_validate_trade')(
			e.data.player,
			e.data.target,
			e.data.terms
		);
		if (#is_defined(trade_error)) {
			return trade_error;
		}
		if (e.data.target.get_diplomatic_trade(e.data.player) != null) {
			return 'A diplomatic trade is already pending';
		}
		if (e.data.player.get_diplomatic_trade(e.data.target) != null) {
			return 'The existing diplomatic proposal must be answered first';
		}
		if (
			e.data.target.get_diplomatic_offer(e.data.player) != '' ||
			e.data.player.get_diplomatic_offer(e.data.target) != ''
		) {
			return 'The existing diplomatic proposal must be answered first';
		}
	},

	apply: (e) => {
		const previous = {
			trade: e.data.target.get_diplomatic_trade(e.data.player),
			offer: e.data.target.get_diplomatic_offer(e.data.player),
		};
		e.data.target.set_diplomatic_trade(e.data.player, e.data.terms);
		const proposed_relation = e.game.get('f_diplomacy_get_proposed_relation')(
			e.data.terms
		);
		if (proposed_relation != '') {
			e.data.target.set_diplomatic_offer(e.data.player, proposed_relation);
		}
		const ultimatum = e.game.get('f_diplomacy_is_ultimatum')(e.data.terms);
		const military_request = e.game.get('f_diplomacy_is_military_request')(e.data.terms);
		const event_name = military_request
			? 'diplomatic_military_request_proposed'
			: (ultimatum ? 'diplomatic_ultimatum_proposed' : 'diplomatic_trade_proposed');
		e.game.trigger(event_name, {
			player: e.data.player,
			target: e.data.target,
			terms: e.data.terms,
		});
		return previous;
	},

	rollback: (e) => {
		if (e.applied.trade == null) {
			e.data.target.clear_diplomatic_trade(e.data.player);
		} else {
			e.data.target.set_diplomatic_trade(e.data.player, e.applied.trade);
		}
		e.data.target.set_diplomatic_offer(e.data.player, e.applied.offer);
		const ultimatum = e.game.get('f_diplomacy_is_ultimatum')(e.data.terms);
		const military_request = e.game.get('f_diplomacy_is_military_request')(e.data.terms);
		const event_name = military_request
			? 'diplomatic_military_request_updated'
			: (ultimatum ? 'diplomatic_ultimatum_updated' : 'diplomatic_trade_updated');
		e.game.trigger(event_name, {
			player: e.data.player,
			target: e.data.target,
		});
	},

};
