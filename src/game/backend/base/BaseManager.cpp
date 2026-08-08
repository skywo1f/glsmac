#include "BaseManager.h"

#include <algorithm>
#include <memory>
#include <unordered_set>

#include "game/backend/Game.h"
#include "game/backend/State.h"
#include "game/backend/Bindings.h"
#include "game/backend/slot/Slots.h"
#include "game/backend/Player.h"
#include "game/backend/faction/Faction.h"

#include "Base.h"
#include "FacilityDef.h"
#include "PopDef.h"

#include "gse/context/Context.h"
#include "gse/callable/Native.h"
#include "gse/value/Bool.h"
#include "gse/value/Array.h"
#include "gse/value/Float.h"

namespace game {
namespace backend {
namespace base {

BaseManager::BaseManager( Game* game )
	: gse::GCWrappable( game->GetGCSpace() )
	, m_game( game ) {
	//
}

BaseManager::~BaseManager() {
	Clear();
}

void BaseManager::Clear() {
	for ( auto& it : m_facility_defs ) {
		delete it.second;
	}
	m_facility_defs.clear();
	for ( auto& it : m_base_popdefs ) {
		delete it.second;
	}
	m_base_popdefs.clear();
	for ( auto& it : m_bases ) {
		delete it.second;
	}
	m_bases.clear();

	m_registered_base_names.clear();
	m_unprocessed_bases.clear();
	m_base_updates.clear();
	{
		std::lock_guard guard( m_updated_bases_mutex );
		m_updated_bases.clear();
	}
}

base::FacilityDef* BaseManager::GetFacilityDef( const std::string& id ) const {
	const auto& it = m_facility_defs.find( id );
	return it == m_facility_defs.end()
		? nullptr
		: it->second;
}

base::PopDef* BaseManager::GetPopDef( const std::string& id ) const {
	const auto& it = m_base_popdefs.find( id );
	if ( it != m_base_popdefs.end() ) {
		return it->second;
	}
	else {
		return nullptr;
	}
}

base::Base* BaseManager::GetBase( const size_t id ) const {
	const auto& it = m_bases.find( id );
	if ( it != m_bases.end() ) {
		return it->second;
	}
	else {
		return nullptr;
	}
}

void BaseManager::DefinePop( base::PopDef* pop_def ) {
	Log( "Defining base pop ('" + pop_def->m_id + "')" );

	ASSERT( m_base_popdefs.find( pop_def->m_id ) == m_base_popdefs.end(), "Base pop def '" + pop_def->m_id + "' already exists" );

	m_base_popdefs.insert(
		{
			pop_def->m_id,
			pop_def
		}
	);

	auto fr = FrontendRequest( FrontendRequest::FR_BASE_POP_DEFINE );
	NEW( fr.data.base_pop_define.serialized_popdef, std::string, base::PopDef::Serialize( pop_def ).ToString() );
	m_game->AddFrontendRequest( fr );
}

void BaseManager::UndefinePop( const std::string& id ) {
	Log( "Undefining base pop ('" + id + "')" );

	ASSERT( m_base_popdefs.find( id ) != m_base_popdefs.end(), "Base pop def '" + id + "' does not exist" );

	m_base_popdefs.erase( id );

	auto fr = FrontendRequest( FrontendRequest::FR_BASE_POP_UNDEFINE );
	NEW( fr.data.base_pop_undefine.id, std::string, id );
	m_game->AddFrontendRequest( fr );
}

void BaseManager::DefineFacility( base::FacilityDef* facility_def ) {
	if ( !facility_def ) {
		THROW( "cannot define a null base facility" );
	}
	Log( "Defining base facility ('" + facility_def->m_id + "')" );
	if ( m_facility_defs.find( facility_def->m_id ) != m_facility_defs.end() ) {
		THROW( "Base facility def '" + facility_def->m_id + "' already exists" );
	}
	m_facility_defs.insert( { facility_def->m_id, facility_def } );
}

void BaseManager::UndefineFacility( const std::string& id ) {
	Log( "Undefining base facility ('" + id + "')" );
	const auto it = m_facility_defs.find( id );
	if ( it == m_facility_defs.end() ) {
		THROW( "Base facility def '" + id + "' does not exist" );
	}
	delete it->second;
	m_facility_defs.erase( it );
}

void BaseManager::SpawnBase( GSE_CALLABLE, base::Base* base ) {

	auto* tile = base->GetTile();

	// validate and fix name if needed (or assign if empty)
	std::vector< std::string > names_to_try = {};
	if ( base->m_name.empty() ) {
		const auto& names = base->m_owner->GetPlayer()->GetFaction()->m_base_names;
		names_to_try = tile->is_water_tile
			? names.water
			: names.land;
	}
	else if ( m_registered_base_names.find( base->m_name ) != m_registered_base_names.end() ) {
		names_to_try = { base->m_name };
	}
	if ( !names_to_try.empty() ) {
		size_t cycle = 0;
		bool found = false;
		while ( !found ) {
			cycle++;
			for ( const auto& name_to_try : names_to_try ) {
				base->m_name = cycle == 1
					? name_to_try
					: name_to_try + " " + std::to_string( cycle );
				if ( m_registered_base_names.find( base->m_name ) == m_registered_base_names.end() ) {
					found = true;
					break;
				}
			}
		}
	}
	m_registered_base_names.insert( base->m_name );

	Log( "Spawning base #" + std::to_string( base->m_id ) + " ( " + base->m_name + " ) at " + base->GetTile()->ToString() );

	ASSERT( m_bases.find( base->m_id ) == m_bases.end(), "duplicate base id" );
	m_bases.insert_or_assign( base->m_id, base );

	QueueBaseUpdate( base, BUO_SPAWN );

	auto* state = m_game->GetState();
	if ( state->IsMaster() ) {
		state->TriggerObject( this, "base_spawn", ARGS_F( &base ) {
			{
				"base",
				base->Wrap( GSE_CALL )
			},
		}; } );
	}

