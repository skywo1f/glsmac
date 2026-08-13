const apply_empath_guild = (game, base) => {
	const owner = base.get_owner();
	let infiltrated_players = [];
	let contacts = [];
	for (other of game.get_players()) {
		if (other.id == owner.id) {
			continue;
		}
		if (!owner.has_infiltrated(other)) {
			owner.set_infiltrated(other, true);
			infiltrated_players :+other;
		}
		if (!owner.has_contact(other) || !other.has_contact(owner)) {
			contacts :+{
				other: other,
				owner_contact: owner.has_contact(other),
				other_contact: other.has_contact(owner),
			};
			owner.set_contact(other, true);
			other.set_contact(owner, true);
			game.trigger('diplomatic_contact_established', {player: owner, target: other});
		}
	}
	if (#sizeof(infiltrated_players) == 0 && #sizeof(contacts) == 0) {
		return #undefined;
	}
	return {
		player: owner,
		infiltrated_players: infiltrated_players,
		contacts: contacts,
	};
};

const rollback_empath_guild = (applied) => {
	for (other of applied.infiltrated_players) {
		applied.player.set_infiltrated(other, false);
	}
	for (contact of applied.contacts) {
		applied.player.set_contact(contact.other, contact.owner_contact);
		contact.other.set_contact(applied.player, contact.other_contact);
	}
};

return {
	apply_empath_guild: apply_empath_guild,
	rollback_empath_guild: rollback_empath_guild,
};
