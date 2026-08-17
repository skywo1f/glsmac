const spawn_base = #include('../default/game/event/spawn_base');

const make_player = (id, faction_id) => {
	return {
		id: id,
		get_faction: () => { return {id: faction_id}; },
	};
};

const spawn_for = (owner) => {
	let facilities = [];
	let minerals = 0 - 1;
	const base = {
		has_facility: (id) => {
			for (facility_id of facilities) {
				if (facility_id == id) { return true; }
			}
			return false;
		},
		add_facility: (id) => { facilities :+id; },
		set_accumulated_minerals: (value) => { minerals = value; },
	};
	const game = {
		get: (key) => {
			test.assert(key == 'f_social_get_new_base_minerals');
			return (player) => {
				test.assert(player == owner);
				return 10;
			};
		},
		bm: {
			spawn_base: (player, tile, info) => {
				test.assert(player == owner);
				test.assert(info.production == 'ScoutPatrol');
				return base;
			},
			despawn_base: (value) => { test.assert(value == base); },
		},
	};
	const event = {
		caller: 0,
		game: game,
		data: {
			owner: owner,
			tile: {is_water: false},
			headquarters: true,
		},
	};
	event.applied = spawn_base.apply(event);
	test.assert(event.applied.base == base);
	test.assert(minerals == 10);
	return facilities;
};

test.assert(spawn_for(make_player(1, 'GAIANS')) == ['Headquarters']);
test.assert(
	spawn_for(make_player(2, 'HIVE')) == ['PerimeterDefense', 'Headquarters']
);
test.assert(
	spawn_for(make_player(3, 'UNIVERSITY')) == ['NetworkNode', 'Headquarters']
);
