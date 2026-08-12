const airdrops = #include('../default/game/ai/airdrops');

let has_graviton = false;
const player = {
	id: 1,
	has_technology: (id) => { return has_graviton && id == 'GravitonTheory'; },
};
const enemy = {id: 2};
let event_data = null;
let tiles = [];

const make_tile = (x) => {
	let base = null;
	return {
		x: x,
		y: 0,
		is_water: false,
		terraforming: {airbase: false},
		is_locked: () => { return false; },
		get_base: () => { return base; },
		set_base: (value) => { base = value; },
		get_units: (include_embarked) => { return []; },
	};
};

for (let x = 0; x < 40; x += 2) {
	tiles :+make_tile(x);
}
const source = tiles[0];
const target = tiles[19];
source.set_base({get_owner: () => { return player; }});
target.set_base({get_owner: () => { return enemy; }});

const unit = {
	id: 10,
	owner: player.id,
	health: 1.0,
	moved_this_turn: false,
	airdropped_this_turn: false,
	transport_id: 0,
	terraforming: 'none',
	is_land: true,
	get_tile: () => { return source; },
	get_def: () => { return {abilities: ['DropPods']}; },
};

const tm = {
	get_distance: (left, right) => { return #abs(left.x - right.x) / 2; },
	get_map_width: () => { return 40; },
	get_map_height: () => { return 1; },
	get_tile: (x, y) => {
		for (tile of tiles) {
			if (tile.x == x) { return tile; }
		}
		throw Error('Missing test tile');
	},
};
const game = {
	is_turn_complete: (id) => { return false; },
	get_player: (id) => { return player; },
	get_tm: () => { return tm; },
	get_um: () => { return {get_units: () => { return []; }}; },
	get_bm: () => { return {get_bases: () => { return []; }}; },
	get: (key) => {
		if (key == 'f_project_has') {
			return (project_player, id) => { return false; };
		}
		if (key == 'f_territory_is_friendly') {
			return (territory_player, tile) => { return true; };
		}
		return #undefined;
	},
	event_as: (caller, name, data) => {
		event_data = {caller: caller, name: name, data: data};
	},
};

test.assert(airdrops.choose_destination(game, player, unit, target) == tiles[8]);
test.assert(airdrops.try_drop(game, player, unit, target));
test.assert(event_data.caller == player.id && event_data.name == 'airdrop_unit');
test.assert(event_data.data.destination == tiles[8]);

has_graviton = true;
test.assert(airdrops.choose_destination(game, player, unit, target) == tiles[18]);
unit.moved_this_turn = true;
test.assert(airdrops.choose_destination(game, player, unit, target) == null);
