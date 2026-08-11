return {
	init: (p) => {
		this.p = p;
		this.player = null;
		this.status_text = null;
		this.first_text = null;
		this.second_text = null;
		this.detail_text = null;
		this.vote_first_button = null;
		this.vote_second_button = null;
		this.abstain_button = null;
		this.governor_button = null;
		this.supreme_button = null;
		this.trade_button = null;

		const result = p.create('PLANETARY COUNCIL', 560, 278, (body, cb) => {
			this.status_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 12,
			});
			this.first_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 40,
			});
			this.second_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 66,
			});
			this.detail_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 94,
			});

			this.vote_first_button = body.button({
				class: 'game-popup-button', text: '', top: 122,
			});
			this.vote_first_button.on('click', (e) => {
				const session = p.game.get('f_council_get_session')();
				if (this.player != null && session != null) {
					p.game.event('cast_council_vote', {
						player: this.player, vote_id: session.candidate_a_id,
					});
				}
				return true;
			});

			this.vote_second_button = body.button({
				class: 'game-popup-button', text: '', top: 148,
			});
			this.vote_second_button.on('click', (e) => {
				const session = p.game.get('f_council_get_session')();
				if (this.player != null && session != null) {
					p.game.event('cast_council_vote', {
						player: this.player, vote_id: session.candidate_b_id,
					});
				}
				return true;
			});

			this.abstain_button = body.button({
				class: 'game-popup-button', text: 'Abstain', top: 174,
			});
			this.abstain_button.on('click', (e) => {
				if (this.player != null) {
					p.game.event('cast_council_vote', {player: this.player, vote_id: -1});
				}
				return true;
			});

			this.governor_button = body.button({
				class: 'game-popup-button', text: 'Convene Governor Election', top: 122,
			});
			this.governor_button.on('click', (e) => {
				if (this.player != null) {
					p.game.event('call_planetary_council', {
						player: this.player, proposal: 'governor',
					});
				}
				return true;
			});

			this.supreme_button = body.button({
				class: 'game-popup-button', text: 'Propose Supreme Leader', top: 148,
			});
			this.supreme_button.on('click', (e) => {
				if (this.player != null) {
					p.game.event('call_planetary_council', {
						player: this.player, proposal: 'supreme',
					});
				}
				return true;
			});

			this.trade_button = body.button({
				class: 'game-popup-button', text: '', top: 174,
			});
			this.trade_button.on('click', (e) => {
				if (this.player != null) {
					const has_trade_pact = p.game.get('f_council_has_global_trade_pact')();
					p.game.event('call_planetary_council', {
						player: this.player,
						proposal: has_trade_pact ? 'repeal_trade_pact' : 'trade_pact',
					});
				}
				return true;
			});

			body.button({
				class: 'game-popup-button', text: 'Close', top: 250, is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});
		});

		p.game.on('council_updated', (e) => {
			if (this.player == null) { this.player = p.game.get_player(); }
			this.refresh();
			const state = this.player.get_council_state();
			if (state.proposal != '' && state.vote_id == -2 && !p.modules.popup.is_shown()) {
				p.modules.popup.show('planetary_council');
			}
		});
		return result;
	},

	refresh: () => {
		this.vote_first_button.hide();
		this.vote_second_button.hide();
		this.abstain_button.hide();
		this.governor_button.hide();
		this.supreme_button.hide();
		this.trade_button.hide();
		if (this.player == null) { return; }

		const get_session = this.p.game.get('f_council_get_session');
		const get_tally = this.p.game.get('f_council_get_tally');
		const get_rankings = this.p.game.get('f_council_get_rankings');
		const get_governor = this.p.game.get('f_council_get_governor');
		const validate_call = this.p.game.get('f_council_validate_call');
		const session = get_session();
		if (session != null) {
			const tally = get_tally();
			const is_policy =
				session.proposal == 'trade_pact' || session.proposal == 'repeal_trade_pact';
			if (is_policy) {
				this.status_text.text = session.proposal == 'trade_pact'
					? 'Resolution: Global Trade Pact'
					: 'Resolution: Repeal Global Trade Pact';
				this.first_text.text = 'Yes: ' + #to_string(tally.candidate_a_votes) +
					' committed votes';
				this.second_text.text = 'No: ' + #to_string(tally.candidate_b_votes) +
					' committed votes';
			} else {
				const first = this.p.game.get_player(session.candidate_a_id);
				const second = this.p.game.get_player(session.candidate_b_id);
				this.status_text.text = session.proposal == 'supreme'
					? 'Election: Supreme Leader of Planet'
					: 'Election: Planetary Governor';
				this.first_text.text = first.get_faction().name + ': ' +
					#to_string(tally.candidate_a_votes) + ' committed votes';
				this.second_text.text = second.get_faction().name + ': ' +
					#to_string(tally.candidate_b_votes) + ' committed votes';
			}
			this.detail_text.text = #to_string(tally.required_votes) + ' of ' +
				#to_string(tally.total_votes) + ' votes required.';
			if (this.player.get_council_state().vote_id == -2) {
				if (is_policy) {
					this.vote_first_button.text = 'Vote Yes';
					this.vote_second_button.text = 'Vote No';
				} else {
					const first = this.p.game.get_player(session.candidate_a_id);
					const second = this.p.game.get_player(session.candidate_b_id);
					this.vote_first_button.text = 'Vote for ' + first.get_faction().name;
					this.vote_second_button.text = 'Vote for ' + second.get_faction().name;
				}
				this.vote_first_button.show();
				this.vote_second_button.show();
				this.abstain_button.show();
			} else {
				this.detail_text.text = this.detail_text.text + ' Your vote has been recorded.';
			}
			return;
		}

		const governor = get_governor();
		const has_trade_pact = this.p.game.get('f_council_has_global_trade_pact')();
		this.status_text.text = (governor == null
			? 'Planetary Governor: none elected'
			: 'Planetary Governor: ' + governor.get_faction().name) +
			(has_trade_pact ? ' | Trade Pact: active' : ' | Trade Pact: inactive');
		const rankings = get_rankings();
		this.first_text.text = #sizeof(rankings) > 0
			? rankings[0].player.get_faction().name + ': ' +
				#to_string(rankings[0].votes) + ' votes'
			: 'No eligible candidates';
		this.second_text.text = #sizeof(rankings) > 1
			? rankings[1].player.get_faction().name + ': ' +
				#to_string(rankings[1].votes) + ' votes'
			: '';
		const governor_error = validate_call(this.player, 'governor');
		const supreme_error = validate_call(this.player, 'supreme');
		const trade_proposal = has_trade_pact ? 'repeal_trade_pact' : 'trade_pact';
		const trade_error = validate_call(this.player, trade_proposal);
		if (!#is_defined(governor_error)) {
			this.governor_button.show();
		}
		if (!#is_defined(supreme_error)) {
			this.supreme_button.show();
		}
		if (!#is_defined(trade_error)) {
			this.trade_button.text = has_trade_pact
				? 'Propose Repeal of Global Trade Pact'
				: 'Propose Global Trade Pact';
			this.trade_button.show();
		}
		if (
			#is_defined(governor_error) && #is_defined(supreme_error) &&
			#is_defined(trade_error)
		) {
			this.detail_text.text = governor_error;
		} else if (#is_defined(supreme_error) && #is_defined(trade_error)) {
			this.detail_text.text = supreme_error;
		} else if (#is_defined(trade_error)) {
			this.detail_text.text = trade_error;
		} else {
			this.detail_text.text = 'The Council is ready to convene.';
		}
	},

	on_show: () => {
		this.player = this.p.game.get_player();
		this.refresh();
	},

	on_hide: () => {
		this.player = null;
	},
};
