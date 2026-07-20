#include "Def.h"

#include "StaticDef.h"

#include "MoraleSet.h"

#include "gse/value/Object.h"
#include "gse/value/Int.h"
#include "gse/value/String.h"

namespace game {
namespace backend {
namespace unit {

Def::Def(
	const std::string& id,
	const MoraleSet* moraleset,
	const def_type_t type,
	const std::string& name,
	const int64_t mineral_cost
)
	: m_id( id )
	, m_moraleset( moraleset )
	, m_type( type )
	, m_name( name )
	, m_mineral_cost( mineral_cost ) {
	//
}

const types::Buffer Def::Serialize( const Def* def ) {
	types::Buffer buf;
	buf.WriteString( def->m_id );
	buf.WriteString( def->m_moraleset->m_id );
	buf.WriteString( def->m_name );
	buf.WriteInt( def->m_mineral_cost );
	buf.WriteInt( def->m_type );
	switch ( def->m_type ) {
		case DT_STATIC: {
			StaticDef::Serialize( buf, (StaticDef*)def );
			break;
		}
		default:
			THROW( "unknown def type on write: " + std::to_string( def->m_type ) );
	}
	return buf;
}

Def* Def::Deserialize( types::Buffer& buf ) {
	const auto id = buf.ReadString();
	const auto moraleset = buf.ReadString();
	const auto name = buf.ReadString();
	const auto mineral_cost = buf.ReadInt();
	const auto serialized_type = buf.ReadInt();
	if ( id.empty() || moraleset.empty() ) {
		THROW( "serialized unit definition id or morale set is empty" );
	}
	if ( serialized_type != DT_STATIC ) {
		THROW( "unknown def type on read: " + std::to_string( serialized_type ) );
	}
	if ( mineral_cost < 0 || mineral_cost > MAX_MINERAL_COST ) {
		THROW( "invalid serialized unit mineral cost" );
	}
	const auto type = static_cast< def_type_t >( serialized_type );
	switch ( type ) {
		case DT_STATIC:
			return StaticDef::Deserialize( buf, id, moraleset, name, mineral_cost );
		default:
			THROW( "unknown def type on read: " + std::to_string( type ) );
	}
}

WRAPIMPL_BEGIN( Def )
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
				"type",
				VALUE( gse::value::String, , "static" ) // TODO
			},
			{
				"mineral_cost",
				VALUE( gse::value::Int, , m_mineral_cost )
			},
		};
WRAPIMPL_END_PTR()

UNWRAPIMPL_PTR( Def )

}
}
}
