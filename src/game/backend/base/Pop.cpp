#include "Pop.h"

#include <limits>

#include "game/backend/Game.h"
#include "game/backend/base/Base.h"
#include "game/backend/base/PopDef.h"
#include "game/backend/base/BaseManager.h"
#include "gse/value/Int.h"
#include "gse/value/Bool.h"
#include "gse/callable/Native.h"

namespace game {
namespace backend {
namespace base {

Pop::Pop( Base* const base, const size_t id, const PopDef* def, const uint8_t variant, map::tile::Tile* const worked_tile )
	: m_base( base )
	, m_id( id )
	, m_def( def )
	, m_variant( variant ) {
	//
}

void Pop::Serialize( types::Buffer& buf ) const {
	ASSERT( m_base, "pop base is null" );
	ASSERT( m_def, "pop def is null" );

	buf.WriteInt( m_id );
	buf.WriteString( m_def->m_id );
	buf.WriteInt( m_variant );
}

void Pop::Deserialize( types::Buffer& buf, Game* game ) {
	ASSERT( !m_base, "pop base is not null" );
	ASSERT( !m_def, "pop def is not null" );

	auto* bm = game->GetBM();
	ASSERT( bm, "bm is null" );

	const auto id = buf.ReadInt();
	if ( id < 0 || static_cast< uint64_t >( id ) > std::numeric_limits< size_t >::max() ) {
		THROW( "invalid serialized base population id: " + std::to_string( id ) );
	}
	m_id = static_cast< size_t >( id );
	const auto def_id = buf.ReadString();
	m_def = bm->GetPopDef( def_id );
	if ( !m_def ) {
		THROW( "base pop definition not found: " + def_id );
	}
	const auto variant = buf.ReadInt();
	if ( variant < 0 || variant > std::numeric_limits< uint8_t >::max() ) {
		THROW( "invalid serialized base population variant: " + std::to_string( variant ) );
	}
	m_variant = static_cast< uint8_t >( variant );
}

void Pop::SetBase( Base* const base ) {
	ASSERT( !m_base, "pop base already set" );
	m_base = base;
}

WRAPIMPL_BEGIN( Pop )
	WRAPIMPL_PROPS
	WRAPIMPL_CUSTOM_SETTERS
		{
			"id",
			VALUE( gse::value::Int,, m_id ),
		},
		{
			"get_type",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				return VALUE( gse::value::String, , m_def->m_id );
			} )
		},
		{
			"variant",
			VALUE( gse::value::Int,, m_variant )
		},
		{
			"get_base",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				ASSERT( m_base, "pop has no base" );
				return m_base->Wrap( GSE_CALL );
			} )
		},
		{
			"set_type",
			NATIVE_CALL( this ) {

				m_base->GetGame()->CheckRW( GSE_CALL );

				N_EXPECT_ARGS( 1 );
				N_GETVALUE( id, 0, String );

				m_base->ChangePopType( GSE_CALL, m_id, id );

				return VALUE( gse::value::Undefined );
			} )
		},
	};
WRAPIMPL_END_PTR()

UNWRAPIMPL_PTR( Pop )

}
}
}
