#pragma once

namespace types {
class Buffer;
}

namespace game {
namespace backend {
namespace map {

namespace tile {
class Tiles;
}

class OriginalMapLoader {
public:
	static bool IsOriginalMap( const types::Buffer& buffer );
	static void Validate( const types::Buffer& buffer );
	static void Load( tile::Tiles* tiles, const types::Buffer& buffer );
};

}
}
}
