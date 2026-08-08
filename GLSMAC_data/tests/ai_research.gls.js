const research = #include('../default/game/ai/research');

const technology = (id, cost) => {
	return {id: id, cost: cost};
};
const unit = (id, required_technology, offense, defense, movement, can_found_base, can_terraform) => {
	return {
		id: id,
		required_technology: required_technology,
		offense: offense,
		defense: defense,
		movement_per_turn: movement,
		can_found_base: can_found_base,
		can_terraform: can_terraform,
	};
};
const facility = (id, required_technology, nutrients, minerals, energy, psych, research_multiplier) => {
	return {
		id: id,
		required_technology: required_technology,
		nutrient_bonus: nutrients,
		mineral_bonus: minerals,
		energy_bonus: energy,
		psych_bonus: psych,
		research_multiplier: research_multiplier,
	};
};
const context = (needs_military, needs_psych) => {
	return {
		needs_colony: false,
		needs_former: false,
		needs_military: needs_military,
		needs_growth: false,
		needs_psych: needs_psych,
		base_labs: 4,
	};
};

const mobility = technology('Mobility', 30);
const social = technology('Social', 40);
const units = [unit('Rover', 'Mobility', 1, 1, 2.0, false, false)];
const facilities = [facility('Commons', 'Social', 0, 0, 0, 4, 0.0)];

test.assert(research.choose([social, mobility], units, facilities, context(true, false)) == mobility);
test.assert(research.choose([mobility, social], units, facilities, context(false, true)) == social);
const definitions = {Mobility: mobility, Social: social};
test.assert(
	research.choose_id(['Social', 'Mobility'], (id) => { return definitions[id]; }, units, facilities, context(true, false)) ==
	'Mobility'
);

const information = technology('Information', 40);
const network = facility('Network', 'Information', 0, 0, 0, 0, 0.5);
test.assert(
	research.score_technology(information, [], [network], context(false, false)) >
	research.score_technology(social, [], facilities, context(false, false))
);

const alpha = technology('Alpha', 40);
const beta = technology('Beta', 40);
test.assert(research.choose([beta, alpha], [], [], context(false, false)) == alpha);
test.assert(research.choose([], units, facilities, context(true, true)) == null);
