const base_trades = #include('../default/game/ai/base_trades');

const source = {id: 1};
let explored = true;
const recipient = {
	id: 2,
	has_explored: (tile) => { return explored; },
};
const make_base = (id, owner, x, facilities, former_owner_id) => {
	return {
		id: id,
		get_owner: () => { return owner; },
		get_tile: () => { return {x: x}; },
		has_facility: (facility_id) => {
			for (facility of facilities) {
				if (facility.id == facility_id) { return true; }
			}
			return false;
		},
		get_facilities: () => { return facilities; },
		has: (key) => { return key == 'former_owner_id' && former_owner_id >= 0; },
		get: (key) => { return key == 'former_owner_id' ? former_owner_id : 0 - 1; },
	};
};

const headquarters = {id: 'Headquarters', is_project: false};
const secret_project = {id: 'TheWeatherParadigm', is_project: true};
const remote = make_base(11, source, 20, [], recipient.id);
const source_capital = make_base(12, source, 0, [headquarters], 0 - 1);
const protected_project = make_base(13, source, 1, [secret_project], 0 - 1);
const recipient_capital = make_base(21, recipient, 18, [headquarters], 0 - 1);
let bases = [remote, source_capital, protected_project, recipient_capital];
const game = {
	get: (key) => {
		return key == 'f_diplomacy_get_base_trade_value'
			? (base) => {
				if (base.id == 11) { return 300; }
				if (base.id == 13) { return 500; }
				return 400;
			}
			: null;
	},
	get_bm: () => { return {get_bases: () => { return bases; }}; },
	get_tm: () => {
		return {
			get_distance: (first, second) => {
				const distance = first.x - second.x;
				return distance < 0 ? 0 - distance : distance;
			},
		};
	},
};

let candidates = base_trades.get_candidates(game, source, recipient);
test.assert(#sizeof(candidates) == 1);
test.assert(candidates[0].id == remote.id);
test.assert(candidates[0].owner_value == 100);
test.assert(candidates[0].recipient_value == 625);

explored = false;
test.assert(#sizeof(base_trades.get_candidates(game, source, recipient)) == 0);
explored = true;

bases = [remote, recipient_capital];
test.assert(#sizeof(base_trades.get_candidates(game, source, recipient)) == 0);

test.assert(base_trades.get_strategic_value(game, null, recipient) == 0);
