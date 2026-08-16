#include "Rules.h"

#include "gse/value/Array.h"
#include "gse/value/Bool.h"
#include "gse/value/Ptr.h"

namespace game {
namespace backend {
namespace rules {

const int Rules::GetDefaultDifficultyLevelV() const {
	return m_difficulty_levels.GetValueUnsafe( GetDefaultDifficultyLevel() );
}

void Rules::Initialize() {
	if ( !m_is_initialized ) {
		InitRules();
		m_is_initialized = true;
	}
}

WRAPIMPL_DYNAMIC_GETTERS( Rules )
			WRAPIMPL_GET_CUSTOM( "difficulty_levels", Array, WrapDifficultyLevels( gc_space ) )
			WRAPIMPL_GET_PTR( "allow_transcendence_victory", allow_transcendence_victory )
			WRAPIMPL_GET_PTR( "allow_conquest_victory", allow_conquest_victory )
			WRAPIMPL_GET_PTR( "allow_diplomatic_victory", allow_diplomatic_victory )
			WRAPIMPL_GET_PTR( "allow_economic_victory", allow_economic_victory )
			WRAPIMPL_GET_PTR( "allow_cooperative_victory", allow_cooperative_victory )
			WRAPIMPL_GET_PTR( "tech_stagnation", tech_stagnation )
			WRAPIMPL_GET_PTR( "spoils_of_war", spoils_of_war )
			WRAPIMPL_GET_PTR( "unity_survey", unity_survey )
			WRAPIMPL_GET_PTR( "random_events", random_events )
WRAPIMPL_DYNAMIC_SETTERS( Rules )
	WRAPIMPL_SET_PTR( "allow_transcendence_victory", Bool, allow_transcendence_victory )
	WRAPIMPL_SET_PTR( "allow_conquest_victory", Bool, allow_conquest_victory )
	WRAPIMPL_SET_PTR( "allow_diplomatic_victory", Bool, allow_diplomatic_victory )
	WRAPIMPL_SET_PTR( "allow_economic_victory", Bool, allow_economic_victory )
	WRAPIMPL_SET_PTR( "allow_cooperative_victory", Bool, allow_cooperative_victory )
	WRAPIMPL_SET_PTR( "tech_stagnation", Bool, tech_stagnation )
	WRAPIMPL_SET_PTR( "spoils_of_war", Bool, spoils_of_war )
	WRAPIMPL_SET_PTR( "unity_survey", Bool, unity_survey )
	WRAPIMPL_SET_PTR( "random_events", Bool, random_events )
WRAPIMPL_DYNAMIC_ON_SET( Rules )
WRAPIMPL_DYNAMIC_END()

const types::Buffer Rules::Serialize() const {
	types::Buffer buf;

	// no need for now, difficulty levels are hardcoded
/*	buf.WriteInt( m_difficulty_levels.size() );
	for ( auto& it : m_difficulty_levels ) {
		buf.WriteString( it.first );
		buf.WriteString( it.second.Serialize().ToString() );
	}*/

	buf.WriteInt( 2 );
	buf.WriteBool( allow_transcendence_victory );
	buf.WriteBool( allow_conquest_victory );
	buf.WriteBool( allow_diplomatic_victory );
	buf.WriteBool( allow_economic_victory );
	buf.WriteBool( allow_cooperative_victory );
	buf.WriteBool( tech_stagnation );
	buf.WriteBool( spoils_of_war );
	buf.WriteBool( unity_survey );
	buf.WriteBool( random_events );

	return buf;
}

void Rules::Deserialize( types::Buffer buf ) {
	if ( buf.GetRemaining() == 0 ) {
		Initialize();
		return;
	}
	const auto version = buf.ReadInt();
	if ( version != 1 && version != 2 ) {
		THROW( "unsupported serialized rules version" );
	}
	const auto serialized_allow_transcendence_victory = buf.ReadBool();
	const auto serialized_allow_conquest_victory = buf.ReadBool();
	const auto serialized_allow_diplomatic_victory = buf.ReadBool();
	const auto serialized_allow_economic_victory = buf.ReadBool();
	const auto serialized_allow_cooperative_victory = version >= 2
		? buf.ReadBool()
		: false;
	const auto serialized_tech_stagnation = buf.ReadBool();
	const auto serialized_spoils_of_war = buf.ReadBool();
	const auto serialized_unity_survey = buf.ReadBool();
	const auto serialized_random_events = buf.ReadBool();
	if ( buf.GetRemaining() != 0 ) {
		THROW( "unexpected data in serialized rules" );
	}
	allow_transcendence_victory = serialized_allow_transcendence_victory;
	allow_conquest_victory = serialized_allow_conquest_victory;
	allow_diplomatic_victory = serialized_allow_diplomatic_victory;
	allow_economic_victory = serialized_allow_economic_victory;
	allow_cooperative_victory = serialized_allow_cooperative_victory;
	tech_stagnation = serialized_tech_stagnation;
	spoils_of_war = serialized_spoils_of_war;
	unity_survey = serialized_unity_survey;
	random_events = serialized_random_events;
	Initialize();
}

const gse::value::array_elements_t Rules::WrapDifficultyLevels( gc::Space* const gc_space ) {
	gse::value::array_elements_t result = {};
	const auto& vk = m_difficulty_levels.GetVK();
	std::map< int, std::string > kv = {};
	for ( const auto& it : vk ) {
		kv.insert( { it.first, it.second } );
	}
	result.reserve( kv.size() );
	for ( const auto& it : kv ) {
		result.push_back( VALUE( gse::value::String, , it.second ) ); // TODO: full object?
	}
	return result;
}

}
}
}
