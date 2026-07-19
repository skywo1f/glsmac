#include "Base.h"

#include <limits>

#include "gse/context/Context.h"
#include "gse/value/Object.h"
#include "gse/value/Int.h"
#include "gse/value/String.h"
#include "gse/value/Undefined.h"
#include "gse/value/Array.h"
#include "gse/value/Bool.h"
#include "gse/callable/Native.h"
#include "game/backend/Game.h"
#include "game/backend/State.h"
#include "game/backend/slot/Slot.h"
#include "game/backend/slot/Slots.h"
#include "game/backend/map/Map.h"
#include "game/backend/map/tile/Tile.h"
#include "game/backend/faction/Faction.h"
#include "game/backend/base/BaseManager.h"
#include "Pop.h"
#include "PopDef.h"
#include "game/backend/Random.h"
#include "game/backend/resource/ResourceManager.h"

namespace game {
namespace backend {
namespace base {

static constexpr size_t MAX_SERIALIZED_POPS = 1024;

static size_t next_id = 1;
const size_t Base::GetNextId() {
	return next_id;
}
const void Base::SetNextId( const size_t id ) {
	next_id = id;
}

Base::Base(
	Game* game,
	const size_t id,
	slot::Slot* owner,
	faction::Faction* faction,
	map::tile::Tile* tile,
	const std::string& name,
	const pops_t& pops,
	const size_t next_pop_id
)
	: MapObject( game->GetMap(), tile )
	, m_game( game )
	, m_id( id )
	, m_owner( owner )
	, m_faction( faction )
	, m_name( name )
	, m_pops( pops )
	, m_next_pop_id( next_pop_id ) {
	if ( next_id <= id ) {
		next_id = id + 1;
	}
	ASSERT( !tile->base, "tile already has base" );
	tile->base = this;
	m_tile = tile;
	for ( auto& it : m_pops ) {
		it.second.SetBase( this );
	}
}

const  Game* const Base::GetGame() const {
	return m_game;
}

Pop* const Base::AddPop( const Pop& pop ) {
	ASSERT( m_pops.find( pop.m_id ) == m_pops.end(), "pop already exists" );
	m_pops.insert_or_assign( pop.m_id, pop );
	m_game->GetBM()->RefreshBase( this );
	TriggerUpdate();
	return &m_pops.at( pop.m_id );
}

void Base::RemovePop( GSE_CALLABLE, const size_t pop_id ) {
	const auto it = m_pops.find( pop_id );
	if ( it == m_pops.end() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "population does not belong to this base" );
	}
	if ( it->second.m_worked_tile ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "population must stop working before it can be removed" );
	}
	m_pops.erase( it );
	m_game->GetBM()->RefreshBase( this );
	TriggerUpdate();
}

void Base::ChangePopType( GSE_CALLABLE, const size_t pop_id, const std::string& def_id ) {
	ASSERT( m_pops.find( pop_id ) != m_pops.end(), "pop id " + std::to_string( pop_id ) + " not found" );
	auto& pop = m_pops.at( pop_id );
	const auto& defs = m_game->GetBM()->GetBasePopDefs();
	const auto& it = defs.find( def_id );
	if ( it == defs.end() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Unknown pop type: " + def_id );
	}
	if ( pop.m_def != it->second ) {
		pop.m_def = it->second;
		TriggerUpdate();
	}
}

void Base::WorkPopTile( GSE_CALLABLE, Pop* const pop, map::tile::Tile* const tile ) {
	if ( !pop || pop->m_base != this ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "population does not belong to this base" );
	}
	if ( !tile ) {
		GSE_ERROR( gse::EC.INVALID_CALL, "worked tile is null" );
	}
	if ( pop->m_worked_tile && pop->m_worked_tile != tile ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "population already works a tile" );
	}
	if ( m_worked_tiles.find( tile ) != m_worked_tiles.end() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "tile is already worked by this base" );
	}
	tile->SetWorkingPop( GSE_CALL, pop );
	pop->SetWorkedTile( GSE_CALL, tile );
	m_worked_tiles.insert( tile );
	TriggerUpdate();
}

