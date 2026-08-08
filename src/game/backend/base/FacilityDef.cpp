#include "FacilityDef.h"

#include "gse/value/Float.h"
#include "gse/value/Int.h"
#include "gse/value/String.h"

namespace game {
namespace backend {
namespace base {

FacilityDef::FacilityDef(
	const std::string& id,
	const std::string& name,
	const int64_t mineral_cost,
	const int64_t nutrient_bonus,
	const int64_t mineral_bonus,
	const int64_t energy_bonus,
	const int64_t energy_maintenance,
	const std::string& required_technology,
	const int64_t psych_bonus,
	const float research_multiplier
)
	: m_id( id )
	, m_name( name )
	, m_mineral_cost( mineral_cost )
	, m_nutrient_bonus( nutrient_bonus )
	, m_mineral_bonus( mineral_bonus )
	, m_energy_bonus( energy_bonus )
	, m_energy_maintenance( energy_maintenance )
	, m_required_technology( required_technology )
	, m_psych_bonus( psych_bonus )
	, m_research_multiplier( research_multiplier ) {
	if (
		m_id.empty() ||
		m_name.empty() ||
		m_mineral_cost <= 0 ||
		m_mineral_cost > MAX_MINERAL_COST ||
		m_nutrient_bonus < 0 ||
		m_nutrient_bonus > MAX_RESOURCE_BONUS ||
		m_mineral_bonus < 0 ||
		m_mineral_bonus > MAX_RESOURCE_BONUS ||
		m_energy_bonus < 0 ||
		m_energy_bonus > MAX_RESOURCE_BONUS ||
		m_energy_maintenance < 0 ||
		m_energy_maintenance > MAX_ENERGY_MAINTENANCE ||
		m_psych_bonus < 0 ||
		m_psych_bonus > MAX_RESOURCE_BONUS ||
		m_research_multiplier < 0.0f ||
		m_research_multiplier > MAX_RESEARCH_MULTIPLIER
	) {
		THROW( "invalid base facility definition: " + m_id );
	}
}

const types::Buffer FacilityDef::Serialize( const FacilityDef* def ) {
	types::Buffer buf;
	buf.WriteString( def->m_id );
	buf.WriteString( def->m_name );
	buf.WriteInt( def->m_mineral_cost );
	buf.WriteInt( def->m_nutrient_bonus );
	buf.WriteInt( def->m_mineral_bonus );
	buf.WriteInt( def->m_energy_bonus );
	buf.WriteInt( def->m_energy_maintenance );
	buf.WriteString( def->m_required_technology );
	buf.WriteInt( def->m_psych_bonus );
	buf.WriteFloat( def->m_research_multiplier );
	return buf;
}

FacilityDef* FacilityDef::Deserialize( types::Buffer& buf ) {
	const auto id = buf.ReadString();
	const auto name = buf.ReadString();
	const auto mineral_cost = buf.ReadInt();
	const auto nutrient_bonus = buf.ReadInt();
	const auto mineral_bonus = buf.ReadInt();
	const auto energy_bonus = buf.ReadInt();
	const auto energy_maintenance = buf.ReadInt();
	const auto required_technology = buf.GetRemaining() > 0 ? buf.ReadString() : "";
	const auto psych_bonus = buf.GetRemaining() > 0 ? buf.ReadInt() : 0;
	const auto research_multiplier = buf.GetRemaining() > 0 ? buf.ReadFloat() : 0.0f;
	return new FacilityDef(
		id,
		name,
		mineral_cost,
		nutrient_bonus,
		mineral_bonus,
		energy_bonus,
		energy_maintenance,
		required_technology,
		psych_bonus,
		research_multiplier
	);
}

WRAPIMPL_BEGIN( FacilityDef )
	WRAPIMPL_PROPS
		{
			"id",
			VALUE( gse::value::String, , m_id )
		},
		{
			"name",
			VALUE( gse::value::String, , m_name )
		},
		{
			"production_kind",
			VALUE( gse::value::String, , "facility" )
		},
		{
			"mineral_cost",
			VALUE( gse::value::Int, , m_mineral_cost )
		},
		{
			"nutrient_bonus",
			VALUE( gse::value::Int, , m_nutrient_bonus )
		},
		{
			"mineral_bonus",
			VALUE( gse::value::Int, , m_mineral_bonus )
		},
		{
			"energy_bonus",
			VALUE( gse::value::Int, , m_energy_bonus )
		},
		{
			"energy_maintenance",
			VALUE( gse::value::Int, , m_energy_maintenance )
		},
		{
			"required_technology",
			VALUE( gse::value::String, , m_required_technology )
		},
		{
			"psych_bonus",
			VALUE( gse::value::Int, , m_psych_bonus )
		},
		{
			"research_multiplier",
			VALUE( gse::value::Float, , m_research_multiplier )
		},
	};
WRAPIMPL_END_PTR()

UNWRAPIMPL_PTR( FacilityDef )

}
}
}
