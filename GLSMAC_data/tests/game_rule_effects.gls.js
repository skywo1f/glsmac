const technologies = #include('../default/technologies');
const facilities = #include('../default/facilities');
const base_capture = #include('../default/game/base_capture');
const declare_victory = #include('../default/game/event/declare_victory');
const corner_market = #include('../default/game/event/corner_global_energy_market');

const rules_game = (changes) => {
	let rules = {
		allow_transcendence_victory: true,
		allow_conquest_victory: true,
		allow_diplomatic_victory: true,
		allow_economic_victory: true,
		allow_cooperative_victory: false,
		tech_stagnation: false,
		spoils_of_war: true,
		unity_survey: false,
		random_events: true,
	};
	for (key in changes) {
		rules[key] = changes[key];
	}
	return {get_settings: () => { return {global: {rules: rules}}; }};
};

test.assert(technologies.apply_research_rate(rules_game({}), 11) == 11);
test.assert(technologies.apply_research_rate(rules_game({tech_stagnation: true}), 11) == 11);
test.assert(technologies.apply_research_rate(rules_game({tech_stagnation: true}), 1) == 1);
test.assert(technologies.apply_research_rate(rules_game({tech_stagnation: true}), 0) == 0);

let disabled_facilities = [];
const disabled_transcendence = rules_game({allow_transcendence_victory: false});
disabled_transcendence.event = (name, data) => { disabled_facilities :+data.id; };
facilities.define(disabled_transcendence);
for (id of disabled_facilities) {
	test.assert(id != 'TheAscentToTranscendence');
}
let enabled_facilities = [];
const enabled_transcendence = rules_game({allow_transcendence_victory: true});
enabled_transcendence.event = (name, data) => { enabled_facilities :+data.id; };
facilities.define(enabled_transcendence);
test.assert(enabled_facilities[#sizeof(enabled_facilities) - 1] == 'TheAscentToTranscendence');

let disabled_conquest = rules_game({allow_conquest_victory: false});
disabled_conquest.is_game_over = () => { return false; };
const disabled_victory_event = {
	caller: 0,
	game: disabled_conquest,
	data: {type: 'conquest', winner_id: 1},
};
test.assert(declare_victory.validate(disabled_victory_event) ==
	'This victory condition is disabled by the game rules');

let disabled_economic = rules_game({allow_economic_victory: false});
const disabled_market_event = {caller: 1, game: disabled_economic, data: {player: {}}};
test.assert(corner_market.validate(disabled_market_event) ==
	'Economic victory is disabled by the game rules');

let winner_state = {technologies: ['Biogenetics'], target: 'IndustrialBase', progress: 4};
const copy_state = (state) => {
	let known = [];
	for (id of state.technologies) { known :+id; }
	return {technologies: known, target: state.target, progress: state.progress};
};
const winner = {
	id: 1,
	has_technology: (id) => {
		for (known of winner_state.technologies) {
			if (known == id) { return true; }
		}
		return false;
	},
	get_research_state: () => { return copy_state(winner_state); },
	set_research_state: (state) => { winner_state = copy_state(state); },
	get_faction: () => { return {name: 'Gaians'}; },
};
const loser = {
	get_research_state: () => {
		return {technologies: ['Biogenetics', 'AppliedPhysics'], target: '', progress: 0};
	},
};
let research_updates = 0;
let message = '';
const spoils_game = rules_game({spoils_of_war: true});
spoils_game.get = (name) => {
	if (name == 'f_diplomacy_grant_technology') {
		return (player, id) => {
			const state = player.get_research_state();
			state.technologies :+id;
			player.set_research_state(state);
			return true;
		};
	}
	if (name == 'f_technology_get_definition') {
		return (id) => { return {name: 'Applied Physics'}; };
	}
	return #undefined;
};
spoils_game.trigger = (name, data) => { research_updates++; };
spoils_game.message = (value) => { message = value; };

const spoils = base_capture.apply_spoils_of_war(spoils_game, winner, loser);
test.assert(#is_defined(spoils));
test.assert(winner.has_technology('AppliedPhysics'));
test.assert(research_updates == 1);
test.assert(message == 'Gaians captured research data for Applied Physics.');
base_capture.rollback_spoils_of_war(spoils_game, spoils);
test.assert(!winner.has_technology('AppliedPhysics'));
test.assert(winner_state.target == 'IndustrialBase');
test.assert(winner_state.progress == 4);
test.assert(research_updates == 2);

const no_spoils_game = rules_game({spoils_of_war: false});
test.assert(!#is_defined(base_capture.apply_spoils_of_war(no_spoils_game, winner, loser)));
