const get_unavailable_reason = (unit) => {
	if (#is_defined(unit.order) && unit.order != 'none') {
		return 'Activate the unit before issuing another order';
	}
	return null;
};

return {
	get_unavailable_reason: get_unavailable_reason,
};
