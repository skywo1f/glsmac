#include "Render.h"

#include "CVRRender.h"
#include "SpriteRender.h"

namespace game {
namespace backend {
namespace unit {

Render::Render( const render_type_t type )
	: m_type( type ) {
	//
}

void Render::Serialize( types::Buffer& buf, const Render* render ) {
	buf.WriteInt( render->m_type );
	switch ( render->m_type ) {
		case RT_SPRITE: {
			SpriteRender::Serialize( buf, (SpriteRender*)render );
			break;
		}
		case RT_CVR: {
			CVRRender::Serialize( buf, (CVRRender*)render );
			break;
		}
		default:
			THROW( "unknown render type on write: " + std::to_string( render->m_type ) );
	}
}

Render* Render::Deserialize( types::Buffer& buf ) {
	const auto serialized_render_type = buf.ReadInt();
	if ( serialized_render_type < RT_SPRITE || serialized_render_type > RT_CVR ) {
		THROW( "unknown render type on read: " + std::to_string( serialized_render_type ) );
	}
	const auto render_type = static_cast< render_type_t >( serialized_render_type );
	switch ( render_type ) {
		case RT_SPRITE:
			return SpriteRender::Deserialize( buf );
		case RT_CVR:
			return CVRRender::Deserialize( buf );
		default:
			THROW( "unknown render type on read: " + std::to_string( render_type ) );
	}
}

}
}
}