	RefreshBase( base );
}

void BaseManager::DespawnBase( GSE_CALLABLE, const size_t base_id ) {

	const auto& it = m_bases.find( base_id );
	if ( it == m_bases.end() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Base id " + std::to_string( base_id ) + " not found" );
	}

	auto* base = it->second;

	Log( "Despawning base #" + std::to_string( base->m_id ) + " at " + base->GetTile()->ToString() );
	for ( auto& pop_it : base->m_pops ) {
		auto& pop = pop_it.second;
		if ( pop.m_worked_tile ) {
			base->UnworkPopTile( GSE_CALL, &pop, pop.m_worked_tile );
		}
	}

	{
		std::lock_guard guard( m_updated_bases_mutex );
		m_updated_bases.erase( base );
	}

	QueueBaseUpdate( base, BUO_DESPAWN );

	auto* tile = base->GetTile();
	ASSERT( tile, "base tile not set" );
	ASSERT( tile->base, "base not found in tile" );
	ASSERT( tile->base == base, "tile base mismatch" );
	tile->base = nullptr;

	m_bases.erase( it );
	m_registered_base_names.erase( base->m_name );

	auto* state = m_game->GetState();
	if ( state->IsMaster() ) {
		state->TriggerObject( this, "base_despawn", ARGS_F( &base ) {
			{
				"base",
				base->Wrap( GSE_CALL )
			}
		}; } );
	}

