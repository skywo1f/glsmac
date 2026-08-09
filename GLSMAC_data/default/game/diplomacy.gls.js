const is_player = (player) => {
	return (
		#typeof(player) == 'Object' &&
		#typeof(player.get_diplomatic_relation) == 'Callable' &&
		#typeof(player.set_diplomatic_relation) == 'Callable' &&
		#typeof(player.get_diplomatic_offer) == 'Callable' &&
		#typeof(player.set_diplomatic_offer) == 'Callable'
	);
};

const validate_pair = (player, other) => {
	if (!is_player(player) || !is_player(other)) {
		return 'Diplomacy requires two players';
	}
	if (player.id == other.id) {
		return 'A player cannot conduct diplomacy with itself';
	}
};

const snapshot_pair = (player, other) => {
	return {
		player_relation: player.get_diplomatic_relation(other),
		other_relation: other.get_diplomatic_relation(player),
		player_offer: player.get_diplomatic_offer(other),
		other_offer: other.get_diplomatic_offer(player),
	};
};

const restore_pair = (player, other, snapshot) => {
	player.set_diplomatic_relation(other, snapshot.player_relation);
	other.set_diplomatic_relation(player, snapshot.other_relation);
	player.set_diplomatic_offer(other, snapshot.player_offer);
	other.set_diplomatic_offer(player, snapshot.other_offer);
};

const set_bilateral_relation = (player, other, relation) => {
	player.set_diplomatic_relation(other, relation);
	other.set_diplomatic_relation(player, relation);
};

const clear_offers = (player, other) => {
	player.set_diplomatic_offer(other, '');
	other.set_diplomatic_offer(player, '');
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_diplomacy_validate_pair', validate_pair);
		game.set('f_diplomacy_snapshot_pair', snapshot_pair);
		game.set('f_diplomacy_restore_pair', restore_pair);
		game.set('f_diplomacy_set_bilateral_relation', set_bilateral_relation);
		game.set('f_diplomacy_clear_offers', clear_offers);
	});
};
