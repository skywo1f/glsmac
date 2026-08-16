const unit_order_rules = #include('../default/game/unit_order_rules');

test.assert(unit_order_rules.get_unavailable_reason({}) == null);
test.assert(unit_order_rules.get_unavailable_reason({order: 'none'}) == null);
test.assert(
	unit_order_rules.get_unavailable_reason({order: 'hold'}) ==
	'Activate the unit before issuing another order'
);
