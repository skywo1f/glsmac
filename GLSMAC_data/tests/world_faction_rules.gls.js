const make_tile = (x, y) => {
	return {x: x, y: y, is_water: false};
};

let tiles = {};
for (let y = 0; y < 2; y++) {
	for (let x = y % 2; x < 8; x += 2) {
		tiles[#to_string(x) + '_' + #to_string(y)] = make_tile(x, y);
	}
}

const make_player = (id, faction_id) => {
	let energy = 0;
	return {
		id: id,
		get_faction: () => {
			return {id: faction_id, is_naval: false, is_native: false};
		},
		set_energy_credits: (value) => { energy = value; },
		get_energy_credits: () => { return energy; },
	};
};

const gaians = make_player(1, 'GAIANS');
const morganites = make_player(2, 'MORGANITES');
const players = [gaians, morganites];
let bases = 0;
let scouts = 0;
const game = {
	random: {get_int: (minimum, maximum) => { return minimum; }},
	get_players: () => { return players; },
	get_tm: () => {
		return {
			get_map_width: () => { return 8; },
			get_map_height: () => { return 2; },
			get_tile: (x, y) => { return tiles[#to_string(x) + '_' + #to_string(y)]; },
			get_distance: (a, b) => { return #abs(a.x - b.x) + #abs(a.y - b.y); },
		};
	},
	event: (name, data) => {
		if (name == 'process_player_economy') {
			data.player.set_energy_credits(data.energy_credits);
			return;
		}
		if (name == 'spawn_base') {
			bases++;
			test.assert(data.headquarters && data.initial_population);
		} else {
			test.assert(name == 'spawn_unit');
			test.assert(data.type == 'ScoutPatrol');
			scouts++;
		}
	},
};

#include('../default/game/world/default')(game);
test.assert(gaians.get_energy_credits() == 10);
test.assert(morganites.get_energy_credits() == 110);
test.assert(bases == 2);
test.assert(scouts == 2);
