const MIN_DAMAGE_VALUE = 0.1;
const MAX_DAMAGE_VALUE = 0.3;
const MIN_BOMBARDMENT_HEALTH = 0.1;
const combat_rules = #include('../combat_rules');

const snapshot_unit = (unit) => {
	const tile = unit.get_tile();
	return {
		id: unit.id,
		def: unit.def,
		owner: unit.owner,
		tile_x: tile.x,
		tile_y: tile.y,
		movement: unit.movement,
		morale: unit.morale,
		health: unit.health,
		moved_this_turn: unit.moved_this_turn,
		terraforming: unit.terraforming,
		terraforming_turns_remaining: unit.terraforming_turns_remaining,
		home_base_id: unit.home_base_id,
	};
};

const restore_unit = (e, backup) => {
	let unit = null;
	if (e.game.um.has_unit(backup.id)) {
		unit = e.game.um.get_unit(backup.id);
	} else {
		unit = e.game.um.spawn_unit({
			id: backup.id,
			def: backup.def,
			owner: e.game.get_player(backup.owner),
			tile: e.game.tm.get_tile(backup.tile_x, backup.tile_y),
			morale: backup.morale,
			health: backup.health,
			terraforming: backup.terraforming,
			terraforming_turns_remaining: backup.terraforming_turns_remaining,
			home_base_id: backup.home_base_id,
		});
	}
	unit.set_terraforming_order(backup.terraforming, backup.terraforming_turns_remaining);
	unit.movement = backup.movement;
	unit.morale = backup.morale;
	unit.health = backup.health;
	unit.moved_this_turn = backup.moved_this_turn;
};

const promote_unit = (um, unit) => {
	const morale_set = um.get_moraleset(unit.get_def().morale_set);
	unit.morale = #min(unit.morale + 1, #sizeof(morale_set) - 1);
};

