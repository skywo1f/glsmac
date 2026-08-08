const turns = #include('../default/units/turns');

const owner = {id: 1};
const other_owner = {id: 2};
const field_tile = {get_base: () => { return null; }};
const friendly_tile = {
	get_base: () => { return {get_owner: () => { return owner; }}; },
};
const hostile_tile = {
	get_base: () => { return {get_owner: () => { return other_owner; }}; },
};
const def = {
	health_max: 1.0,
	health_per_turn: 0.1,
};

const make_unit = (tile, health, moved, terraforming) => {
	return {
		owner: owner.id,
		health: health,
		moved_this_turn: moved,
		terraforming: terraforming,
		get_tile: () => { return tile; },
	};
};

let repair = turns.get_repair(make_unit(field_tile, 0.5, false, 'none'), def);
test.assert(repair > 0.099 && repair < 0.101);

repair = turns.get_repair(make_unit(friendly_tile, 0.5, false, 'none'), def);
test.assert(repair > 0.199 && repair < 0.201);

repair = turns.get_repair(make_unit(hostile_tile, 0.5, false, 'none'), def);
test.assert(repair > 0.099 && repair < 0.101);

repair = turns.get_repair(make_unit(friendly_tile, 0.5, true, 'none'), def);
test.assert(repair == 0.0);

repair = turns.get_repair(make_unit(friendly_tile, 0.5, false, 'farm'), def);
test.assert(repair == 0.0);

repair = turns.get_repair(make_unit(friendly_tile, 0.95, false, 'none'), def);
test.assert(repair > 0.049 && repair < 0.051);

repair = turns.get_repair(make_unit(friendly_tile, 1.0, false, 'none'), def);
test.assert(repair == 0.0);

repair = turns.get_repair(
	make_unit(field_tile, 0.5, false, 'none'),
	def,
	{full_repair: true}
);
test.assert(repair == 0.5);

const naval_def = {
	health_max: 1.0,
	health_per_turn: 0.1,
	is_immovable: false,
	is_native: false,
	movement_per_turn: 3.0,
};
const naval_unit = {
	owner: owner.id,
	health: 0.5,
	movement: 0.0,
	moved_this_turn: false,
	terraforming: 'none',
	is_water: true,
	get_def: () => { return naval_def; },
	get_owner: () => { return owner; },
	get_tile: () => { return field_tile; },
};
test.assert(turns.get_movement(
	naval_unit,
	naval_def,
	{naval_movement_bonus: 2.0, full_repair: true}
) == 5.0);