	delete base;
}

const std::map< size_t, Base* >& BaseManager::GetBases() const {
	return m_bases;
}

const BaseManager::popdefs_t& BaseManager::GetBasePopDefs() const {
	return m_base_popdefs;
}

const BaseManager::facilitydefs_t& BaseManager::GetFacilityDefs() const {
	return m_facility_defs;
}

void BaseManager::ProcessUnprocessed( GSE_CALLABLE ) {
	for ( auto& it : m_unprocessed_bases ) {
		SpawnBase( GSE_CALL, base::Base::Deserialize( GSE_CALL, it, m_game ) );
	}
	m_unprocessed_bases.clear();
}

void BaseManager::PushUpdates() {
	if ( m_game->IsRunning() && !m_base_updates.empty() ) {
		for ( const auto& it : m_base_updates ) {
			const auto base_id = it.first;
			const auto& bu = it.second;
			const auto& base = bu.base;
			if ( bu.ops & BUO_SPAWN ) {
				auto fr = FrontendRequest( FrontendRequest::FR_BASE_SPAWN );
				fr.data.base_spawn.base_id = base->m_id;
				fr.data.base_spawn.slot_index = base->m_owner->GetIndex();
				NEW( fr.data.base_spawn.faction_id, std::string, base->m_faction->m_id );
				const auto* tile = base->GetTile();
				fr.data.base_spawn.tile_coords = {
					tile->coord.x,
					tile->coord.y
				};
				const auto c = base->GetRenderCoords();
				fr.data.base_spawn.render_coords = {
					c.x,
					c.y,
					c.z
				};
				NEW( fr.data.base_spawn.name, std::string, base->m_name );
				m_game->AddFrontendRequest( fr );
			}
			if ( bu.ops & BUO_REFRESH ) {
				auto fr = FrontendRequest( FrontendRequest::FR_BASE_UPDATE );
				fr.data.base_update.base_id = base->m_id;
				fr.data.base_update.slot_index = base->m_owner->GetIndex();
				NEW( fr.data.base_update.name, std::string, base->m_name );
				NEW( fr.data.base_update.faction_id, std::string, base->m_faction->m_id );
				NEW( fr.data.base_update.pops, FrontendRequest::base_pops_t, {} );
				for ( const auto& it : base->m_pops ) {
					fr.data.base_update.pops->push_back(
						{
							it.second.m_def->m_id,
							it.second.m_variant
						}
					);
				}
				m_game->AddFrontendRequest( fr );
			}
			if ( bu.ops & BUO_DESPAWN ) {
				auto fr = FrontendRequest( FrontendRequest::FR_BASE_DESPAWN );
				fr.data.base_despawn.base_id = base_id;
				m_game->AddFrontendRequest( fr );
			}
		}
		m_base_updates.clear();
	}
}

WRAPIMPL_BEGIN( BaseManager )
	WRAPIMPL_PROPS
	WRAPIMPL_TRIGGERS
		{
			"define_facility",
			NATIVE_CALL( this ) {
				m_game->CheckRW( GSE_CALL );
				N_EXPECT_ARGS( 2 );
				N_GETVALUE( id, 0, String );
				N_GETVALUE( def, 1, Object );
				N_GETPROP( name, def, "name", String );
				N_GETPROP( mineral_cost, def, "mineral_cost", Int );
				N_GETPROP_OPT( int64_t, nutrient_bonus, def, "nutrient_bonus", Int, 0 );
				N_GETPROP_OPT( int64_t, mineral_bonus, def, "mineral_bonus", Int, 0 );
				N_GETPROP_OPT( int64_t, energy_bonus, def, "energy_bonus", Int, 0 );
				N_GETPROP_OPT( int64_t, energy_maintenance, def, "energy_maintenance", Int, 0 );
				N_GETPROP_OPT( std::string, required_technology, def, "required_technology", String, "" );
				N_GETPROP_OPT( int64_t, psych_bonus, def, "psych_bonus", Int, 0 );
				N_GETPROP_OPT( float, research_multiplier, def, "research_multiplier", Float, 0.0f );
				N_GETPROP_OPT( float, defense_multiplier, def, "defense_multiplier", Float, 1.0f );
				N_GETPROP_OPT( float, economy_multiplier, def, "economy_multiplier", Float, 0.0f );
				N_GETPROP_OPT( int64_t, unit_morale_bonus, def, "unit_morale_bonus", Int, 0 );
				N_GETPROP_OPT( int64_t, research_bonus, def, "research_bonus", Int, 0 );
				if (
					id.empty() ||
					name.empty() ||
					mineral_cost <= 0 ||
					mineral_cost > base::FacilityDef::MAX_MINERAL_COST ||
					nutrient_bonus < 0 ||
					nutrient_bonus > base::FacilityDef::MAX_RESOURCE_BONUS ||
					mineral_bonus < 0 ||
					mineral_bonus > base::FacilityDef::MAX_RESOURCE_BONUS ||
					energy_bonus < 0 ||
					energy_bonus > base::FacilityDef::MAX_RESOURCE_BONUS ||
					energy_maintenance < 0 ||
					energy_maintenance > base::FacilityDef::MAX_ENERGY_MAINTENANCE ||
					psych_bonus < 0 ||
					psych_bonus > base::FacilityDef::MAX_RESOURCE_BONUS ||
					research_multiplier < 0.0f ||
					research_multiplier > base::FacilityDef::MAX_RESEARCH_MULTIPLIER ||
					defense_multiplier < 1.0f ||
					defense_multiplier > base::FacilityDef::MAX_DEFENSE_MULTIPLIER ||
					economy_multiplier < 0.0f ||
					economy_multiplier > base::FacilityDef::MAX_ECONOMY_MULTIPLIER ||
					unit_morale_bonus < 0 ||
					unit_morale_bonus > base::FacilityDef::MAX_UNIT_MORALE_BONUS ||
					research_bonus < 0 ||
					research_bonus > base::FacilityDef::MAX_RESOURCE_BONUS
				) {
					GSE_ERROR( gse::EC.INVALID_CALL, "Invalid base facility definition: " + id );
				}
				if ( m_facility_defs.find( id ) != m_facility_defs.end() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Base facility def '" + id + "' already exists" );
				}
				DefineFacility( new base::FacilityDef(
					id,
					name,
					mineral_cost,
					nutrient_bonus,
					mineral_bonus,
					energy_bonus,
					energy_maintenance,
					required_technology,
					psych_bonus,
					research_multiplier,
					defense_multiplier,
					economy_multiplier,
					unit_morale_bonus,
					research_bonus
				) );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"undefine_facility",
			NATIVE_CALL( this ) {
				m_game->CheckRW( GSE_CALL );
				N_EXPECT_ARGS( 1 );
				N_GETVALUE( id, 0, String );
				if ( m_facility_defs.find( id ) == m_facility_defs.end() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Base facility def '" + id + "' does not exist" );
				}
				UndefineFacility( id );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"get_facility_def",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 1 );
				N_GETVALUE( id, 0, String );
				auto* const def = GetFacilityDef( id );
				if ( !def ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Base facility def '" + id + "' does not exist" );
				}
				return def->Wrap( GSE_CALL );
			} )
		},
		{
			"get_facility_defs",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				std::vector< base::FacilityDef* > defs = {};
				defs.reserve( m_facility_defs.size() );
				for ( const auto& it : m_facility_defs ) {
					defs.push_back( it.second );
				}
				std::sort(
					defs.begin(),
					defs.end(),
					[]( const base::FacilityDef* left, const base::FacilityDef* right ) {
						return left->m_id < right->m_id;
					}
				);
				gse::value::array_elements_t result = {};
				result.reserve( defs.size() );
				for ( auto* const def : defs ) {
					result.push_back( def->Wrap( GSE_CALL ) );
				}
				return VALUE( gse::value::Array,, result );
			} )
		},
		{
			"define_pop",
			NATIVE_CALL( this ) {

				m_game->CheckRW( GSE_CALL );

				N_EXPECT_ARGS( 2 );
				N_GETVALUE( id, 0, String );
				N_GETVALUE( def, 1, Object );

				N_GETPROP( name, def, "name", String );

				base::pop_render_infos_t rh = {};
				base::pop_render_infos_t rp = {};
				const auto& f_read_renders = [ &def, &arg, &gc_space, &ctx, &si, &ep, &getprop_val, &obj_it ]( const std::string& key, base::pop_render_infos_t& out ) {
					N_GETPROP( renders, def, key, Array );
					out.reserve( renders.size() );
					for ( const auto& v : renders ) {
						if ( v->type != gse::VT_OBJECT ) {
							GSE_ERROR( gse::EC.INVALID_CALL, "Pop render elements must be objects" );
						}
						const auto* obj = (gse::value::Object*)v;
						const auto& ov = obj->value;
						N_GETPROP( type, ov, "type", String );
						if ( type == "sprite" ) {
							N_GETPROP( file, ov, "file", String );
							N_GETPROP( x, ov, "x", Int );
							N_GETPROP( y, ov, "y", Int );
							N_GETPROP( w, ov, "w", Int );
							N_GETPROP( h, ov, "h", Int );
							out.push_back(
								base::pop_render_info_t{
									file,
									(uint16_t)x,
									(uint16_t)y,
									(uint16_t)w,
									(uint16_t)h
								}
							);
						}
						else {
							GSE_ERROR( gse::EC.INVALID_CALL, "Only sprite pops are supported for now" );
						}

					}
				};
				f_read_renders( "renders_human", rh );
				f_read_renders( "renders_progenitor", rp );

				base::PopDef::pop_flags_t flags = base::PopDef::PF_NONE;
				N_GETPROP_OPT( bool, can_work_tiles, def, "tile_worker", Bool, false );
				if ( can_work_tiles ) {
					flags |= base::PopDef::PF_TILE_WORKER;
				}

				DefinePop( new base::PopDef( id, name, rh, rp, flags ) );

				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"undefine_pop",
			NATIVE_CALL( this ) {

				m_game->CheckRW( GSE_CALL );

				N_EXPECT_ARGS( 1 );
				N_GETVALUE( id, 0, String );

				UndefinePop( id );

				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"get_pop_renders",
			NATIVE_CALL( this ) {

				N_EXPECT_ARGS( 1 );
				N_GETVALUE_UNWRAP( player, 0, Player );

				gse::value::object_properties_t defs = {};

				const auto& faction = player->GetFaction();

				for ( const auto& it : m_base_popdefs ) {
					gse::value::array_elements_t variants = {};
					const auto& renders = ( faction->m_flags & faction::Faction::FF_PROGENITOR )
						? it.second->m_renders_progenitor
						: it.second->m_renders_human
					;
					for ( const auto& render : renders ) {
						variants.push_back( VALUE( gse::value::String,, render.file + ":crop(" + std::to_string( render.x ) + "," + std::to_string( render.y ) + "," + std::to_string( render.x + render.width - 1 ) + "," + std::to_string( render.y + render.height - 1 ) + ")" ) );
					}
					defs.insert({ it.first, VALUE( gse::value::Array,, variants ) } );
				}

				return VALUE( gse::value::Object,, GSE_CALL_NOGC, defs );
			} )
		},
		{
			"spawn_base",
			NATIVE_CALL( this ) {

				m_game->CheckRW( GSE_CALL );

				N_EXPECT_ARGS_MIN_MAX( 3, 4 );
				N_GETVALUE_UNWRAP( owner, 0, Player );
				N_GETVALUE_UNWRAP( tile, 1, map::tile::Tile );

				N_GETVALUE( info, 2, Object );
				N_GETPROP_OPT( std::string, name, info, "name", String, "" );
				N_GETPROP_OPT( std::string, production_unit_id, info, "production", String, "" );
				base::Base::production_queue_t production_queue = {};
				if ( !production_unit_id.empty() ) {
					production_queue.push_back( { base::Base::PK_UNIT, production_unit_id } );
				}

				if ( arguments.size() > 3 ) {
					// N_GET_CALLABLE( on_spawn, 3 ); not used???
				}

				auto* base = new base::Base(
					m_game,
					base::Base::GetNextId(),
					owner->GetSlot(),
					owner->GetFaction(),
					tile,
					name,
					{},
					1,
					production_queue
				);

				SpawnBase( GSE_CALL, base );

				return base->Wrap( GSE_CALL );
			} )
		},
		{
			"despawn_base",
			NATIVE_CALL( this ) {

				m_game->CheckRW( GSE_CALL );

				N_EXPECT_ARGS( 1 );

				if ( arguments.at( 0 )->type == gse::VT_INT ) {
					N_GETVALUE( base_id, 0, Int );
					DespawnBase( GSE_CALL, base_id );
				}
				else {
					N_GETVALUE_UNWRAP( base, 0, Base );
					DespawnBase( GSE_CALL, base->m_id );
				}

				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"get_bases",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				gse::value::array_elements_t arr = {};
				arr.reserve( m_bases.size() );
				for ( const auto& it : m_bases ) {
					arr.push_back( it.second->Wrap( GSE_CALL ) );
				}

				return VALUE( gse::value::Array,, arr );
			} )
		},
	};
