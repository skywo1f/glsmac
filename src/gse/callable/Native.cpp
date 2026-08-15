#include "Native.h"

#include "gse/Exception.h"
#include "gc/Space.h"

namespace gse {
namespace callable {

Native::Native( gc::Space* const gc_space, context::Context* const ctx, const executor_t& executor )
	: Callable( gc_space, ctx )
	, m_executor( executor ) {
	//
}

Native::Native( gc::Space* const gc_space, const executor_t& executor, const destructor_t& on_destroy )
	: Callable( gc_space )
	, m_executor( executor )
	, m_on_destroy( on_destroy ) {
	ASSERT( on_destroy, "context-free native destructor callback is null" );
}

Native::~Native() {
	if ( m_on_destroy ) {
		m_on_destroy( this );
	}
}

Value* Native::Run( GSE_CALLABLE, const value::function_arguments_t& arguments ) {
	CHECKACCUM( m_gc_space );
	return m_executor( GSE_CALL, arguments );
}

}
}
