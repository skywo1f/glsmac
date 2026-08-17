const relation_name = (relation) => {
	if (relation == 'treaty') { return 'Treaty'; }
	if (relation == 'pact') { return 'Pact'; }
	if (relation == 'vendetta') { return 'Vendetta'; }
	return 'Neutral';
};

const technology_name = (game, id) => {
	if (id == '') {
		return '';
	}
	const definition = game.get('f_technology_get_definition')(id);
	return definition == null ? id : definition.name;
};

const contact_name = (game, id) => {
	return id < 0 ? '' : #to_string(game.get_player(id).name);
};

const base_name = (game, id) => {
	if (#typeof(id) != 'Int' || id < 0) {
		return '';
	}
	const base = game.get('f_diplomacy_find_base')(id);
	return base == null ? 'Unknown base' : #to_string(base.name);
};

const trade_side_text = (game, energy, technology, contact, world_map, base_id) => {
	let parts = [];
	if (energy > 0) {
		parts :+(#to_string(energy) + ' EC');
	}
	if (technology != '') {
		parts :+technology_name(game, technology);
	}
	if (#typeof(contact) == 'Int' && contact >= 0) {
		parts :+('Commlink: ' + contact_name(game, contact));
	}
	if (#typeof(world_map) == 'Bool' && world_map) {
		parts :+'World map';
	}
	if (#typeof(base_id) == 'Int' && base_id >= 0) {
		parts :+('Base: ' + base_name(game, base_id));
	}
	if (#sizeof(parts) == 0) {
		return 'nothing';
	}
	let result = parts[0];
	for (let i = 1; i < #sizeof(parts); i++) {
		result += ' + ' + parts[i];
	}
	return result;
};

const trade_text = (game, terms, proposed_relation) => {
	const text = (
		'Offers ' + trade_side_text(
			game, terms.offer_energy, terms.offer_technology, terms.offer_contact,
			terms.offer_map, terms.offer_base
		) + '; requests ' + trade_side_text(
			game, terms.request_energy, terms.request_technology, terms.request_contact,
			terms.request_map, terms.request_base
		)
	);
	return proposed_relation == ''
		? text : text + '; establishes ' + relation_name(proposed_relation);
};

const ultimatum_text = (game, terms) => {
	if (#typeof(terms.request_withdrawal) == 'Bool' && terms.request_withdrawal) {
		return 'Demands immediate withdrawal from faction territory';
	}
	return 'Demands ' + trade_side_text(
		game, terms.request_energy, terms.request_technology, terms.request_contact,
		terms.request_map, terms.request_base
	);
};

const military_request_text = (game, terms) => {
	return 'Join vendetta against ' + contact_name(game, terms.request_vendetta_player);
};

const peace_request_text = (game, terms) => {
	return 'Call off vendetta against ' + contact_name(game, terms.request_peace_player);
};

const loan_terms_text = (terms, proposer, recipient) => {
	const lender = terms.proposer_is_lender ? proposer : recipient;
	const borrower = terms.proposer_is_lender ? recipient : proposer;
	return (
		#to_string(lender.name) + ' lends ' + #to_string(borrower.name) + ' ' +
		#to_string(terms.principal) +
		' EC; ' + #to_string(terms.payment) + ' EC/year for ' +
		#to_string(terms.turns) + ' years'
	);
};

const get_trade_action = (player, target, terms, countering) => {
	return countering ? {
		name: 'respond_diplomatic_trade',
		data: {
			player: player,
			proposer: target,
			accept: false,
			counter_terms: terms,
		},
	} : {
		name: 'propose_diplomatic_trade',
		data: {player: player, target: target, terms: terms},
	};
};

const field = (value, key, fallback) => {
	return #is_defined(value[key]) ? value[key] : fallback;
};

const trade_signature = (terms) => {
	if (terms == null) {
		return '';
	}
	return
		#to_string(field(terms, 'offer_energy', 0)) + '|' +
		field(terms, 'offer_technology', '') + '|' +
		#to_string(field(terms, 'request_energy', 0)) + '|' +
		field(terms, 'request_technology', '') + '|' +
		#to_string(field(terms, 'offer_contact', 0 - 1)) + '|' +
		#to_string(field(terms, 'request_contact', 0 - 1)) + '|' +
		#to_string(field(terms, 'offer_map', false)) + '|' +
		#to_string(field(terms, 'request_map', false)) + '|' +
		#to_string(field(terms, 'offer_base', 0 - 1)) + '|' +
		#to_string(field(terms, 'request_base', 0 - 1)) + '|' +
		#to_string(field(terms, 'is_ultimatum', false)) + '|' +
		#to_string(field(terms, 'request_vendetta_player', 0 - 1)) + '|' +
		#to_string(field(terms, 'request_withdrawal', false)) + '|' +
		#to_string(field(terms, 'request_peace_player', 0 - 1));
};

const loan_signature = (terms) => {
	if (terms == null) {
		return '';
	}
	return
		#to_string(field(terms, 'proposer_is_lender', false)) + '|' +
		#to_string(field(terms, 'principal', 0)) + '|' +
		#to_string(field(terms, 'payment', 0)) + '|' +
		#to_string(field(terms, 'turns', 0));
};

const get_incoming_state = (game, player, target) => {
	const empty = {
		target_id: target == null ? 0 - 1 : target.id + 0,
		relation: '', trade: '', loan: '', surrender: false, excuse_turn: 0 - 1,
	};
	if (
		player == null || target == null || target.id == player.id ||
		target.type == 'native' || !player.has_contact(target) || !target.has_contact(player)
	) {
		return empty;
	}
	const excuse_turn = player.get_diplomatic_excuse_turn(target);
	return {
		target_id: target.id + 0,
		relation: '' + player.get_diplomatic_offer(target),
		trade: trade_signature(player.get_diplomatic_trade(target)),
		loan: loan_signature(player.get_diplomatic_loan_offer(target)),
		surrender: target.get_surrender_offer_to_id() == player.id,
		excuse_turn: excuse_turn >= game.get_turn() ? excuse_turn : 0 - 1,
	};
};

const find_new_incoming = (previous, current) => {
	for (state of current) {
		const key = 'p' + #to_string(state.target_id);
		const old = #is_defined(previous[key]) ? previous[key] : {
			relation: '', trade: '', loan: '', surrender: false, excuse_turn: 0 - 1,
		};
		for (kind of ['relation', 'trade', 'loan']) {
			if (state[kind] != '' && state[kind] != old[kind]) {
				return {target_id: state.target_id, kind: kind};
			}
		}
		if (state.surrender && !old.surrender) {
			return {target_id: state.target_id, kind: 'surrender'};
		}
		if (state.excuse_turn >= 0 && state.excuse_turn != old.excuse_turn) {
			return {target_id: state.target_id, kind: 'excuse'};
		}
	}
	return null;
};

