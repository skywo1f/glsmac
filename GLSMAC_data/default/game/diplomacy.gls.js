const diplomatic_base_transfer = #include('./diplomatic_base_transfer');
const technology_acquisition = #include('./technology_acquisition');
const technology_effects = #include('./technology_effects');
const diplomatic_withdrawal = #include('./diplomatic_withdrawal');
const messages = #include('./message_rules');

const is_player = (player) => {
	return (
		#typeof(player) == 'Object' &&
		#typeof(player.get_diplomatic_relation) == 'Callable' &&
		#typeof(player.get_energy_credits) == 'Callable' &&
		#typeof(player.get_sanction_turns) == 'Callable' &&
		#typeof(player.set_sanction_turns) == 'Callable' &&
		#typeof(player.get_integrity_blemishes) == 'Callable' &&
		#typeof(player.set_integrity_blemishes) == 'Callable' &&
		#typeof(player.has_contact) == 'Callable' &&
		#typeof(player.set_contact) == 'Callable' &&
		#typeof(player.set_diplomatic_relation) == 'Callable' &&
		#typeof(player.get_diplomatic_offer) == 'Callable' &&
		#typeof(player.set_diplomatic_offer) == 'Callable' &&
		#typeof(player.get_diplomatic_trade) == 'Callable' &&
		#typeof(player.set_diplomatic_trade) == 'Callable' &&
		#typeof(player.clear_diplomatic_trade) == 'Callable' &&
		#typeof(player.get_diplomatic_loan_offer) == 'Callable' &&
		#typeof(player.set_diplomatic_loan_offer) == 'Callable' &&
		#typeof(player.clear_diplomatic_loan_offer) == 'Callable' &&
		#typeof(player.get_diplomatic_loan) == 'Callable' &&
		#typeof(player.set_diplomatic_loan) == 'Callable' &&
		#typeof(player.clear_diplomatic_loan) == 'Callable'
	);
};

const get_diplomatic_excuse_turn = (player, other) => {
	return #typeof(player.get_diplomatic_excuse_turn) == 'Callable'
		? player.get_diplomatic_excuse_turn(other) : 0 - 1;
};

const set_diplomatic_excuse_turn = (player, other, expiry_turn) => {
	if (#typeof(player.set_diplomatic_excuse_turn) == 'Callable') {
		player.set_diplomatic_excuse_turn(other, expiry_turn);
	}
};

const get_diplomatic_grievance = (player, other) => {
	return #typeof(player.get_diplomatic_grievance) == 'Callable'
		? player.get_diplomatic_grievance(other)
		: {
			wants_revenge: false,
			atrocity_victim: false,
			major_atrocity_victim: false,
		};
};

const set_diplomatic_grievance = (player, other, grievance) => {
	if (#typeof(player.set_diplomatic_grievance) == 'Callable') {
		player.set_diplomatic_grievance(other, grievance);
	}
};

const add_diplomatic_grievance = (
	player,
	other,
	wants_revenge,
	atrocity_victim,
	major_atrocity_victim
) => {
	const current = get_diplomatic_grievance(player, other);
	set_diplomatic_grievance(player, other, {
		wants_revenge: current.wants_revenge || wants_revenge ||
			atrocity_victim || major_atrocity_victim,
		atrocity_victim: current.atrocity_victim || atrocity_victim || major_atrocity_victim,
		major_atrocity_victim: current.major_atrocity_victim || major_atrocity_victim,
	});
};

const validate_players = (player, other) => {
	if (!is_player(player) || !is_player(other)) {
		return 'Diplomacy requires two players';
	}
	if (player.id == other.id) {
		return 'A player cannot conduct diplomacy with itself';
	}
};

const validate_pair = (player, other) => {
	const player_error = validate_players(player, other);
	if (#is_defined(player_error)) {
		return player_error;
	}
	if (!player.has_contact(other) || !other.has_contact(player)) {
		return 'The factions have not established diplomatic contact';
	}
};

const validate_surrender_direction = (game, proposer, recipient) => {
	const get_supreme_state = game.get('f_council_get_supreme_state');
	const get_supreme_response = game.get('f_council_get_supreme_response');
	if (
		#typeof(get_supreme_state) != 'Callable' ||
		#typeof(get_supreme_response) != 'Callable'
	) {
		return;
	}
	const supreme = get_supreme_state();
	if (
		supreme != null && supreme.resolved &&
		get_supreme_response(proposer) != 3 &&
		get_supreme_response(recipient) == 3
	) {
		return 'A loyal faction cannot surrender to a Supreme Leader defiant';
	}
};

const get_submissive_to_id = (player) => {
	return #typeof(player.get_submissive_to_id) == 'Callable'
		? player.get_submissive_to_id() : -1;
};

