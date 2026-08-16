const game_rules = #include('../default/game/game_rules');
const game_settings = #include('../default/game/event/game_settings');
const select_rules = #include('../default/ui/parts/mainmenu/steps/select_rules');
const customize_rules = #include('../default/ui/parts/mainmenu/steps/customize_rules');

test.assert(#sizeof(game_rules.definitions) == 9);
test.assert(game_rules.defaults.allow_conquest_victory);
test.assert(!game_rules.defaults.allow_cooperative_victory);
test.assert(game_rules.defaults.spoils_of_war);
test.assert(!game_rules.defaults.tech_stagnation);
test.assert(!game_rules.defaults.unity_survey);
test.assert(game_rules.get({}, 'random_events'));

const explicit_game = {
	get_settings: () => {
		return {global: {rules: {random_events: false}}};
	},
};
test.assert(!game_rules.get(explicit_game, 'random_events'));

let ready = true;
const settings = {
	global: {
		map: {size_x: 40, size_y: 20},
		rules: {
			allow_transcendence_victory: true,
			allow_conquest_victory: true,
			allow_diplomatic_victory: true,
			allow_economic_victory: true,
			allow_cooperative_victory: false,
			tech_stagnation: false,
			spoils_of_war: true,
			unity_survey: false,
			random_events: true,
		},
	},
};
const settings_player = {
	id: 0,
	is_ready: () => { return ready; },
	set_ready: (value) => { ready = value; },
};
let triggered = null;
const settings_game = {
	is_started: () => { return false; },
	get_settings: () => { return settings; },
	get_players: () => { return [settings_player]; },
	get_player: (id) => { return settings_player; },
	trigger: (name, data) => { triggered = data.settings; },
};
const event = {
	caller: 0,
	game: settings_game,
	data: {changes: [
		['tech_stagnation', true],
		['spoils_of_war', false],
	]},
};

test.assert(!#is_defined(game_settings.validate(event)));
event.data.changes = [['tech_stagnation', 1]];
test.assert(#is_defined(game_settings.validate(event)));
event.data.changes = [
	['tech_stagnation', true],
	['spoils_of_war', false],
];
event.applied = game_settings.apply(event);
test.assert(settings.global.rules.tech_stagnation);
test.assert(!settings.global.rules.spoils_of_war);
test.assert(!ready);
test.assert(triggered == event.data.changes);
game_settings.rollback(event);
test.assert(!settings.global.rules.tech_stagnation);
test.assert(settings.global.rules.spoils_of_war);
test.assert(ready);

let menu = null;
let faction_selections = 0;
let customizations = 0;
const ui = {
	settings: settings,
	sliding: {show: (value) => { menu = value; }},
	steps: {
		select_faction: (i) => { faction_selections++; },
		customize_rules: (i) => { customizations++; },
	},
};
settings.global.rules.tech_stagnation = true;
settings.global.rules.random_events = false;
settings.global.rules.allow_cooperative_victory = true;
select_rules(ui);
test.assert(menu.title == 'Game rules');
menu.entries[1][1]();
test.assert(settings.global.rules.tech_stagnation);
test.assert(faction_selections == 1);
select_rules(ui);
menu.entries[0][1]();
test.assert(!ui.settings.global.rules.tech_stagnation);
test.assert(ui.settings.global.rules.random_events);
test.assert(!ui.settings.global.rules.allow_cooperative_victory);
test.assert(faction_selections == 2);
select_rules(ui);
menu.entries[2][1]();
test.assert(customizations == 1);

customize_rules(ui);
test.assert(menu.title == 'Customize Game Rules');
test.assert(#sizeof(menu.entries) == 10);
test.assert(menu.entries[4][0] == '[ ] One for All: Cooperative Victory');
test.assert(menu.entries[5][0] == '[ ] Tech Stagnation');
menu.entries[5][1]();
test.assert(menu.entries[5][0] == '[X] Tech Stagnation');
menu.entries[9][1]();
test.assert(faction_selections == 3);
