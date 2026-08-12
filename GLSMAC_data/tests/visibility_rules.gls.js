const visibility = #include('../default/game/visibility_rules');

const make_tile = (x, y) => {
	let surrounding = [];
	return {
		x: x,
		y: y,
		terraforming: {sensor: false},
		get_surrounding_tiles: () => { return surrounding; },
		set_surrounding_tiles: (tiles) => { surrounding = tiles; },
		is_adjactent_to: (tile) => {
			for (candidate of surrounding) {
				if (candidate == tile) {
					return true;
				}
			}
			return false;
		},
	};
};

const center = make_tile(2, 2);
const adjacent = make_tile(4, 2);
const sensor = make_tile(6, 2);
const distant = make_tile(8, 2);
center.set_surrounding_tiles([adjacent]);
adjacent.set_surrounding_tiles([center, sensor]);
sensor.set_surrounding_tiles([adjacent, distant]);
distant.set_surrounding_tiles([sensor]);

const make_unit = (owner, tile, abilities, id) => {
	const def = {
		id: #is_defined(id) ? id : 'TestUnit',
		abilities: abilities,
		weapon: 'Laser',
	};
	return {
		owner: owner,
		get_tile: () => { return tile; },
		get_def: () => { return def; },
	};
};

let sensor_owner = null;
const game = {
	get: (name) => {
		test.assert(name == 'f_territory_get_owner');
		return (tile) => { return tile == sensor ? sensor_owner : null; };
	},
};

const scout = make_unit(2, center, []);
const radar = make_unit(2, center, ['DeepRadar']);
const cloaked = make_unit(2, sensor, ['CloakingDevice']);
const submarine = make_unit(2, sensor, ['DeepPressureHull']);
const attacker = make_unit(1, adjacent, []);
const artillery = make_unit(1, adjacent, ['HeavyArtillery'], 'TestArtillery');

test.assert(visibility.get_sight_radius(scout) == 1);
test.assert(visibility.get_sight_radius(radar) == 2);
test.assert(!visibility.is_concealed(scout));
test.assert(visibility.is_concealed(cloaked));
test.assert(visibility.is_concealed(submarine));
test.assert(visibility.is_detected(game, 1, scout));
test.assert(!visibility.is_detected(game, 1, cloaked));
test.assert(!visibility.is_detected(game, 1, submarine));
test.assert(visibility.is_detected(game, 2, cloaked));

sensor.terraforming.sensor = true;
sensor_owner = {id: 2};
test.assert(!visibility.is_detected(game, 1, cloaked));
sensor_owner = {id: 1};
test.assert(visibility.is_detected(game, 1, cloaked));
test.assert(visibility.is_detected(game, 1, submarine));

sensor_owner = null;
test.assert(visibility.can_target(game, 1, attacker, cloaked));
test.assert(!visibility.can_target(game, 1, artillery, cloaked));
sensor_owner = {id: 1};
test.assert(visibility.can_target(game, 1, artillery, cloaked));

test.assert(#sizeof(visibility.get_tiles_in_radius(center, 1)) == 2);
test.assert(#sizeof(visibility.get_tiles_in_radius(center, 2)) == 3);
test.assert(#sizeof(visibility.get_tiles_in_radius(center, 3)) == 4);
