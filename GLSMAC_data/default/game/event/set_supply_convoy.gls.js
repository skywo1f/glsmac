const supply_rules = #include('../supply_rules');

return {
	validate: (e) => {
		return supply_rules.get_order_error(
			e.game,
			e.data.unit,
			e.caller,
			e.data.resource
		);
	},

	resolve: (e) => {
		return {resource: '' + e.data.resource};
	},

	apply: (e) => {
		const unit = e.data.unit;
		const result = {
			convoy_resource: '' + unit.convoy_resource,
			movement: unit.movement + 0.0,
			moved_this_turn: unit.moved_this_turn == true,
		};
		unit.set_convoy_resource(e.resolved.resource);
		if (e.resolved.resource != 'none') {
			unit.movement = 0.0;
			unit.moved_this_turn = true;
		}
		return result;
	},

	rollback: (e) => {
		const unit = e.data.unit;
		unit.set_convoy_resource(e.applied.convoy_resource);
		unit.movement = e.applied.movement;
		unit.moved_this_turn = e.applied.moved_this_turn;
	},
};
