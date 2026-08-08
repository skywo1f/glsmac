const combat_rules = #include('../default/game/combat_rules');

const make_tile = () => {
	let base = null;
	return {
		rockiness: 1,
		features: {xenofungus: false},
		terraforming: {bunker: false},
		get_base: () => { return base; },
		set_base: (value) => { base = value; },
	};
};

const make_base = (tile, owner, facilities) => {
	const base = {
		get_owner: () => { return {id: owner}; },
		get_facilities: () => { return facilities; },
	};
	tile.set_base(base);
	return base;
};

const make_unit = (tile, owner, offense, defense, is_native) => {
	return {
		owner: owner,
		morale: 2,
		health: 1.0,
		movement: 1.0,
		is_land: true,
		get_tile: () => { return tile; },
		get_def: () => {
			return {
				is_native: is_native,
				offense: offense,
				defense: defense,
			};
		},
	};
};

const attack_tile = make_tile();
const attacker = make_unit(attack_tile, 1, 2, 1, false);
const base_tile = make_tile();
let facilities = [];
make_base(base_tile, 2, facilities);
const defender = make_unit(base_tile, 2, 1, 2, false);

test.assert(combat_rules.get_base_defense_multiplier(defender) == 1.0);
test.assert(combat_rules.get_combat_powers(attacker, defender).defence == 2.5);

facilities :+{defense_multiplier: 2.0};
test.assert(combat_rules.get_base_defense_multiplier(defender) == 2.0);
test.assert(combat_rules.get_combat_powers(attacker, defender).defence == 5.0);

facilities :+{defense_multiplier: 1.5};
test.assert(combat_rules.get_base_defense_multiplier(defender) == 2.0);

const occupying_defender = make_unit(base_tile, 3, 1, 2, false);
test.assert(combat_rules.get_base_defense_multiplier(occupying_defender) == 1.0);
test.assert(combat_rules.get_combat_powers(attacker, occupying_defender).defence == 2.5);

const native_attacker = make_unit(attack_tile, 1, 1, 1, true);
test.assert(combat_rules.get_combat_powers(native_attacker, defender).defence == 2.5);