WRAPIMPL_END_PTR()

UNWRAPIMPL_PTR( BaseManager )

void BaseManager::TriggerUpdates( GSE_CALLABLE ) {
	std::lock_guard guard( m_updated_bases_mutex );
	for ( const auto& base : m_updated_bases ) {
		m_game->Trigger( GSE_CALL, "update_base", ARGS_F( base ) {
			{
				"base",
				base->Wrap( GSE_CALL )
			},
		}; } );
	}
	m_updated_bases.clear();
}

void BaseManager::Serialize( types::Buffer& buf ) const {
	Log( "Serializing " + std::to_string( m_facility_defs.size() ) + " base facility defs" );
	buf.WriteInt( m_facility_defs.size() );
	std::vector< std::string > facility_ids = {};
	facility_ids.reserve( m_facility_defs.size() );
	for ( const auto& it : m_facility_defs ) {
		facility_ids.push_back( it.first );
	}
	std::sort( facility_ids.begin(), facility_ids.end() );
	for ( const auto& id : facility_ids ) {
		buf.WriteString( id );
		buf.WriteString( base::FacilityDef::Serialize( m_facility_defs.at( id ) ).ToString() );
	}

	Log( "Serializing " + std::to_string( m_base_popdefs.size() ) + " base pop defs" );
	buf.WriteInt( m_base_popdefs.size() );
	for ( const auto& it : m_base_popdefs ) {
		buf.WriteString( it.first );
		buf.WriteString( base::PopDef::Serialize( it.second ).ToString() );
	}

	Log( "Serializing " + std::to_string( m_bases.size() ) + " bases" );
	buf.WriteInt( m_bases.size() );
	for ( const auto& it : m_bases ) {
		buf.WriteString( base::Base::Serialize( it.second ).ToString() );
	}
	buf.WriteInt( base::Base::GetNextId() );

	Log( "Saved next base id: " + std::to_string( base::Base::GetNextId() ) );
}

