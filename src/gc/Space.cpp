#include "Space.h"

#include <algorithm>
#include <thread>
#include <typeinfo>
#include <unordered_map>
#include <vector>

#include "engine/Engine.h"
#include "GC.h"
#include "util/String.h"
#include "util/LogHelper.h"
#include "util/FinallyGuard.h"
#include "graphics/Graphics.h"

#if defined( GLSMAC_TESTING )
#include "config/Config.h"
#endif

#if defined( DEBUG ) || defined( FASTDEBUG )

#include "debug/MemoryWatcher.h"

#endif

namespace gc {

static std::atomic< uint64_t > s_next_accumulation_pass = 1;

Space::Space( Object* const root_object )
	: m_root_object( root_object ) {
	ASSERT( root_object, "root object is null" );
	g_engine->GetGC()->AddSpace( this );
}

Space::~Space() {
	StopCollecting();

	{
		// cleanup anything that didn't execute in time
		std::lock_guard guard( m_pending_accumulations_mutex );
		for ( const auto& it : m_pending_accumulations ) {
			if ( it.second.cleanup ) {
				it.second.cleanup();
			}
		}
		m_pending_accumulations.clear();
	}

	// collect until there's nothing to collect
	GC_LOG( "Destroying remaining objects" );
	{
		m_objects_mutex.lock();
		size_t tries = 10;
		while ( !m_objects.empty() ) {
			GC_LOG( std::to_string( m_objects.size() ) + " objects are still reachable" );
			m_objects_mutex.unlock();
			{
				std::lock_guard guard( m_accumulations_mutex );
				if ( !m_accumulations.empty() ) {
					Log( "WARNING: space is destroying but still accumulating in " + std::to_string( m_accumulations.size() ) + " thread(s)" );
				}
			}
			while ( Collect() ) {}
			m_objects_mutex.lock();
			if ( !m_objects.empty() ) {
				Log( "WARNING: collect finished but objects still not empty" );
				if ( !--tries ) {
					break;
				}
			}
		}
		m_objects_mutex.unlock();
	}
	GC_LOG( "All objects have been destroyed." );
}

void Space::StopCollecting() {
	if ( !m_is_destroying.exchange( true ) ) {
		// RemoveSpace waits for a currently running GC iteration, so the root
		// object can be torn down safely after this returns.
		g_engine->GetGC()->RemoveSpace( this );
	}
}

void Space::Add( Object* object ) {
	ASSERT( !m_is_destroying, "space is destroying" );
	ASSERT( IsAccumulating(), "GC not in accumulation mode" );
	//GC_LOG( "Adding object: " + std::to_string( (unsigned long long)object ) );
	m_accumulated_objects.push_back( object );
}

void Space::Accumulate( gc::Object* const owner, const f_accum_t& f, const f_accum_t& f_cleanup, const bool need_now ) {
	ASSERT( m_thread_id.has_value(), "gc space thread id not set" );
	if ( need_now ) {
		ASSERT( m_thread_id == std::this_thread::get_id(), "accumulate needed now but thread is different" );
	}
	if ( m_thread_id == std::this_thread::get_id() ) {
		AccumulateImpl( f );
		if ( f_cleanup ) {
			f_cleanup();
		}
	}
	else {
		std::lock_guard guard( m_pending_accumulations_mutex );
		m_pending_accumulations.push_back(
			{ f, {
				owner,
				f_cleanup,
			} }
		);
	}
}

const bool Space::IsAccumulating() {
	std::lock_guard guard( m_accumulations_mutex );
	return m_accumulations.find( std::this_thread::get_id() ) != m_accumulations.end();
}

const uint64_t Space::GetAccumulationPass() const {
	return m_accumulation_pass;
}

const uint64_t Space::GetWrapperCacheGeneration() const {
	return m_wrapper_cache_generation.load();
}

void Space::InvalidateWrapperCache() {
	m_wrapper_cache_generation.fetch_add( 1 );
}

void Space::SetThreadId( const std::thread::id& thread_id ) {
	ASSERT( !m_thread_id.has_value(), "gc space thread id already set" );
	m_thread_id = thread_id;
}

void Space::ProcessAccumulations() {
	std::lock_guard guard( m_pending_accumulations_mutex );
	for ( const auto& it : m_pending_accumulations ) {
		AccumulateImpl( it.first );
	}
	for ( const auto& it : m_pending_accumulations ) {
		if ( it.second.cleanup ) {
			it.second.cleanup();
		}
	}
	m_pending_accumulations.clear();
}

void Space::Remove( Object* object ) {
	// this does nothing and exists to solve false positives from scanbuild
	// when he thinks some gse::Value (which inherits gc::Object) is memory leak
	// calling this method makes 'leak' message go away lol
	// in reality gc::Object can't produce leaks because they register at gc space and are deleted when
	// unreachable, except for a handful of 'root' objects that own gc space (these are known and deleted properly)
}

void Space::AccumulateImpl( const f_accum_t& f ) {
	bool is_accumulating;
	const auto tid = std::this_thread::get_id();
	{
		std::lock_guard guard( m_accumulations_mutex );
		is_accumulating = m_accumulations.find( tid ) != m_accumulations.end();
	}
	if ( is_accumulating ) { // recursive accumulate, nothing to do
		f();
	}
	else { // top accumulate, need to do full logic
		std::lock_guard guard2( m_accumulation_mutex );
		std::lock_guard guard( m_collect_mutex ); // do not accumulate during collect or vice versa // TODO: optimize to reduce lock times
		m_accumulation_pass = s_next_accumulation_pass.fetch_add( 1 );
		if ( m_accumulation_pass == 0 ) {
			m_accumulation_pass = s_next_accumulation_pass.fetch_add( 1 );
		}
		const auto& commit = [ this, &tid ]() {
			{
				std::lock_guard guard( m_accumulations_mutex );
				ASSERT( m_accumulations.find( tid ) != m_accumulations.end(), "accumulations thread not found" );
				m_accumulations.erase( tid );
			}
			if ( !m_accumulated_objects.empty() ) {
				std::lock_guard guard( m_objects_mutex );
				GC_LOG( "Accumulated " + std::to_string( m_accumulated_objects.size() ) + " objects" );
				m_objects.insert(
					m_objects.end(),
					m_accumulated_objects.begin(),
					m_accumulated_objects.end()
				);
				m_accumulated_objects.clear();
			}
		};
		ASSERT( m_accumulated_objects.empty(), "accumulated objects not empty" );
		{
			std::lock_guard guard3( m_accumulations_mutex );
			ASSERT( m_accumulations.find( tid ) == m_accumulations.end(), "accumulations thread already exists" );
			m_accumulations.insert( tid );
		}
		try {
			f();
		}
		catch ( const gse::Exception& e ) {
			commit();
			throw;
		}
		commit();
	}
}

const bool Space::Collect() {
	const auto collection_started = std::chrono::steady_clock::now();
	std::lock_guard guard2( m_pending_accumulations_mutex );
	std::lock_guard guard( m_collect_mutex ); // allow only one collection at same space at same time
	const auto collection_locked = std::chrono::steady_clock::now();

#if defined( GLSMAC_TESTING )
	static const bool s_profile_gc = g_engine->GetConfig()->HasDebugFlag( config::Config::DF_PROFILE_GC );
	static constexpr size_t PROFILE_SAMPLE_STRIDE = 1024;
	std::unordered_map< std::string, size_t > removed_type_samples = {};
#endif

	ASSERT( m_reachable_objects_tmp.empty(), "reachable objects tmp not empty" );
	Object::BeginReachabilityPass();

	GC_DEBUG_LOCK();
	GC_DEBUG_BEGIN( "Root" );
	Object::QueueReachable( m_root_object, m_reachable_objects_tmp );
	GC_DEBUG_END();

	if ( !m_pending_accumulations.empty() ) {
		GC_DEBUG_BEGIN( "pending accumulations owners" );
		for ( const auto& it : m_pending_accumulations ) {
			if ( it.second.owner ) {
				Object::QueueReachable( it.second.owner, m_reachable_objects_tmp );
			}
		}
		GC_DEBUG_END();
	}
	Object::DrainReachabilityQueue( m_reachable_objects_tmp );
	GC_DEBUG_UNLOCK();
	const auto reachability_finished = std::chrono::steady_clock::now();

	size_t removed_count = 0;
	size_t retained_count = 0;
	const size_t reachable_count = Object::GetReachableCount();
	auto sweep_started = reachability_finished;
	auto sweep_finished = reachability_finished;
	{
		std::lock_guard guard3( m_accumulations_mutex ); // prevent collection during accumulation // TODO: improve

		{
			std::lock_guard guard2( m_objects_mutex );

			g_engine->GetGraphics()->NoRender( // tmp: prevent race conditions with render thread
#if defined( GLSMAC_TESTING )
				[ this, &removed_count, &retained_count, reachable_count, &removed_type_samples, &sweep_started, &sweep_finished ]() {
#else
				[ this, &removed_count, &retained_count, reachable_count, &sweep_started, &sweep_finished ]() {
#endif
					sweep_started = std::chrono::steady_clock::now();
					for ( auto* const object : m_objects ) {
						if ( !object->IsReachable() ) {
#if defined( GLSMAC_TESTING )
							if ( s_profile_gc && removed_count % PROFILE_SAMPLE_STRIDE == 0 ) {
								removed_type_samples[ typeid( *object ).name() ]++;
							}
#endif
#if defined( DEBUG ) || defined( FASTDEBUG )
							GC_LOG( "Destroying unreachable object: " + util::String::ToHexString( (unsigned long long)object ) /* TODO + "[ " + object->ToString() + " ]"*/ );
#endif
#if defined( DEBUG ) || defined( FASTDEBUG )
							debug::g_memory_watcher->MaybeDelete( object );
#endif
							delete object;
							removed_count++;
						}
						else {
							m_objects[ retained_count++ ] = object;
						}
					}
					m_objects.resize( retained_count );
					sweep_finished = std::chrono::steady_clock::now();
					GC_LOG( "Kept " + std::to_string( reachable_count ) + " reachable objects, removed " + std::to_string( removed_count ) + " unreachable" );
				}
			);

			m_reachable_objects_tmp.clear();
		}
	}
	const auto collection_finished = std::chrono::steady_clock::now();
	const auto elapsed_ms = []( const auto& from, const auto& to ) {
		return std::chrono::duration_cast< std::chrono::milliseconds >( to - from ).count();
	};
	const auto collection_wait = elapsed_ms( collection_started, collection_locked );
	const auto collection_elapsed = elapsed_ms( collection_locked, collection_finished );
	if ( collection_elapsed >= 50 || collection_wait >= 50 ) {
		Log(
			"Slow collection: " + std::to_string( collection_elapsed ) + " ms active after " +
			std::to_string( collection_wait ) + " ms wait, " +
			std::to_string( reachable_count ) + " reachable, " +
			std::to_string( retained_count ) + " retained, " +
			std::to_string( removed_count ) + " removed; phases: lock " +
			std::to_string( elapsed_ms( collection_started, collection_locked ) ) + " ms, mark " +
			std::to_string( elapsed_ms( collection_locked, reachability_finished ) ) + " ms, sweep-wait " +
			std::to_string( elapsed_ms( reachability_finished, sweep_started ) ) + " ms, sweep " +
			std::to_string( elapsed_ms( sweep_started, sweep_finished ) ) + " ms, finish " +
			std::to_string( elapsed_ms( sweep_finished, collection_finished ) ) + " ms"
		);
	}
	m_has_collected = true;
	m_last_retained_count = retained_count;
	m_last_collection_time = std::chrono::steady_clock::now();
#if defined( GLSMAC_TESTING )
	if ( s_profile_gc && !removed_type_samples.empty() ) {
		std::vector< std::pair< std::string, size_t > > ordered_samples(
			removed_type_samples.begin(),
			removed_type_samples.end()
		);
		std::sort(
			ordered_samples.begin(),
			ordered_samples.end(),
			[]( const auto& a, const auto& b ) {
				return a.second != b.second ? a.second > b.second : a.first < b.first;
			}
		);
		std::string summary = "GC type samples (1/" + std::to_string( PROFILE_SAMPLE_STRIDE ) + "):";
		const size_t limit = std::min< size_t >( ordered_samples.size(), 12 );
		for ( size_t i = 0; i < limit; i++ ) {
			summary += " " + ordered_samples[ i ].first + "=" + std::to_string( ordered_samples[ i ].second );
		}
		Log( summary );
	}
#endif
	return removed_count > 0;
}

const bool Space::ShouldCollect() {
	const auto now = std::chrono::steady_clock::now();
	std::lock_guard guard( m_objects_mutex );
	if ( !m_has_collected ) {
		return m_objects.size() >= INITIAL_COLLECTION_OBJECTS ||
			now - m_last_collection_time >= MAX_COLLECTION_INTERVAL;
	}
	if ( now - m_last_collection_time >= MAX_COLLECTION_INTERVAL ) {
		return true;
	}
	const size_t growth_threshold = std::max(
		MIN_COLLECTION_GROWTH,
		m_last_retained_count / 4
	);
	return m_objects.size() >= m_last_retained_count &&
		m_objects.size() - m_last_retained_count >= growth_threshold;
}

}
