const queue = #include('../default/ui/parts/game/popup/base_screen/bottom_bar/queue');

test.assert(queue._candidate_key({production_kind: 'unit', id: 'Former'}) == 'unit:Former');
test.assert(queue._candidate_key({production_kind: 'facility', id: 'NetworkNode'}) == 'facility:NetworkNode');
test.assert(queue._candidate_label({name: 'Colony Pod'}) == 'Colony Pod');

const candidates = [
	{production_kind: 'unit', id: 'Former', name: 'Former'},
	{production_kind: 'facility', id: 'NetworkNode', name: 'Network Node'},
];
test.assert(queue._candidate_signature([], 'EMPTY') == 'EMPTY');
test.assert(
	queue._candidate_signature(candidates, 'EMPTY')
	== '|unit:Former:Former|facility:NetworkNode:Network Node'
);
