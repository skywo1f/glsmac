const rules = #include('../default/game/orbital_rules');

const sky = {
	id: 'SkyHydroponicsLab',
	name: 'Sky Hydroponics Lab',
	orbital_resource: 'NUTRIENTS',
	orbital_defense: false,
};
const mine = {
	id: 'NessusMiningStation',
	name: 'Nessus Mining Station',
	orbital_resource: 'MINERALS',
	orbital_defense: false,
};
const power = {
	id: 'OrbitalPowerTransmitter',
	name: 'Orbital Power Transmitter',
	orbital_resource: 'ENERGY',
	orbital_defense: false,
};
const defense = {
	id: 'OrbitalDefensePod',
	name: 'Orbital Defense Pod',
	orbital_resource: '',
	orbital_defense: true,
};
const ordinary = {id: 'RecyclingTanks', orbital_resource: '', orbital_defense: false};
const definitions = [sky, mine, power, defense, ordinary];

let counts = {
	SkyHydroponicsLab: 5,
	NessusMiningStation: 3,
	OrbitalPowerTransmitter: 2,
	OrbitalDefensePod: 2,
};
let deployments = 1;
const player = {
	id: 1,
	name: 'University',
	get_orbital_facility_count: (id) => {
		return #is_defined(counts[id]) ? counts[id] : 0;
	},
	set_orbital_facility_count: (id, count) => {
		if (count == 0) {
			counts[id] = #undefined;
		} else {
			counts[id] = count;
		}
	},
	get_orbital_defense_deployments: () => { return deployments; },
};
let other_counts = {SkyHydroponicsLab: 2, OrbitalDefensePod: 1};
const other_player = {
	id: 2,
	get_orbital_facility_count: (id) => {
		return #is_defined(other_counts[id]) ? other_counts[id] : 0;
	},
};
let space_elevator = false;
let turn_complete = false;
let game_over = false;
let forced_allies = false;
const make_base = (id, owner, size, aerospace) => {
	return {
		id: id,
		get_owner: () => { return owner; },
		get_size: () => { return size; },
		has_facility: (facility_id) => {
			return facility_id == 'AerospaceComplex' && aerospace;
		},
	};
};
const complex_base = make_base(1, player, 3, true);
const unsupported_base = make_base(2, player, 4, false);
const other_base = make_base(3, other_player, 10, true);
const bases = [complex_base, unsupported_base, other_base];
const game = {
	get_players: () => { return [player, other_player]; },
	is_turn_complete: (id) => { return id == player.id && turn_complete; },
	is_game_over: () => { return game_over; },
	get: (key) => {
		if (key == 'f_project_has') {
			return (candidate, id) => {
				return candidate == player && id == 'TheSpaceElevator' && space_elevator;
			};
		}
		if (key == 'f_council_get_forced_relation') {
			return (player, target) => { return forced_allies ? 'pact' : ''; };
		}
		return #undefined;
	},
	get_bm: () => {
		return {
			get_bases: () => { return bases; },
			get_facility_defs: () => { return definitions; },
		};
	},
};

test.assert(rules.is_orbital(sky));
test.assert(rules.is_orbital(defense));
test.assert(!rules.is_orbital(ordinary));
test.assert(!rules.has_space_elevator(game, player));
test.assert(rules.has_full_access(game, complex_base));
test.assert(!rules.has_full_access(game, unsupported_base));
test.assert(rules.get_base_resource_bonus(game, complex_base, 'NUTRIENTS') == 3);
test.assert(rules.get_base_resource_bonus(game, unsupported_base, 'NUTRIENTS') == 2);
test.assert(rules.get_base_resource_bonus(game, unsupported_base, 'MINERALS') == 1);
test.assert(rules.get_base_resource_bonus(game, unsupported_base, 'ENERGY') == 1);
test.assert(rules.get_marginal_yield(game, player, sky) == 1);
test.assert(rules.get_marginal_yield(game, player, defense) == 0);
test.assert(rules.get_marginal_loss(game, player, mine) == 1);
test.assert(rules.get_available_defense_pods(player) == 1);
test.assert(!#is_defined(
	rules.get_attack_error(game, player, other_player, 'SkyHydroponicsLab')
));
test.assert(#sizeof(rules.get_attack_targets(game, player)) == 2);
forced_allies = true;
test.assert(
	rules.get_attack_error(game, player, other_player, 'SkyHydroponicsLab') ==
	'Factions loyal to the Supreme Leader cannot attack each other'
);
test.assert(#sizeof(rules.get_attack_targets(game, player)) == 0);
forced_allies = false;

deployments = 2;
test.assert(
	rules.get_attack_error(game, player, other_player, 'SkyHydroponicsLab') ==
	'All Orbital Defense Pods have been deployed this turn'
);
deployments = 1;
turn_complete = true;
test.assert(
	rules.get_attack_error(game, player, other_player, 'SkyHydroponicsLab') ==
	'Player has already completed this turn'
);
turn_complete = false;
game_over = true;
test.assert(
	rules.get_attack_error(game, player, other_player, 'SkyHydroponicsLab') ==
	'The game is already over'
);
game_over = false;
test.assert(#is_defined(
	rules.get_attack_error(game, player, player, 'SkyHydroponicsLab')
));
test.assert(#is_defined(
	rules.get_attack_error(game, player, other_player, 'RecyclingTanks')
));

space_elevator = true;
test.assert(rules.has_space_elevator(game, player));
test.assert(rules.has_full_access(game, unsupported_base));
test.assert(rules.get_base_resource_bonus(game, unsupported_base, 'NUTRIENTS') == 4);
test.assert(rules.get_marginal_yield(game, player, sky) == 0);
test.assert(rules.get_marginal_loss(game, player, mine) == 2);
space_elevator = false;

counts.SkyHydroponicsLab = 0;
const applied = rules.apply_launch(game, complex_base, sky);
test.assert(counts.SkyHydroponicsLab == 1);
test.assert(applied.player == player);
test.assert(applied.id == 'SkyHydroponicsLab');
test.assert(applied.count == 0);
rules.rollback_launch(applied);
test.assert(!#is_defined(counts.SkyHydroponicsLab));
