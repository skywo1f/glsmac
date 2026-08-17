#include "TXTLoaders.h"

#include "FactionTXTLoader.h"
#include "TechnologyTXTLoader.h"

namespace loader {
namespace txt {

TXTLoaders::TXTLoaders()
	: factions( new FactionTXTLoader() )
	, technologies( new TechnologyTXTLoader() ) {
	//
}
TXTLoaders::~TXTLoaders() {
	delete factions;
	delete technologies;
}

}
}
