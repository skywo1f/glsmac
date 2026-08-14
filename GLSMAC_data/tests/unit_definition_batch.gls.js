const handler = #include('../default/game/event/define_units');

let defined = [];
let undefined_ids = [];
const game = {
	um: {
		define_unit: (id, data) => {
			defined :+[id, data.name];
		},
		undefine_unit: (id) => {
			undefined_ids :+id;
		},
	},
};
let event = {
	caller: 0,
	game: game,
	data: {
		units: [
			{id: 'First', data: {name: 'First unit'}},
			{id: 'Second', data: {name: 'Second unit'}},
		],
	},
};

test.assert(!#is_defined(handler.validate(event)));
event.applied = handler.apply(event);
test.assert(defined == [
	['First', 'First unit'],
	['Second', 'Second unit'],
]);
handler.rollback(event);
test.assert(undefined_ids == ['Second', 'First']);

event.caller = 1;
test.assert(handler.validate(event) == 'Only master is allowed to define units');
event.caller = 0;
event.data.units = [];
test.assert(handler.validate(event) == 'Units must be a non-empty array');
event.data.units = [
	{id: 'Duplicate', data: {}},
	{id: 'Duplicate', data: {}},
];
test.assert(handler.validate(event) == 'Duplicate unit definition: Duplicate');