void BaseManager::Deserialize( GSE_CALLABLE, types::Buffer& buf ) {
	if ( !m_facility_defs.empty() || !m_base_popdefs.empty() || !m_bases.empty() || !m_unprocessed_bases.empty() ) {
		THROW( "cannot deserialize bases into a non-empty manager" );
	}

	size_t sz = buf.ReadCollectionSize( "base facility definition" );
	m_facility_defs.reserve( sz );
	Log( "Unserializing " + std::to_string( sz ) + " base facility defs" );
	for ( size_t i = 0 ; i < sz ; i++ ) {
		const auto id = buf.ReadString();
		auto b = types::Buffer( buf.ReadString() );
		auto facility_def = std::unique_ptr< base::FacilityDef >( base::FacilityDef::Deserialize( b ) );
		if ( b.GetRemaining() != 0 ) {
			THROW( "unexpected data after serialized base facility definition" );
		}
		if ( id != facility_def->m_id ) {
			THROW( "serialized base facility definition id mismatch" );
		}
		if ( m_facility_defs.find( id ) != m_facility_defs.end() ) {
			THROW( "duplicate serialized base facility definition: " + id );
		}
		DefineFacility( facility_def.release() );
	}

	sz = buf.ReadCollectionSize( "base population definition" );
	m_base_popdefs.reserve( sz );
	Log( "Unserializing " + std::to_string( sz ) + " base pop defs" );
	for ( size_t i = 0 ; i < sz ; i++ ) {
		const auto name = buf.ReadString();
		auto b = types::Buffer( buf.ReadString() );
		auto pop_def = std::unique_ptr< base::PopDef >( base::PopDef::Deserialize( b ) );
		if ( b.GetRemaining() != 0 ) {
			THROW( "unexpected data after serialized base population definition" );
		}
		if ( name != pop_def->m_id ) {
			THROW( "serialized base population definition id mismatch" );
		}
		if ( m_base_popdefs.find( name ) != m_base_popdefs.end() ) {
			THROW( "duplicate serialized base population definition: " + name );
		}
		DefinePop( pop_def.release() );
	}

	sz = buf.ReadCollectionSize( "base" );
	Log( "Unserializing " + std::to_string( sz ) + " bases" );
	if ( !m_game->IsRunning() ) {
		m_unprocessed_bases.reserve( sz );
	}
	std::unordered_set< size_t > serialized_base_ids = {};
	size_t max_base_id = 0;
	for ( size_t i = 0 ; i < sz ; i++ ) {
		auto b = types::Buffer( buf.ReadString() );
		auto id_buffer = b;
		const auto id = id_buffer.ReadInt< size_t >( "base id" );
		if ( id == 0 || !serialized_base_ids.insert( id ).second ) {
			THROW( "invalid or duplicate serialized base id: " + std::to_string( id ) );
		}
		max_base_id = std::max( max_base_id, id );
		if ( m_game->IsRunning() ) {
			auto base = std::unique_ptr< base::Base >( base::Base::Deserialize( GSE_CALL, b, m_game ) );
			SpawnBase( GSE_CALL, base.release() );
		}
		else {
			m_unprocessed_bases.push_back( b );
		}
	}

	const auto next_base_id = buf.ReadInt< size_t >( "next base id" );
	if ( next_base_id == 0 || next_base_id <= max_base_id ) {
		THROW( "invalid serialized next base id" );
	}
	if ( buf.GetRemaining() != 0 ) {
		THROW( "unexpected data after serialized base manager" );
	}
	base::Base::SetNextId( next_base_id );
	Log( "Restored next base id: " + std::to_string( base::Base::GetNextId() ) );
}

