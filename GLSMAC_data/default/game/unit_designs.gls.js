const rules = #include('unit_design_rules');

return (game) => {
	game.set('f_unit_design_get_options', (player) => {
		return {
			chassis: rules.get_available(player, rules.manifest.chassis),
			weapons: rules.get_available(player, rules.manifest.weapons),
			armors: rules.get_available(player, rules.manifest.armors),
			reactors: rules.get_available(player, rules.manifest.reactors),
			abilities: rules.get_available(
				player,
				rules.manifest.abilities,
				rules.supported_abilities
			),
			ability_limit: rules.get_ability_limit(player),
		};
	});
	game.set('f_unit_design_get_preview', (player, selection) => {
		return rules.get_preview(game, player, selection);
	});
	game.set('f_unit_design_get_existing', (player) => {
		let result = [];
		for (definition of game.get_um().get_unit_defs()) {
			if (definition.owner_player_id == player.id) {
				result :+{
					id: definition.id,
					name: definition.name,
					obsolete: player.is_unit_design_obsolete(definition.id),
				};
			}
		}
		return result;
	});
};
