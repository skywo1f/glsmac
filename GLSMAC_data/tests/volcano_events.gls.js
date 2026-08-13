const create_volcano = #include('../default/game/event/create_volcano');

let locked = false;
let occupied = false;
let landmark = false;
let water = true;
let tile = null;
tile = {
	x: 4,
	y: 4,
	is_water: water,
	is_locked: () => { return locked; },
	get_base: () => { return occupied ? {} : null; },
	get_units: (include_embarked) => { return []; },
	get_surrounding_tiles: () => { return [tile]; },
	landmarks: {mount_planet: landmark},
};

let applied = false;
let restored = false;
let messages = [];
let triggers = [];
const event = {
	caller: 0,
	data: {tile: tile},
	game: {
		tm: {
			apply_volcano: (center) => {
				test.assert(center == tile);
				applied = true;
				return 'terrain-snapshot';
			},
			restore_terrain: (snapshot) => {
				test.assert(snapshot == 'terrain-snapshot');
				restored = true;
			},
		},
		message: (message) => { messages :+message; },
		trigger: (name, data) => { triggers :+name; },
	},
};

test.assert(!#is_defined(create_volcano.validate(event)));
event.caller = 1;
test.assert(#is_defined(create_volcano.validate(event)));
event.caller = 0;
event.data.tile.is_water = false;
test.assert(#is_defined(create_volcano.validate(event)));
event.data.tile.is_water = true;
locked = true;
test.assert(#is_defined(create_volcano.validate(event)));
locked = false;
occupied = true;
test.assert(#is_defined(create_volcano.validate(event)));
occupied = false;
event.data.tile.landmarks.mount_planet = true;
test.assert(#is_defined(create_volcano.validate(event)));
event.data.tile.landmarks.mount_planet = false;

test.assert(create_volcano.resolve(event) == {});
event.applied = create_volcano.apply(event);
test.assert(applied);
test.assert(#sizeof(messages) == 1);
test.assert(#sizeof(triggers) == 1);
test.assert(triggers[0] == 'volcano_created');
create_volcano.rollback(event);
test.assert(restored);
