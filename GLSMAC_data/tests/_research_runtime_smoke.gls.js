#main((glsmac) => {

	#include('../default/game/game')(glsmac);
	#include('../default/ui/ui')(glsmac);

	const technologies = #include('../default/technologies');
	const facility_catalog = #include('../default/facilities');
	let production_gates = [
		['unit', 'Former', 'CentauriEcology'],
		['unit', 'ReconRover', 'DoctrineMobility'],
		['unit', 'LaserInfantry', 'AppliedPhysics'],
		['unit', 'SynthmetalSentinels', 'IndustrialBase'],
	];
	let facility_ids = [];
	let project_ids = [];
	for (entry of facility_catalog.definitions) {
		const kind = entry.data.is_project ? 'project' : 'facility';
		if (entry.data.is_project) {
			project_ids :+entry.id;
		} else {
			facility_ids :+entry.id;
		}
		production_gates :+[kind, entry.id, entry.data.required_technology];
	}

	let runtime_complete = false;
	let ui_started = false;
	let exit_scheduled = false;

	const fail = (message) => {
		#print('RESEARCH_RUNTIME_FAIL: ' + message);
		glsmac.exit();
	};

	const finish_if_ready = () => {
		if (runtime_complete && ui_started && !exit_scheduled) {
			exit_scheduled = true;
			#print(
				'RESEARCH_RUNTIME_PASS: validated 77 technologies, 31 facilities, 33 projects, and batch production gates'
			);
			#async(500, () => { glsmac.exit(); });
		}
	};

	glsmac.on('configure_game', (e) => {
		const game = e.game;

		game.on('start_ui', (e) => {
			ui_started = true;
			finish_if_ready();
		});

		game.on('turn', (e) => {
			const turn_id = e.year - 2100;
			const player = game.get_player();
			let base = null;
			for (candidate of game.get_bm().get_bases()) {
				if (candidate.get_owner().id == player.id) {
					base = candidate;
					break;
				}
			}
			if (base == null) {
				fail('player base is missing');
				return;
			}

			if (turn_id == 1) {
				let catalog_count = 0;
				for (technology_id of technologies.order) {
					const definition = game.get('f_technology_get_definition')(technology_id);
					if (
						definition == null ||
						definition.id != technology_id ||
						definition.name == '' ||
						definition.cost <= 0
					) {
						fail('technology definition is invalid: ' + technology_id);
						return;
					}
					catalog_count++;
				}
				if (catalog_count != 77) {
					fail('technology catalog count is ' + #to_string(catalog_count));
					return;
				}

				const state = player.get_research_state();
				if (
					player.get_faction().id != 'GAIANS' ||
					state.technologies != ['CentauriEcology'] ||
					state.target != 'Biogenetics' ||
					state.progress != 0
				) {
					fail('initial Gaian research state is invalid');
					return;
				}
				for (gate of production_gates) {
					const should_be_available = gate[2] == '' || gate[2] == 'CentauriEcology';
					if (base.can_set_production(gate[0], gate[1]) != should_be_available) {
						fail('initial production gate is invalid: ' + gate[1]);
						return;
					}
				}

				const biogenetics = game.get('f_technology_get_definition')('Biogenetics');
				player.set_research_state({
					technologies: ['CentauriEcology'],
					target: 'Biogenetics',
					progress: biogenetics.cost - 1,
				});
				game.event('complete_turn', {});
				return;
			}

			if (turn_id == 2) {
				const state = player.get_research_state();
				if (
					state.technologies != ['Biogenetics', 'CentauriEcology'] ||
					state.target != 'IndustrialBase' ||
					state.progress < 0 ||
					state.progress >= game.get('f_technology_get_definition')('IndustrialBase').cost
				) {
					fail('live research completion did not advance to Industrial Base');
					return;
				}

				let all_technologies = [];
				for (technology_id of technologies.order) {
					all_technologies :+technology_id;
				}
				player.set_research_state({
					technologies: all_technologies,
					target: '',
					progress: 0,
				});
				game.event('set_social_engineering', {
					player: player,
					choices: {
						politics: 'Democratic',
						economics: 'Planned',
						values: 'Wealth',
						future_society: 'None',
					},
				});
				let social_wait_ticks = 0;
				#async(100, () => {
					social_wait_ticks++;
					if (player.get_social_engineering().politics != 'Democratic') {
						if (social_wait_ticks >= 100) {
							fail('social engineering event application timed out');
							return false;
						}
						return true;
					}
					game.event('complete_turn', {});
					return false;
				});
				return;
			}

			if (turn_id == 3) {
				const social_choices = player.get_social_engineering();
				const social_ratings = game.get('f_social_get_ratings')(player);
				const social_energy = base.get_intake().ENERGY;
				const social_growth_cost = game.get(
					'f_base_get_nutrients_for_growth'
				)(game, base);
				player.set_social_engineering({
					politics: 'Frontier',
					economics: 'Simple',
					values: 'Survival',
					future_society: 'None',
				});
				const baseline_energy = base.get_intake().ENERGY;
				const baseline_growth_cost = game.get(
					'f_base_get_nutrients_for_growth'
				)(game, base);
				const ecological_damage = game.get('f_ecology_get_base_damage')(base);
				player.set_social_engineering(social_choices);
				if (
					social_choices.politics != 'Democratic' ||
					social_choices.economics != 'Planned' ||
					social_choices.values != 'Wealth' ||
					social_choices.future_society != 'None'
				) {
					fail('live social engineering event did not store its choices');
					return;
				}
				if (
					social_ratings.economy != 1 || social_ratings.effic != 2 ||
					social_ratings.support != 0 - 2 || social_ratings.morale != 0 - 3 ||
					social_ratings.police != 0 - 1 || social_ratings.growth != 4 ||
					social_ratings.planet != 1 || social_ratings.industry != 2
				) {
					fail('live social engineering ratings are invalid');
					return;
				}
				if (social_energy != baseline_energy + 1) {
					fail('ECONOMY rating did not increase live base energy');
					return;
				}
				if (social_growth_cost >= baseline_growth_cost) {
					fail('GROWTH rating did not reduce live base growth cost');
					return;
				}
				if (game.get('f_social_get_free_support')(player, base.get_size()) != 1) {
					fail('SUPPORT rating returned an invalid live free-unit allowance');
					return;
				}
				if (game.get('f_social_get_mineral_cost')(player, 40) != 32) {
					fail('INDUSTRY rating returned an invalid live mineral cost');
					return;
				}
				if (
					ecological_damage.percent < 0 ||
					ecological_damage.clean_allowance != 16 ||
					ecological_damage.facility_divisor != 1 ||
					player.get_ecological_damage_events() != 0
				) {
					fail('live ecological damage state is invalid');
					return;
				}
				player.set_ecological_damage_events(3);
				if (
					game.get('f_ecology_get_base_damage')(base).clean_allowance != 19
				) {
					fail('fungal bloom clean-mineral allowance did not update');
					return;
				}
				player.set_ecological_damage_events(0);
				const unit_defs = game.get_um().get_unit_defs();
				let found_late_land_unit = false;
				let found_sea_unit = false;
				let found_air_unit = false;
				let found_clean_unit = false;
				let found_trained_unit = false;
				let found_improved_former = false;
				for (unit_def of unit_defs) {
					if (unit_def.offense >= 20 && unit_def.is_land) {
						found_late_land_unit = base.can_set_production('unit', unit_def.id);
					}
					if (unit_def.offense > 1 && unit_def.is_water) {
						found_sea_unit = true;
					}
					if (unit_def.offense > 1 && unit_def.is_air) {
						found_air_unit = base.can_set_production('unit', unit_def.id);
					}
					for (ability of unit_def.abilities) {
						if (ability == 'CleanReactor') {
							found_clean_unit = base.can_set_production('unit', unit_def.id);
						} else if (ability == 'HighMorale') {
							found_trained_unit = base.can_set_production('unit', unit_def.id);
						} else if (
							unit_def.can_terraform &&
							(ability == 'SuperFormer' || ability == 'FungicideTanks')
						) {
							found_improved_former = base.can_set_production('unit', unit_def.id);
						}
					}
				}
				if (
					#sizeof(unit_defs) < 102 || !found_late_land_unit ||
					!found_sea_unit || !found_air_unit || !found_clean_unit ||
					!found_trained_unit || !found_improved_former
				) {
					fail('generated unit catalog is unavailable at runtime');
					return;
				}
				for (gate of production_gates) {
					const expected_available =
						gate[1] != 'HabitationDome' && gate[1] != 'TheAscentToTranscendence';
					if (base.can_set_production(gate[0], gate[1]) != expected_available) {
						fail('full-catalog production gate stayed locked: ' + gate[1]);
						return;
					}
				}
				base.add_facility('HabComplex');
				if (!base.can_set_production('facility', 'HabitationDome')) {
					fail('Habitation Dome stayed locked after Hab Complex');
					return;
				}
				base.remove_facility('HabComplex');

				if (#sizeof(project_ids) != 33) {
					fail('secret project runtime catalog count is invalid');
					return;
				}
				const supercollider = game.get_bm().get_facility_def('TheSupercollider');
				const project_labs_before = game.get('f_technology_get_base_labs')(base).total;
				base.add_facility(supercollider.id);
				const project_labs_after = game.get('f_technology_get_base_labs')(base).total;
				if (
					supercollider.production_kind != 'project' || !supercollider.is_project ||
					game.get_bm().get_project_base(supercollider.id) != base ||
					base.can_set_production('project', supercollider.id) ||
					project_labs_after <= project_labs_before
				) {
					fail('secret project ownership or local effect is invalid');
					return;
				}
				base.remove_facility(supercollider.id);

				const effect_project_ids = [
					'TheHumanGenomeProject',
					'TheCommandNexus',
					'TheWeatherParadigm',
					'TheMerchantExchange',
					'TheCitizensDefenseForce',
					'TheVirtualWorld',
					'ThePlanetaryTransitSystem',
					'TheXenoempathyDome',
					'TheNeuralAmplifier',
					'TheMaritimeControlCenter',
					'TheSupercollider',
					'TheAsceticVirtues',
					'ThePholusMutagen',
					'TheCyborgFactory',
					'TheTheoryOfEverything',
					'TheDreamTwister',
					'TheNetworkBackbone',
					'TheNanoFactory',
					'TheLivingRefinery',
					'TheCloningVats',
					'TheSelfAwareColony',
					'ClinicalImmortality',
					'TheSpaceElevator',
					'TheSingularityInductor',
					'TheBulkMatterTransmitter',
					'TheTelepathicMatrix',
				];
				for (project_id of effect_project_ids) {
					base.add_facility(project_id);
				}
				const project_effects = game.get('f_project_get_effects')(base);
				let effective_ids = {};
				for (definition of game.get('f_base_get_effective_facilities')(base)) {
					effective_ids[definition.id] = true;
				}
				if (
					#sizeof(game.get('f_project_get_owned')(base)) != 26 ||
					project_effects.talent_bonus != 2 ||
					project_effects.growth_rating_bonus != 10 ||
					project_effects.population_limit_bonus != 2 ||
					project_effects.mineral_bonus != 2 ||
					project_effects.support_bonus != 2 ||
					project_effects.maintenance_multiplier != 0.5 ||
					project_effects.native_lifecycle_bonus != 2 ||
					project_effects.network_node_drone_modifier != -2 ||
					project_effects.network_node_research_bonus != 1 ||
					project_effects.terraforming_rate_multiplier != 1.5 ||
					project_effects.new_base_population != 3 ||
					project_effects.small_base_drone_modifier != -1 ||
					project_effects.psi_attack_multiplier != 1.5 ||
					project_effects.psi_defense_multiplier != 1.5 ||
					project_effects.naval_movement_bonus != 2.0 ||
					!project_effects.full_repair ||
					!project_effects.prevent_riots ||
					!#is_defined(effective_ids.CommandCenter) ||
					!#is_defined(effective_ids.PerimeterDefense) ||
					!#is_defined(effective_ids.NavalYard) ||
					!#is_defined(effective_ids.BioenhancementCenter) ||
					!#is_defined(effective_ids.QuantumConverter)
				) {
					fail('batch secret project effects are invalid');
					return;
				}
				for (project_id of effect_project_ids) {
					base.remove_facility(project_id);
				}

				const intake_before = base.get_intake();
				const consumption_before = base.get_consumption().ENERGY;
				const labs_before = game.get('f_technology_get_base_labs')(base).total;
				let nutrient_bonus = 0;
				let mineral_bonus = 0;
				let energy_bonus = 0;
				let maintenance = 0;
				let mineral_multiplier = 0.0;
				let psych_bonus = 0;
				let psych_multiplier = 0.0;
				let research_multiplier = 0.0;
				let research_bonus = 0;
				let defense_multiplier = 1.0;
				let morale_bonus = 0;
				let land_morale_bonus = 0;
				let water_morale_bonus = 0;
				let air_morale_bonus = 0;
				let water_defense_multiplier = 1.0;
				let air_defense_multiplier = 1.0;
				let growth_rating_bonus = 0;
				let native_lifecycle_bonus = 0;
				let drone_modifier = 0;
				let talent_bonus = 0;
				let suppress_psych = 0;
				for (facility_id of facility_ids) {
					const definition = game.get_bm().get_facility_def(facility_id);
					nutrient_bonus += definition.nutrient_bonus;
					mineral_bonus += definition.mineral_bonus;
					energy_bonus += definition.energy_bonus;
					maintenance += definition.energy_maintenance;
					mineral_multiplier += definition.mineral_multiplier;
					psych_bonus += definition.psych_bonus;
					psych_multiplier += definition.psych_multiplier;
					research_multiplier += definition.research_multiplier;
					research_bonus += definition.research_bonus;
					defense_multiplier += #max(definition.defense_multiplier - 1.0, 0.0);
					morale_bonus += definition.unit_morale_bonus;
					land_morale_bonus += definition.unit_morale_land_bonus;
					water_morale_bonus += definition.unit_morale_water_bonus;
					air_morale_bonus += definition.unit_morale_air_bonus;
					water_defense_multiplier += #max(
						definition.water_defense_multiplier - 1.0,
						0.0
					);
					air_defense_multiplier += #max(
						definition.air_defense_multiplier - 1.0,
						0.0
					);
					growth_rating_bonus += definition.growth_rating_bonus;
					native_lifecycle_bonus += definition.native_lifecycle_bonus;
					drone_modifier += definition.drone_modifier;
					talent_bonus += definition.talent_bonus;
					suppress_psych += definition.suppress_psych ? 1 : 0;
					base.add_facility(facility_id);
				}
				const intake_after = base.get_intake();
				const psych_after = game.get('f_economy_get_base_allocation')(game, base).psych;
				const labs_after = game.get('f_technology_get_base_labs')(base);
				if (
					#sizeof(facility_ids) != 31 ||
					nutrient_bonus != 2 || mineral_bonus != 2 || energy_bonus != 3 ||
					maintenance != 72 || mineral_multiplier != 2.0 ||
					psych_bonus != 0 || psych_multiplier != 2.0 ||
					research_multiplier != 2.0 || research_bonus != 2 ||
					defense_multiplier != 3.0 || morale_bonus != 2 ||
					land_morale_bonus != 2 || water_morale_bonus != 2 ||
					air_morale_bonus != 2 || water_defense_multiplier != 2.0 ||
					air_defense_multiplier != 2.0 || growth_rating_bonus != 2 ||
					native_lifecycle_bonus != 4 ||
					drone_modifier != -5 || talent_bonus != 2 || suppress_psych != 1 ||
					intake_after.NUTRIENTS != intake_before.NUTRIENTS + nutrient_bonus ||
					intake_after.MINERALS != #ceil(
						#to_float(intake_before.MINERALS + mineral_bonus) * (1.0 + mineral_multiplier)
					) ||
					intake_after.ENERGY != intake_before.ENERGY + energy_bonus ||
					base.get_consumption().ENERGY != consumption_before + maintenance ||
					psych_after.bonus != psych_bonus + #ceil(
						#to_float(psych_after.value) * psych_multiplier
					) ||
					labs_after.bonus != 2 + research_bonus + #ceil(
						#to_float(labs_after.value + 2 + research_bonus) * research_multiplier
					) ||
					labs_after.total <= labs_before
				) {
					fail('batch facility effects are invalid');
					return;
				}
				for (facility_id of facility_ids) {
					if (!base.has_facility(facility_id)) {
						fail('batch facility construction missed ' + facility_id);
						return;
					}
				}

				const ascent = game.get_bm().get_facility_def('TheAscentToTranscendence');
				if (
					ascent.required_project != 'TheVoiceOfPlanet' ||
					base.can_set_production('project', ascent.id)
				) {
					fail('Ascent was available before Voice of Planet');
					return;
				}
				base.add_facility('TheVoiceOfPlanet');
				if (!base.can_set_production('project', ascent.id)) {
					fail('Ascent stayed locked after Voice of Planet');
					return;
				}
				base.add_facility(ascent.id);
				let victory_wait_ticks = 0;
				#async(100, () => {
					victory_wait_ticks++;
					if (!game.is_game_over()) {
						if (victory_wait_ticks >= 100) {
							fail('transcendence victory timed out');
							return false;
						}
						return true;
					}
					const victory = game.get_victory_state();
					if (victory != {type: 'transcendence', winner: player.id, turn: 3}) {
						fail('transcendence victory state is invalid');
						return false;
					}
					runtime_complete = true;
					finish_if_ready();
					return false;
				});
				return;
			}

			fail('runtime test exceeded three turns');
		});
	});

	glsmac.run();

});
