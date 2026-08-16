const monoliths = #include('../default/game/monoliths');

let messages = [];
let global_messages = [];
const owner = {id: 1};
const game = {
	get: (name) => {
		return name == 'f_message_to_player'
			? (player, text) => { test.assert(player == owner); messages :+text; }
			: #undefined;
	},
	message: (text) => { global_messages :+text; },
};

let military = #undefined;
military = {
	health: 0.4,
	morale: 2,
	monolith_upgraded: false,
	get_owner: () => { return owner; },
	get_def: () => { return {name: 'Scout Patrol', offense: 1}; },
};
const first = monoliths.apply(game, military);
test.assert(military.health == 1.0 && military.morale == 3 && military.monolith_upgraded);
test.assert(#sizeof(messages) == 1);

military.health = 0.6;
test.assert(military.health > 0.599 && military.health < 0.601);
const second = monoliths.apply(game, military);
test.assert(second.health > 0.599 && second.health < 0.601);
test.assert(military.health == 1.0 && military.morale == 3 && military.monolith_upgraded);
test.assert(#sizeof(messages) == 2);
monoliths.rollback(second, military);
test.assert(military.health > 0.599 && military.health < 0.601);
test.assert(military.morale == 3);
test.assert(military.monolith_upgraded);
monoliths.rollback(first, military);
test.assert(military.health > 0.399 && military.health < 0.401);
test.assert(military.morale == 2);
test.assert(!military.monolith_upgraded);

const civilian = {
	health: 0.5,
	morale: 1,
	monolith_upgraded: false,
	get_owner: () => { return owner; },
	get_def: () => { return {name: 'Colony Pod', offense: 0}; },
};
const civilian_visit = monoliths.apply(game, civilian);
test.assert(civilian.health == 1.0 && civilian.morale == 1 && !civilian.monolith_upgraded);
monoliths.rollback(civilian_visit, civilian);
test.assert(civilian.health == 0.5 && civilian.morale == 1 && !civilian.monolith_upgraded);

const native = {
	health: 1.0,
	morale: 4,
	monolith_upgraded: false,
	get_owner: () => { return owner; },
	get_def: () => { return {name: 'Mind Worms', offense: 0 - 1}; },
};
const native_visit = monoliths.apply(game, native);
test.assert(native.morale == 5 && native.monolith_upgraded);
monoliths.rollback(native_visit, native);
test.assert(native.morale == 4 && !native.monolith_upgraded);
test.assert(global_messages == []);
