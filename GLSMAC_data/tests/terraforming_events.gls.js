const terraform_tile = #include('../default/game/event/terraform_tile');
const cancel_terraform = #include('../default/game/event/cancel_terraform');
const terraforming = #include('../default/units/terraforming');

let tile_state = {
	is_water: false,
	is_locked: false,
	base: null,
	other_units: [],
	updates: 0,
};

let tile = null;
tile = {
	is_water: false,
	features: {
		monolith: false,
		xenofungus: false,
	},
	terraforming: {
		road: false,
		forest: false,
		farm: false,
		mine: false,
		solar: false,
	},
	is_locked: () => {
		return tile_state.is_locked;
	},
	get_base: () => {
		return tile_state.base;
	},
	get_units: () => {
		return tile_state.other_units;
	},
	update_terraforming: (changes) => {
		for (type in changes) {
			tile.terraforming[type] = changes[type];
		}
		tile_state.updates = tile_state.updates + 1;
	},
};

let can_terraform = true;
let unit = null;
unit = {
	id: 10,
	owner: 1,
	movement: 1.0,
	moved_this_turn: false,
	terraforming: 'none',
	terraforming_turns_remaining: 0,
	get_def: () => {
		return {can_terraform: can_terraform};
	},
	get_tile: () => {
		return tile;
	},
	set_terraforming_order: (type, turns) => {
		unit.terraforming = type;
		unit.terraforming_turns_remaining = turns;
	},
};

let turn_complete = false;
const event = {
	caller: 1,
	data: {
		unit: unit,
		type: 'farm',
	},
	game: {
		is_turn_complete: (player) => {
			return turn_complete;
		},
	},
};

test.assert(!#is_defined(terraform_tile.validate(event)));
test.assert(terraform_tile.resolve(event) == {});

event.data.type = 'unknown';
test.assert(#is_defined(terraform_tile.validate(event)));
event.data.type = 'farm';
event.caller = 2;
test.assert(#is_defined(terraform_tile.validate(event)));
event.caller = 1;
turn_complete = true;
test.assert(#is_defined(terraform_tile.validate(event)));
turn_complete = false;
can_terraform = false;
test.assert(#is_defined(terraform_tile.validate(event)));
can_terraform = true;
tile.is_water = true;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.is_water = false;
tile.features.xenofungus = true;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.features.xenofungus = false;
tile.terraforming.farm = true;
test.assert(#is_defined(terraform_tile.validate(event)));
tile.terraforming.farm = false;
tile_state.other_units = [{id: 11, terraforming: 'mine'}];
test.assert(#is_defined(terraform_tile.validate(event)));
tile_state.other_units = [];

event.applied = terraform_tile.apply(event);
test.assert(unit.terraforming == 'farm');
test.assert(unit.terraforming_turns_remaining == 4);
test.assert(event.data.unit.movement == 0.0);
test.assert(event.data.unit.moved_this_turn);
terraform_tile.rollback(event);
test.assert(unit.terraforming == 'none');
test.assert(unit.terraforming_turns_remaining == 0);
test.assert(event.data.unit.movement == 1.0);
test.assert(!event.data.unit.moved_this_turn);

unit.set_terraforming_order('farm', 4);
test.assert(terraforming.advance_order(unit));
test.assert(unit.terraforming_turns_remaining == 3);
test.assert(terraforming.advance_order(unit));
test.assert(unit.terraforming_turns_remaining == 2);
test.assert(terraforming.advance_order(unit));
test.assert(unit.terraforming_turns_remaining == 1);
test.assert(!terraforming.advance_order(unit));
test.assert(unit.terraforming == 'none');
test.assert(unit.terraforming_turns_remaining == 0);
test.assert(tile.terraforming.farm);
test.assert(tile_state.updates == 1);

tile.terraforming.solar = true;
unit.set_terraforming_order('mine', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.terraforming.mine);
test.assert(!tile.terraforming.solar);
test.assert(tile_state.updates == 2);

unit.set_terraforming_order('road', 2);
test.assert(terraforming.advance_order(unit));
test.assert(unit.terraforming_turns_remaining == 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.terraforming.road);
test.assert(tile_state.updates == 3);

tile.terraforming.farm = true;
tile.terraforming.mine = true;
tile.terraforming.solar = true;
unit.set_terraforming_order('forest', 1);
test.assert(!terraforming.advance_order(unit));
test.assert(tile.terraforming.forest);
test.assert(!tile.terraforming.farm);
test.assert(!tile.terraforming.mine);
test.assert(!tile.terraforming.solar);
test.assert(tile_state.updates == 4);

unit.set_terraforming_order('solar', 2);
unit.movement = 0.0;
unit.moved_this_turn = true;
const cancel_event = {
	caller: 1,
	game: event.game,
	data: {unit: unit},
};
test.assert(!#is_defined(cancel_terraform.validate(cancel_event)));
cancel_event.applied = cancel_terraform.apply(cancel_event);
test.assert(unit.terraforming == 'none');
test.assert(unit.terraforming_turns_remaining == 0);
cancel_terraform.rollback(cancel_event);
test.assert(unit.terraforming == 'solar');
test.assert(unit.terraforming_turns_remaining == 2);
test.assert(unit.movement == 0.0);
test.assert(unit.moved_this_turn);
