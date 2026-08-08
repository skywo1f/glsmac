const terraforming = #include('terraforming');

const get_repair = (unit, def) => {
	if (unit.moved_this_turn || unit.terraforming != 'none' || unit.health >= def.health_max) {
		return 0.0;
	}
	let repair = def.health_per_turn;
	const base = unit.get_tile().get_base();
	if (base != null && base.get_owner().id == unit.owner) {
		repair *= 2.0;
	}
	return #min(repair, def.health_max - unit.health);
};

const result = {
	get_repair: get_repair,

	configure: (game) => {

		const um = game.get_um();

		um.on('unit_turn', (e) => {
			const def = e.unit.get_def();
			const repair = get_repair(e.unit, def);
			if (repair > 0.0) {
				e.unit.health = e.unit.health + repair;
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