void BaseManager::RefreshBase( const base::Base* base ) {
	QueueBaseUpdate( base, BUO_REFRESH );
}

void BaseManager::AddUpdateTrigger( base::Base* base ) {
	std::lock_guard guard( m_updated_bases_mutex );
	m_updated_bases.insert( base );
}

void BaseManager::GetReachableObjects( std::unordered_set< Object* >& reachable_objects ) {
	gse::GCWrappable::GetReachableObjects( reachable_objects );

	GC_DEBUG_BEGIN( "BaseManager" );
	GC_DEBUG_BEGIN( "facilities" );
	for ( const auto& it : m_facility_defs ) {
		it.second->GetReachableObjects( reachable_objects );
	}
	GC_DEBUG_END();

	GC_DEBUG_BEGIN( "bases" );
	for ( const auto& it : m_bases ) {
		it.second->GetReachableObjects( reachable_objects );
	}
	GC_DEBUG_END();

	GC_DEBUG_END();
}

void BaseManager::QueueBaseUpdate( const Base* base, const base_update_op_t op ) {
	auto it = m_base_updates.find( base->m_id );
	if ( it == m_base_updates.end() ) {
		it = m_base_updates.insert(
			{
				base->m_id,
				{
					{},
					base,
				}
			}
		).first;
	}
	auto& update = it->second;
	if ( op == BUO_DESPAWN ) {
		if ( update.ops & BUO_SPAWN ) {
			// if base is despawned immediately after spawning - frontend doesn't need to know
			m_base_updates.erase( it );
			return;
		}
		update.ops = BUO_NONE; // clear other actions if base was despawned
	}
	if ( op == BUO_SPAWN || op == BUO_REFRESH ) {
		if ( update.ops & BUO_DESPAWN ) {
			// do not despawn if it needs to spawn or refresh, i.e. if event was rolled back
			update.ops = (base_update_op_t)( (uint8_t)update.ops & ~BUO_DESPAWN);
			if ( op == BUO_SPAWN ) {
				// if there's pending despawn event it means unit was already spawned, nothing to do
				m_base_updates.erase( it );
				return;
			}
		}
	}
	// add to operations list
	update.ops = (base_update_op_t)( (uint8_t)update.ops | (uint8_t)op );
}

}
}
}
