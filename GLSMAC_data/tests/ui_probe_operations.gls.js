const popup = #include('../default/ui/parts/game/popup/probe_operations');
const intelligence = #include('../default/ui/parts/game/popup/intelligence_report');
const diplomacy = #include('../default/ui/parts/game/popup/diplomacy');
const unit_upgrade = #include('../default/ui/parts/game/popup/unit_upgrade');
const orbital_attack = #include('../default/ui/parts/game/popup/orbital_attack');
const preview = #include('../default/ui/parts/game/bottom_bar/object_preview');

test.assert(#typeof(popup.init) == 'Callable');
test.assert(#typeof(popup.set) == 'Callable');
test.assert(#typeof(intelligence.init) == 'Callable');
test.assert(#typeof(intelligence.refresh) == 'Callable');
test.assert(#typeof(diplomacy.init) == 'Callable');
test.assert(#typeof(unit_upgrade.init) == 'Callable');
test.assert(#typeof(unit_upgrade.set) == 'Callable');
test.assert(#typeof(orbital_attack.init) == 'Callable');
test.assert(#typeof(preview.init) == 'Callable');

let observed_player_updates = 0;
const fake_popup_context = {
	game: {
		on: (event_name, callback) => {
			if (event_name == 'player_update') {
				observed_player_updates++;
			}
		},
	},
	create: (title, width, height, callback) => { return {}; },
};
intelligence.init(fake_popup_context);
diplomacy.init(fake_popup_context);
test.assert(observed_player_updates == 2);
