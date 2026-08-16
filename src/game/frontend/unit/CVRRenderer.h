#pragma once

#include <string>
#include <vector>

namespace types::texture {
class Texture;
}

namespace game {
namespace frontend {
namespace unit {

class CVRRenderer {
public:
	static types::texture::Texture* Render(
		const std::vector< std::string >& files,
		const size_t width,
		const size_t height
	);
};

}
}
}