const incoming_state_changed = (previous, current) => {
	return
		previous.relation != current.relation ||
		previous.trade != current.trade ||
		previous.loan != current.loan ||
		previous.surrender != current.surrender ||
		previous.excuse_turn != current.excuse_turn;
};

return {
	get_trade_action: get_trade_action,
	find_new_incoming: find_new_incoming,
	observe: (p) => {
		if (#is_defined(this.observing) && this.observing) {
			return;
		}
		this.observing = true;
		this.p = p;
		this.player = null;
		this.target_id = 0 - 1;
		this.pending_target_id = 0 - 1;
		this.pending_open_timer = null;
		this.incoming_states = {};
		const queue_pending_open = () => {
			if (this.pending_open_timer != null) {
				this.pending_open_timer.stop();
			}
			this.pending_open_timer = #async(100, () => {
				this.pending_open_timer = null;
				const target_id = this.pending_target_id + 0;
				this.pending_target_id = 0 - 1;
				this.open_target_id = target_id;
				p.modules.popup.show('diplomacy');
				this.open_target_id = 0 - 1;
				return false;
			});
		};

		for (event_name of [
			'player_update',
			'diplomacy_updated',
			'diplomatic_proposal',
			'diplomatic_proposal_updated',
			'diplomatic_proposal_resolved',
			'diplomatic_surrender_offered',
			'diplomatic_surrender_updated',
			'diplomatic_surrender_resolved',
			'submission_updated',
			'diplomatic_trade_proposed',
			'diplomatic_trade_updated',
			'diplomatic_trade_resolved',
			'diplomatic_ultimatum_proposed',
			'diplomatic_ultimatum_updated',
			'diplomatic_ultimatum_resolved',
			'diplomatic_military_request_proposed',
			'diplomatic_military_request_updated',
			'diplomatic_military_request_resolved',
			'diplomatic_peace_request_proposed',
			'diplomatic_peace_request_updated',
			'diplomatic_peace_request_resolved',
			'diplomatic_withdrawal_proposed',
			'diplomatic_withdrawal_updated',
			'diplomatic_withdrawal_resolved',
			'diplomatic_loan_proposed',
			'diplomatic_loan_updated',
			'diplomatic_loan_resolved',
			'diplomatic_sanctions_updated',
			'diplomatic_integrity_updated',
			'diplomatic_excuse_updated',
			'diplomatic_grievance_updated',
			'diplomatic_contact_established',
			'diplomatic_contact_updated',
		]) {
			const observed_event_name = event_name;
			p.game.on(observed_event_name, (e) => {
				let projected_incoming = null;
				let projected_state_changed = false;
				if (observed_event_name == 'player_update') {
					if (this.pending_target_id >= 0) {
						queue_pending_open();
					}
					if (!p.game.is_master()) {
						const player = p.game.get_player();
						const target = e.player;
						if (target.id != player.id && target.type != 'native') {
							const key = 'p' + #to_string(target.id);
							let previous = {};
							let current = {};
							previous[key] = #is_defined(this.incoming_states[key])
								? this.incoming_states[key]
								: {
									target_id: target.id + 0,
									relation: '', trade: '', loan: '', surrender: false,
									excuse_turn: 0 - 1,
								};
							current[key] = get_incoming_state(p.game, player, target);
							projected_state_changed = incoming_state_changed(
								previous[key], current[key]
							);
							projected_incoming = find_new_incoming(previous, current);
							this.incoming_states[key] = current[key];
						}
					}
				}
				const active_popup = p.modules.popup.popup;
				if (
					this.player != null && active_popup != null && active_popup.id == 'diplomacy'
				) {
					this.rebind_players();
				}
				if (
					this.player != null && active_popup != null && active_popup.id == 'diplomacy' &&
					(observed_event_name != 'player_update' || projected_state_changed)
				) {
					this.refresh();
				}
				const incoming_diplomacy =
					(observed_event_name == 'diplomatic_proposal' ||
						observed_event_name == 'diplomatic_trade_proposed' ||
						observed_event_name == 'diplomatic_ultimatum_proposed' ||
						observed_event_name == 'diplomatic_military_request_proposed' ||
						observed_event_name == 'diplomatic_peace_request_proposed' ||
						observed_event_name == 'diplomatic_withdrawal_proposed' ||
						observed_event_name == 'diplomatic_loan_proposed' ||
						observed_event_name == 'diplomatic_surrender_offered') &&
					e.target.id == p.game.get_player().id;
				const incoming_excuse = observed_event_name == 'diplomatic_excuse_updated' &&
					e.expiry_turn >= p.game.get_turn() &&
					e.player.id == p.game.get_player().id;
				const incoming_target_id = incoming_diplomacy
					? e.player.id
					: (incoming_excuse
						? e.target.id
						: (projected_incoming == null ? 0 - 1 : projected_incoming.target_id));
				const should_auto_open = p.game.get('f_ui_should_auto_open_diplomacy');
				if (
					incoming_target_id >= 0 && this.pending_target_id < 0 &&
					(!#is_defined(should_auto_open) || should_auto_open())
				) {
					// Keep native event wrappers out of the deferred popup callback.
					this.pending_target_id = incoming_target_id + 0;
					// Projection updates arrive in bursts; open after the burst has settled.
					queue_pending_open();
				}
			});
		}
	},

	init: (p) => {
		this.observe(p);
		this.p = p;
		this.player = null;
		this.target = null;
		this.target_id = 0 - 1;
		this.opponent_select = null;
		this.relation_text = null;
		this.offer_text = null;
		this.trade_text = null;
		this.trade_error = null;
		this.offer_treaty = null;
		this.offer_pact = null;
		this.declare_vendetta = null;
		this.demand_withdrawal = null;
		this.use_excuse = null;
		this.overlook_excuse = null;
		this.accept_offer = null;
		this.reject_offer = null;
		this.accept_surrender = null;
		this.reject_surrender = null;
		this.offer_technology_label = null;
		this.offer_technology = null;
		this.offer_contact_label = null;
		this.offer_contact = null;
		this.offer_base_label = null;
		this.offer_base = null;
		this.offer_energy_label = null;
		this.offer_energy = null;
		this.offer_map = null;
		this.request_technology_label = null;
		this.request_technology = null;
		this.request_contact_label = null;
		this.request_contact = null;
		this.request_base_label = null;
		this.request_base = null;
		this.request_energy_label = null;
		this.request_energy = null;
		this.request_map = null;
		this.trade_relation_label = null;
		this.trade_relation = null;
		this.propose_trade_button = null;
		this.issue_ultimatum_button = null;
		this.accept_trade = null;
		this.counter_trade = null;
		this.reject_trade = null;
		this.military_target_label = null;
		this.military_target = null;
		this.request_military_support = null;
		this.countering_trade = false;
		this.loan_text = null;
		this.loan_error = null;
		this.loan_principal_label = null;
		this.loan_principal = null;
		this.loan_payment_label = null;
		this.loan_payment = null;
		this.loan_turns_label = null;
		this.loan_turns = null;
		this.offer_loan_button = null;
		this.request_loan_button = null;
		this.accept_loan = null;
		this.reject_loan = null;

		return p.create('DIPLOMACY', 600, 800, (body, cb) => {
			body.text({class: 'game-popup-text', text: 'Faction:', left: 10, top: 10});
			this.opponent_select = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 8,
				width: 420, items: [['', 'No other factions']], value: '',
			});
			this.opponent_select.on('select', (e) => {
				this.select_target(e.value);
				return true;
			});

			this.relation_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 43,
			});
			this.offer_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 65,
			});

			this.offer_treaty = body.button({
				class: 'game-popup-button', text: 'Propose Treaty', top: 94,
			});
			this.offer_treaty.on('click', (e) => {
				this.propose_relation('treaty');
				return true;
			});
			this.offer_pact = body.button({
				class: 'game-popup-button', text: 'Propose Pact', top: 118,
			});
			this.offer_pact.on('click', (e) => {
				this.propose_relation('pact');
				return true;
			});
			this.declare_vendetta = body.button({
				class: 'game-popup-button', text: 'Declare Vendetta', right: 10, top: 142,
				width: 280,
			});
			this.declare_vendetta.on('click', (e) => {
				if (this.player != null && this.target != null) {
					p.game.event('declare_vendetta', {player: this.player, target: this.target});
				}
				return true;
			});
			this.demand_withdrawal = body.button({
				class: 'game-popup-button', text: 'Demand Withdrawal', left: 10, top: 142,
				width: 280,
			});
			this.demand_withdrawal.on('click', (e) => {
				this.propose_withdrawal();
				return true;
			});
			this.use_excuse = body.button({
				class: 'game-popup-button', text: 'Use Justification', top: 94,
			});
			this.use_excuse.on('click', (e) => {
				this.respond_excuse(true);
				return true;
			});
			this.overlook_excuse = body.button({
				class: 'game-popup-button', text: 'Overlook Framing Attempt', top: 118,
			});
			this.overlook_excuse.on('click', (e) => {
				this.respond_excuse(false);
				return true;
			});

			this.accept_offer = body.button({
				class: 'game-popup-button', text: 'Accept Proposal', top: 94,
			});
			this.accept_offer.on('click', (e) => {
				this.respond_relation(true);
				return true;
			});
			this.reject_offer = body.button({
				class: 'game-popup-button', text: 'Reject Proposal', top: 118,
			});
			this.reject_offer.on('click', (e) => {
				this.respond_relation(false);
				return true;
			});
			this.accept_surrender = body.button({
				class: 'game-popup-button', text: 'Accept Surrender', top: 94,
			});
			this.accept_surrender.on('click', (e) => {
				this.respond_surrender(true);
				return true;
			});
			this.reject_surrender = body.button({
				class: 'game-popup-button', text: 'Reject Surrender', top: 118,
			});
			this.reject_surrender.on('click', (e) => {
				this.respond_surrender(false);
				return true;
			});

			this.trade_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 170,
			});
			this.offer_technology_label = body.text({
				class: 'game-popup-text', text: 'Offer technology:', left: 10, top: 198,
			});
			this.offer_technology = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 194,
				width: 360, items: [['', 'No technology']], value: '',
			});
			this.offer_contact_label = body.text({
				class: 'game-popup-text', text: 'Offer commlink:', left: 10, top: 226,
			});
			this.offer_contact = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 222,
				width: 360, items: [['-1', 'No commlink']], value: '-1',
			});
			this.offer_base_label = body.text({
				class: 'game-popup-text', text: 'Offer base:', left: 10, top: 254,
			});
			this.offer_base = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 250,
				width: 360, items: [['-1', 'No base']], value: '-1',
			});
			this.offer_energy_label = body.text({
				class: 'game-popup-text', text: 'Offer energy:', left: 10, top: 282,
			});
			this.offer_energy = body.input({
				class: 'popup-input', align: 'top right', right: 210, top: 278,
				width: 120, value: '0',
			});
			this.offer_map = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 278,
				width: 190, items: [['0', 'No world map'], ['1', 'World map']], value: '0',
			});
			this.request_technology_label = body.text({
				class: 'game-popup-text', text: 'Request technology:', left: 10, top: 310,
			});
			this.request_technology = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 306,
				width: 360, items: [['', 'No technology']], value: '',
			});
			this.request_contact_label = body.text({
				class: 'game-popup-text', text: 'Request commlink:', left: 10, top: 338,
			});
			this.request_contact = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 334,
				width: 360, items: [['-1', 'No commlink']], value: '-1',
			});
			this.request_base_label = body.text({
				class: 'game-popup-text', text: 'Request base:', left: 10, top: 366,
			});
			this.request_base = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 362,
				width: 360, items: [['-1', 'No base']], value: '-1',
			});
			this.request_energy_label = body.text({
				class: 'game-popup-text', text: 'Request energy:', left: 10, top: 394,
			});
			this.request_energy = body.input({
				class: 'popup-input', align: 'top right', right: 210, top: 390,
				width: 120, value: '0',
			});
			this.request_map = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 390,
				width: 190, items: [['0', 'No world map'], ['1', 'World map']], value: '0',
			});
			this.trade_relation_label = body.text({
				class: 'game-popup-text', text: 'Agreement:', left: 10, top: 422,
			});
			this.trade_relation = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 418,
				width: 360, items: [['', 'No agreement change']], value: '',
			});
			this.trade_error = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 446,
			});
			this.propose_trade_button = body.button({
				class: 'game-popup-button', text: 'Propose Trade', left: 10, top: 470,
				width: 280,
			});
			this.propose_trade_button.on('click', (e) => {
				this.propose_trade(false);
				return true;
			});
			this.issue_ultimatum_button = body.button({
				class: 'game-popup-button', text: 'Issue Ultimatum', right: 10, top: 470,
				width: 280,
			});
			this.issue_ultimatum_button.on('click', (e) => {
				this.propose_trade(true);
				return true;
			});
			this.accept_trade = body.button({
				class: 'game-popup-button', text: 'Accept Trade', left: 10, top: 470,
				width: 180,
			});
			this.accept_trade.on('click', (e) => {
				this.respond_trade(true);
				return true;
			});
			this.counter_trade = body.button({
				class: 'game-popup-button', text: 'Counter Trade', left: 210, top: 470,
				width: 180,
			});
			this.counter_trade.on('click', (e) => {
				this.begin_counter_trade();
				return true;
			});
			this.reject_trade = body.button({
				class: 'game-popup-button', text: 'Reject Trade', right: 10, top: 470,
				width: 180,
			});
			this.reject_trade.on('click', (e) => {
				this.respond_trade(false);
				return true;
			});
			this.military_target_label = body.text({
				class: 'game-popup-text', text: 'Military request:', left: 10, top: 502,
			});
			this.military_target = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 498,
				width: 360, items: [], value: '',
			});
			this.request_military_support = body.button({
				class: 'game-popup-button', text: 'Send Military Request', top: 526,
			});
			this.request_military_support.on('click', (e) => {
				this.propose_military_request();
				return true;
			});

			this.loan_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 550,
			});
			this.loan_principal_label = body.text({
				class: 'game-popup-text', text: 'Loan principal:', left: 10, top: 578,
			});
			this.loan_principal = body.input({
				class: 'popup-input', align: 'top right', right: 10, top: 574,
				width: 160, value: '100',
			});
			this.loan_payment_label = body.text({
				class: 'game-popup-text', text: 'Payment per year:', left: 10, top: 606,
			});
			this.loan_payment = body.input({
				class: 'popup-input', align: 'top right', right: 10, top: 602,
				width: 160, value: '7',
			});
			this.loan_turns_label = body.text({
				class: 'game-popup-text', text: 'Repayment years:', left: 10, top: 634,
			});
			this.loan_turns = body.input({
				class: 'popup-input', align: 'top right', right: 10, top: 630,
				width: 160, value: '20',
			});
			this.loan_error = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 662,
			});
			this.offer_loan_button = body.button({
				class: 'game-popup-button', text: 'Offer Loan', top: 690,
			});
			this.offer_loan_button.on('click', (e) => {
				this.propose_loan(true);
				return true;
			});
			this.request_loan_button = body.button({
				class: 'game-popup-button', text: 'Request Loan', top: 714,
			});
			this.request_loan_button.on('click', (e) => {
				this.propose_loan(false);
				return true;
			});
			this.accept_loan = body.button({
				class: 'game-popup-button', text: 'Accept Loan', top: 690,
			});
			this.accept_loan.on('click', (e) => {
				this.respond_loan(true);
				return true;
			});
			this.reject_loan = body.button({
				class: 'game-popup-button', text: 'Reject Loan', top: 714,
			});
			this.reject_loan.on('click', (e) => {
				this.respond_loan(false);
				return true;
			});

			body.button({
				class: 'game-popup-button', text: 'Close', top: 762, is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});
		});
	},

	rebind_players: () => {
		this.player = this.p.game.get_player();
		this.target = this.target_id < 0
			? null
			: this.p.game.get_player(this.target_id);
	},

	select_target: (value) => {
		this.target_id = value == '' ? 0 - 1 : #to_int(value);
		this.rebind_players();
		this.offer_energy.value = '0';
		this.request_energy.value = '0';
		this.offer_contact.value = '-1';
		this.request_contact.value = '-1';
		this.offer_base.value = '-1';
		this.request_base.value = '-1';
		this.military_target.value = '';
		this.offer_map.value = '0';
		this.request_map.value = '0';
		this.trade_relation.value = '';
		this.countering_trade = false;
		this.trade_error.text = '';
		this.loan_error.text = '';
		this.refresh();
	},

	propose_relation: (relation) => {
		if (this.player != null && this.target != null) {
			this.p.game.event('propose_diplomatic_relation', {
				player: this.player, target: this.target, relation: relation,
			});
		}
	},

	respond_relation: (accept) => {
		if (this.player != null && this.target != null) {
			this.p.game.event('respond_diplomatic_proposal', {
				player: this.player, proposer: this.target, accept: accept,
			});
		}
	},

	respond_surrender: (accept) => {
		if (this.player != null && this.target != null) {
			this.p.game.event('respond_surrender', {
				player: this.player, proposer: this.target, accept: accept,
			});
		}
	},

	respond_excuse: (use_excuse) => {
		if (this.player != null && this.target != null) {
			this.p.game.event('respond_diplomatic_excuse', {
				player: this.player,
				target: this.target,
				use_excuse: use_excuse,
			});
		}
	},

	parse_energy: (value) => {
		let amount = 0;
		let valid = true;
		try {
			amount = #to_int(#trim(value));
		} catch {
			: (e) => { valid = false; }
		}
		return valid && amount >= 0 ? amount : null;
	},

	propose_trade: (is_ultimatum) => {
		if (this.player == null || this.target == null) {
			return;
		}
		const offer_energy = this.parse_energy(this.offer_energy.value);
		const request_energy = this.parse_energy(this.request_energy.value);
		if (offer_energy == null || request_energy == null) {
			this.trade_error.text = 'Energy amounts must be non-negative whole numbers.';
			return;
		}
		this.trade_error.text = '';
		const terms = {
			offer_energy: offer_energy,
			offer_technology: this.offer_technology.value,
			request_energy: request_energy,
			request_technology: this.request_technology.value,
			offer_contact: #to_int(this.offer_contact.value),
			request_contact: #to_int(this.request_contact.value),
			offer_map: this.offer_map.value == '1',
			request_map: this.request_map.value == '1',
			offer_base: #to_int(this.offer_base.value),
			request_base: #to_int(this.request_base.value),
			request_vendetta_player: 0 - 1,
			request_peace_player: 0 - 1,
			is_ultimatum: is_ultimatum,
			proposed_relation: is_ultimatum ? '' : this.trade_relation.value,
		};
		if (
			is_ultimatum &&
			(
				terms.offer_energy != 0 || terms.offer_technology != '' ||
				terms.offer_contact >= 0 || terms.request_contact >= 0 ||
				terms.offer_map || terms.request_map ||
				terms.offer_base >= 0 || terms.request_base >= 0 ||
				(terms.request_energy > 0) == (terms.request_technology != '')
			)
		) {
			this.trade_error.text =
				'An ultimatum must demand exactly energy or one technology.';
			return;
		}
		const action = get_trade_action(
			this.player,
			this.target,
			terms,
			this.countering_trade
		);
		this.p.game.event(action.name, action.data);
	},

	propose_military_request: () => {
		if (
			this.player == null || this.target == null ||
			this.military_target.value == ''
		) {
			return;
		}
		const encoded_target = #to_int(this.military_target.value);
		const request_vendetta_player = encoded_target >= 0
			? encoded_target : 0 - 1;
		const request_peace_player = encoded_target < 0
			? 0 - encoded_target - 1 : 0 - 1;
		this.p.game.event('propose_diplomatic_trade', {
			player: this.player,
			target: this.target,
			terms: {
				offer_energy: 0,
				offer_technology: '',
				request_energy: 0,
				request_technology: '',
				offer_contact: 0 - 1,
				request_contact: 0 - 1,
				offer_map: false,
				request_map: false,
				offer_base: 0 - 1,
				request_base: 0 - 1,
				request_vendetta_player: request_vendetta_player,
				is_ultimatum: false,
				request_peace_player: request_peace_player,
			},
		});
	},

	propose_withdrawal: () => {
		if (this.player == null || this.target == null) {
			return;
		}
		this.p.game.event('propose_diplomatic_trade', {
			player: this.player,
			target: this.target,
			terms: {
				offer_energy: 0,
				offer_technology: '',
				request_energy: 0,
				request_technology: '',
				offer_contact: 0 - 1,
				request_contact: 0 - 1,
				offer_map: false,
				request_map: false,
				offer_base: 0 - 1,
				request_base: 0 - 1,
				request_vendetta_player: 0 - 1,
				is_ultimatum: true,
				request_withdrawal: true,
				request_peace_player: 0 - 1,
			},
		});
	},

	begin_counter_trade: () => {
		if (this.player == null || this.target == null) {
			return;
		}
		const incoming = this.player.get_diplomatic_trade(this.target);
		if (incoming == null) {
			return;
		}
		const incoming_relation = this.player.get_diplomatic_offer(this.target);
		this.countering_trade = true;
		this.refresh();
		this.trade_relation.value = incoming_relation;
		this.offer_energy.value = #to_string(incoming.request_energy);
		this.offer_technology.value = incoming.request_technology;
		this.offer_contact.value = #to_string(
			#typeof(incoming.request_contact) == 'Int' ? incoming.request_contact : 0 - 1
		);
		this.offer_map.value = #typeof(incoming.request_map) == 'Bool' && incoming.request_map
			? '1' : '0';
		this.offer_base.value = #to_string(
			#typeof(incoming.request_base) == 'Int' ? incoming.request_base : 0 - 1
		);
		this.request_energy.value = #to_string(incoming.offer_energy);
		this.request_technology.value = incoming.offer_technology;
		this.request_contact.value = #to_string(
			#typeof(incoming.offer_contact) == 'Int' ? incoming.offer_contact : 0 - 1
		);
		this.request_map.value = #typeof(incoming.offer_map) == 'Bool' && incoming.offer_map
			? '1' : '0';
		this.request_base.value = #to_string(
			#typeof(incoming.offer_base) == 'Int' ? incoming.offer_base : 0 - 1
		);
	},

	respond_trade: (accept) => {
		if (this.player != null && this.target != null) {
			this.p.game.event('respond_diplomatic_trade', {
				player: this.player, proposer: this.target, accept: accept,
			});
		}
	},

	propose_loan: (proposer_is_lender) => {
		if (this.player == null || this.target == null) {
			return;
		}
		const principal = this.parse_energy(this.loan_principal.value);
		const payment = this.parse_energy(this.loan_payment.value);
		const turns = this.parse_energy(this.loan_turns.value);
		if (
			principal == null || principal <= 0 ||
			payment == null || payment <= 0 ||
			turns == null || turns <= 0 || turns > 1000
		) {
			this.loan_error.text = 'Loan terms must be positive whole numbers (maximum 1000 years).';
			return;
		}
		const repayment = payment * turns;
		if (repayment > 1000000000 || repayment < principal || repayment > principal * 4) {
			this.loan_error.text = 'Total repayment must be between the principal and four times it.';
			return;
		}
		this.loan_error.text = '';
		this.p.game.event('propose_diplomatic_loan', {
			player: this.player,
			target: this.target,
			terms: {
				proposer_is_lender: proposer_is_lender,
				principal: principal,
				payment: payment,
				turns: turns,
			},
		});
	},

	respond_loan: (accept) => {
		if (this.player != null && this.target != null) {
			this.p.game.event('respond_diplomatic_loan', {
				player: this.player, proposer: this.target, accept: accept,
			});
		}
	},

	get_technology_items: (source, recipient) => {
		let items = [['', 'No technology']];
		for (id of source.get_research_state().technologies) {
			if (!recipient.has_technology(id)) {
				items :+[id, technology_name(this.p.game, id)];
			}
		}
		return items;
	},

	get_contact_items: (source, recipient) => {
		let items = [['-1', 'No commlink']];
		for (contact of this.p.game.get_players()) {
			if (
				contact.id != source.id && contact.id != recipient.id &&
				source.has_contact(contact) && contact.has_contact(source) &&
				(!recipient.has_contact(contact) || !contact.has_contact(recipient))
			) {
				items :+[#to_string(contact.id), #to_string(contact.name)];
			}
		}
		return items;
	},

	get_map_items: (source, recipient) => {
		const count_shareable = this.p.game.get('f_exploration_count_shareable_tiles');
		return #is_defined(count_shareable) && count_shareable(source, recipient) > 0
			? [['0', 'No world map'], ['1', 'World map']]
			: [['0', 'No world map']];
	},

	get_base_items: (source, viewer, disclosed_base_id) => {
		let items = [['-1', 'No base']];
		let owned = [];
		for (base of this.p.game.get_bm().get_bases()) {
			if (base.get_owner().id == source.id) {
				owned :+base;
			}
		}
		if (#sizeof(owned) <= 1) {
			return items;
		}
		for (base of owned) {
			const is_disclosed = (
				#typeof(disclosed_base_id) == 'Int' && base.id == disclosed_base_id
			);
			const is_known = (
				viewer == null || source.id == viewer.id ||
				#typeof(viewer.has_explored) != 'Callable' || viewer.has_explored(base.get_tile())
			);
			if (!base.has_facility('Headquarters') && (is_known || is_disclosed)) {
				items :+[#to_string(base.id), #to_string(base.name)];
			}
		}
		return items;
	},

	get_military_target_items: (player, ally) => {
		let items = [];
		const validate_trade = this.p.game.get('f_diplomacy_validate_trade');
		for (candidate of this.p.game.get_players()) {
			if (candidate.id == player.id || candidate.id == ally.id) {
				continue;
			}
			const terms = {
				offer_energy: 0,
				offer_technology: '',
				request_energy: 0,
				request_technology: '',
				offer_contact: 0 - 1,
				request_contact: 0 - 1,
				offer_map: false,
				request_map: false,
				offer_base: 0 - 1,
				request_base: 0 - 1,
				request_vendetta_player: candidate.id,
				is_ultimatum: false,
				request_peace_player: 0 - 1,
			};
			if (!#is_defined(validate_trade(player, ally, terms))) {
				items :+[
					#to_string(candidate.id),
					'Join vendetta: ' + #to_string(candidate.name),
				];
			}
			terms.request_vendetta_player = 0 - 1;
			terms.request_peace_player = candidate.id;
			if (!#is_defined(validate_trade(player, ally, terms))) {
				items :+[
					#to_string(0 - candidate.id - 1),
					'Call off vendetta: ' + #to_string(candidate.name),
				];
			}
		}
		return items;
	},

	refresh: () => {
		this.rebind_players();
		// UI wrappers must remain direct references; storing them in a script array
		// converts them to plain values in the interpreter.
		this.offer_treaty.hide();
		this.offer_pact.hide();
		this.declare_vendetta.hide();
		this.demand_withdrawal.hide();
		this.use_excuse.hide();
		this.overlook_excuse.hide();
		this.accept_offer.hide();
		this.reject_offer.hide();
		this.accept_surrender.hide();
		this.reject_surrender.hide();
		this.offer_technology_label.hide();
		this.offer_technology.hide();
		this.offer_contact_label.hide();
		this.offer_contact.hide();
		this.offer_base_label.hide();
		this.offer_base.hide();
		this.offer_energy_label.hide();
		this.offer_energy.hide();
		this.offer_map.hide();
		this.request_technology_label.hide();
		this.request_technology.hide();
		this.request_contact_label.hide();
		this.request_contact.hide();
		this.request_base_label.hide();
		this.request_base.hide();
		this.request_energy_label.hide();
		this.request_energy.hide();
		this.request_map.hide();
		this.trade_relation_label.hide();
		this.trade_relation.hide();
		this.propose_trade_button.hide();
		this.issue_ultimatum_button.hide();
		this.loan_principal_label.hide();
		this.loan_principal.hide();
		this.loan_payment_label.hide();
		this.loan_payment.hide();
		this.loan_turns_label.hide();
		this.loan_turns.hide();
		this.offer_loan_button.hide();
		this.request_loan_button.hide();
		this.accept_trade.hide();
		this.counter_trade.hide();
		this.reject_trade.hide();
		this.military_target_label.hide();
		this.military_target.hide();
		this.request_military_support.hide();
		this.accept_loan.hide();
		this.reject_loan.hide();
		if (this.player == null || this.target == null) {
			this.relation_text.text = '';
			this.offer_text.text = '';
			this.trade_text.text = '';
			this.trade_error.text = '';
			this.loan_text.text = '';
			this.loan_error.text = '';
			return;
		}

		const relation = this.player.get_diplomatic_relation(this.target);
		const incoming = this.player.get_diplomatic_offer(this.target);
		const outgoing = this.target.get_diplomatic_offer(this.player);
		const incoming_trade = this.player.get_diplomatic_trade(this.target);
		const outgoing_trade = this.target.get_diplomatic_trade(this.player);
		const is_ultimatum = this.p.game.get('f_diplomacy_is_ultimatum');
		const is_military_request = this.p.game.get('f_diplomacy_is_military_request');
		const is_peace_request = this.p.game.get('f_diplomacy_is_peace_request');
		const is_withdrawal_request = this.p.game.get(
			'f_diplomacy_is_withdrawal_request'
		);
		const incoming_ultimatum = incoming_trade != null && is_ultimatum(incoming_trade);
		const outgoing_ultimatum = outgoing_trade != null && is_ultimatum(outgoing_trade);
		const incoming_military_request = incoming_trade != null &&
			is_military_request(incoming_trade);
		const outgoing_military_request = outgoing_trade != null &&
			is_military_request(outgoing_trade);
		const incoming_peace_request = incoming_trade != null &&
			is_peace_request(incoming_trade);
		const outgoing_peace_request = outgoing_trade != null &&
			is_peace_request(outgoing_trade);
		const incoming_withdrawal = incoming_trade != null &&
			is_withdrawal_request(incoming_trade);
		const outgoing_withdrawal = outgoing_trade != null &&
			is_withdrawal_request(outgoing_trade);
		const incoming_loan = this.player.get_diplomatic_loan_offer(this.target);
		const outgoing_loan = this.target.get_diplomatic_loan_offer(this.player);
		const player_debt = this.player.get_diplomatic_loan(this.target);
		const target_debt = this.target.get_diplomatic_loan(this.player);
		const player_sanctions = this.player.get_sanction_turns();
		const target_sanctions = this.target.get_sanction_turns();
		const player_master = this.player.get_submissive_to_id();
		const target_master = this.target.get_submissive_to_id();
		const incoming_surrender = this.target.get_surrender_offer_to_id() == this.player.id;
		const outgoing_surrender = this.player.get_surrender_offer_to_id() == this.target.id;
		const excuse_turn = this.player.get_diplomatic_excuse_turn(this.target);
		const has_excuse = relation != 'vendetta' && excuse_turn >= this.p.game.get_turn();
		const grievance = this.player.get_diplomatic_grievance(this.target);
		const integrity_name = this.p.game.get('f_diplomacy_get_integrity_name');
		let sanction_text = '';
		if (player_sanctions > 0) {
			sanction_text = '; sanctions: you ' + #to_string(player_sanctions) + 'y';
		}
		if (target_sanctions > 0) {
			sanction_text += (player_sanctions > 0 ? ' / them ' : '; sanctions: them ') +
				#to_string(target_sanctions) + 'y';
		}
		let submission_text = '';
		if (target_master == this.player.id) {
			submission_text = '; submission: serves you';
		} else if (player_master == this.target.id) {
			submission_text = '; submission: you serve them';
		}
		let grievance_text = '';
		if (grievance.major_atrocity_victim) {
			grievance_text = '; grievance: major atrocity victim';
		} else if (grievance.atrocity_victim) {
			grievance_text = '; grievance: atrocity victim';
		} else if (grievance.wants_revenge) {
			grievance_text = '; grievance: revenge';
		}
		this.relation_text.text =
			'Relation: ' + relation_name(relation) + '; integrity: you ' +
			integrity_name(this.player.get_integrity_blemishes()) + ' / them ' +
			integrity_name(this.target.get_integrity_blemishes()) + sanction_text + submission_text +
			grievance_text;
		this.offer_text.text = has_excuse
			? 'Exposed framing attempt; justification valid through year ' +
				#to_string(excuse_turn)
			: (incoming_surrender
			? 'Incoming unconditional surrender offer'
			: (outgoing_surrender
				? 'Surrender awaiting response'
				: (incoming != '' && incoming_trade == null
			? 'Incoming proposal: ' + relation_name(incoming)
			: (outgoing != '' && outgoing_trade == null
				? 'Proposal awaiting response: ' + relation_name(outgoing) : ''))));
		this.trade_text.text = '';
		if (incoming_trade != null) {
			if (incoming_withdrawal) {
				this.trade_text.text = 'Incoming territory demand: ' +
					ultimatum_text(this.p.game, incoming_trade);
			} else if (incoming_peace_request) {
				this.trade_text.text = 'Incoming peace request: ' +
					peace_request_text(this.p.game, incoming_trade);
			} else if (incoming_military_request) {
				this.trade_text.text = 'Incoming military request: ' +
					military_request_text(this.p.game, incoming_trade);
			} else if (incoming_ultimatum) {
				this.trade_text.text = 'Incoming ultimatum: ' +
					ultimatum_text(this.p.game, incoming_trade);
			} else {
				this.trade_text.text = 'Incoming trade: ' + trade_text(
					this.p.game,
					incoming_trade,
					incoming
				);
			}
		} else if (outgoing_trade != null) {
			if (outgoing_withdrawal) {
				this.trade_text.text = 'Withdrawal demand awaiting response';
			} else if (outgoing_peace_request) {
				this.trade_text.text = 'Peace request awaiting response: ' +
					peace_request_text(this.p.game, outgoing_trade);
			} else if (outgoing_military_request) {
				this.trade_text.text = 'Military request awaiting response: ' +
					military_request_text(this.p.game, outgoing_trade);
			} else if (outgoing_ultimatum) {
				this.trade_text.text = 'Ultimatum awaiting response: ' +
					ultimatum_text(this.p.game, outgoing_trade);
			} else {
				this.trade_text.text = 'Trade awaiting response: ' + trade_text(
					this.p.game,
					outgoing_trade,
					outgoing
				);
			}
		}
		this.loan_text.text = player_debt != null
			? 'You owe ' + #to_string(player_debt.balance) + ' EC; ' +
				#to_string(player_debt.payment) + ' EC/year'
			: (target_debt != null
				? #to_string(this.target.name) + ' owes you ' +
					#to_string(target_debt.balance) + ' EC; ' +
					#to_string(target_debt.payment) + ' EC/year'
				: (incoming_loan != null
					? 'Incoming loan: ' + loan_terms_text(incoming_loan, this.target, this.player)
					: (outgoing_loan != null
						? 'Loan awaiting response: ' + loan_terms_text(
							outgoing_loan,
							this.player,
							this.target
						)
						: '')));

		if (has_excuse) {
			this.use_excuse.text = relation == 'pact' || relation == 'treaty'
				? 'Renounce ' + relation_name(relation) + ' (Justified)'
				: 'Declare Vendetta (Justified)';
			this.use_excuse.show();
			this.overlook_excuse.show();
		} else if (incoming_surrender) {
			this.accept_surrender.show();
			this.reject_surrender.show();
		} else if (incoming != '' && incoming_trade == null) {
			this.accept_offer.show();
			this.reject_offer.show();
		} else if (
			outgoing == '' && incoming_trade == null && outgoing_trade == null &&
			!outgoing_surrender && player_master != this.target.id &&
			target_master != this.player.id) {
			if (relation != 'treaty' && relation != 'pact') {
				this.offer_treaty.show();
			}
			if (relation == 'treaty') {
				this.offer_pact.show();
			}
			if (relation != 'vendetta') {
				this.declare_vendetta.show();
			}
			const get_withdrawal_error = this.p.game.get('f_diplomacy_get_withdrawal_error');
			if (
				relation == 'treaty' && #typeof(get_withdrawal_error) == 'Callable' &&
				!#is_defined(get_withdrawal_error(this.player, this.target))
			) {
				this.demand_withdrawal.show();
			}
		}

		if (incoming_trade != null) {
			this.accept_trade.text = 'Accept Trade';
			this.reject_trade.text = 'Reject Trade';
			if (incoming_withdrawal) {
				this.accept_trade.text = 'Withdraw Units';
				this.reject_trade.text = 'Refuse';
			} else if (incoming_peace_request) {
				this.accept_trade.text = 'Pledge Truce';
				this.reject_trade.text = 'Decline';
			} else if (incoming_military_request) {
				this.accept_trade.text = 'Join Vendetta';
				this.reject_trade.text = 'Decline';
			} else if (incoming_ultimatum) {
				this.accept_trade.text = 'Comply';
				this.reject_trade.text = 'Refuse';
			}
			if (incoming_ultimatum || incoming_military_request || incoming_peace_request) {
				this.countering_trade = false;
			}
			if (!this.countering_trade) {
				this.accept_trade.show();
				if (!incoming_ultimatum && !incoming_military_request && !incoming_peace_request) {
					this.counter_trade.show();
				}
				this.reject_trade.show();
				return;
			}
		} else {
			this.countering_trade = false;
		}
		if (outgoing_trade != null) {
			return;
		}
		const regular_trade_available = player_sanctions == 0 && target_sanctions == 0;
		const ultimatum_available = relation == 'neutral' || relation == 'vendetta';
		const military_request_available = relation != 'vendetta';
		if (!regular_trade_available && !ultimatum_available && !military_request_available) {
			return;
		}

		this.offer_technology.items = this.get_technology_items(this.player, this.target);
		this.request_technology.items = this.get_technology_items(this.target, this.player);
		this.offer_contact.items = this.get_contact_items(this.player, this.target);
		this.request_contact.items = this.get_contact_items(this.target, this.player);
		this.offer_map.items = this.get_map_items(this.player, this.target);
		this.request_map.items = this.get_map_items(this.target, this.player);
		this.offer_base.items = this.get_base_items(this.player, this.player, 0 - 1);
		this.request_base.items = this.get_base_items(
			this.target,
			this.player,
			this.countering_trade && incoming_trade != null &&
				#typeof(incoming_trade.offer_base) == 'Int'
				? incoming_trade.offer_base : 0 - 1
		);
		let agreement_items = [['', 'No agreement change']];
		if (relation == 'vendetta') {
			agreement_items = [['treaty', 'Treaty']];
		} else if (relation == 'neutral') {
			agreement_items :+['treaty', 'Treaty'];
		} else if (relation == 'treaty') {
			agreement_items :+['pact', 'Pact'];
		}
		this.trade_relation.items = agreement_items;
		if (!this.countering_trade) {
			this.offer_technology.value = '';
			this.request_technology.value = '';
			this.offer_contact.value = '-1';
			this.request_contact.value = '-1';
			this.offer_map.value = '0';
			this.request_map.value = '0';
			this.offer_base.value = '-1';
			this.request_base.value = '-1';
			this.trade_relation.value = relation == 'vendetta' ? 'treaty' : '';
		}
		this.propose_trade_button.text = this.countering_trade
			? 'Send Counter' : 'Propose Trade';
		if (regular_trade_available || this.countering_trade) {
			this.offer_technology_label.show();
			this.offer_technology.show();
			this.offer_contact_label.show();
			this.offer_contact.show();
			this.offer_base_label.show();
			this.offer_base.show();
			this.offer_energy_label.show();
			this.offer_energy.show();
			this.offer_map.show();
			this.request_technology_label.show();
			this.request_technology.show();
			this.request_contact_label.show();
			this.request_contact.show();
			this.request_base_label.show();
			this.request_base.show();
			this.request_energy_label.show();
			this.request_energy.show();
			this.request_map.show();
			this.trade_relation_label.show();
			this.trade_relation.show();
			this.propose_trade_button.show();
			this.issue_ultimatum_button.show();
			if (!ultimatum_available || this.countering_trade) {
				this.issue_ultimatum_button.hide();
			}
		} else if (ultimatum_available) {
			this.request_technology_label.show();
			this.request_technology.show();
			this.request_energy_label.show();
			this.request_energy.show();
			this.issue_ultimatum_button.show();
		}
		this.request_technology_label.text = regular_trade_available
			? 'Request technology:' : 'Demand technology:';
		this.request_energy_label.text = regular_trade_available
			? 'Request energy:' : 'Demand energy:';
		if (military_request_available && !this.countering_trade) {
			const military_items = this.get_military_target_items(this.player, this.target);
			if (#sizeof(military_items) > 0) {
				this.military_target.items = military_items;
				this.military_target.value = military_items[0][0];
				this.military_target_label.show();
				this.military_target.show();
				this.request_military_support.show();
			}
		}
		if (this.countering_trade) {
			return;
		}

		if (incoming_loan != null) {
			this.accept_loan.show();
			this.reject_loan.show();
			return;
		}
		if (
			outgoing_loan != null || player_debt != null || target_debt != null ||
			relation == 'vendetta' || player_sanctions > 0 || target_sanctions > 0
		) {
			return;
		}
		this.loan_principal_label.show();
		this.loan_principal.show();
		this.loan_payment_label.show();
		this.loan_payment.show();
		this.loan_turns_label.show();
		this.loan_turns.show();
		this.offer_loan_button.show();
		this.request_loan_button.show();
	},

	on_show: () => {
		this.player = this.p.game.get_player();
		let items = [];
		for (player of this.p.game.get_players()) {
			if (
				player.id != this.player.id &&
				this.player.has_contact(player) && player.has_contact(this.player)
			) {
				items :+[#to_string(player.id), #to_string(player.name)];
			}
		}
		this.opponent_select.items = #sizeof(items) > 0 ? items : [['', 'No other factions']];
		let selected_value = #sizeof(items) > 0 ? items[0][0] : '';
		if (#is_defined(this.open_target_id) && this.open_target_id >= 0) {
			for (item of items) {
				if (#to_int(item[0]) == this.open_target_id) {
					selected_value = item[0];
				}
			}
		}
		this.opponent_select.value = selected_value;
		this.select_target(this.opponent_select.value);
	},

	on_hide: () => {
		this.player = null;
		this.target = null;
		this.target_id = 0 - 1;
	},

};
