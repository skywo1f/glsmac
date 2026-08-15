#include "Object.h"

#include <atomic>
#include <vector>

#include "Space.h"

namespace gc {

static std::atomic< uint64_t > s_next_reachability_pass = 1;
thread_local static uint64_t s_reachability_pass = 0;
thread_local static std::vector< Object* > s_reachability_queue = {};

Object::Object( gc::Space* const gc_space ) {
	if ( gc_space ) {
		gc_space->Add( this );
	}
}

void Object::GetReachableObjects( std::unordered_set< Object* >& reachable_objects ) {
	GC_DEBUG_BEGIN( "gc::Object" );

	ASSERT( IsReachable(), "object was visited without being queued" );
	GC_DEBUG( "this", this );
	reachable_objects.insert( this );

	{
		std::lock_guard guard( m_persisted_objects_mutex );
		if ( !m_persisted_objects.empty() ) {
			GC_DEBUG_BEGIN( "persisted_objects" );
			for ( const auto& [ obj, count ] : m_persisted_objects ) {
				if ( count > 0 ) {
					GC_REACHABLE( obj );
				}
			}
			GC_DEBUG_END();
		}
	}

	GC_DEBUG_END();
}

void Object::BeginReachabilityPass() {
	s_reachability_queue.clear();
	s_reachability_pass = s_next_reachability_pass.fetch_add( 1 );
	if ( s_reachability_pass == 0 ) {
		s_reachability_pass = s_next_reachability_pass.fetch_add( 1 );
	}
}

const bool Object::QueueReachable(
	Object* const object,
	std::unordered_set< Object* >& reachable_objects
) {
	ASSERT( object, "cannot queue null reachable object" );
	ASSERT( s_reachability_pass != 0, "reachability pass not started" );
	if ( object->IsReachable() ) {
		return false;
	}
	object->m_reachability_pass = s_reachability_pass;
	reachable_objects.insert( object );
	s_reachability_queue.push_back( object );
	return true;
}

void Object::DrainReachabilityQueue( std::unordered_set< Object* >& reachable_objects ) {
	while ( !s_reachability_queue.empty() ) {
		auto* const object = s_reachability_queue.back();
		s_reachability_queue.pop_back();
		object->GetReachableObjects( reachable_objects );
	}
}

const bool Object::IsReachable() const {
	return s_reachability_pass != 0 && m_reachability_pass == s_reachability_pass;
}

void Object::Persist( Object* const obj ) {
	ASSERT( obj, "cannot persist null object" );
	std::lock_guard guard( m_persisted_objects_mutex );
	m_persisted_objects[ obj ]++;
}

void Object::Unpersist( Object* const obj ) {
	std::lock_guard guard( m_persisted_objects_mutex );
	auto it = m_persisted_objects.find( obj );
	ASSERT( it != m_persisted_objects.end() && it->second > 0, "object not persisted" );
	if ( --it->second == 0 ) {
		m_persisted_objects.erase( it );
	}
}

const bool Object::IsPersisted( Object* const obj ) const {
	std::lock_guard guard( m_persisted_objects_mutex );
	const auto& it = m_persisted_objects.find( obj );
	return it != m_persisted_objects.end() && it->second > 0;
}

}