void Base::UnworkPopTile( GSE_CALLABLE, Pop* const pop, map::tile::Tile* const tile ) {
	if ( !pop || pop->m_base != this ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "population does not belong to this base" );
	}
	if ( !tile || pop->m_worked_tile != tile ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "population does not work this tile" );
	}
	const auto it = m_worked_tiles.find( tile );
	if ( it == m_worked_tiles.end() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "tile is not worked by this base" );
	}
	tile->UnsetWorkingPop( GSE_CALL, pop );
	pop->UnsetWorkedTile( GSE_CALL, tile );
	m_worked_tiles.erase( it );
	TriggerUpdate();
}

const types::Buffer Base::Serialize( const Base* base ) {
	types::Buffer buf;
	std::unordered_set< map::tile::Tile* > pop_worked_tiles = {};
	for ( const auto& it : base->m_pops ) {
		const auto& pop = it.second;
		if ( pop.m_worked_tile ) {
			if (
				pop.GetWorkedTileLink() != pop.m_worked_tile ||
				pop.m_worked_tile->GetWorkingPop() != &pop
			) {
				THROW( "base population worker links do not match its assignment" );
			}
			if ( !pop_worked_tiles.insert( pop.m_worked_tile ).second ) {
				THROW( "multiple populations work the same tile" );
			}
		}
		else if ( pop.HasWorkedTileLink() ) {
			THROW( "unassigned base population has a worked tile link" );
		}
	}
	if ( pop_worked_tiles != base->m_worked_tiles ) {
		THROW( "base worked tiles do not match population assignments" );
	}
	buf.WriteInt( base->m_id );
	buf.WriteInt( base->m_owner->GetIndex() );
	buf.WriteString( base->m_faction->m_id );
	buf.WriteInt( base->m_tile->coord.x );
	buf.WriteInt( base->m_tile->coord.y );
	buf.WriteString( base->m_name );
	buf.WriteInt( base->m_pops.size() );
	for ( const auto& it : base->m_pops ) {
		buf.WriteInt( it.first );
		it.second.Serialize( buf );
	}
	buf.WriteInt( base->m_next_pop_id );
	auto* const accumulated_nutrients = const_cast< Base* >( base )->CustomGet( "accumulated_nutrients" );
	buf.WriteBool( accumulated_nutrients != nullptr );
	if ( accumulated_nutrients ) {
		if ( accumulated_nutrients->type != gse::VT_INT ) {
			THROW( "base accumulated nutrients must be an integer" );
		}
		buf.WriteInt( ( (gse::value::Int*)accumulated_nutrients )->value );
	}
	return buf;
}

Base* Base::Deserialize( GSE_CALLABLE, types::Buffer& buf, Game* game ) {
	ASSERT( game, "game is null" );
	const auto id = buf.ReadInt();
	auto* slot = &game->GetState()->m_slots->GetSlot( buf.ReadInt() );
	const auto faction_id = buf.ReadString();
	auto* faction = game->GetFaction( faction_id );
	const auto pos_x = buf.ReadInt();
	const auto pos_y = buf.ReadInt();
	auto* tile = game->GetMap()->GetTile( pos_x, pos_y );
	const auto name = buf.ReadString();
	pops_t pops = {};
	const auto pops_count = buf.ReadInt();
	if ( pops_count < 0 || pops_count > MAX_SERIALIZED_POPS ) {
		THROW( "invalid serialized base population count: " + std::to_string( pops_count ) );
	}
	for ( size_t i = 0 ; i < static_cast< size_t >( pops_count ) ; i++ ) {
		const auto pop_id = buf.ReadInt();
		if ( pop_id < 0 || static_cast< uint64_t >( pop_id ) > std::numeric_limits< size_t >::max() ) {
			THROW( "invalid serialized base population id: " + std::to_string( pop_id ) );
		}
		Pop pop = {};
		pop.Deserialize( buf, game );
		if ( pop.m_id != static_cast< size_t >( pop_id ) ) {
			THROW( "serialized base population id mismatch" );
		}
		if ( !pops.emplace( pop.m_id, pop ).second ) {
			THROW( "duplicate serialized base population id: " + std::to_string( pop.m_id ) );
		}
		const auto& renders = ( faction->m_flags & faction::Faction::FF_PROGENITOR )
			? pop.m_def->m_renders_progenitor
			: pop.m_def->m_renders_human;
		if ( pop.m_variant >= renders.size() ) {
			THROW( "serialized base population variant is unavailable" );
		}
	}
	const auto next_pop_id = buf.ReadInt();
	const bool has_accumulated_nutrients = buf.ReadBool();
	const auto accumulated_nutrients = has_accumulated_nutrients ? buf.ReadInt() : 0;
	auto* const base = new Base( game, id, slot, faction, tile, name, pops, next_pop_id );
	if ( has_accumulated_nutrients ) {
		base->CustomSet(
			"accumulated_nutrients",
			VALUE( gse::value::Int, , accumulated_nutrients )
		);
	}
	base->RestoreWorkedTiles( GSE_CALL );
	return base;
}