return {

	validate: (e) => {
		if (e.data.attacker.owner != e.caller) {
			return 'Unit can only be ordered to attack by its owner';
		}
		if (e.game.is_turn_complete(e.caller)) {
			return 'Player has already completed this turn';
		}
		if (e.data.defender.owner == e.data.attacker.owner) {
			return 'Unit cannot attack a friendly unit';
		}
		if (e.data.attacker.health <= 0.0) {
			return 'Dead unit cannot attack';
		}
		if (e.data.defender.health <= 0.0) {
			return 'Dead unit cannot be attacked';
		}

		const attacker_tile = e.data.attacker.get_tile();
		const defender_tile = e.data.defender.get_tile();

		if (attacker_tile == defender_tile) {
			return 'Attacker tile is same as defender tile';
		}

		if (attacker_tile.is_locked()) {
			return 'Attacker tile is locked';
		}
		if (defender_tile.is_locked()) {
			return 'Defender tile is locked';
		}

		if (e.data.attacker.is_immovable) {
			return 'Attacker is immovable';
		}
		if (e.data.attacker.terraforming != 'none') {
			return 'Cancel the unit\'s terraforming order before attacking';
		}
		if (e.data.attacker.movement <= 0.0) {
			return 'Attacker is out of moves';
		}
		if (attacker_tile == defender_tile) {
			return 'Defender tile is same as attacker tile';
		}
		const attacker_def = e.data.attacker.get_def();
		const attacker_is_artillery = combat_rules.is_artillery(attacker_def);
		if (!attacker_tile.is_adjactent_to(defender_tile)) {
			if (!attacker_is_artillery || e.game.tm.get_distance(attacker_tile, defender_tile) > 2) {
				return attacker_is_artillery
					? 'Defender tile is out of artillery range'
					: 'Defender tile is not adjacent to attacker tile';
			}
		}
		if (!attacker_is_artillery && e.data.attacker.is_land && defender_tile.is_water) {
			// TODO: marine
			return 'Land units can\'t attack water tiles';
		}
		if (!attacker_is_artillery && e.data.attacker.is_water && defender_tile.is_land) {
			// TODO: marine
			return 'Water units can\'t attack land tiles';
		}

		if (attacker_def.offense <= 0) {
			return 'Noncombat units cannot attack';
		}

	},

	resolve: (e) => {
		const attacker = e.data.attacker;
		const defender = e.data.defender;
		const attacker_is_artillery = combat_rules.is_artillery(attacker.get_def());
		const defender_is_artillery = combat_rules.is_artillery(defender.get_def());

		if (attacker_is_artillery && !defender_is_artillery) {
			const powers = combat_rules.get_artillery_powers(attacker, defender);
			let damage_sequence = [];
			const combat_roll = e.game.random.get_float(0.0, powers.attack + powers.defence);
			if (combat_roll < powers.attack && defender.health > MIN_BOMBARDMENT_HEALTH) {
				const maximum_damage = defender.health - MIN_BOMBARDMENT_HEALTH;
				const damage = #min(maximum_damage, e.game.random.get_float(MIN_DAMAGE_VALUE, MAX_DAMAGE_VALUE));
				damage_sequence [] = [true, damage];
			}
			return {
				sequence: damage_sequence,
				attacker_dead: false,
				defender_dead: false,
				advance_after_combat: false,
			};
		}

		const powers = attacker_is_artillery
			? combat_rules.get_artillery_powers(attacker, defender)
			: combat_rules.get_combat_powers(attacker, defender);
		const attack_power = powers.attack;
		const defence_power = powers.defence;

		let attacker_health = attacker.health;
		let defender_health = defender.health;

		let damage_sequence = [];
		while (attacker_health > 0.0 && defender_health > 0.0) {
			const combat_roll = e.game.random.get_float(0.0, attack_power + defence_power);
			if (combat_roll < attack_power) {
				let damage = #min(defender_health, e.game.random.get_float(MIN_DAMAGE_VALUE, MAX_DAMAGE_VALUE));
				damage_sequence [] = [true, damage];
				defender_health -= damage;
			}
			else {
				let damage = #min(attacker_health, e.game.random.get_float(MIN_DAMAGE_VALUE, MAX_DAMAGE_VALUE));
				damage_sequence [] = [false, damage];
				attacker_health -= damage;
			}
		}
		return {
			sequence: damage_sequence,
			attacker_dead: attacker_health <= 0.0,
			defender_dead: defender_health <= 0.0,
			advance_after_combat: !attacker_is_artillery,
		};
	},

	apply: (e) => {
		const attacker = e.data.attacker;
		const defender = e.data.defender;
		let attacker_tile = attacker.get_tile();
		let defender_tile = defender.get_tile();

		let applied = {
			backup: {
				attacker: snapshot_unit(attacker),
				defender: snapshot_unit(defender),
			},
		};

		attacker.movement = #max(0.0, attacker.movement - 1.0);
		attacker.moved_this_turn = true;

		let animations = [];
		for (step of e.resolved.sequence) {
			if (step[0]) {
				animations :+{
					id: 'ATTACK_PSI',
					tile: defender_tile,
				};
			}
			else {
				animations :+{
					id: 'ATTACK_PSI',
					tile: attacker_tile,
				};
			}
		}
		if (e.resolved.attacker_dead) {
			animations :+{
				id: 'DEATH_PSI',
				tile: attacker_tile,
			};
		}
		if (e.resolved.defender_dead) {
			let death_animation = {
				id: 'DEATH_PSI',
				tile: defender_tile,
			};
			let advance_after_combat = true;
			if (#is_defined(e.resolved.advance_after_combat)) {
				advance_after_combat = e.resolved.advance_after_combat;
			}
			if (!e.resolved.attacker_dead && advance_after_combat) {
				death_animation.oncomplete = () => {
					if (e.game.is_master()) {
						e.game.event('advance_unit_after_combat', {
							unit: attacker,
							tile: defender_tile,
							animations_id: applied.animations_id,
						});
					}
				};
			}
			animations :+death_animation;
		}

		applied.animations_id = e.game.am.show_animations(animations);
		for (step of e.resolved.sequence) {
			if (step[0]) {
				defender.health = #max(0.0, defender.health - step[1]);
			}
			else {
				attacker.health = #max(0.0, attacker.health - step[1]);
			}
		}
		if (e.resolved.attacker_dead) {
			attacker.health = 0.0;
		}
		if (e.resolved.defender_dead) {
			defender.health = 0.0;
		}
		if (!e.resolved.attacker_dead && e.resolved.defender_dead) {
			promote_unit(e.game.um, attacker);
		}
		if (!e.resolved.defender_dead && e.resolved.attacker_dead) {
			promote_unit(e.game.um, defender);
		}
		if (e.game.is_master()) {
			if (e.resolved.attacker_dead) {
				e.game.event('despawn_unit', {unit: attacker});
			}
			if (e.resolved.defender_dead) {
				e.game.event('despawn_unit', {unit: defender});
			}
		}

		return applied;
	},

	rollback: (e) => {
		const a = e.applied;
		e.game.am.stop_animations(a.animations_id);
		restore_unit(e, a.backup.attacker);
		restore_unit(e, a.backup.defender);
	},

};
