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

	FacilityDef(
		const std::string& id,
		const std::string& name,
		const int64_t mineral_cost,
		const int64_t nutrient_bonus,
		const int64_t mineral_bonus,
		const int64_t energy_bonus,
		const int64_t energy_maintenance
	);
	virtual ~FacilityDef() = default;

	const std::string m_id;
	const std::string m_name;
	const int64_t m_mineral_cost;
	const int64_t m_nutrient_bonus;
	const int64_t m_mineral_bonus;
	const int64_t m_energy_bonus;
	const int64_t m_energy_maintenance;

	static const types::Buffer Serialize( const FacilityDef* def );
	static FacilityDef* Deserialize( types::Buffer& buf );

	WRAPDEFS_PTR( FacilityDef );

};

}
}
}
