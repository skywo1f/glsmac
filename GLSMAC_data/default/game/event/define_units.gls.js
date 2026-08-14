return {

	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master is allowed to define units';
		}
		if (#typeof(e.data.units) != 'Array' || #sizeof(e.data.units) == 0) {
			return 'Units must be a non-empty array';
		}
		let seen = {};
		for (let i = 0; i < #sizeof(e.data.units); i++) {
			const unit = e.data.units[i];
			if (
				#typeof(unit) != 'Object' || #typeof(unit.id) != 'String' ||
				unit.id == '' || #typeof(unit.data) != 'Object'
			) {
				return 'Invalid unit definition at index ' + #to_string(i);
			}
			if (#is_defined(seen[unit.id])) {
				return 'Duplicate unit definition: ' + unit.id;
			}
			seen[unit.id] = true;
		}
	},

	apply: (e) => {
		let ids = [];
		for (unit of e.data.units) {
			e.game.um.define_unit(unit.id, unit.data);
			ids :+unit.id;
		}
		return {
			ids: ids,
		};
	},

	rollback: (e) => {
		for (let i = #sizeof(e.applied.ids) - 1; i >= 0; i--) {
			e.game.um.undefine_unit(e.applied.ids[i]);
		}
	},

};