WRAPIMPL_SERIALIZE( Base )
	buf->WriteInt( obj->m_id );
}

WRAPIMPL_DESERIALIZE( Base )
	const auto id = buf->ReadInt();
	const auto& base = game->GetBM()->GetBase( id );
	ASSERT( base, "base id not found: " + std::to_string( id ) );
	return base->Wrap( GSE_CALL );
}

WRAPIMPL_DYNAMIC_GETTERS( Base )
	WRAPIMPL_GET_CUSTOM( "id", Int, m_id )
	WRAPIMPL_GET_CUSTOM( "name", String, m_name )
	WRAPIMPL_LINK( "get_owner", m_owner )
	WRAPIMPL_LINK( "get_tile", m_tile )
	WRAPIMPL_CUSTOM_SETTERS
	{
		"work_pop_tile",
		NATIVE_CALL( this ) {

			m_game->CheckRW( GSE_CALL );

			N_EXPECT_ARGS( 2 );
			N_GETVALUE_UNWRAP( pop, 0, Pop );
			N_GETVALUE_UNWRAP( tile, 1, map::tile::Tile );
			WorkPopTile( GSE_CALL, pop, tile );

			return VALUE( gse::value::Undefined );
		} )
	},
	{
		"unwork_pop_tile",
		NATIVE_CALL( this ) {

			m_game->CheckRW( GSE_CALL );

			N_EXPECT_ARGS( 2 );
			N_GETVALUE_UNWRAP( pop, 0, Pop );
			N_GETVALUE_UNWRAP( tile, 1, map::tile::Tile );
			UnworkPopTile( GSE_CALL, pop, tile );

			return VALUE( gse::value::Undefined );
		} )
	},
	{
		"create_pop",
		NATIVE_CALL( this ) {

			m_game->CheckRW( GSE_CALL );

			N_EXPECT_ARGS( 1 );
			N_GETVALUE( data, 0, Object );
			N_GETPROP( def_id, data, "type", String );
			N_GETPROP_UNWRAP_OPT( worked_tile, data, "worked_tile", map::tile::Tile );
			auto* def = GetPopDef( GSE_CALL, def_id );
			const auto max_variants = (m_faction->m_flags & faction::Faction::FF_PROGENITOR)
				? 1 // aliens have 1 gender
				: 2; // humans have 2
			ASSERT( max_variants > 0, "no variants found for pop type: " + def_id );
			if (
				worked_tile &&
				(
					m_worked_tiles.find( worked_tile ) != m_worked_tiles.end() ||
					worked_tile->HasWorkingPopLink()
				)
			) {
				GSE_ERROR( gse::EC.GAME_ERROR, "worked tile already has a population" );
			}

			auto* const pop = AddPop( Pop( this, m_next_pop_id++, def, m_game->GetRandom()->GetUInt(0, max_variants - 1), worked_tile ) );
			if ( worked_tile ) {
				WorkPopTile( GSE_CALL, pop, worked_tile );
			}

			return pop->Wrap( GSE_CALL );
		} )
	},
	{
		"destroy_pop",
		NATIVE_CALL( this ) {

			m_game->CheckRW( GSE_CALL );

			N_EXPECT_ARGS( 1 );
			N_GETVALUE_UNWRAP( pop, 0, Pop );

			const auto it = m_pops.find( pop->m_id );
			if ( it == m_pops.end() || &it->second != pop ) {
				GSE_ERROR( gse::EC.GAME_ERROR, "Base does not have pop " + std::to_string( pop->m_id ) );
			}

			RemovePop( GSE_CALL, pop->m_id );

			return VALUE( gse::value::Undefined );
		} )
	},
	{
		"add_worked_tile",
		NATIVE_CALL( this ) {

			m_game->CheckRW( GSE_CALL );

			N_EXPECT_ARGS( 1 );
			N_GETVALUE_UNWRAP( tile, 0, map::tile::Tile );

			if ( m_worked_tiles.find( tile ) != m_worked_tiles.end() ) {
				GSE_ERROR( gse::EC.GAME_ERROR, "This tile is already worked" );
			}
			auto* const pop = tile->GetWorkingPop();
			if ( !pop ) {
				GSE_ERROR( gse::EC.GAME_ERROR, "Worked tile has an invalid population link" );
			}
			WorkPopTile( GSE_CALL, pop, tile );

			return VALUE( gse::value::Undefined );
		} )
	},
	{
		"remove_worked_tile",
		NATIVE_CALL( this ) {

			m_game->CheckRW( GSE_CALL );

			N_EXPECT_ARGS( 1 );
			N_GETVALUE_UNWRAP( tile, 0, map::tile::Tile );

			if ( m_worked_tiles.find( tile ) == m_worked_tiles.end() ) {
				GSE_ERROR( gse::EC.GAME_ERROR, "This tile is not worked" );
			}
			Pop* pop = nullptr;
			for ( auto& it : m_pops ) {
				if ( it.second.m_worked_tile == tile ) {
					if ( pop ) {
						GSE_ERROR( gse::EC.GAME_ERROR, "Multiple populations work this tile" );
					}
					pop = &it.second;
				}
			}
			if ( !pop ) {
				GSE_ERROR( gse::EC.GAME_ERROR, "Worked tile does not identify its population" );
			}
			// Preserve compatibility with scripts that clear the two dynamic links first.
			tile->SetWorkingPop( GSE_CALL, pop );
			pop->SetWorkedTile( GSE_CALL, tile );
			UnworkPopTile( GSE_CALL, pop, tile );

			return VALUE( gse::value::Undefined );
		} )
	},
	{
		"is_tile_worked",
		NATIVE_CALL( this ) {
			N_EXPECT_ARGS( 1 );
			N_GETVALUE_UNWRAP( tile, 0, map::tile::Tile );
			return VALUE( gse::value::Bool,, m_worked_tiles.find( tile ) != m_worked_tiles.end() );
		} )
	},
	{
		"get_pops",
		NATIVE_CALL( this ) {
			N_EXPECT_ARGS( 0 );

			gse::value::array_elements_t elements = {};

			for ( auto& it : m_pops ) {
				elements.push_back( it.second.Wrap( GSE_CALL ) );
			}

			return VALUE( gse::value::Array,, elements );
		} ),
	},
	{
		"get_size",
		NATIVE_CALL( this ) {
			N_EXPECT_ARGS( 0 );
			return VALUE( gse::value::Int,, m_pops.size() );
		} ),
	},
	{
		"get_workable_tiles",
		NATIVE_CALL( this ) {
			N_EXPECT_ARGS( 0 );
			return GetWorkableTiles( GSE_CALL );
		} ),
	},
	{
		"get_worked_tiles",
		NATIVE_CALL( this ) {
			N_EXPECT_ARGS( 0 );
			return GetWorkedTiles( GSE_CALL );
		} ),
	},
	{
		"get_unworked_tiles",
		NATIVE_CALL( this ) {
			N_EXPECT_ARGS( 0 );
			return GetUnworkedTiles( GSE_CALL );
		} ),
	},
	{
		"get_intake",
		NATIVE_CALL( this ) {
			N_EXPECT_ARGS( 0 );
			return GetIntake( GSE_CALL );
		} ),
	},
	{
		"get_consumption",
		NATIVE_CALL( this ) {
			N_EXPECT_ARGS( 0 );
			return GetConsumption( GSE_CALL );
		} ),
	},
