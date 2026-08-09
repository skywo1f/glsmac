const terraforming = #include('terraforming');
const air = #include('air');

const get_repair = (unit, def, project_effects) => {
	if (unit.moved_this_turn || unit.terraforming != 'none' || unit.health >= def.health_max) {
		return 0.0;
	}
	if (#is_defined(project_effects) && project_effects.full_repair) {
		return def.health_max - unit.health;
	}
	let repair = def.health_per_turn;
	const base = unit.get_tile().get_base();
	if (base != null && base.get_owner().id == unit.owner) {
		repair *= 2.0;
	}
	return #min(repair, def.health_max - unit.health);
};

const get_movement = (unit, def, project_effects) => {
	return def.movement_per_turn + (
		#is_defined(project_effects) && unit.is_water && !def.is_native
			? project_effects.naval_movement_bonus
			: 0.0
	);
};

const result = {
	get_repair: get_repair,
	get_movement: get_movement,
	get_air_turn_state: air.get_turn_state,

	configure: (game) => {

		const um = game.get_um();

		um.on('unit_turn', (e) => {
			const def = e.unit.get_def();
			const air_state = air.get_turn_state(e.unit, def);
			if (e.unit.fuel != air_state.fuel) {
				e.unit.set_fuel(air_state.fuel);
			}
			if (air_state.damage > 0.0) {
				e.unit.health = #max(0.0, e.unit.health - air_state.damage);
			}
			if (air_state.crash || (air_state.damage > 0.0 && e.unit.health <= 0.0)) {
				e.unit.movement = 0.0;
				if (game.is_master()) {
					game.event('despawn_unit', {unit: e.unit});
				}
				return;
			}
			const get_project_effects = #is_defined(game.get)
				? game.get('f_project_get_player_effects')
				: #undefined;
			const project_effects = #is_defined(get_project_effects)
				? get_project_effects(e.unit.get_owner())
				: {naval_movement_bonus: 0.0, full_repair: false};
			const repair = air_state.damage > 0.0
				? 0.0
				: get_repair(e.unit, def, project_effects);
			if (repair > 0.0) {
				e.unit.health = e.unit.health + repair;
			}
			let is_still_terraforming = false;
			if (e.unit.terraforming != 'none') {
				is_still_terraforming = terraforming.advance_order(e.unit);
			}
			if (!def.is_immovable && !is_still_terraforming) {
				e.unit.movement = get_movement(e.unit, def, project_effects);
			}
		});

	},
};

return result;
