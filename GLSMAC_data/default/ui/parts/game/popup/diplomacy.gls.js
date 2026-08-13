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

const trade_side_text = (game, energy, technology, contact, world_map) => {
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
	if (#sizeof(parts) == 0) {
		return 'nothing';
	}
	let result = parts[0];
	for (let i = 1; i < #sizeof(parts); i++) {
		result += ' + ' + parts[i];
	}
	return result;
};

const trade_text = (game, terms) => {
	return (
		'Offers ' + trade_side_text(
			game, terms.offer_energy, terms.offer_technology, terms.offer_contact,
			terms.offer_map
		) + '; requests ' + trade_side_text(
			game, terms.request_energy, terms.request_technology, terms.request_contact,
			terms.request_map
		)
	);
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

return {
	get_trade_action: get_trade_action,

	init: (p) => {
		this.p = p;
		this.player = null;
		this.target = null;
		this.opponent_select = null;
		this.relation_text = null;
		this.offer_text = null;
		this.trade_text = null;
		this.trade_error = null;
		this.offer_treaty = null;
		this.offer_pact = null;
		this.declare_vendetta = null;
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
		this.offer_energy_label = null;
		this.offer_energy = null;
		this.offer_map = null;
		this.request_technology_label = null;
		this.request_technology = null;
		this.request_contact_label = null;
		this.request_contact = null;
		this.request_energy_label = null;
		this.request_energy = null;
		this.request_map = null;
		this.propose_trade_button = null;
		this.accept_trade = null;
		this.counter_trade = null;
		this.reject_trade = null;
		this.countering_trade = false;
		this.pending_popup = false;
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

		for (event_name of [
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
			'diplomatic_loan_proposed',
			'diplomatic_loan_updated',
			'diplomatic_loan_resolved',
			'diplomatic_sanctions_updated',
			'diplomatic_integrity_updated',
			'diplomatic_excuse_updated',
			'diplomatic_grievance_updated',
			'diplomatic_contact_established',
			'diplomatic_contact_updated',
			'map_visibility_updated',
		]) {
			const observed_event_name = event_name;
			p.game.on(observed_event_name, (e) => {
				if (this.player != null) {
					this.refresh();
				}
				const incoming_diplomacy =
					(observed_event_name == 'diplomatic_proposal' ||
						observed_event_name == 'diplomatic_trade_proposed' ||
						observed_event_name == 'diplomatic_loan_proposed' ||
						observed_event_name == 'diplomatic_surrender_offered') &&
					e.target.id == p.game.get_player().id;
				const incoming_excuse = observed_event_name == 'diplomatic_excuse_updated' &&
					e.expiry_turn >= p.game.get_turn() &&
					e.player.id == p.game.get_player().id;
				const should_auto_open = p.game.get('f_ui_should_auto_open_diplomacy');
				if (
					(incoming_diplomacy || incoming_excuse) && !this.pending_popup &&
					(!#is_defined(should_auto_open) || should_auto_open())
				) {
					const target_id = e.target.id;
					this.pending_popup = true;
					#async(0, () => {
						this.pending_popup = false;
						p.modules.popup.show('diplomacy');
						if (incoming_excuse) {
							this.opponent_select.value = #to_string(target_id);
							this.select_target(this.opponent_select.value);
						}
						return false;
					});
				}
			});
		}

		return p.create('DIPLOMACY', 600, 710, (body, cb) => {
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
				class: 'game-popup-button', text: 'Declare Vendetta', top: 142,
			});
			this.declare_vendetta.on('click', (e) => {
				if (this.player != null && this.target != null) {
					p.game.event('declare_vendetta', {player: this.player, target: this.target});
				}
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
			this.offer_energy_label = body.text({
				class: 'game-popup-text', text: 'Offer energy:', left: 10, top: 254,
			});
			this.offer_energy = body.input({
				class: 'popup-input', align: 'top right', right: 210, top: 250,
				width: 120, value: '0',
			});
			this.offer_map = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 250,
				width: 190, items: [['0', 'No world map'], ['1', 'World map']], value: '0',
			});
			this.request_technology_label = body.text({
				class: 'game-popup-text', text: 'Request technology:', left: 10, top: 282,
			});
			this.request_technology = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 278,
				width: 360, items: [['', 'No technology']], value: '',
			});
			this.request_contact_label = body.text({
				class: 'game-popup-text', text: 'Request commlink:', left: 10, top: 310,
			});
			this.request_contact = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 306,
				width: 360, items: [['-1', 'No commlink']], value: '-1',
			});
			this.request_energy_label = body.text({
				class: 'game-popup-text', text: 'Request energy:', left: 10, top: 338,
			});
			this.request_energy = body.input({
				class: 'popup-input', align: 'top right', right: 210, top: 334,
				width: 120, value: '0',
			});
			this.request_map = body.select({
				class: 'popup-list-select', align: 'top right', right: 10, top: 334,
				width: 190, items: [['0', 'No world map'], ['1', 'World map']], value: '0',
			});
			this.trade_error = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 366,
			});
			this.propose_trade_button = body.button({
				class: 'game-popup-button', text: 'Propose Trade', top: 390,
			});
			this.propose_trade_button.on('click', (e) => {
				this.propose_trade();
				return true;
			});
			this.accept_trade = body.button({
				class: 'game-popup-button', text: 'Accept Trade', left: 10, top: 390,
				width: 180,
			});
			this.accept_trade.on('click', (e) => {
				this.respond_trade(true);
				return true;
			});
			this.counter_trade = body.button({
				class: 'game-popup-button', text: 'Counter Trade', left: 210, top: 390,
				width: 180,
			});
			this.counter_trade.on('click', (e) => {
				this.begin_counter_trade();
				return true;
			});
			this.reject_trade = body.button({
				class: 'game-popup-button', text: 'Reject Trade', right: 10, top: 390,
				width: 180,
			});
			this.reject_trade.on('click', (e) => {
				this.respond_trade(false);
				return true;
			});

			this.loan_text = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 442,
			});
			this.loan_principal_label = body.text({
				class: 'game-popup-text', text: 'Loan principal:', left: 10, top: 470,
			});
			this.loan_principal = body.input({
				class: 'popup-input', align: 'top right', right: 10, top: 466,
				width: 160, value: '100',
			});
			this.loan_payment_label = body.text({
				class: 'game-popup-text', text: 'Payment per year:', left: 10, top: 498,
			});
			this.loan_payment = body.input({
				class: 'popup-input', align: 'top right', right: 10, top: 494,
				width: 160, value: '7',
			});
			this.loan_turns_label = body.text({
				class: 'game-popup-text', text: 'Repayment years:', left: 10, top: 526,
			});
			this.loan_turns = body.input({
				class: 'popup-input', align: 'top right', right: 10, top: 522,
				width: 160, value: '20',
			});
			this.loan_error = body.text({
				class: 'game-popup-text', text: '', left: 10, right: 10, top: 550,
			});
			this.offer_loan_button = body.button({
				class: 'game-popup-button', text: 'Offer Loan', top: 578,
			});
			this.offer_loan_button.on('click', (e) => {
				this.propose_loan(true);
				return true;
			});
			this.request_loan_button = body.button({
				class: 'game-popup-button', text: 'Request Loan', top: 602,
			});
			this.request_loan_button.on('click', (e) => {
				this.propose_loan(false);
				return true;
			});
			this.accept_loan = body.button({
				class: 'game-popup-button', text: 'Accept Loan', top: 578,
			});
			this.accept_loan.on('click', (e) => {
				this.respond_loan(true);
				return true;
			});
			this.reject_loan = body.button({
				class: 'game-popup-button', text: 'Reject Loan', top: 602,
			});
			this.reject_loan.on('click', (e) => {
				this.respond_loan(false);
				return true;
			});

			body.button({
				class: 'game-popup-button', text: 'Close', top: 674, is_cancel: true,
			}).on('click', (e) => {
				cb(false);
				return true;
			});
		});
	},

	select_target: (value) => {
		this.target = value == '' ? null : this.p.game.get_player(#to_int(value));
		this.offer_energy.value = '0';
		this.request_energy.value = '0';
		this.offer_contact.value = '-1';
		this.request_contact.value = '-1';
		this.offer_map.value = '0';
		this.request_map.value = '0';
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

	propose_trade: () => {
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
		};
		const action = get_trade_action(
			this.player,
			this.target,
			terms,
			this.countering_trade
		);
		this.p.game.event(action.name, action.data);
	},

	begin_counter_trade: () => {
		if (this.player == null || this.target == null) {
			return;
		}
		const incoming = this.player.get_diplomatic_trade(this.target);
		if (incoming == null) {
			return;
		}
		this.countering_trade = true;
		this.refresh();
		this.offer_energy.value = #to_string(incoming.request_energy);
		this.offer_technology.value = incoming.request_technology;
		this.offer_contact.value = #to_string(
			#typeof(incoming.request_contact) == 'Int' ? incoming.request_contact : 0 - 1
		);
		this.offer_map.value = #typeof(incoming.request_map) == 'Bool' && incoming.request_map
			? '1' : '0';
		this.request_energy.value = #to_string(incoming.offer_energy);
		this.request_technology.value = incoming.offer_technology;
		this.request_contact.value = #to_string(
			#typeof(incoming.offer_contact) == 'Int' ? incoming.offer_contact : 0 - 1
		);
		this.request_map.value = #typeof(incoming.offer_map) == 'Bool' && incoming.offer_map
			? '1' : '0';
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

	refresh: () => {
		const relation_buttons = [
			this.offer_treaty, this.offer_pact, this.declare_vendetta,
			this.use_excuse, this.overlook_excuse,
			this.accept_offer, this.reject_offer,
			this.accept_surrender, this.reject_surrender,
		];
		const trade_editor = [
			this.offer_technology_label, this.offer_technology,
			this.offer_contact_label, this.offer_contact,
			this.offer_energy_label, this.offer_energy,
			this.offer_map,
			this.request_technology_label, this.request_technology,
			this.request_contact_label, this.request_contact,
			this.request_energy_label, this.request_energy,
			this.request_map,
			this.propose_trade_button,
		];
		const loan_editor = [
			this.loan_principal_label, this.loan_principal,
			this.loan_payment_label, this.loan_payment,
			this.loan_turns_label, this.loan_turns,
			this.offer_loan_button, this.request_loan_button,
		];
		for (button of relation_buttons) {
			button.hide();
		}
		for (control of trade_editor) {
			control.hide();
		}
		for (control of loan_editor) {
			control.hide();
		}
		this.accept_trade.hide();
		this.counter_trade.hide();
		this.reject_trade.hide();
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
				: (incoming != ''
			? 'Incoming proposal: ' + relation_name(incoming)
			: (outgoing != '' ? 'Proposal awaiting response: ' + relation_name(outgoing) : ''))));
		this.trade_text.text = incoming_trade != null
			? 'Incoming trade: ' + trade_text(this.p.game, incoming_trade)
			: (outgoing_trade != null
				? 'Trade awaiting response: ' + trade_text(this.p.game, outgoing_trade)
				: '');
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
		} else if (incoming != '') {
			this.accept_offer.show();
			this.reject_offer.show();
		} else if (outgoing == '' && !outgoing_surrender && player_master != this.target.id &&
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
		}

		if (incoming_trade != null) {
			if (!this.countering_trade) {
				this.accept_trade.show();
				this.counter_trade.show();
				this.reject_trade.show();
				return;
			}
		} else {
			this.countering_trade = false;
		}
		if (
			outgoing_trade != null || relation == 'vendetta' ||
			player_sanctions > 0 || target_sanctions > 0
		) {
			return;
		}

		this.offer_technology.items = this.get_technology_items(this.player, this.target);
		this.request_technology.items = this.get_technology_items(this.target, this.player);
		this.offer_contact.items = this.get_contact_items(this.player, this.target);
		this.request_contact.items = this.get_contact_items(this.target, this.player);
		this.offer_map.items = this.get_map_items(this.player, this.target);
		this.request_map.items = this.get_map_items(this.target, this.player);
		if (!this.countering_trade) {
			this.offer_technology.value = '';
			this.request_technology.value = '';
			this.offer_contact.value = '-1';
			this.request_contact.value = '-1';
			this.offer_map.value = '0';
			this.request_map.value = '0';
		}
		this.propose_trade_button.text = this.countering_trade
			? 'Send Counter' : 'Propose Trade';
		for (control of trade_editor) {
			control.show();
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
		for (control of loan_editor) {
			control.show();
		}
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
		this.opponent_select.value = #sizeof(items) > 0 ? items[0][0] : '';
		this.select_target(this.opponent_select.value);
	},

	on_hide: () => {
		this.player = null;
		this.target = null;
	},

};
