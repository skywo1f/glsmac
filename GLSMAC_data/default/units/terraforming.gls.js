const orders = {
	road: {
		name: 'Road',
		turns: 2,
		changes: {road: true},
	},
	forest: {
		name: 'Forest',
		turns: 4,
		changes: {forest: true, farm: false, mine: false, solar: false},
	},
	farm: {
		name: 'Farm',
		turns: 4,
		changes: {forest: false, farm: true},
	},
	mine: {
		name: 'Mine',
		turns: 8,
		changes: {forest: false, mine: true, solar: false},
	},
	solar: {
		name: 'Solar Collector',
		turns: 4,
		changes: {forest: false, solar: true, mine: false},
	},
};

const get_order = (type) => {
	if (!#is_defined(orders[type])) {
		return null;
	}
	return orders[type];
};

const advance_order = (unit) => {
	const type = unit.terraforming;
	const order = get_order(type);
	if (order == null) {
		throw Error('Unknown terraforming order: ' + type);
	}
	if (unit.terraforming_turns_remaining > 1) {
		unit.set_terraforming_order(type, unit.terraforming_turns_remaining - 1);
		unit.movement = 0.0;
		return true;
	}

	unit.get_tile().update_terraforming(order.changes);
	unit.set_terraforming_order('none', 0);
	return false;
};

return {
	orders: orders,
	get_order: get_order,
	advance_order: advance_order,
};
