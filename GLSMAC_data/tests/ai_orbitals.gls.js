const orbitals = #include('../default/game/ai/orbitals');

const defense = {
	id: 'OrbitalDefensePod', orbital_resource: '', orbital_defense: true,
};
const sky = {
	id: 'SkyHydroponicsLab', orbital_resource: 'NUTRIENTS', orbital_defense: false,
};
const mine = {
	id: 'NessusMiningStation', orbital_resource: 'MINERALS', orbital_defense: false,
};
const treaty_power = {
	id: 'OrbitalPowerTransmitter', orbital_resource: 'ENERGY', orbital_defense: false,
};

let relations = {p2: 'vendetta', p3: 'neutral', p4: 'treaty'};
const player = {
	id: 1,
	get_diplomatic_relation: (other) => { return relations['p' + #to_string(other.id)]; },
};
const enemy = {id: 2, has_technology: (id) => { return id == 'OrbitalSpaceflight'; }};
const neutral = {id: 3, has_technology: (id) => { return false; }};
const treaty = {id: 4, has_technology: (id) => { return true; }};
let available = 1;
let targets = [
	{player: enemy, definition: defense, count: 2},
	{player: enemy, definition: sky, count: 4},
	{player: neutral, definition: mine, count: 3},
	{player: treaty, definition: treaty_power, count: 8},
];
const losses = {
	SkyHydroponicsLab: 4,
	NessusMiningStation: 7,
	OrbitalPowerTransmitter: 20,
};
const game = {
	get_players: () => { return [player, enemy, neutral, treaty]; },
	get: (key) => {
		if (key == 'f_orbital_get_available_defense_pods') {
			return (candidate) => { return available; };
		}
		if (key == 'f_orbital_get_attack_targets') {
			return (candidate) => { return targets; };
		}
		if (key == 'f_orbital_get_marginal_loss') {
			return (owner, definition) => { return losses[definition.id]; };
		}
		throw Error('Unexpected orbital AI callback: ' + key);
	},
};

test.assert(orbitals.get_defense_reserve(game, player) == 1);
test.assert(orbitals.choose_target(game, player) == null);
available = 2;
test.assert(orbitals.choose_target(game, player).definition == defense);
targets = [targets[1], targets[2], targets[3]];
test.assert(orbitals.choose_target(game, player).definition == sky);
relations.p2 = 'neutral';
test.assert(orbitals.get_defense_reserve(game, player) == 0);
test.assert(orbitals.choose_target(game, player).definition == mine);
relations.p3 = 'pact';
test.assert(orbitals.choose_target(game, player).definition == sky);
relations.p2 = 'treaty';
test.assert(orbitals.choose_target(game, player) == null);
