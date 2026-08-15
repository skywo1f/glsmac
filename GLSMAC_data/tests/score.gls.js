const rules = #include('../default/game/score_rules');
const configure_score = #include('../default/game/score');

const make_player = (id, technologies, thoughts) => {
	let relations = {};
	let submissive_to_id = -1;
	return {
		id: id,
		get_research_state: () => { return {technologies: technologies}; },
		get_transcendent_thoughts: () => { return thoughts; },
		get_diplomatic_relation: (other) => {
			const key = 'p' + #to_string(other.id);
			return #is_defined(relations[key]) ? relations[key] : 'neutral';
		},
		set_relation: (other, relation) => { relations['p' + #to_string(other.id)] = relation; },
		get_submissive_to_id: () => { return submissive_to_id; },
		set_submissive_to_id: (value) => { submissive_to_id = value; },
	};
};

const local = make_player(1, ['Biogenetics', 'IndustrialBase', 'TranscendentThought'], 3);
const surrendered = make_player(2, ['Biogenetics'], 0);
const rival = make_player(3, [], 0);
local.set_relation(surrendered, 'pact');
surrendered.set_relation(local, 'pact');
surrendered.set_submissive_to_id(local.id);

const project = {id: 'TheHumanGenomeProject', is_project: true};
const second_project = {id: 'TheWeatherParadigm', is_project: true};
const ordinary_facility = {id: 'RecyclingTanks', is_project: false};
const bases = [
	{get_owner: () => { return local; }, get_size: () => { return 7; }, get_facilities: () => { return [project, second_project, ordinary_facility]; }},
	{get_owner: () => { return surrendered; }, get_size: () => { return 5; }, get_facilities: () => { return []; }},
	{get_owner: () => { return rival; }, get_size: () => { return 3; }, get_facilities: () => { return []; }},
];
let victory = {type: 'diplomatic', winner: local.id, turn: 100};
let callbacks = {};
let values = {
	f_economy_get_player_commerce: (game, player) => { return player.id == local.id ? 4 : 0; },
	f_diplomacy_get_submission_master: (player) => {
		return player.get_submissive_to_id() == local.id ? local : null;
	},
};
const game = {
	get_bm: () => { return {get_bases: () => { return bases; }}; },
	get_victory_state: () => { return victory; },
	get: (name) => { return values[name]; },
	set: (name, value) => { values[name] = value; },
	on: (name, callback) => { callbacks[name] = callback; },
};

let score = rules.get_breakdown(game, local);
test.assert(score.population == 7);
test.assert(score.victory_population == 6);
test.assert(score.surrendered_population == 5);
test.assert(score.commerce == 4);
test.assert(score.technology == 2);
test.assert(score.transcendent_thought == 30);
test.assert(score.secret_projects == 50);
test.assert(score.victory_bonus == 1000);
test.assert(score.total == 1104);

score = rules.get_breakdown(game, surrendered);
test.assert(score.population == 5);
test.assert(score.victory_population == 0);
test.assert(score.surrendered_population == 0);
test.assert(score.victory_bonus == 0);

victory = {type: 'conquest', winner: local.id, turn: 600};
score = rules.get_breakdown(game, local);
test.assert(score.victory_population == 0);
test.assert(score.victory_bonus == 0);

victory = {type: 'transcendence', winner: local.id, turn: 100};
test.assert(rules.get_breakdown(game, local).victory_bonus == 1800);
victory = {type: 'economic', winner: local.id, turn: 100};
test.assert(rules.get_breakdown(game, local).victory_bonus == 1000);

configure_score(game);
callbacks.start({});
test.assert(#typeof(values.f_score_get_breakdown) == 'Callable');
test.assert(values.f_score_get_breakdown(local).total == 1104);
