#pragma once

#include <vector>

#include "Operand.h"

namespace gse {
namespace program {

class Control;

class Scope : public Operand {
public:

	Scope( const si_t& si, const std::vector< const Control* >& body );
	~Scope();

	const std::vector< const Control* > body;
	const bool HasLocalBindings() const;

	const std::string ToString() const override;
	const std::string Dump( const size_t depth = 0 ) const override;

private:
	const bool m_has_local_bindings;
};

}
}