const get_surrender_offer_to_id = (player) => {
	return #typeof(player.get_surrender_offer_to_id) == 'Callable'
		? player.get_surrender_offer_to_id() : -1;
};

const get_submission_master = (game, player) => {
	let current = player;
	let visited = {};
	while (current != null) {
		const key = 'p' + #to_string(current.id);
		if (#is_defined(visited[key])) { return null; }
		visited[key] = true;
		const master_id = get_submissive_to_id(current);
		if (master_id < 0) { return current.id == player.id ? null : current; }
		current = find_player(game, master_id);
	}
	return null;
};

const is_submission_pair = (game, player, other) => {
	const player_master = get_submission_master(game, player);
	const other_master = get_submission_master(game, other);
	const player_root = player_master == null ? player : player_master;
	const other_root = other_master == null ? other : other_master;
	return player_root.id == other_root.id &&
		(player_master != null || other_master != null);
};

const snapshot_pair = (player, other) => {
	return {
		player_relation: player.get_diplomatic_relation(other),
		other_relation: other.get_diplomatic_relation(player),
		player_offer: player.get_diplomatic_offer(other),
		other_offer: other.get_diplomatic_offer(player),
		player_excuse_turn: get_diplomatic_excuse_turn(player, other),
		other_excuse_turn: get_diplomatic_excuse_turn(other, player),
		player_grievance: get_diplomatic_grievance(player, other),
		other_grievance: get_diplomatic_grievance(other, player),
		player_contact: player.has_contact(other),
		other_contact: other.has_contact(player),
		player_trade: player.get_diplomatic_trade(other),
		other_trade: other.get_diplomatic_trade(player),
		player_loan_offer: player.get_diplomatic_loan_offer(other),
		other_loan_offer: other.get_diplomatic_loan_offer(player),
		player_integrity_blemishes: player.get_integrity_blemishes(),
		other_integrity_blemishes: other.get_integrity_blemishes(),
		player_submissive_to_id: get_submissive_to_id(player),
		other_submissive_to_id: get_submissive_to_id(other),
		player_surrender_offer_to_id: get_surrender_offer_to_id(player),
		other_surrender_offer_to_id: get_surrender_offer_to_id(other),
	};
};

const restore_trade = (recipient, proposer, trade) => {
	if (trade == null) {
		recipient.clear_diplomatic_trade(proposer);
	} else {
		recipient.set_diplomatic_trade(proposer, trade);
	}
};

const restore_loan_offer = (recipient, proposer, offer) => {
	if (offer == null) {
		recipient.clear_diplomatic_loan_offer(proposer);
	} else {
		recipient.set_diplomatic_loan_offer(proposer, offer);
	}
};

const restore_pair = (player, other, snapshot) => {
	player.set_diplomatic_relation(other, snapshot.player_relation);
	other.set_diplomatic_relation(player, snapshot.other_relation);
	player.set_diplomatic_offer(other, snapshot.player_offer);
	other.set_diplomatic_offer(player, snapshot.other_offer);
	set_diplomatic_excuse_turn(player, other, snapshot.player_excuse_turn);
	set_diplomatic_excuse_turn(other, player, snapshot.other_excuse_turn);
	set_diplomatic_grievance(player, other, snapshot.player_grievance);
	set_diplomatic_grievance(other, player, snapshot.other_grievance);
	player.set_contact(other, snapshot.player_contact);
	other.set_contact(player, snapshot.other_contact);
	restore_trade(player, other, snapshot.player_trade);
	restore_trade(other, player, snapshot.other_trade);
	restore_loan_offer(player, other, snapshot.player_loan_offer);
	restore_loan_offer(other, player, snapshot.other_loan_offer);
	player.set_integrity_blemishes(snapshot.player_integrity_blemishes);
	other.set_integrity_blemishes(snapshot.other_integrity_blemishes);
	if (#typeof(player.set_submissive_to_id) == 'Callable') {
		player.set_submissive_to_id(snapshot.player_submissive_to_id);
		player.set_surrender_offer_to_id(snapshot.player_surrender_offer_to_id);
	}
	if (#typeof(other.set_submissive_to_id) == 'Callable') {
		other.set_submissive_to_id(snapshot.other_submissive_to_id);
		other.set_surrender_offer_to_id(snapshot.other_surrender_offer_to_id);
	}
};

const integrity_names = [
	'Noble', 'Faithful', 'Scrupulous', 'Dependable',
	'Ruthless', 'Treacherous', 'Wicked', 'Infamous',
];

const get_integrity_name = (blemishes) => {
	const index = #min(7, #max(0, blemishes));
	return integrity_names[index];
};

const get_betrayal_penalty = (relation) => {
	if (relation == 'pact') {
		return 2;
	}
	return relation == 'treaty' ? 1 : 0;
};

const record_betrayal = (game, player, other) => {
	const relation = player.get_diplomatic_relation(other);
	const penalty = get_betrayal_penalty(relation);
	if (penalty == 0) {
		return 0;
	}
	const updated = #min(7, player.get_integrity_blemishes() + penalty);
	player.set_integrity_blemishes(updated);
	add_diplomatic_grievance(other, player, true, false, false);
	game.trigger('diplomatic_integrity_updated', {
		player: player,
		target: other,
		blemishes: updated,
		integrity: get_integrity_name(updated),
	});
	messages.to_contacts(
		game,
		player,
		player.name + ' broke a ' + relation + ' with ' + other.name +
		'; diplomatic integrity is now ' + get_integrity_name(updated) + '.'
	);
	return penalty;
};

const set_bilateral_relation = (game, player, other, relation, justified) => {
	if (relation == 'vendetta' && (!#is_defined(justified) || !justified)) {
		record_betrayal(game, player, other);
	}
	const established_contact = !player.has_contact(other) || !other.has_contact(player);
	player.set_contact(other, true);
	other.set_contact(player, true);
	if (established_contact) {
		game.trigger('diplomatic_contact_established', {player: player, target: other});
	}
	player.set_diplomatic_relation(other, relation);
	other.set_diplomatic_relation(player, relation);
	if (relation == 'vendetta') {
		set_diplomatic_excuse_turn(player, other, 0 - 1);
		set_diplomatic_excuse_turn(other, player, 0 - 1);
	}
};

const has_active_excuse = (game, player, other) => {
	const turn = #typeof(game.get_turn) == 'Callable' ? game.get_turn() : 0;
	return get_diplomatic_excuse_turn(player, other) >= turn;
};

const clear_relation_offers = (player, other) => {
	player.set_diplomatic_offer(other, '');
	other.set_diplomatic_offer(player, '');
};

const clear_offers = (player, other) => {
	clear_relation_offers(player, other);
	player.clear_diplomatic_trade(other);
	other.clear_diplomatic_trade(player);
	player.clear_diplomatic_loan_offer(other);
	other.clear_diplomatic_loan_offer(player);
	if (
		#typeof(player.get_surrender_offer_to_id) == 'Callable' &&
		player.get_surrender_offer_to_id() == other.id
	) {
		player.set_surrender_offer_to_id(-1);
	}
	if (
		#typeof(other.get_surrender_offer_to_id) == 'Callable' &&
		other.get_surrender_offer_to_id() == player.id
	) {
		other.set_surrender_offer_to_id(-1);
	}
};

const get_offer_contact = (terms) => {
	return #typeof(terms.offer_contact) == 'Int' ? terms.offer_contact : 0 - 1;
};

const get_request_contact = (terms) => {
	return #typeof(terms.request_contact) == 'Int' ? terms.request_contact : 0 - 1;
};

const get_offer_map = (terms) => {
	return #typeof(terms.offer_map) == 'Bool' ? terms.offer_map : false;
};

const get_request_map = (terms) => {
	return #typeof(terms.request_map) == 'Bool' ? terms.request_map : false;
};

const get_offer_base = (terms) => {
	return #typeof(terms.offer_base) == 'Int' ? terms.offer_base : 0 - 1;
};

const get_request_base = (terms) => {
	return #typeof(terms.request_base) == 'Int' ? terms.request_base : 0 - 1;
};

const get_request_vendetta_player = (terms) => {
	return #typeof(terms.request_vendetta_player) == 'Int'
		? terms.request_vendetta_player : 0 - 1;
};

const get_request_peace_player = (terms) => {
	return #typeof(terms.request_peace_player) == 'Int'
		? terms.request_peace_player : 0 - 1;
};

const get_proposed_relation = (terms) => {
	return #typeof(terms.proposed_relation) == 'String' ? terms.proposed_relation : '';
};

const is_military_request = (terms) => {
	return get_request_vendetta_player(terms) >= 0;
};

const is_peace_request = (terms) => {
	return get_request_peace_player(terms) >= 0;
};

const is_ultimatum = (terms) => {
	return #typeof(terms.is_ultimatum) == 'Bool' && terms.is_ultimatum;
};

const is_withdrawal_request = (terms) => {
	return #typeof(terms.request_withdrawal) == 'Bool' && terms.request_withdrawal;
};

const find_player = (game, player_id) => {
	if (#typeof(game.get_players) != 'Callable') {
		return null;
	}
	for (player of game.get_players()) {
		if (player.id == player_id) {
			return player;
		}
	}
	return null;
};

const validate_contact_transfer = (game, sender, recipient, contact_id, label) => {
	if (contact_id < 0) {
		return;
	}
	const contact = find_player(game, contact_id);
	if (contact == null || contact.id == sender.id || contact.id == recipient.id) {
		return 'The ' + label + ' commlink identifies an invalid faction';
	}
	if (!sender.has_contact(contact) || !contact.has_contact(sender)) {
		return 'The ' + label + ' commlink is not known by its sender';
	}
	if (recipient.has_contact(contact) || contact.has_contact(recipient)) {
		return 'The ' + label + ' commlink is already known by its recipient';
	}
};

const validate_trade = (game, proposer, recipient, terms) => {
	if (#typeof(terms) != 'Object') {
		return 'Diplomatic trade terms must be an object';
	}
	if (
		#typeof(terms.offer_energy) != 'Int' ||
		#typeof(terms.offer_technology) != 'String' ||
		#typeof(terms.request_energy) != 'Int' ||
		#typeof(terms.request_technology) != 'String' ||
		(#is_defined(terms.offer_contact) && #typeof(terms.offer_contact) != 'Int') ||
		(#is_defined(terms.request_contact) && #typeof(terms.request_contact) != 'Int') ||
		(#is_defined(terms.offer_map) && #typeof(terms.offer_map) != 'Bool') ||
		(#is_defined(terms.request_map) && #typeof(terms.request_map) != 'Bool') ||
		(#is_defined(terms.offer_base) && #typeof(terms.offer_base) != 'Int') ||
		(#is_defined(terms.request_base) && #typeof(terms.request_base) != 'Int') ||
		(#is_defined(terms.request_vendetta_player) &&
			#typeof(terms.request_vendetta_player) != 'Int') ||
		(#is_defined(terms.request_peace_player) &&
			#typeof(terms.request_peace_player) != 'Int') ||
		(#is_defined(terms.is_ultimatum) && #typeof(terms.is_ultimatum) != 'Bool') ||
		(#is_defined(terms.request_withdrawal) &&
			#typeof(terms.request_withdrawal) != 'Bool') ||
		(#is_defined(terms.proposed_relation) && #typeof(terms.proposed_relation) != 'String')
	) {
		return 'Diplomatic trade terms have invalid fields';
	}
	if (
		terms.offer_energy < 0 || terms.offer_energy > 1000000000 ||
		terms.request_energy < 0 || terms.request_energy > 1000000000
	) {
		return 'Diplomatic trade energy is out of range';
	}
	if (terms.offer_energy > 0 && terms.request_energy > 0) {
		return 'Diplomatic trade cannot send energy in both directions';
	}
	const offer_contact = get_offer_contact(terms);
	const request_contact = get_request_contact(terms);
	const offer_map = get_offer_map(terms);
	const request_map = get_request_map(terms);
	const offer_base = get_offer_base(terms);
	const request_base = get_request_base(terms);
	const request_vendetta_player = get_request_vendetta_player(terms);
	const request_peace_player = get_request_peace_player(terms);
	const proposed_relation = get_proposed_relation(terms);
	const military_request = request_vendetta_player >= 0;
	const peace_request = request_peace_player >= 0;
	const ultimatum = is_ultimatum(terms);
	const withdrawal_request = is_withdrawal_request(terms);
	if (
		proposed_relation != '' &&
		proposed_relation != 'treaty' && proposed_relation != 'pact'
	) {
		return 'A trade agreement must be a treaty or pact';
	}
	if (
		offer_contact < -1 || offer_contact >= 64 ||
		request_contact < -1 || request_contact >= 64
	) {
		return 'Diplomatic trade commlink is out of range';
	}
	if (
		offer_base < -1 || offer_base > 1000000000 ||
		request_base < -1 || request_base > 1000000000
	) {
		return 'Diplomatic trade base ID is out of range';
	}
	if (request_vendetta_player < -1 || request_vendetta_player >= 64) {
		return 'Diplomatic military request player ID is out of range';
	}
	if (request_peace_player < -1 || request_peace_player >= 64) {
		return 'Diplomatic peace request player ID is out of range';
	}
	if (military_request && peace_request) {
		return 'A diplomatic proposal cannot request both war and peace';
	}
	if (offer_contact >= 0 && offer_contact == request_contact) {
		return 'Diplomatic trade cannot exchange a commlink for itself';
	}
	if (
		(military_request || peace_request) &&
		(
			terms.offer_energy != 0 || terms.offer_technology != '' ||
			terms.request_energy != 0 || terms.request_technology != '' ||
			offer_contact >= 0 || request_contact >= 0 || offer_map || request_map ||
			offer_base >= 0 || request_base >= 0 || ultimatum || withdrawal_request ||
			proposed_relation != ''
		)
	) {
		return 'A third-party diplomatic request cannot contain trade terms';
	}
	if (
		withdrawal_request &&
		(
			!ultimatum || terms.offer_energy != 0 || terms.offer_technology != '' ||
			terms.request_energy != 0 || terms.request_technology != '' ||
			offer_contact >= 0 || request_contact >= 0 || offer_map || request_map ||
			offer_base >= 0 || request_base >= 0 || proposed_relation != ''
		)
	) {
		return 'A withdrawal demand cannot contain trade terms';
	}
	if (
		ultimatum && !withdrawal_request &&
		(
			terms.offer_energy != 0 || terms.offer_technology != '' ||
			offer_contact >= 0 || request_contact >= 0 || offer_map || request_map ||
			offer_base >= 0 || request_base >= 0 || proposed_relation != '' ||
			(terms.request_energy > 0) == (terms.request_technology != '')
		)
	) {
		return 'An ultimatum must demand exactly energy or one technology';
	}
	if (
		terms.offer_energy == 0 && terms.offer_technology == '' &&
		terms.request_energy == 0 && terms.request_technology == '' &&
		offer_contact < 0 && request_contact < 0 &&
		!offer_map && !request_map && offer_base < 0 && request_base < 0 &&
		!military_request && !peace_request && !withdrawal_request
	) {
		return 'Diplomatic trade cannot be empty';
	}
	if (
		terms.offer_technology != '' &&
		terms.offer_technology == terms.request_technology
	) {
		return 'Diplomatic trade cannot exchange a technology for itself';
	}
	const relation = proposer.get_diplomatic_relation(recipient);
	if (proposed_relation != '') {
		if (is_submission_pair(game, proposer, recipient)) {
			return 'A Pact of Submission is permanent';
		}
		const forced_relation = game.get('f_council_get_forced_relation');
		if (
			#typeof(forced_relation) == 'Callable' &&
			forced_relation(proposer, recipient) == 'vendetta'
		) {
			return 'Defiant and loyal factions must remain at vendetta';
		}
		if (proposed_relation == relation) {
			return 'Players already have that diplomatic relation';
		}
		if (proposed_relation == 'treaty' && relation == 'pact') {
			return 'A treaty cannot replace an existing pact';
		}
		if (proposed_relation == 'pact' && relation != 'treaty') {
			return 'A pact requires an existing treaty';
		}
	}
	if (
		!ultimatum && !military_request && !peace_request && relation == 'vendetta' &&
		proposed_relation != 'treaty'
	) {
		return 'Regular trade is unavailable during a vendetta';
	}
	if (military_request && relation != 'pact') {
		return 'Joint vendetta requests require a diplomatic pact';
	}
	if (peace_request && relation == 'vendetta') {
		return 'Peace mediation is unavailable during a vendetta';
	}
	if (
		ultimatum && !withdrawal_request &&
		relation != 'neutral' && relation != 'vendetta'
	) {
		return 'Ultimatums require neutral relations or an active vendetta';
	}
	if (withdrawal_request) {
		const withdrawal_error = diplomatic_withdrawal.get_error(game, proposer, recipient);
		if (#is_defined(withdrawal_error)) {
			return withdrawal_error;
		}
	}
	if (
		!ultimatum && !military_request && !peace_request &&
		(proposer.get_sanction_turns() > 0 || recipient.get_sanction_turns() > 0)
	) {
		return 'Regular trade is suspended by economic sanctions';
	}
	if (military_request) {
		const target = find_player(game, request_vendetta_player);
		if (target == null || target.id == proposer.id || target.id == recipient.id) {
			return 'The joint vendetta target is invalid';
		}
		if (!proposer.has_contact(target) || !target.has_contact(proposer)) {
			return 'The proposer has no diplomatic contact with the vendetta target';
		}
		if (!recipient.has_contact(target) || !target.has_contact(recipient)) {
			return 'The recipient has no diplomatic contact with the vendetta target';
		}
		if (proposer.get_diplomatic_relation(target) != 'vendetta') {
			return 'The proposer must already be at vendetta with the target';
		}
		if (recipient.get_diplomatic_relation(target) == 'vendetta') {
			return 'The recipient is already at vendetta with the target';
		}
		if (is_submission_pair(game, recipient, target)) {
			return 'A faction cannot join a vendetta against its submission partner';
		}
		const get_forced_relation = game.get('f_council_get_forced_relation');
		if (
			#typeof(get_forced_relation) == 'Callable' &&
			get_forced_relation(recipient, target) == 'pact'
		) {
			return 'Factions loyal to the Supreme Leader cannot join this vendetta';
		}
		return;
	}
	if (peace_request) {
		const target = find_player(game, request_peace_player);
		if (target == null || target.id == proposer.id || target.id == recipient.id) {
			return 'The peace request target is invalid';
		}
		if (!proposer.has_contact(target) || !target.has_contact(proposer)) {
			return 'The proposer has no diplomatic contact with the peace target';
		}
		if (!recipient.has_contact(target) || !target.has_contact(recipient)) {
			return 'The recipient has no diplomatic contact with the peace target';
		}
		const proposer_target_relation = proposer.get_diplomatic_relation(target);
		if (proposer_target_relation != 'treaty' && proposer_target_relation != 'pact') {
			return 'Peace mediation requires the target to be the proposer\'s friend';
		}
		if (recipient.get_diplomatic_relation(target) != 'vendetta') {
			return 'The recipient is not at vendetta with the peace target';
		}
		if (is_submission_pair(game, recipient, target)) {
			return 'A Pact of Submission cannot be mediated';
		}
		const get_forced_relation = game.get('f_council_get_forced_relation');
		if (
			#typeof(get_forced_relation) == 'Callable' &&
			get_forced_relation(recipient, target) == 'vendetta'
		) {
			return 'Defiant and loyal factions cannot make peace';
		}
		return;
	}
	const proposer_energy = proposer.get_energy_credits();
	const recipient_energy = recipient.get_energy_credits();
	if (proposer_energy < terms.offer_energy) {
		return 'Proposer cannot afford the offered energy';
	}
	if (recipient_energy < terms.request_energy) {
		return 'Recipient cannot afford the requested energy';
	}
	if (recipient_energy + terms.offer_energy > 1000000000) {
		return 'Recipient cannot hold the offered energy';
	}
	if (proposer_energy + terms.request_energy > 1000000000) {
		return 'Proposer cannot hold the requested energy';
	}
	for (technology of [
		[terms.offer_technology, proposer, recipient, 'offered'],
		[terms.request_technology, recipient, proposer, 'requested'],
	]) {
		const id = technology[0];
		if (id == '') {
			continue;
		}
		const definition = game.get('f_technology_get_definition')(id);
		if (definition == null) {
			return 'Diplomatic trade contains an unknown technology';
		}
		if (!technology[1].has_technology(id)) {
			return 'The ' + technology[3] + ' technology is not known by its sender';
		}
		if (technology[2].has_technology(id)) {
			return 'The ' + technology[3] + ' technology is already known by its recipient';
		}
	}
	const offer_contact_error = validate_contact_transfer(
		game, proposer, recipient, offer_contact, 'offered'
	);
	if (#is_defined(offer_contact_error)) {
		return offer_contact_error;
	}
	const request_contact_error = validate_contact_transfer(
		game, recipient, proposer, request_contact, 'requested'
	);
	if (#is_defined(request_contact_error)) {
		return request_contact_error;
	}
	if (offer_map || request_map) {
		const count_shareable = game.get('f_exploration_count_shareable_tiles');
		if (!#is_defined(count_shareable)) {
			return 'World map trading is unavailable';
		}
		if (offer_map && count_shareable(proposer, recipient) == 0) {
			return 'The offered world map contains no new exploration data';
		}
		if (request_map && count_shareable(recipient, proposer) == 0) {
			return 'The requested world map contains no new exploration data';
		}
	}
	const offer_base_error = diplomatic_base_transfer.validate_transfer(
		game, offer_base, proposer, recipient, 'offered'
	);
	if (#is_defined(offer_base_error)) {
		return offer_base_error;
	}
	const request_base_error = diplomatic_base_transfer.validate_transfer(
		game, request_base, recipient, proposer, 'requested'
	);
	if (#is_defined(request_base_error)) {
		return request_base_error;
	}
};

const grant_contact = (game, player, contact_id) => {
	if (#typeof(contact_id) != 'Int' || contact_id < 0) {
		return #undefined;
	}
	const contact = find_player(game, contact_id);
	const snapshot = {
		player: player,
		contact: contact,
		player_contact: player.has_contact(contact),
		contact_player: contact.has_contact(player),
	};
	player.set_contact(contact, true);
	contact.set_contact(player, true);
	game.trigger('diplomatic_contact_established', {player: player, target: contact});
	return snapshot;
};

const restore_contact = (game, snapshot) => {
	snapshot.player.set_contact(snapshot.contact, snapshot.player_contact);
	snapshot.contact.set_contact(snapshot.player, snapshot.contact_player);
	game.trigger('diplomatic_contact_updated', {
		player: snapshot.player,
		target: snapshot.contact,
	});
};

const queue_contact = (game, player, other) => {
	if (
		player == null || other == null || player.id == other.id ||
		(player.has_contact(other) && other.has_contact(player))
	) {
		return;
	}
	game.event('establish_diplomatic_contact', {player: player, target: other});
};

const queue_contacts_at_tile = (game, player, tile) => {
	if (
		#typeof(game.is_master) != 'Callable' || !game.is_master() ||
		player == null || tile == null
	) {
		return;
	}
	let tiles = [tile];
	for (nearby of tile.get_surrounding_tiles()) {
		tiles :+nearby;
	}
	for (candidate of tiles) {
		for (unit of candidate.get_units()) {
			queue_contact(game, player, find_player(game, unit.owner));
		}
		const base = candidate.get_base();
		if (base != null) {
			queue_contact(game, player, base.get_owner());
		}
	}
};

const scan_contacts = (game) => {
	if (#typeof(game.is_master) != 'Callable' || !game.is_master()) {
		return;
	}
	if (#typeof(game.get_um) == 'Callable') {
		for (unit of game.get_um().get_units()) {
			queue_contacts_at_tile(game, find_player(game, unit.owner), unit.get_tile());
		}
	}
	if (#typeof(game.get_bm) == 'Callable') {
		for (base of game.get_bm().get_bases()) {
			queue_contacts_at_tile(game, base.get_owner(), base.get_tile());
		}
	}
};

const grant_technology = (game, player, id) => {
	if (id == '') {
		return false;
	}
	const previous = player.get_research_state();
	let technologies = [];
	for (known_id of previous.technologies) {
		technologies :+known_id;
	}
	technologies :+id;
	let target = previous.target;
	let progress = previous.progress;
	if (target == id) {
		target = game.get('f_technology_get_next_target')(technologies, player);
		if (target == '') {
			progress = 0;
		}
	}
	player.set_research_state({
		technologies: technologies,
		target: target,
		progress: progress,
		cost: technology_acquisition.get_state_cost(
			game,
			player,
			technologies,
			target,
			previous
		),
	});
	const map_reveals = technology_effects.apply_map_reveals(game, player, [id]);
	const specialist_updates = technology_effects.apply_specialist_updates(game, player);
	const queue_datalinks = game.get('f_project_queue_planetary_datalinks');
	if (#is_defined(queue_datalinks)) {
		queue_datalinks();
	}
	return {
		player: player,
		technology_id: id,
		map_reveals: map_reveals,
		specialist_updates: specialist_updates,
	};
};

const get_loan_parties = (proposer, recipient, terms) => {
	return terms.proposer_is_lender
		? {lender: proposer, borrower: recipient}
		: {lender: recipient, borrower: proposer};
};

const validate_loan_offer = (proposer, recipient, terms) => {
	const pair_error = validate_pair(proposer, recipient);
	if (#is_defined(pair_error)) {
		return pair_error;
	}
	if (#typeof(terms) != 'Object') {
		return 'Diplomatic loan terms must be an object';
	}
	if (
		#typeof(terms.proposer_is_lender) != 'Bool' ||
		#typeof(terms.principal) != 'Int' ||
		#typeof(terms.payment) != 'Int' ||
		#typeof(terms.turns) != 'Int'
	) {
		return 'Diplomatic loan terms have invalid fields';
	}
	if (
		terms.principal <= 0 || terms.principal > 1000000000 ||
		terms.payment <= 0 || terms.payment > 1000000000 ||
		terms.turns <= 0 || terms.turns > 1000
	) {
		return 'Diplomatic loan terms are out of range';
	}
	const repayment = terms.payment * terms.turns;
	if (
		repayment > 1000000000 ||
		repayment < terms.principal ||
		repayment > terms.principal * 4
	) {
		return 'Diplomatic loan repayment is outside supported terms';
	}
	if (
		proposer.get_diplomatic_relation(recipient) == 'vendetta' ||
		recipient.get_diplomatic_relation(proposer) == 'vendetta'
	) {
		return 'Diplomatic loans are unavailable during a vendetta';
	}
	if (proposer.get_sanction_turns() > 0 || recipient.get_sanction_turns() > 0) {
		return 'Diplomatic loans are suspended by economic sanctions';
	}
	if (
		proposer.get_diplomatic_loan(recipient) != null ||
		recipient.get_diplomatic_loan(proposer) != null
	) {
		return 'Only one active loan is supported between two factions';
	}
	const parties = get_loan_parties(proposer, recipient, terms);
	if (parties.lender.get_energy_credits() < terms.principal) {
		return 'Lender cannot afford the loan principal';
	}
	if (parties.borrower.get_energy_credits() + terms.principal > 1000000000) {
		return 'Borrower cannot hold the loan principal';
	}
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_diplomacy_validate_players', validate_players);
		game.set('f_diplomacy_validate_pair', validate_pair);
		game.set('f_diplomacy_validate_surrender_direction', (proposer, recipient) => {
			return validate_surrender_direction(game, proposer, recipient);
		});
		game.set('f_diplomacy_snapshot_pair', snapshot_pair);
		game.set('f_diplomacy_restore_pair', restore_pair);
		game.set('f_diplomacy_get_integrity_name', get_integrity_name);
		game.set('f_diplomacy_get_betrayal_penalty', get_betrayal_penalty);
		game.set('f_diplomacy_has_active_excuse', (player, other) => {
			return has_active_excuse(game, player, other);
		});
		game.set('f_diplomacy_get_grievance', get_diplomatic_grievance);
		game.set('f_diplomacy_add_grievance', add_diplomatic_grievance);
		game.set('f_diplomacy_get_submissive_to_id', get_submissive_to_id);
		game.set('f_diplomacy_get_surrender_offer_to_id', get_surrender_offer_to_id);
		game.set('f_diplomacy_is_submission_pair', (player, other) => {
			return is_submission_pair(game, player, other);
		});
		game.set('f_diplomacy_get_submission_master', (player) => {
			return get_submission_master(game, player);
		});
		game.set('f_diplomacy_set_bilateral_relation', (player, other, relation, justified) => {
			return set_bilateral_relation(game, player, other, relation, justified);
		});
		game.set('f_diplomacy_clear_relation_offers', clear_relation_offers);
		game.set('f_diplomacy_clear_offers', clear_offers);
		game.set('f_diplomacy_validate_trade', (proposer, recipient, terms) => {
			return validate_trade(game, proposer, recipient, terms);
		});
		game.set('f_diplomacy_get_offer_base', get_offer_base);
		game.set('f_diplomacy_get_request_base', get_request_base);
		game.set('f_diplomacy_get_request_vendetta_player', get_request_vendetta_player);
		game.set('f_diplomacy_get_request_peace_player', get_request_peace_player);
		game.set('f_diplomacy_get_proposed_relation', get_proposed_relation);
		game.set('f_diplomacy_is_military_request', is_military_request);
		game.set('f_diplomacy_is_peace_request', is_peace_request);
		game.set('f_diplomacy_find_player', (player_id) => {
			return find_player(game, player_id);
		});
		game.set('f_diplomacy_is_ultimatum', is_ultimatum);
		game.set('f_diplomacy_is_withdrawal_request', is_withdrawal_request);
		game.set('f_diplomacy_get_withdrawal_error', (territory_owner, unit_owner) => {
			return diplomatic_withdrawal.get_error(game, territory_owner, unit_owner);
		});
		game.set('f_diplomacy_apply_withdrawal', (territory_owner, unit_owner) => {
			return diplomatic_withdrawal.apply(game, territory_owner, unit_owner);
		});
		game.set('f_diplomacy_rollback_withdrawal', (snapshots) => {
			diplomatic_withdrawal.rollback(game, snapshots);
		});
		game.set('f_diplomacy_find_base', (base_id) => {
			return diplomatic_base_transfer.find_base(game, base_id);
		});
		game.set('f_diplomacy_get_base_trade_value', (base) => {
			return diplomatic_base_transfer.get_base_trade_value(game, base);
		});
		game.set('f_diplomacy_transfer_base', (base, new_owner) => {
			return diplomatic_base_transfer.transfer_base(game, base, new_owner);
		});
		game.set('f_diplomacy_restore_base_transfer', (snapshot) => {
			return diplomatic_base_transfer.restore_transfer(game, snapshot);
		});
		game.set('f_diplomacy_get_loan_parties', get_loan_parties);
		game.set('f_diplomacy_validate_loan_offer', validate_loan_offer);
		game.set('f_diplomacy_grant_technology', (player, id) => {
			return grant_technology(game, player, id);
		});
		game.set('f_diplomacy_grant_contact', (player, contact_id) => {
			return grant_contact(game, player, contact_id);
		});
		game.set('f_diplomacy_restore_contact', (snapshot) => {
			return restore_contact(game, snapshot);
		});
		game.set('f_diplomacy_queue_contacts_at_tile', (player, tile) => {
			return queue_contacts_at_tile(game, player, tile);
		});
		if (
			#typeof(game.get_um) == 'Callable' &&
			#typeof(game.get_um().on) == 'Callable'
		) {
			game.get_um().on('unit_spawn', (event) => {
				queue_contacts_at_tile(
					game,
					find_player(game, event.unit.owner),
					event.unit.get_tile()
				);
			});
		}
		if (
			#typeof(game.get_bm) == 'Callable' &&
			#typeof(game.get_bm().on) == 'Callable'
		) {
			game.get_bm().on('base_spawn', (event) => {
				queue_contacts_at_tile(game, event.base.get_owner(), event.base.get_tile());
			});
		}
		scan_contacts(game);
		game.on('turn', (e) => {
			if (!game.is_master()) {
				return;
			}
			const turn_profile = game.get('f_turn_profile');
			const turn_profile_started = #typeof(turn_profile) == 'Callable' ? #monotonic_ms() : 0;
			scan_contacts(game);
			if (#is_defined(e.initial) && e.initial) {
				return;
			}
			for (borrower of game.get_players()) {
				for (lender of game.get_players()) {
					if (
						borrower.id != lender.id &&
						borrower.get_diplomatic_loan(lender) != null
					) {
						game.event('process_diplomatic_loan_payment', {
							borrower: borrower,
							lender: lender,
						});
					}
				}
			}
			if (#typeof(turn_profile) == 'Callable') {
				turn_profile({phase: 'diplomacy', elapsed_ms: #monotonic_ms() - turn_profile_started});
			}
		});
	});
};
