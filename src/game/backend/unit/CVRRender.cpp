#include "CVRRender.h"

namespace game {
namespace backend {
namespace unit {

CVRRender::CVRRender(
	const std::vector< std::string >& files,
	const uint32_t w,
	const uint32_t h,
	const uint32_t cx,
	const uint32_t cy,
	const sprite_render_info_t& fallback
)
	: Render( RT_CVR )
	, m_files( files )
	, m_w( w )
	, m_h( h )
	, m_cx( cx )
	, m_cy( cy )
	, m_fallback( fallback ) {
	//
}

const std::string CVRRender::ToString( const std::string& prefix ) const {
	return (std::string)
		TS_OBJ_BEGIN( "CVRRender" ) +
		TS_OBJ_PROP_NUM( "files", m_files.size() ) +
		TS_OBJ_PROP_NUM( "w", m_w ) +
		TS_OBJ_PROP_NUM( "h", m_h ) +
		TS_OBJ_PROP_NUM( "cx", m_cx ) +
		TS_OBJ_PROP_NUM( "cy", m_cy ) +
		TS_OBJ_END();
}

void CVRRender::Serialize( types::Buffer& buf, const CVRRender* render ) {
	buf.WriteInt( render->m_files.size() );
	for ( const auto& file : render->m_files ) {
		buf.WriteString( file );
	}
	buf.WriteInt( render->m_w );
	buf.WriteInt( render->m_h );
	buf.WriteInt( render->m_cx );
	buf.WriteInt( render->m_cy );
	buf.WriteString( render->m_fallback.file );
	buf.WriteInt( render->m_fallback.x );
	buf.WriteInt( render->m_fallback.y );
	buf.WriteInt( render->m_fallback.w );
	buf.WriteInt( render->m_fallback.h );
	buf.WriteInt( render->m_fallback.cx );
	buf.WriteInt( render->m_fallback.cy );
	buf.WriteInt( render->m_fallback.morale_based_xshift );
}

CVRRender* CVRRender::Deserialize( types::Buffer& buf ) {
	const auto file_count = buf.ReadInt< uint32_t >( "CVR render file count" );
	if ( file_count == 0 || file_count > MAX_FILES ) {
		THROW( "invalid serialized CVR render file count" );
	}
	std::vector< std::string > files;
	files.reserve( file_count );
	for ( uint32_t i = 0 ; i < file_count ; i++ ) {
		const auto file = buf.ReadString();
		if ( file.empty() ) {
			THROW( "invalid serialized CVR render file" );
		}
		files.push_back( file );
	}
	const auto w = buf.ReadInt< uint32_t >( "CVR render width" );
	const auto h = buf.ReadInt< uint32_t >( "CVR render height" );
	const auto cx = buf.ReadInt< uint32_t >( "CVR render center x" );
	const auto cy = buf.ReadInt< uint32_t >( "CVR render center y" );
	const sprite_render_info_t fallback = {
		buf.ReadString(),
		buf.ReadInt< uint32_t >( "CVR fallback sprite x" ),
		buf.ReadInt< uint32_t >( "CVR fallback sprite y" ),
		buf.ReadInt< uint32_t >( "CVR fallback sprite width" ),
		buf.ReadInt< uint32_t >( "CVR fallback sprite height" ),
		buf.ReadInt< uint32_t >( "CVR fallback sprite center x" ),
		buf.ReadInt< uint32_t >( "CVR fallback sprite center y" ),
		buf.ReadInt< uint32_t >( "CVR fallback sprite morale shift" ),
	};
	if (
		w == 0 || h == 0 || w > MAX_DIMENSION || h > MAX_DIMENSION ||
		cx > w || cy > h || fallback.file.empty() ||
		fallback.w == 0 || fallback.h == 0
	) {
		THROW( "invalid serialized CVR render" );
	}
	return new CVRRender( files, w, h, cx, cy, fallback );
}

}
}
}