WRAPIMPL_DYNAMIC_SETTERS( Base )
WRAPIMPL_DYNAMIC_ON_SET( Base )
WRAPIMPL_DYNAMIC_END()

UNWRAPIMPL_PTR( Base )

void Base::GetReachableObjects( std::unordered_set< gc::Object* >& reachable_objects ) {
	gse::Wrappable::GetReachableObjects( reachable_objects );

	GC_DEBUG_BEGIN( "pops" );
	for ( auto& it : m_pops ) {
		it.second.GetReachableObjects( reachable_objects );
	}
	GC_DEBUG_END();
}

const PopDef* const Base::GetPopDef( GSE_CALLABLE, const std::string& id ) const {
	auto* def = m_game->GetBM()->GetPopDef( id );
	if ( !def ) {
		GSE_ERROR( gse::EC.INVALID_DEFINITION, "Unknown pop type: " + id );
	}
	return def;
}

gse::value::Array* const Base::GetWorkableTiles( GSE_CALLABLE ) {
	auto* const result = m_game->GetBM()->Trigger( GSE_CALL, "get_base_workable_tiles", ARGS_F( this ) {
		{
			"base",
			Wrap( GSE_CALL )
		},
	}; } );
	ASSERT( result, "GetWorkableTiles result is null" );
	if ( result->type != gse::VT_ARRAY ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "get_base_workable_tiles must return array, got: " + result->ToString() );
	}
	for ( const auto& v : ((gse::value::Array*)result)->value ) {
		if ( v->type != gse::VT_OBJECT || ((gse::value::Object*)v)->object_class != "Tile" ) {
			GSE_ERROR( gse::EC.GAME_ERROR, "get_base_workable_tiles elements must be objects of type Tile, got: " + v->ToString() );
		}
	}
	return (gse::value::Array*)result;
}

