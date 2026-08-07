const PSYCH_ALLOCATION = 0.2;
const MAX_ENERGY_CREDITS = 1000000000;

const get_base_economy = (game, base) => {
	const intake = base.get_intake();
	const consumption = base.get_consumption();
	const total_energy = intake.ENERGY - consumption.ENERGY;
	const energy_surplus = #max(total_energy, 0);
	const labs = game.get('f_technology_get_base_labs')(base).value;
	const psych = #round(#to_float(energy_surplus) * PSYCH_ALLOCATION);
	return total_energy - labs - psych;
};

const get_player_economy = (game, player) => {
	let result = 0;
	for (base of game.get_bm().get_bases()) {
		if (base.get_owner().id == player.id) {
			result += get_base_economy(game, base);
		}
	}
	return result;
};

return (game) => {
	game.on('start', (e) => {
		game.set('f_economy_get_base', get_base_economy);
		game.set('f_economy_get_player', get_player_economy);
		game.on('turn', (e) => {
			if (!game.is_master()) {
				return;
			}
			for (player of game.get_players()) {
				const updated = #min(
					MAX_ENERGY_CREDITS,
					#max(0, player.energy_credits + get_player_economy(game, player))
				);
				game.event('process_player_economy', {
					player: player,
					energy_credits: updated,
				});
			}
		});
	});
};
