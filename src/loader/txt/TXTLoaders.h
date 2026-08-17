#pragma once

namespace loader {
namespace txt {

class FactionTXTLoader;
class TechnologyTXTLoader;

class TXTLoaders {
public:
	TXTLoaders();
	~TXTLoaders();

	FactionTXTLoader* const factions;
	TechnologyTXTLoader* const technologies;
};

}
}
