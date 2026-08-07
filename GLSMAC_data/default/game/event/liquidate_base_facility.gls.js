return {
	validate: (e) => {
		if (e.caller != 0) {
			return 'Only master can liquidate a facility for insolvency';
		}
		if (!e.data.base.has_facility(e.data.facility_id)) {
			return 'Base does not have this facility';
		}
		const facility = e.game.get_bm().get_facility_def(e.data.facility_id);
		if (facility.energy_maintenance <= 0) {
			return 'Facility has no maintenance cost';
		}
	},

	apply: (e) => {
		e.data.base.remove_facility(e.data.facility_id);
		return {facility_id: e.data.facility_id};
	},

	rollback: (e) => {
		e.data.base.add_facility(e.applied.facility_id);
	},
};
