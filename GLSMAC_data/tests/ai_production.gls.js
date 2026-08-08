const production = #include('../default/game/ai/production');

const unit = (id, offense, defense, movement, cost, can_found_base, can_terraform) => {
	return {
		id: id,
		offense: offense,
		defense: defense,
		movement_per_turn: movement,
		mineral_cost: cost,
		can_found_base: can_found_base,
		can_terraform: can_terraform,
	};
};
const facility = (id, nutrients, minerals, energy, psych, research, maintenance, cost) => {
	return {
		id: id,
		nutrient_bonus: nutrients,
		mineral_bonus: minerals,
		energy_bonus: energy,
		psych_bonus: psych,
		research_multiplier: research,
		energy_maintenance: maintenance,
		mineral_cost: cost,
	};
};

const scout = unit('Scout', 1, 1, 1.0, 10, false, false);
const rover = unit('Rover', 1, 1, 2.0, 20, false, false);
const laser = unit('Laser', 2, 1, 1.0, 20, false, false);
const defender = unit('Defender', 1, 2, 1.0, 20, false, false);
const former = unit('Former', 0, 1, 1.0, 20, false, true);
const colony = unit('Colony', 0, 1, 1.0, 30, true, false);
const recycling = facility('Recycling', 1, 1, 1, 0, 0.0, 0, 40);
const network = facility('Network', 0, 0, 0, 0, 0.5, 1, 80);
const recreation = facility('Recreation', 0, 0, 0, 4, 0.0, 1, 40);
const all_units = [scout, rover, laser, defender, former, colony];
const all_facilities = [network, recreation, recycling];
let locked = {};
const base = {
	can_set_production: (kind, id) => { return !#is_defined(locked[id]); },
};
const context = (garrison, needs_former, needs_colony, needs_psych, energy) => {
	return {
		needs_garrison: garrison,
		needs_former: needs_former,
		needs_colony: needs_colony,
		needs_military: true,
		needs_psych: needs_psych,
		needs_growth: false,
		can_expand: true,
		nutrient_surplus: 1,
		supported_units: 0,
		free_support: 1,
		base_labs: 4,
		available_energy: energy,
	};
};

test.assert(production.choose(base, all_units, all_facilities, context(true, true, true, true, 10)).id == 'Defender');
test.assert(production.choose(base, all_units, all_facilities, context(false, true, true, true, 10)).id == 'Former');
test.assert(production.choose(base, all_units, all_facilities, context(false, false, true, true, 10)).id == 'Colony');
test.assert(production.choose(base, all_units, all_facilities, context(false, false, false, true, 10)).id == 'Recreation');
test.assert(production.choose(base, all_units, all_facilities, context(false, false, false, false, 10)).id == 'Recycling');
locked.Recycling = true;
locked.Recreation = true;
test.assert(production.choose(base, all_units, all_facilities, context(false, false, false, false, 0)).id == 'Laser');
test.assert(production.choose(base, all_units, all_facilities, context(false, false, false, false, 1)).id == 'Network');
locked.Network = true;
test.assert(production.choose(base, all_units, all_facilities, context(false, false, false, false, 10)).id == 'Laser');

const alpha = unit('Alpha', 1, 1, 1.0, 10, false, false);
const beta = unit('Beta', 1, 1, 1.0, 10, false, false);
test.assert(production.choose(base, [beta, alpha], [], context(false, false, false, false, 0)).id == 'Alpha');

let peaceful_context = context(false, false, false, false, 0);
peaceful_context.needs_military = false;
test.assert(production.choose(base, [laser], [], peaceful_context) == null);

let blocked_expansion_context = context(false, false, true, false, 0);
blocked_expansion_context.can_expand = false;
test.assert(production.score_unit(colony, blocked_expansion_context) == null);

let supported_context = context(false, false, false, false, 0);
supported_context.supported_units = 2;
supported_context.free_support = 1;
test.assert(
	production.score_unit(laser, supported_context) <
	production.score_unit(laser, context(false, false, false, false, 0))
);

let growth_context = context(false, false, false, false, 10);
growth_context.needs_growth = true;
test.assert(
	production.score_facility(recycling, growth_context) >
	production.score_facility(recycling, context(false, false, false, false, 10))
);
