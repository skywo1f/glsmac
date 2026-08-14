#include "Object.h"

#include <atomic>

#include "Space.h"

namespace gc {

static std::atomic< uint64_t > s_next_reachability_pass = 1;
thread_local static uint64_t s_reachability_pass = 0;

Object::Object( gc::Space* const gc_space ) {
	if ( gc_space ) {
		gc_space->Add( this );
	}
}

void Object::GetReachableObjects( std::unordered_set< Object* >& reachable_objects ) {
	GC_DEBUG_BEGIN( "gc::Object" );

	m_reachability_pass = s_reachability_pass;
	GC_DEBUG( "this", this );
	reachable_objects.insert( this );

	{
		if ( !m_persisted_objects.empty() ) {
			GC_DEBUG_BEGIN( "persisted_objects" );
			for ( const auto& obj : m_persisted_objects ) {
				GC_REACHABLE( obj );
			}
			GC_DEBUG_END();
		}
	}

	GC_DEBUG_END();
}

void Object::BeginReachabilityPass() {
	s_reachability_pass = s_next_reachability_pass.fetch_add( 1 );
	if ( s_reachability_pass == 0 ) {
		s_reachability_pass = s_next_reachability_pass.fetch_add( 1 );
	}
}

const bool Object::IsReachable() const {
	return s_reachability_pass != 0 && m_reachability_pass == s_reachability_pass;
}

void Object::Persist( Object* const obj ) {
	ASSERT( m_persisted_objects.find( obj ) == m_persisted_objects.end(), "object already persisted" );
	m_persisted_objects.insert( obj );
}

void Object::Unpersist( Object* const obj ) {
	ASSERT( m_persisted_objects.find( obj ) != m_persisted_objects.end(), "object not persisted" );
	m_persisted_objects.erase( obj );
}

const bool Object::IsPersisted( Object* const obj ) const {
	return m_persisted_objects.find( obj ) != m_persisted_objects.end();
}

}