gse::value::Array* const Base::GetWorkedTiles( GSE_CALLABLE ) {
	gse::value::array_elements_t result = {};
	for ( const auto& tile : m_worked_tiles ) {
		result.push_back( tile->Wrap( GSE_CALL ) );
	}
	return VALUE( gse::value::Array,, result );
}

gse::value::Array* const Base::GetUnworkedTiles( GSE_CALLABLE ) {
	gse::value::array_elements_t result = {};
	const auto* workable_tiles_v = GetWorkableTiles( GSE_CALL );
	for ( const auto& v : workable_tiles_v->value ) {
		ASSERT( v->type == gse::VT_OBJECT && ((gse::value::Object*)v)->object_class == "Tile", "invalid tile object" );
		auto* tile = (map::tile::Tile*)((gse::value::Object*)v)->wrapobj;
		if ( m_worked_tiles.find( tile ) == m_worked_tiles.end() ) {
			result.push_back( v );
		}
	}
	return VALUE( gse::value::Array,, result );
}

gse::value::Object* const Base::GetIntake( GSE_CALLABLE ) {
	return GetResourcesFromCallback( GSE_CALL, m_game->GetBM(), m_game->GetRM(), "get_base_intake", ARGS_F( this ) {
		{
			"base",
			Wrap( GSE_CALL )
		},
		{
			"player",
			m_owner->Wrap( GSE_CALL )
		},
	}; } );
}

gse::value::Object* const Base::GetConsumption( GSE_CALLABLE ) {
	return GetResourcesFromCallback( GSE_CALL, m_game->GetBM(), m_game->GetRM(), "get_base_consumption", ARGS_F( this ) {
		{
			"base",
			Wrap( GSE_CALL )
		},
		{
			"player",
			m_owner->Wrap( GSE_CALL )
		},
	}; } );
}

void Base::RestoreWorkedTiles( GSE_CALLABLE ) {
	if ( !m_worked_tiles.empty() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "base worked tiles were already restored" );
	}
	std::unordered_set< map::tile::Tile* > restored_tiles = {};
	for ( auto& it : m_pops ) {
		auto& pop = it.second;
		auto* const tile = pop.m_worked_tile;
		if ( tile ) {
			if ( !restored_tiles.insert( tile ).second ) {
				GSE_ERROR( gse::EC.GAME_ERROR, "multiple populations work the same tile" );
			}
			if ( tile->HasWorkingPopLink() || pop.HasWorkedTileLink() ) {
				GSE_ERROR( gse::EC.GAME_ERROR, "serialized worker links were already restored" );
			}
		}
	}
	for ( auto& it : m_pops ) {
		auto& pop = it.second;
		auto* const tile = pop.m_worked_tile;
		if ( tile ) {
			tile->SetWorkingPop( GSE_CALL, &pop );
			pop.SetWorkedTile( GSE_CALL, tile );
		}
	}
	m_worked_tiles = restored_tiles;
}

void Base::TriggerUpdate() {
	m_game->GetBM()->AddUpdateTrigger( this );
}

}
}
}
