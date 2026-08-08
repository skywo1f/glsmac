const declare_victory = #include('../default/game/event/declare_victory');

let game_over = false;
let eligible_winner = {id: 1};
let declaration = null;
let message = '';
let transcendence_base = null;

const game = {
	is_game_over: () => {
		return game_over;
	},
	get_conquest_winner: () => {
		return eligible_winner;
	},
	get_bm: () => {
		return {
			get_project_base: (id) => {
				test.assert(id == 'TheAscentToTranscendence');
				return transcendence_base;
			},
		};
	},
	declare_victory: (type, winner_id) => {
		declaration = {type: type, winner_id: winner_id};
		game_over = true;
	},
	get_player: (id) => {
		return {
			id: id,
			get_faction: () => {
				return {name: 'Test Faction'};
			},
		};
	},
	get_year: () => {
		return 2142;
	},
	message: (text) => {
		message = text;
	},
};

const event = {
	caller: 0,
	game: game,
	data: {
		type: 'conquest',
		winner_id: 1,
	},
};

event.caller = 1;
test.assert(#is_defined(declare_victory.validate(event)));
event.caller = 0;

game_over = true;
test.assert(#is_defined(declare_victory.validate(event)));
game_over = false;

event.data.type = 'economic';
test.assert(#is_defined(declare_victory.validate(event)));
event.data.type = 'conquest';

event.data.winner_id = 1.0;
test.assert(#is_defined(declare_victory.validate(event)));
event.data.winner_id = 1;

eligible_winner = null;
test.assert(#is_defined(declare_victory.validate(event)));
eligible_winner = {id: 2};
test.assert(#is_defined(declare_victory.validate(event)));
eligible_winner = {id: 1};

test.assert(!#is_defined(declare_victory.validate(event)));
declare_victory.apply(event);
test.assert(game_over);
test.assert(declaration == {type: 'conquest', winner_id: 1});
test.assert(message == 'Test Faction has won by conquest in M.Y. 2142.');

declare_victory.rollback(event);
test.assert(game_over);

game_over = false;
declaration = null;
message = '';
event.data.type = 'transcendence';
transcendence_base = null;
test.assert(#is_defined(declare_victory.validate(event)));
transcendence_base = {get_owner: () => { return {id: 2}; }};
test.assert(#is_defined(declare_victory.validate(event)));
transcendence_base = {get_owner: () => { return {id: 1}; }};
test.assert(!#is_defined(declare_victory.validate(event)));
declare_victory.apply(event);
test.assert(game_over);
test.assert(declaration == {type: 'transcendence', winner_id: 1});
test.assert(message == 'Test Faction has achieved transcendence in M.Y. 2142.');
