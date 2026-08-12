const MIN_DAMAGE_VALUE = 0.1;
const MAX_DAMAGE_VALUE = 0.3;
const MIN_BOMBARDMENT_HEALTH = 0.1;
const NERVE_GAS_SANCTION_YEARS = 10;
const MAX_MAJOR_ATROCITIES = 1000000;
const combat_rules = #include('../combat_rules');
const visibility_rules = #include('../visibility_rules');
const native_capture = #include('../native_capture');
const entity_snapshots = #include('../entity_snapshots');
const snapshot_unit = entity_snapshots.snapshot_unit;

const is_un_charter_active = (game) => {
	const is_repealed = game.get('f_council_is_un_charter_repealed');
	return !#is_defined(is_repealed) || !is_repealed();
};

const remove_base_population = (game, base, count) => {
	let removed = [];
	const old_nutrients = base.get('accumulated_nutrients');
	game.get('f_base_reset_nutrients')(game, base);
	for (let i = 0; i < count; i++) {
		const pops = base.get_pops();
		const pop = pops[#sizeof(pops) - 1];
		const worked_tile = pop.get('worked_tile');
		removed :+{type: pop.get_type(), worked_tile: worked_tile};
		if (#is_defined(worked_tile)) {
			game.get('f_base_pop_unwork_tile')(base, pop);
		}
		base.destroy_pop(pop);
	}
	return {pops: removed, nutrients: old_nutrients};
};

const restore_base_population = (game, base, snapshot) => {
	for (let i = #sizeof(snapshot.pops) - 1; i >= 0; i--) {
		const pop = base.create_pop({type: snapshot.pops[i].type});
		if (#is_defined(snapshot.pops[i].worked_tile)) {
			game.get('f_base_pop_work_tile')(base, pop, snapshot.pops[i].worked_tile);
		}
	}
	base.set('accumulated_nutrients', snapshot.nutrients);
};

const refresh_base_psych = (game, base) => {
	const get_psych = game.get('f_economy_get_base_psych');
	const process_psych = game.get('f_base_process_psych');
	if (#is_defined(get_psych) && #is_defined(process_psych)) {
		process_psych(game, base, get_psych(game, base));
	}
};

const restore_unit = (e, backup) => {
	let unit = null;
	if (e.game.um.has_unit(backup.id)) {
		unit = e.game.um.get_unit(backup.id);
	} else {
		unit = entity_snapshots.spawn_unit_snapshot(e.game, backup);
	}
	unit.set_terraforming_order(backup.terraforming, backup.terraforming_turns_remaining);
	unit.set_fuel(backup.fuel);
	if (#is_defined(unit.set_convoy_resource)) {
		unit.set_convoy_resource(backup.convoy_resource);
	}
	unit.movement = backup.movement;
	unit.morale = backup.morale;
	unit.health = backup.health;
	unit.moved_this_turn = backup.moved_this_turn;
	unit.native_capture_attempted = backup.native_capture_attempted;
	unit.airdropped_this_turn = backup.airdropped_this_turn;
	unit.monolith_upgraded = #is_defined(backup.monolith_upgraded)
		? backup.monolith_upgraded : false;
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
		if (!visibility_rules.can_target(
			e.game,
			e.caller,
			e.data.attacker,
			e.data.defender
		)) {
			return 'Concealed unit has not been detected';
		}
		if (!combat_rules.can_attack_target(e.data.attacker, e.data.defender)) {
			if (
				combat_rules.is_air_unit_in_flight(e.data.defender) &&
				!combat_rules.has_ability(attacker_def, 'AirSuperiority')
			) {
				return 'Only units with Air Superiority can attack air units in flight';
			}
			if (
				#is_defined(e.data.attacker.transport_id) &&
				e.data.attacker.transport_id > 0
			) {
				return 'Only units with Amphibious Pods can attack from a transport';
			}
			if (e.data.attacker.is_land) {
				return 'Only units with Amphibious Pods can attack across a coastline';
			}
			return 'Water units can only attack land tiles containing a base';
		}

		if (attacker_def.offense <= 0) {
			return 'Noncombat units cannot attack';
		}
		if (combat_rules.has_ability(attacker_def, 'NerveGasPods')) {
			let atrocity_defender = e.data.defender;
			if (#is_defined(defender_tile.get_units)) {
				const selected = combat_rules.get_best_defender(
					e.data.attacker,
					defender_tile,
					e.game
				);
				if (selected != null) {
					atrocity_defender = selected;
				}
			}
			if (
				combat_rules.is_nerve_gas_attack(e.data.attacker, atrocity_defender) &&
				e.game.get_player(e.caller).get_major_atrocities() >= MAX_MAJOR_ATROCITIES
			) {
				return 'Major atrocity limit has been reached';
			}
		}

	},

	resolve: (e) => {
		const attacker = e.data.attacker;
		const target_tile = #is_defined(e.data.defender.get_tile)
			? e.data.defender.get_tile()
			: null;
		const selected_defender = target_tile != null && #is_defined(target_tile.get_units)
			? combat_rules.get_best_defender(attacker, target_tile, e.game)
			: null;
		const defender = selected_defender == null ? e.data.defender : selected_defender;
		const attacker_is_artillery = combat_rules.is_artillery(attacker.get_def());
		const defender_is_artillery = combat_rules.is_artillery(defender.get_def());
		const nerve_gas = combat_rules.is_nerve_gas_attack(attacker, defender);
		const capture = native_capture.resolve(e.game, attacker, defender);

		if (capture.captured) {
			return {
				defender_id: defender.id,
				sequence: [],
				attacker_dead: false,
				defender_dead: false,
				advance_after_combat: combat_rules.can_advance_after_combat(
					attacker,
					target_tile
				),
				native_capture: capture,
				nerve_gas: nerve_gas,
			};
		}

		if (attacker_is_artillery && !defender_is_artillery) {
			const powers = combat_rules.get_artillery_powers(attacker, defender);
			let damage_sequence = [];
			const combat_roll = e.game.random.get_float(0.0, powers.attack + powers.defence);
			if (combat_roll < powers.attack && defender.health > MIN_BOMBARDMENT_HEALTH) {
				const maximum_damage = defender.health - MIN_BOMBARDMENT_HEALTH;
				const damage = #min(
					maximum_damage,
					combat_rules.get_damage(
						defender,
						e.game.random.get_float(MIN_DAMAGE_VALUE, MAX_DAMAGE_VALUE)
					)
				);
				damage_sequence [] = [true, damage];
			}
			return {
				defender_id: defender.id,
				sequence: damage_sequence,
				attacker_dead: false,
				defender_dead: false,
				advance_after_combat: false,
				native_capture: capture,
				nerve_gas: nerve_gas,
			};
		}

		const powers = attacker_is_artillery
			? combat_rules.get_artillery_powers(attacker, defender)
			: combat_rules.get_combat_powers(attacker, defender, e.game);
		const attack_power = powers.attack;
		const defence_power = powers.defence;

		let attacker_health = attacker.health;
		let defender_health = defender.health;

		let damage_sequence = [];
		while (attacker_health > 0.0 && defender_health > 0.0) {
			const combat_roll = e.game.random.get_float(0.0, attack_power + defence_power);
			if (combat_roll < attack_power) {
				let damage = #min(
					defender_health,
					combat_rules.get_damage(
						defender,
						e.game.random.get_float(MIN_DAMAGE_VALUE, MAX_DAMAGE_VALUE)
					)
				);
				damage_sequence [] = [true, damage];
				defender_health -= damage;
			}
			else {
				let damage = #min(
					attacker_health,
					combat_rules.get_damage(
						attacker,
						e.game.random.get_float(MIN_DAMAGE_VALUE, MAX_DAMAGE_VALUE)
					)
				);
				damage_sequence [] = [false, damage];
				attacker_health -= damage;
			}
		}
		return {
			defender_id: defender.id,
			sequence: damage_sequence,
			attacker_dead: attacker_health <= 0.0,
			defender_dead: defender_health <= 0.0,
			advance_after_combat:
				!attacker_is_artillery &&
				combat_rules.can_advance_after_combat(attacker, target_tile) &&
				(
					target_tile == null || target_tile.get_base() == null ||
					#typeof(attacker.get_owner) != 'Callable' ||
					attacker.get_owner().type != 'native'
				),
			native_capture: capture,
			nerve_gas: nerve_gas,
		};
	},

	apply: (e) => {
		const attacker = e.data.attacker;
		const defender = #is_defined(e.resolved.defender_id) &&
			#is_defined(e.game.um) && e.game.um.has_unit(e.resolved.defender_id)
			? e.game.um.get_unit(e.resolved.defender_id)
			: e.data.defender;
		let attacker_tile = attacker.get_tile();
		let defender_tile = defender.get_tile();
		const attacker_def = attacker.get_def();
		const attacker_is_missile =
			#is_defined(attacker_def.is_missile) && attacker_def.is_missile;
		const attacker_destroyed = e.resolved.attacker_dead || attacker_is_missile;
		const capture = #is_defined(e.resolved.native_capture)
			? e.resolved.native_capture : null;
		const nerve_gas = #is_defined(e.resolved.nerve_gas)
			? e.resolved.nerve_gas
			: combat_rules.is_nerve_gas_attack(attacker, defender);

		let applied = {
			backup: {
				attacker: snapshot_unit(attacker),
				defender: snapshot_unit(defender),
			},
		};
		const attacker_owner = e.game.get_player(attacker.owner);
		const defender_owner = e.game.get_player(defender.owner);
		if (nerve_gas) {
			applied.nerve_gas = {
				actor_atrocities: attacker_owner.get_major_atrocities(),
				actor_sanction_turns: attacker_owner.get_sanction_turns(),
				population_loss: 0,
				rehomed_units: [],
			};
			attacker_owner.set_major_atrocities(applied.nerve_gas.actor_atrocities + 1);
			if (is_un_charter_active(e.game)) {
				attacker_owner.set_sanction_turns(#min(
					MAX_MAJOR_ATROCITIES,
					applied.nerve_gas.actor_sanction_turns + NERVE_GAS_SANCTION_YEARS
				));
				e.game.trigger('diplomatic_sanctions_updated', {
					player: attacker_owner,
					turns: attacker_owner.get_sanction_turns(),
				});
				e.game.message(
					'Economic sanctions imposed against ' + attacker_owner.name +
					' for 10 years.'
				);
			}
		}
		if (
			attacker_owner.id != defender_owner.id &&
			attacker_owner.type != 'native' && defender_owner.type != 'native' &&
			#typeof(attacker_owner.get_diplomatic_relation) == 'Callable'
		) {
			applied.diplomacy = e.game.get('f_diplomacy_snapshot_pair')(attacker_owner, defender_owner);
			e.game.get('f_diplomacy_set_bilateral_relation')(attacker_owner, defender_owner, 'vendetta');
			e.game.get('f_diplomacy_clear_offers')(attacker_owner, defender_owner);
			e.game.trigger('diplomacy_updated', {
				player: attacker_owner,
				target: defender_owner,
				relation: 'vendetta',
			});
		}

		attacker.movement = #max(0.0, attacker.movement - 1.0);
		attacker.moved_this_turn = true;

		if (capture != null && capture.captured) {
			const captured_name = #is_defined(defender.get_def().name)
				? defender.get_def().name : defender.get_def().id;
			applied.native_capture = native_capture.apply(
				e.game,
				attacker_owner,
				defender_tile,
				capture
			);
			const advance = () => {
				if (e.game.is_master() && e.game.um.has_unit(attacker.id)) {
					e.game.event('advance_unit_after_combat', {
						unit: e.game.um.get_unit(attacker.id),
						tile: defender_tile,
						animations_id: applied.animations_id,
					});
				}
			};
			applied.animations_id = e.game.am.show_animations([{
				id: 'ATTACK_PSI',
				tile: defender_tile,
				oncomplete: advance,
			}]);
			e.game.trigger('native_life_captured', {
				player: attacker_owner,
				unit_ids: capture.unit_ids,
			});
			e.game.message(
				attacker_owner.name + ' captured ' + captured_name +
					' through its affinity with Planet.'
			);
			return applied;
		}

		if (capture != null && capture.mark_attempted) {
			defender.native_capture_attempted = true;
		}
		if (capture != null && capture.attempted) {
			e.game.message(capture.reason == 'agitated'
				? 'The native life is too agitated by ecological damage to be captured.'
				: 'The attempt to capture the native life failed.');
		}

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
		if (attacker_destroyed) {
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
			if (!attacker_destroyed && advance_after_combat) {
				death_animation.oncomplete = () => {
					if (e.game.is_master()) {
						if (#is_defined(defender_tile.get_units)) {
							for (other of defender_tile.get_units()) {
								if (other.owner != attacker.owner && other.health > 0.0) {
									return;
								}
							}
						}
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
		if (attacker_destroyed) {
			attacker.health = 0.0;
		}
		if (e.resolved.defender_dead) {
			defender.health = 0.0;
		}
		if (!attacker_destroyed && e.resolved.defender_dead) {
			promote_unit(e.game.um, attacker);
		}
		if (!e.resolved.defender_dead && e.resolved.attacker_dead) {
			promote_unit(e.game.um, defender);
		}
		if (nerve_gas && e.resolved.defender_dead) {
			const base = defender_tile.get_base();
			if (base != null && base.get_owner().id == defender.owner) {
				const size = base.get_size();
				const population_loss = size - #floor(#to_float(size) / 2.0);
				applied.nerve_gas.population_loss = population_loss;
				applied.nerve_gas.base_id = base.id;
				applied.nerve_gas.base_name = base.name;
				if (size == 1) {
					applied.nerve_gas.destroyed_base = e.game.bm.snapshot_base(base);
					e.game.bm.despawn_base(base.id);
					applied.nerve_gas.rehomed_units =
						entity_snapshots.rehome_surviving_units(
							e.game,
							[{id: base.id}],
							defender.id
						);
					e.game.message(
						applied.nerve_gas.base_name + ' was destroyed by nerve gas.'
					);
				} else {
					applied.nerve_gas.base = base;
					applied.nerve_gas.population = remove_base_population(
						e.game,
						base,
						population_loss
					);
					refresh_base_psych(e.game, base);
					e.game.trigger('update_base', {base: base});
					e.game.message(
						base.name + ' lost ' + #to_string(population_loss) +
						' population to nerve gas.'
					);
				}
			}
		}
		if (nerve_gas) {
			e.game.trigger('nerve_gas_used', {
				player: attacker_owner,
				target: defender_owner,
				attacker: attacker,
				defender: defender,
				population_loss: applied.nerve_gas.population_loss,
			});
			e.game.message(attacker_owner.name + ' committed a nerve gas atrocity.');
		}
		if (e.game.is_master()) {
			if (attacker_destroyed) {
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
		if (#is_defined(a.native_capture)) {
			native_capture.rollback(e.game, a.native_capture);
			restore_unit(e, a.backup.attacker);
			return;
		}
		if (#is_defined(a.nerve_gas)) {
			if (#is_defined(a.nerve_gas.destroyed_base)) {
				e.game.bm.restore_base(a.nerve_gas.destroyed_base);
			} else if (#is_defined(a.nerve_gas.population)) {
				restore_base_population(
					e.game,
					a.nerve_gas.base,
					a.nerve_gas.population
				);
				refresh_base_psych(e.game, a.nerve_gas.base);
				e.game.trigger('update_base', {base: a.nerve_gas.base});
			}
		}
		restore_unit(e, a.backup.attacker);
		restore_unit(e, a.backup.defender);
		if (#is_defined(a.nerve_gas)) {
			entity_snapshots.restore_rehomed_units(e.game, a.nerve_gas.rehomed_units);
			const attacker_owner = e.game.get_player(a.backup.attacker.owner);
			attacker_owner.set_major_atrocities(a.nerve_gas.actor_atrocities);
			attacker_owner.set_sanction_turns(a.nerve_gas.actor_sanction_turns);
			e.game.trigger('diplomatic_sanctions_updated', {
				player: attacker_owner,
				turns: a.nerve_gas.actor_sanction_turns,
			});
		}
		if (#is_defined(a.diplomacy)) {
			const attacker_owner = e.game.get_player(a.backup.attacker.owner);
			const defender_owner = e.game.get_player(a.backup.defender.owner);
			e.game.get('f_diplomacy_restore_pair')(attacker_owner, defender_owner, a.diplomacy);
			e.game.trigger('diplomacy_updated', {
				player: attacker_owner,
				target: defender_owner,
				relation: a.diplomacy.player_relation,
			});
		}
	},

};
