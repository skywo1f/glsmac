#pragma once

#include <vector>

#include "Render.h"
#include "Types.h"

namespace game {
namespace backend {
namespace unit {

class CVRRender : public Render {
public:
	static constexpr size_t MAX_FILES = 16;
	static constexpr uint32_t MAX_DIMENSION = 4096;

	CVRRender(
		const std::vector< std::string >& files,
		const uint32_t w,
		const uint32_t h,
		const uint32_t cx,
		const uint32_t cy,
		const sprite_render_info_t& fallback
	);

	const std::vector< std::string > m_files;
	const uint32_t m_w;
	const uint32_t m_h;
	const uint32_t m_cx;
	const uint32_t m_cy;
	const sprite_render_info_t m_fallback;

	const std::string ToString( const std::string& prefix ) const override;

private:
	friend class Render;

	static void Serialize( types::Buffer& buf, const CVRRender* render );
	static CVRRender* Deserialize( types::Buffer& buf );
};

}
}
}
