#pragma once

#include <cstdint>
#include <string>

#include "gse/Wrappable.h"
#include "types/Buffer.h"

namespace game {
namespace backend {
namespace base {

class FacilityDef : public gse::Wrappable {
public:

	static constexpr int64_t MAX_MINERAL_COST = 1000000;
	static constexpr int64_t MAX_RESOURCE_BONUS = 1000000;
	static constexpr int64_t MAX_ENERGY_MAINTENANCE = 1000000;
	static constexpr float MAX_RESEARCH_MULTIPLIER = 10.0f;
	static constexpr float MAX_DEFENSE_MULTIPLIER = 10.0f;
	static constexpr float MAX_ECONOMY_MULTIPLIER = 10.0f;
	static constexpr float MAX_MINERAL_MULTIPLIER = 10.0f;
	static constexpr float MAX_PSYCH_MULTIPLIER = 10.0f;
	static constexpr int64_t MAX_UNIT_MORALE_BONUS = 10;

	FacilityDef(
		const std::string& id,
		const std::string& name,
		const int64_t mineral_cost,
		const int64_t nutrient_bonus,
		const int64_t mineral_bonus,
		const int64_t energy_bonus,
		const int64_t energy_maintenance,
		const std::string& required_technology = "",
		const int64_t psych_bonus = 0,
		const float research_multiplier = 0.0f,
		const float defense_multiplier = 1.0f,
		const float economy_multiplier = 0.0f,
		const int64_t unit_morale_bonus = 0,
		const int64_t research_bonus = 0,
		const float mineral_multiplier = 0.0f,
		const float psych_multiplier = 0.0f
	);
	virtual ~FacilityDef() = default;

	const std::string m_id;
	const std::string m_name;
	const int64_t m_mineral_cost;
	const int64_t m_nutrient_bonus;
	const int64_t m_mineral_bonus;
	const int64_t m_energy_bonus;
	const int64_t m_energy_maintenance;
	const std::string m_required_technology;
	const int64_t m_psych_bonus;
	const float m_research_multiplier;
	const float m_defense_multiplier;
	const float m_economy_multiplier;
	const int64_t m_unit_morale_bonus;
	const int64_t m_research_bonus;
	const float m_mineral_multiplier;
	const float m_psych_multiplier;

	static const types::Buffer Serialize( const FacilityDef* def );
	static FacilityDef* Deserialize( types::Buffer& buf );

	WRAPDEFS_PTR( FacilityDef );

};

}
}
}
