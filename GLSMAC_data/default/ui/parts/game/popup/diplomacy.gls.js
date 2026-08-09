const relation_name = (relation) => {
	if (relation == 'treaty') { return 'Treaty'; }
	if (relation == 'pact') { return 'Pact'; }
	if (relation == 'vendetta') { return 'Vendetta'; }
	return 'Neutral';
};

return {

	init: (p) => {
		this.p = p;
		this.player = null;
		this.target = null;
		this.opponent_select = null;
		this.relation_text = null;
		this.offer_text = null;
		this.offer_treaty = null;
		this.offer_pact = null;
		this.declare_vendetta = null;
		this.accept_offer = null;
		this.reject_offer = null;

		for (event_name of [
			'diplomacy_updated',
			'diplomatic_proposal',
			'diplomatic_proposal_updated',
			'diplomatic_proposal_resolved',
		]) {
			const observed_event_name = event_name;
			p.game.on(observed_event_name, (e) => {
				if (this.player != null) {
					this.refresh();
				}
				if (
					observed_event_name == 'diplomatic_proposal' &&
					e.target.id == p.game.get_player().id
				) {
					p.modules.popup.show('diplomacy');
				}
			});
		}

		return p.create('DIPLOMACY', 480, 226, (body, cb) => {
			body.text({
				class: 'game-popup-text',
				text: 'Faction:',
				left: 10,
				top: 10,
			});
			this.opponent_select = body.select({
				class: 'popup-list-select',
				align: 'top right',
				right: 10,
				top: 8,
				width: 300,
				items: [['', 'No other factions']],
				value: '',
			});
			this.opponent_select.on('select', (e) => {
				this.select_target(e.value);
				return true;
			});

			this.relation_text = body.text({
				class: 'game-popup-text',
				text: '',
				left: 10,
				right: 10,
				top: 43,
			});
			this.offer_text = body.text({
				class: 'game-popup-text',
				text: '',
				left: 10,
				right: 10,
				top: 65,
			});

			this.offer_treaty = body.button({
				class: 'game-popup-button',
				text: 'Propose Treaty',
				top: 94,
			});
			this.offer_treaty.on('click', (e) => {
				this.propose('treaty');
				return true;
			});
			this.offer_pact = body.button({
				class: 'game-popup-button',
				text: 'Propose Pact',
				top: 118,
			});
			this.offer_pact.on('click', (e) => {
				this.propose('pact');
				return true;
			});
			this.declare_vendetta = body.button({
				class: 'game-popup-button',
				text: 'Declare Vendetta',
				top: 142,
			});
			this.declare_vendetta.on('click', (e) => {
				if (this.player != null && this.target != null) {
					p.game.event('declare_vendetta', {
						player: this.player,
						target: this.target,
					});
				}
				return true;
			});

			this.accept_offer = body.button({
				class: 'game-popup-button',
				text: 'Accept Proposal',
				top: 94,
			});
			this.accept_offer.on('click', (e) => {
				this.respond(true);
				return true;
			});
			this.reject_offer = body.button({
				class: 'game-popup-button',
				text: 'Reject Proposal',
				top: 118,
			});
			this.reject_offer.on('click', (e) => {
				this.respond(false);
				return true;
			});

			body.button({
				class: 'game-popup-button',
				text: 'Close',
				top: 194,
				is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});
		});
	},

	select_target: (value) => {
		this.target = value == '' ? null : this.p.game.get_player(#to_int(value));
		this.refresh();
	},

	propose: (relation) => {
		if (this.player != null && this.target != null) {
			this.p.game.event('propose_diplomatic_relation', {
				player: this.player,
				target: this.target,
				relation: relation,
			});
		}
	},

	respond: (accept) => {
		if (this.player != null && this.target != null) {
			this.p.game.event('respond_diplomatic_proposal', {
				player: this.player,
				proposer: this.target,
				accept: accept,
			});
		}
	},

	refresh: () => {
		if (this.player == null || this.target == null) {
			this.relation_text.text = '';
			this.offer_text.text = '';
			for (button of [
				this.offer_treaty, this.offer_pact, this.declare_vendetta,
				this.accept_offer, this.reject_offer,
			]) {
				button.hide();
			}
			return;
		}
		const relation = this.player.get_diplomatic_relation(this.target);
		const incoming = this.player.get_diplomatic_offer(this.target);
		const outgoing = this.target.get_diplomatic_offer(this.player);
		this.relation_text.text = 'Current relation: ' + relation_name(relation);
		this.offer_text.text = incoming != ''
			? 'Incoming proposal: ' + relation_name(incoming)
			: (outgoing != '' ? 'Proposal awaiting response: ' + relation_name(outgoing) : '');

		this.offer_treaty.hide();
		this.offer_pact.hide();
		this.declare_vendetta.hide();
		this.accept_offer.hide();
		this.reject_offer.hide();
		if (incoming != '') {
			this.accept_offer.show();
			this.reject_offer.show();
			return;
		}
		if (outgoing != '') {
			return;
		}
		if (relation != 'treaty' && relation != 'pact') {
			this.offer_treaty.show();
		}
		if (relation == 'treaty') {
			this.offer_pact.show();
		}
		if (relation != 'vendetta') {
			this.declare_vendetta.show();
		}
	},

	on_show: () => {
		this.player = this.p.game.get_player();
		let items = [];
		for (player of this.p.game.get_players()) {
			if (player.id != this.player.id) {
				items :+[#to_string(player.id), player.name];
			}
		}
		this.opponent_select.items = #sizeof(items) > 0 ? items : [['', 'No other factions']];
		this.opponent_select.value = #sizeof(items) > 0 ? items[0][0] : '';
		this.select_target(this.opponent_select.value);
	},

	on_hide: () => {
		this.player = null;
		this.target = null;
	},

};
