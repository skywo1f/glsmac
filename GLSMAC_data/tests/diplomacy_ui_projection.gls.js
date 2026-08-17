const diplomacy = #include('../default/ui/parts/game/popup/diplomacy');

const empty = {
	p2: {
		target_id: 2,
		relation: '',
		trade: '',
		loan: '',
		surrender: false,
		excuse_turn: 0 - 1,
	},
};

test.assert(diplomacy.find_new_incoming(empty, empty) == null);

let next = #clone(empty);
next.p2.relation = 'treaty';
let incoming = diplomacy.find_new_incoming(empty, next);
test.assert(incoming.target_id == 2 && incoming.kind == 'relation');

next = #clone(empty);
next.p2.trade = '10||0||-1|-1|false|false|-1|-1|false|-1';
incoming = diplomacy.find_new_incoming(empty, next);
test.assert(incoming.target_id == 2 && incoming.kind == 'trade');

next = #clone(empty);
next.p2.loan = 'true|50|5|12';
incoming = diplomacy.find_new_incoming(empty, next);
test.assert(incoming.target_id == 2 && incoming.kind == 'loan');

next = #clone(empty);
next.p2.surrender = true;
incoming = diplomacy.find_new_incoming(empty, next);
test.assert(incoming.target_id == 2 && incoming.kind == 'surrender');

next = #clone(empty);
next.p2.excuse_turn = 7;
incoming = diplomacy.find_new_incoming(empty, next);
test.assert(incoming.target_id == 2 && incoming.kind == 'excuse');

const existing = #clone(next);
test.assert(diplomacy.find_new_incoming(existing, next) == null);
