#include "Object.h"

#include <atomic>
#include <vector>

#include "Space.h"

namespace gc {

static std::atomic< uint64_t > s_next_reachability_pass = 1;
thread_local static uint64_t s_reachability_pass = 0;
thread_local static size_t s_reachable_count = 0;
thread_local static std::vector< Object* > s_reachability_queue = {};

struct Object::persisted_objects_t {
	std::mutex mutex;
	std::unordered_map< Object*, size_t > objects = {};
};

Object::Object( gc::Space* const gc_space ) {
	if ( gc_space ) {
		gc_space->Add( this );
	}
}

Object::~Object() {
	delete m_persisted_objects.load( std::memory_order_relaxed );
}

Object::persisted_objects_t* Object::GetOrCreatePersistedObjects() const {
	auto* persisted = m_persisted_objects.load( std::memory_order_acquire );
	if ( persisted ) {
		return persisted;
	}
	auto* candidate = new persisted_objects_t();
	if ( !m_persisted_objects.compare_exchange_strong(
		persisted,
		candidate,
		std::memory_order_release,
		std::memory_order_acquire
	) ) {
		delete candidate;
		return persisted;
	}
	return candidate;
}

void Object::GetReachableObjects( std::unordered_set< Object* >& reachable_objects ) {
	GC_DEBUG_BEGIN( "gc::Object" );

	ASSERT( IsReachable(), "object was visited without being queued" );
	GC_DEBUG( "this", this );

	if ( auto* const persisted = m_persisted_objects.load( std::memory_order_acquire ) ) {
		std::lock_guard guard( persisted->mutex );
		if ( !persisted->objects.empty() ) {
			GC_DEBUG_BEGIN( "persisted_objects" );
			for ( const auto& [ obj, count ] : persisted->objects ) {
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
	s_reachable_count = 0;
	s_reachability_pass = s_next_reachability_pass.fetch_add( 1 );
	if ( s_reachability_pass == 0 ) {
		s_reachability_pass = s_next_reachability_pass.fetch_add( 1 );
	}
}

const bool Object::QueueReachable(
	Object* const object,
	std::unordered_set< Object* >&
) {
	ASSERT( object, "cannot queue null reachable object" );
	ASSERT( s_reachability_pass != 0, "reachability pass not started" );
	if ( object->IsReachable() ) {
		return false;
	}
	object->m_reachability_pass = s_reachability_pass;
	s_reachable_count++;
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

const size_t Object::GetReachableCount() {
	return s_reachable_count;
}

const bool Object::IsReachable() const {
	return s_reachability_pass != 0 && m_reachability_pass == s_reachability_pass;
}

void Object::Persist( Object* const obj ) {
	ASSERT( obj, "cannot persist null object" );
	auto* const persisted = GetOrCreatePersistedObjects();
	std::lock_guard guard( persisted->mutex );
	persisted->objects[ obj ]++;
}

void Object::Unpersist( Object* const obj ) {
	auto* const persisted = m_persisted_objects.load( std::memory_order_acquire );
	ASSERT( persisted, "object not persisted" );
	std::lock_guard guard( persisted->mutex );
	auto it = persisted->objects.find( obj );
	ASSERT( it != persisted->objects.end() && it->second > 0, "object not persisted" );
	if ( --it->second == 0 ) {
		persisted->objects.erase( it );
	}
}

const bool Object::IsPersisted( Object* const obj ) const {
	auto* const persisted = m_persisted_objects.load( std::memory_order_acquire );
	if ( !persisted ) {
		return false;
	}
	std::lock_guard guard( persisted->mutex );
	const auto& it = persisted->objects.find( obj );
	return it != persisted->objects.end() && it->second > 0;
}

}
