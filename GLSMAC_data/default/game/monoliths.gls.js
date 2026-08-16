const messages = #include('message_rules');

const can_upgrade = (unit) => {
	const def = unit.get_def();
	return (
		!unit.monolith_upgraded && unit.morale < 6 &&
		#is_defined(def.offense) && def.offense != 0
	);
};

const apply = (game, unit) => {
	const snapshot = {
		unit_id: #is_defined(unit.id) ? unit.id + 0 : 0,
		health: unit.health + 0.0,
		morale: unit.morale + 0,
		monolith_upgraded: unit.monolith_upgraded == true,
	};
	const upgraded = can_upgrade(unit);
	const repaired = unit.health < 1.0;
	unit.health = 1.0;
	if (upgraded) {
		unit.morale = unit.morale + 1;
		unit.monolith_upgraded = true;
	}
	if (upgraded && repaired) {
		messages.to_player(
			game,
			unit.get_owner(),
			'The monolith repaired and upgraded ' + unit.get_def().name + '.'
		);
	} else if (upgraded) {
		messages.to_player(
			game,
			unit.get_owner(),
			'The monolith upgraded ' + unit.get_def().name + '.'
		);
	} else if (repaired) {
		messages.to_player(
			game,
			unit.get_owner(),
			'The monolith repaired ' + unit.get_def().name + '.'
		);
	}
	return snapshot;
};

const rollback = (snapshot, unit) => {
	unit.health = snapshot.health;
	unit.morale = snapshot.morale;
	unit.monolith_upgraded = snapshot.monolith_upgraded;
};

return {
	can_upgrade: can_upgrade,
	apply: apply,
	rollback: rollback,
};
