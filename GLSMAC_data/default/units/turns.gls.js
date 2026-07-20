const terraforming = #include('terraforming');

const result = {

	configure: (game) => {

		const um = game.get_um();

		um.on('unit_turn', (e) => {
			const def = e.unit.get_def();
			if (!e.unit.moved_this_turn) {
				if (e.unit.health < def.health_max) {
					e.unit.health = #min(e.unit.health + def.health_per_turn, def.health_max);
				}
			}
			let is_still_terraforming = false;
			if (e.unit.terraforming != 'none') {
				is_still_terraforming = terraforming.advance_order(e.unit);
			}
			if (!def.is_immovable && !is_still_terraforming) {
				e.unit.movement = def.movement_per_turn;
			}
		});

	},
};

return result;
