#include "Game.h"

#include <algorithm>

#include "engine/Engine.h"
#include "types/Exception.h"
#include "types/texture/Texture.h"
#include "types/mesh/Render.h"
#include "types/mesh/Data.h"
#include "util/FS.h"
#include "types/Buffer.h"
#include "State.h"
#include "game/backend/faction/Faction.h"
#include "game/backend/faction/FactionManager.h"
#include "Random.h"
#include "config/Config.h"
#include "slot/Slots.h"
#include "Player.h"
#include "connection/Connection.h"
#include "connection/Server.h"
#include "connection/Client.h"
#include "map/Map.h"
#include "map/Consts.h"
#include "gse/value/String.h"
#include "gse/value/Int.h"
#include "gse/value/Undefined.h"
#include "gse/value/Array.h"
#include "gse/value/Null.h"
#include "gse/GSE.h"
#include "gse/context/Context.h"
#include "map/tile/TileManager.h"
#include "map/tile/Tiles.h"
#include "map/MapState.h"
#include "resource/ResourceManager.h"
#include "Bindings.h"
#include "graphics/Graphics.h"
#include "animation/Def.h"
#include "unit/Def.h"
#include "unit/StaticDef.h"
#include "unit/UnitManager.h"
#include "unit/Unit.h"
#include "unit/MoraleSet.h"
#include "base/BaseManager.h"
#include "base/PopDef.h"
#include "base/Base.h"
#include "animation/AnimationManager.h"
#include "gc/Space.h"
#include "game/backend/event/Event.h"
#include "game/backend/event/EventHandler.h"
#include "gse/value/Bool.h"

namespace game {
namespace backend {

response_map_data_t::~response_map_data_t() {
	if ( terrain_texture ) {
		DELETE( terrain_texture );
	}
	if ( terrain_mesh ) {
		DELETE( terrain_mesh );
	}
	if ( terrain_data_mesh ) {
		DELETE( terrain_data_mesh );
	}
};

Game::Game()
	: gse::GCWrappable( nullptr ) {}

common::mt_id_t Game::MT_Ping() {
	MT_Request request = {};
	request.op = OP_PING;
	return MT_CreateRequest( request );
}

common::mt_id_t Game::MT_Init( State* state ) {
 	MT_Request request = {};
	request.op = OP_INIT;
	return MT_CreateRequest( request );
}

common::mt_id_t Game::MT_GetMapData() {
	MT_Request request = {};
	request.op = OP_GET_MAP_DATA;
	return MT_CreateRequest( request );
}

common::mt_id_t Game::MT_Reset() {
	m_init_cancel = true; // stop initialization in Iterate()
	MT_Request request = {};
	request.op = OP_RESET;
	return MT_CreateRequest( request );
}

common::mt_id_t Game::MT_SaveMap( const std::string& path ) {
	ASSERT( !path.empty(), "savemap path is empty" );
	MT_Request request = {};
	request.op = OP_SAVE_MAP;
	NEW( request.data.save_map.path, std::string );
	*request.data.save_map.path = path;
	return MT_CreateRequest( request );
}

common::mt_id_t Game::MT_SaveGame( const std::string& path ) {
	ASSERT( !path.empty(), "save-game path is empty" );
	MT_Request request = {};
	request.op = OP_SAVE_GAME;
	NEW( request.data.save_map.path, std::string );
	*request.data.save_map.path = path;
	return MT_CreateRequest( request );
}

common::mt_id_t Game::MT_GetFrontendRequests() {
	MT_Request request = {};
	request.op = OP_GET_FRONTEND_REQUESTS;
	return MT_CreateRequest( request );
}

common::mt_id_t Game::MT_SendBackendRequests( const std::vector< BackendRequest >& requests ) {
	MT_Request request = {};
	request.op = OP_SEND_BACKEND_REQUESTS;
	NEW( request.data.send_backend_requests.requests, std::vector< BackendRequest >, requests );
	return MT_CreateRequest( request );
}

#ifdef DEBUG
#define x( _method, _op ) \
    common::mt_id_t Game::_method( const std::string& path ) { \
        ASSERT( !path.empty(), "dump path is empty" ); \
        MT_Request request = {}; \
        request.op = _op; \
        NEW( request.data.dump.path, std::string ); \
        *request.data.dump.path = path; \
        return MT_CreateRequest( request ); \
    }

x( MT_SaveDump, OP_SAVE_DUMP )

x( MT_LoadDump, OP_LOAD_DUMP )

#undef x
#endif

void Game::Start() {
	MTModule::Start();

	MTModule::Log( "Starting thread" );

	m_game_state = GS_NONE;
	m_init_cancel = false;

	ASSERT( !m_pending_frontend_requests, "frontend requests already set" );
	NEW( m_pending_frontend_requests, std::vector< FrontendRequest > );

	NEW( m_random, Random, this );

	const auto* config = g_engine->GetConfig();
	if ( config->HasLaunchFlag( config::Config::LF_QUICKSTART_SEED ) ) {
		m_random->SetState( config->GetQuickstartSeed() );
	}

}

void Game::Stop() {
	MTModule::Log( "Stopping thread" );

	if ( m_state ) {
	   m_state = nullptr;
	}

	ResetGame();

	m_tm = nullptr;
	m_rm = nullptr;
	m_um = nullptr;
	m_bm = nullptr;
	m_am = nullptr;

	DELETE( m_pending_frontend_requests );
	m_pending_frontend_requests = nullptr;

	DELETE( m_random );
	m_random = nullptr;

	MTModule::Stop();
}

void Game::Iterate() {
	MTModule::Iterate();

	if ( m_state ) {
		m_state->Iterate();
	}

	if ( m_game_state == GS_INITIALIZING ) {

		ASSERT( m_state, "state is null" );

		if ( !m_state->IsMaster() ) {
			ASSERT( m_state->m_connection, "not master but no connection" );
			// notify server of successful download and continue initialization
			m_slot->SetPlayerFlag( slot::PF_MAP_DOWNLOADED );
			m_state->m_connection->UpdateSlot( m_slot_num, m_slot, true );
		}

		auto ec = m_map->Initialize( m_init_cancel );
		if ( !ec && m_init_cancel ) {
			ec = map::Map::EC_ABORTED;
		}

		if ( !ec ) {
#ifdef DEBUG
			const auto* config = g_engine->GetConfig();
			// also handy to have dump of generated map
			if (
				!ec &&
					config->HasDebugFlag( config::Config::DF_MAPDUMP ) &&
					!config->HasDebugFlag( config::Config::DF_QUICKSTART_MAP_DUMP ) // no point saving if we just loaded it
				) {
				MTModule::Log( (std::string)"Saving map dump to " + config->GetDebugPath() + map::s_consts.debug.lastdump_filename );
				SetLoaderText( "Saving dump" );
				util::FS::WriteFile( config->GetDebugPath() + map::s_consts.debug.lastdump_filename, m_map->Serialize().ToString() );
			}
#endif

			ASSERT( m_map, "map not set" );

			NEW( m_response_map_data, response_map_data_t );

			m_response_map_data->map_width = m_map->GetWidth();
			m_response_map_data->map_height = m_map->GetHeight();

			ASSERT( m_map->m_textures.terrain, "map terrain texture not generated" );
			NEW(
				m_response_map_data->terrain_texture,
				types::texture::Texture,
				m_map->m_textures.terrain->GetWidth(),
				m_map->m_textures.terrain->GetHeight(),
				m_map->m_textures.terrain->GetFlags()
			);
			m_response_map_data->terrain_texture->Deserialize( m_map->m_textures.terrain->Serialize() );

			ASSERT( m_map->m_meshes.terrain, "map terrain mesh not generated" );
			NEW(
				m_response_map_data->terrain_mesh,
				types::mesh::Render,
				*m_map->m_meshes.terrain
			);

			ASSERT( m_map->m_meshes.terrain_data, "map terrain data mesh not generated" );
			NEW(
				m_response_map_data->terrain_data_mesh,
				types::mesh::Data,
				*m_map->m_meshes.terrain_data
			);

			m_response_map_data->sprites.actors = &m_map->m_sprite_actors;
			m_response_map_data->sprites.instances = &m_map->m_sprite_instances;

			m_response_map_data->tiles = m_map->GetTilesPtr()->GetTilesPtr();
			m_response_map_data->tile_states = m_map->GetMapState()->GetTileStatesPtr();

			if ( m_old_map ) {
				MTModule::Log( "Destroying old map state" );
				DELETE( m_old_map );
				m_old_map = nullptr;
			}

			// notify server of successful initialization
			m_slot->SetPlayerFlag( slot::PF_GAME_INITIALIZED );
			if ( m_state->m_connection ) {
				m_state->m_connection->UpdateSlot( m_slot_num, m_slot, true );
			}

			{
				const auto factions = m_state->GetFM()->GetAll();
				NEWV( faction_defines, FrontendRequest::faction_defines_t );
				for ( const auto& faction : factions ) {
					faction_defines->push_back( faction );
				}
				auto fr = FrontendRequest( FrontendRequest::FR_FACTION_DEFINE );
				fr.data.faction_define.factiondefs = faction_defines;
				AddFrontendRequest( fr );
			}

			{
				const auto& slots = m_state->m_slots->GetSlots();
				NEWV( slot_defines, FrontendRequest::slot_defines_t );
				for ( const auto& slot : slots ) {
					if ( slot.GetState() == slot::Slot::SS_OPEN || slot.GetState() == slot::Slot::SS_CLOSED ) {
						continue;
					}
					ASSERT( slot.GetState() == slot::Slot::SS_PLAYER, "unknown slot state: " + std::to_string( slot.GetState() ) );
					auto* player = slot.GetPlayer();
					ASSERT( player, "slot player not set" );
					ASSERT( player->GetFaction(), "slot player faction not set" );
					slot_defines->push_back(
						FrontendRequest::slot_define_t{
							slot.GetIndex(),
							player->GetFaction()->m_id
						}
					);
				}
				auto fr = FrontendRequest( FrontendRequest::FR_SLOT_DEFINE );
				fr.data.slot_define.slotdefs = slot_defines;
				AddFrontendRequest( fr );
			}

			HideLoader();

			m_game_state = GS_STARTING;

			m_state->WithGSE( this, [ this ]( GSE_CALLABLE ) {

				if ( m_state->IsMaster() && !m_is_loaded_game ) {
					try {
						m_state->TriggerObject(
							this, "create_world", ARGS_F( this ) {
								{
									"game",
									Wrap( GSE_CALL )
								},
							}; }
						);
						InitComplete( GSE_CALL );
					}
					catch ( const gse::Exception& e ) {
						MTModule::Log( (std::string)"Initialization failed: " + e.ToString() );
						InitFailed( e.what() );
						return;
					}
					if ( m_game_state == GS_RUNNING ) {
						FirstTurn( GSE_CALL );
					}
				}
				else {
					InitComplete( GSE_CALL );
				}

				if ( m_game_state == GS_RUNNING ) {
					ProcessEvents();
					CheckTurnComplete();
					if ( ( !m_state->IsMaster() || m_is_loaded_game ) && m_current_turn.GetId() > 0 ) {
						SetTurnStatus( m_is_turn_complete
							? turn::TS_TURN_COMPLETE
							: turn::TS_TURN_ACTIVE
						);
					}
				}

			});

		}
		else {
			InitFailed( map::Map::GetErrorString( ec ) );
		}
	}
	if ( m_state ) {

		m_state->m_gc_space->Accumulate( this, [ this ]() {

			{
				std::lock_guard guard( m_pending_event_responses_mutex );
				for ( const auto& it : m_pending_event_responses ) {
					std::lock_guard guard2( m_events_waiting_for_responses_mutex );
					ASSERT( m_events_waiting_for_responses.find( it.event_id ) != m_events_waiting_for_responses.end(), "event for response not found" );
					const auto& event_data = m_events_waiting_for_responses.at( it.event_id );
					const auto* const event = event_data.event;
					const bool was_event_applied = event_data.was_applied;
					if ( !it.is_accepted ) {
						if ( was_event_applied ) {
							// event was rejected, rollback
							m_state->WithGSE(
								this, [ this, event_data, event ]( GSE_CALLABLE ) {
									auto* obj = VALUE( gse::value::Object, , GSE_CALL_NOGC, event->GetData() );
									if ( event_data.rollback_data ) {
										obj->Set( "applied", event_data.rollback_data, GSE_CALL );
									}
									const auto fargs = gse::value::function_arguments_t{ obj };
									event::EventHandler* h = nullptr;
									{
										std::lock_guard guard( m_event_handlers_mutex );
										const auto& it = m_event_handlers.find( event->GetEventName() );
										if ( it != m_event_handlers.end() ) {
											h = it->second;
										}
										else {
											MTModule::Log( "WARNING: tried to rollback event '" + event->GetEventName() + ", but found no handler" );
										}
									}
									if ( h ) {
										WithRW( [ &h, &ctx, &gc_space, &si, &ep, &fargs ]() {
											h->Rollback( GSE_CALL, fargs );
										});
									}
								}
							);
						}
					}
					else {
						// event was accepted (and maybe resolved)
						if ( !was_event_applied ) {
							m_state->WithGSE(
								this, [ this, it, event ]( GSE_CALLABLE ) {
									auto* obj = VALUE( gse::value::Object, , GSE_CALL_NOGC, event->GetData() );
									if ( it.resolved ) {
										obj->Set( "resolved", it.resolved, GSE_CALL );
									}
									const auto fargs = gse::value::function_arguments_t{ obj };
									event::EventHandler* h = nullptr;
									{
										std::lock_guard guard( m_event_handlers_mutex );
										const auto& it2 = m_event_handlers.find( event->GetEventName() );
										if ( it2 != m_event_handlers.end() ) {
											h = it2->second;
										}
										else {
											MTModule::Log( "WARNING: tried to apply event '" + event->GetEventName() + ", but found no handler" );
										}
									}
									if ( h ) {
										WithRW( [ &h, &ctx, &gc_space, &si, &ep, &fargs ]() {
											h->Apply( GSE_CALL, fargs );
										});
									}
								}
							);
						}
					}
					m_events_waiting_for_responses.erase( it.event_id );
				}
				m_pending_event_responses.clear();
			}
			ProcessEvents();
		});

		m_state->WithGSE(
			this, [ this ]( GSE_CALLABLE ) {
				if ( m_bm ) {
					m_bm->TriggerUpdates( GSE_CALL );
				}
			}
		);

	}
	if ( m_um ) {
		m_um->PushUpdates();
	}
	if ( m_bm ) {
		m_bm->PushUpdates();
	}
	if ( m_tm ) {
		m_tm->ProcessTileLockRequests();
	}
	PushExplorationUpdate();
	PushTerritoryVisibilityUpdate();
}

const bool Game::IsStarted() const {
	return m_game_state != GS_NONE;
}

Random* Game::GetRandom() const {
	return m_random;
}

map::Map* Game::GetMap() const {
	ASSERT( m_map, "backend game map is null" );
	return m_map;
}

State* Game::GetState() const {
	ASSERT( m_state, "state not set" );
	return m_state;
}

State* Game::TryGetState() const {
	return m_state;
}

const Player* Game::GetPlayer() const {
	ASSERT( m_state, "state not set" );
	if ( m_state->m_connection ) {
		return m_state->m_connection->GetPlayer();
	}
	else {
		return m_state->m_slots->GetSlot( 0 ).GetPlayer();
	}
}

const size_t Game::GetSlotNum() const {
	return m_slot_num;
}

const Game::visibility_tiles_t Game::GetVisibilityTilesForSlot( const size_t slot_num ) const {
	ASSERT( m_map && m_um && m_bm, "cannot calculate unit visibility before world initialization" );
	ASSERT( slot_num < m_state->m_slots->GetCount(), "visibility slot index overflow" );
	const auto& viewer = m_state->m_slots->GetSlot( slot_num );
	ASSERT( viewer.GetState() == slot::Slot::SS_PLAYER, "visibility slot has no player" );

	using Tile = map::tile::Tile;
	using Base = base::Base;
	visibility_tiles_t result = {};
	auto& visible_tiles = result.visible;
	auto& sensor_detected_tiles = result.sensor_detected;
	auto& radar_detected_tiles = result.radar_detected;

	const auto add_tiles_in_radius = [](
		const Tile* const center,
		const size_t radius,
		std::unordered_set< const Tile* >& tiles
	) {
		std::unordered_set< const Tile* > seen = { center };
		std::vector< const Tile* > frontier = { center };
		tiles.insert( center );
		for ( size_t distance = 0 ; distance < radius ; distance++ ) {
			std::vector< const Tile* > next = {};
			for ( const auto* const tile : frontier ) {
				for ( const auto* const candidate : tile->neighbours ) {
					if ( seen.insert( candidate ).second ) {
						tiles.insert( candidate );
						next.push_back( candidate );
					}
				}
			}
			frontier = std::move( next );
		}
	};
	const auto add_base_visible_tiles = [ &visible_tiles ]( const Tile* const center ) {
		const auto add = [ &visible_tiles ]( const Tile* const tile ) {
			visible_tiles.insert( tile );
			return tile;
		};
		const auto* const n = add( center->N );
		const auto* const ne = add( center->NE );
		const auto* const e = add( center->E );
		const auto* const se = add( center->SE );
		const auto* const s = add( center->S );
		const auto* const sw = add( center->SW );
		const auto* const w = add( center->W );
		const auto* const nw = add( center->NW );
		add( center );
		add( n->NW );
		add( n->NE );
		add( ne->NE );
		add( e->NE );
		add( e->SE );
		add( se->SE );
		add( s->SE );
		add( s->SW );
		add( sw->SW );
		add( w->SW );
		add( w->NW );
		add( nw->NW );
	};
	const auto get_tile_distance = [ this ]( const Tile* const first, const Tile* const second ) {
		const auto& first_coords = first->coord;
		const auto& second_coords = second->coord;
		const int64_t y_distance = std::abs(
			static_cast< int64_t >( first_coords.y ) - static_cast< int64_t >( second_coords.y )
		);
		const auto distance_with_offset = [ &first_coords, &second_coords, y_distance ]( const int64_t x_offset ) {
			return static_cast< size_t >(
				(
					std::abs(
						static_cast< int64_t >( first_coords.x ) + x_offset -
						static_cast< int64_t >( second_coords.x )
					) + y_distance
				) / 2
			);
		};
		const auto width = static_cast< int64_t >( m_map->GetWidth() );
		return std::min(
			distance_with_offset( 0 ),
			std::min( distance_with_offset( -width ), distance_with_offset( width ) )
		);
	};
	const auto get_claiming_base = [ this, &get_tile_distance ]( const Tile* const tile ) {
		static constexpr size_t max_claim_distance = 8;
		static constexpr size_t coastal_claim_distance = 2;
		const auto choose = [](
			const Base* const current,
			const size_t current_distance,
			const Base* const candidate,
			const size_t candidate_distance
		) {
			return !current || candidate_distance < current_distance || (
				candidate_distance == current_distance && candidate->m_id < current->m_id
			);
		};

		const Base* connected = nullptr;
		size_t connected_distance = max_claim_distance + 1;
		std::unordered_set< const Tile* > visited = { tile };
		std::vector< const Tile* > frontier = { tile };
		for ( size_t distance = 0 ; distance <= max_claim_distance && !frontier.empty() ; distance++ ) {
			for ( const auto* const current : frontier ) {
				const auto* const candidate = current->base;
				if ( candidate && choose( connected, connected_distance, candidate, distance ) ) {
					connected = candidate;
					connected_distance = distance;
				}
			}
			if ( connected || distance == max_claim_distance ) {
				break;
			}
			std::vector< const Tile* > next = {};
			for ( const auto* const current : frontier ) {
				for ( const auto* const candidate : current->neighbours ) {
					if (
						candidate->is_water_tile == tile->is_water_tile &&
						visited.insert( candidate ).second
					) {
						next.push_back( candidate );
					}
				}
			}
			frontier = std::move( next );
		}

		const Base* coastal = nullptr;
		size_t coastal_distance = coastal_claim_distance + 1;
		if ( tile->is_water_tile ) {
			for ( const auto& it : m_bm->GetBases() ) {
				const auto* const candidate = it.second;
				if ( candidate->GetTile()->is_water_tile ) {
					continue;
				}
				const auto distance = get_tile_distance( candidate->GetTile(), tile );
				if (
					distance <= coastal_claim_distance &&
					choose( coastal, coastal_distance, candidate, distance )
				) {
					coastal = candidate;
					coastal_distance = distance;
				}
			}
		}

		if ( !connected ) {
			return coastal;
		}
		if ( !coastal ) {
			return connected;
		}
		return choose( connected, connected_distance, coastal, coastal_distance )
			? coastal
			: connected;
	};

	for ( const auto& it : m_bm->GetBases() ) {
		const auto* const base = it.second;
		if ( base->m_owner->GetIndex() == slot_num ) {
			add_base_visible_tiles( base->GetTile() );
		}
	}
	for ( const auto& it : m_um->GetUnits() ) {
		const auto* const unit = it.second;
		if (
			unit->m_health <= 0.0f || unit->m_owner->GetIndex() != slot_num ||
			unit->m_transport_id != 0
		) {
			continue;
		}
		ASSERT( unit->m_def->m_type == unit::DT_STATIC, "non-static unit in visibility calculation" );
		const auto* const def = static_cast< const unit::StaticDef* >( unit->m_def );
		add_tiles_in_radius( unit->GetTile(), def->HasAbility( "DeepRadar" ) ? 2 : 1, visible_tiles );
		if ( def->HasAbility( "DeepRadar" ) ) {
			add_tiles_in_radius( unit->GetTile(), 1, radar_detected_tiles );
		}
	}
	for ( const auto& tile : *m_map->GetTilesPtr()->GetTilesPtr() ) {
		if ( !( tile.terraforming & map::tile::TERRAFORMING_SENSOR ) ) {
			continue;
		}
		const auto* const owner = get_claiming_base( &tile );
		if ( owner && owner->m_owner->GetIndex() == slot_num ) {
			add_tiles_in_radius( &tile, 2, visible_tiles );
			add_tiles_in_radius( &tile, 2, sensor_detected_tiles );
		}
	}
	return result;
}

const std::unordered_set< const map::tile::Tile* > Game::GetVisibleTilesForSlot(
	const size_t slot_num
) const {
	return GetVisibilityTilesForSlot( slot_num ).visible;
}

const std::unordered_set< size_t > Game::GetVisibleUnitIdsForSlot( const size_t slot_num ) const {
	const auto visibility = GetVisibilityTilesForSlot( slot_num );
	const auto& visible_tiles = visibility.visible;
	const auto& sensor_detected_tiles = visibility.sensor_detected;
	const auto& radar_detected_tiles = visibility.radar_detected;
	std::unordered_set< size_t > result = {};
	for ( const auto& it : m_um->GetUnits() ) {
		const auto* const candidate = it.second;
		if ( candidate->m_health <= 0.0f ) {
			continue;
		}
		if ( candidate->m_owner->GetIndex() == slot_num ) {
			result.insert( candidate->m_id );
			continue;
		}
		if (
			candidate->m_transport_id != 0 ||
			visible_tiles.find( candidate->GetTile() ) == visible_tiles.end()
		) {
			continue;
		}
		ASSERT( candidate->m_def->m_type == unit::DT_STATIC, "non-static unit in visibility calculation" );
		const auto* const def = static_cast< const unit::StaticDef* >( candidate->m_def );
		const bool ability_concealed =
			def->HasAbility( "CloakingDevice" ) || def->HasAbility( "DeepPressureHull" );
		const auto movement_type = def->GetMovementType();
		const bool fungus_concealed =
			( movement_type == unit::MT_LAND || movement_type == unit::MT_WATER ) &&
			( candidate->GetTile()->features & map::tile::FEATURE_XENOFUNGUS );
		const bool detected =
			!ability_concealed && !fungus_concealed ||
			sensor_detected_tiles.find( candidate->GetTile() ) != sensor_detected_tiles.end() ||
			(
				!ability_concealed && fungus_concealed &&
				radar_detected_tiles.find( candidate->GetTile() ) != radar_detected_tiles.end()
			);
		if ( detected ) {
			result.insert( candidate->m_id );
		}
	}
	return result;
}

const Game::base_visibility_t Game::GetBaseVisibilityForSlot(
	const base::Base* base,
	const size_t slot_num
) const {
	ASSERT( base && m_map && m_bm, "cannot calculate base visibility before world initialization" );
	ASSERT( slot_num < m_state->m_slots->GetCount(), "base visibility slot index overflow" );
	const auto& viewer_slot = m_state->m_slots->GetSlot( slot_num );
	ASSERT( viewer_slot.GetState() == slot::Slot::SS_PLAYER, "base visibility slot has no player" );
	const auto* const viewer = viewer_slot.GetPlayer();
	ASSERT( viewer, "base visibility slot has no player data" );
	const auto owner_slot = base->m_owner->GetIndex();
	if ( owner_slot == slot_num || viewer->HasInfiltrated( owner_slot ) ) {
		return BV_FULL;
	}
	const auto visibility = GetVisibilityTilesForSlot( slot_num );
	return visibility.visible.find( base->GetTile() ) != visibility.visible.end()
		? BV_PUBLIC
		: BV_HIDDEN;
}

const Game::projected_bases_t Game::GetProjectedBasesForSlot( const size_t slot_num ) const {
	ASSERT( slot_num < m_state->m_slots->GetCount(), "base projection slot index overflow" );
	const auto& viewer_slot = m_state->m_slots->GetSlot( slot_num );
	ASSERT( viewer_slot.GetState() == slot::Slot::SS_PLAYER, "base projection slot has no player" );
	const auto* const viewer = viewer_slot.GetPlayer();
	ASSERT( viewer, "base projection slot has no player data" );
	const auto visibility = GetVisibilityTilesForSlot( slot_num );
	projected_bases_t result = {};
	for ( const auto& it : m_bm->GetBases() ) {
		const auto* const base = it.second;
		const auto owner_slot = base->m_owner->GetIndex();
		const bool is_full = owner_slot == slot_num || viewer->HasInfiltrated( owner_slot );
		if ( is_full || visibility.visible.find( base->GetTile() ) != visibility.visible.end() ) {
			result.insert({
				it.first,
				m_bm->ProjectBase( base, is_full )
			});
		}
	}
	return result;
}

const std::unordered_set< size_t > Game::GetFullBaseIdsForSlot( const size_t slot_num ) const {
	ASSERT( slot_num < m_state->m_slots->GetCount(), "full base projection slot index overflow" );
	const auto* const viewer = m_state->m_slots->GetSlot( slot_num ).GetPlayer();
	ASSERT( viewer, "full base projection slot has no player data" );
	std::unordered_set< size_t > result = {};
	for ( const auto& it : m_bm->GetBases() ) {
		const auto owner_slot = it.second->m_owner->GetIndex();
		if ( owner_slot == slot_num || viewer->HasInfiltrated( owner_slot ) ) {
			result.insert( it.first );
		}
	}
	return result;
}

void Game::ShowLoader( const std::string& text ) {
	auto fr = FrontendRequest( FrontendRequest::FR_LOADER_SHOW );
	NEW( fr.data.loader.text, std::string, text );
	AddFrontendRequest( fr );
}

void Game::SetLoaderText( const std::string& text ) {
	auto fr = FrontendRequest( FrontendRequest::FR_LOADER_TEXT );
	NEW( fr.data.loader.text, std::string, text );
	AddFrontendRequest( fr );
	ProcessRequests(); // allow frontend to update % while backend is busy
}

void Game::HideLoader() {
	auto fr = FrontendRequest( FrontendRequest::FR_LOADER_HIDE );
	AddFrontendRequest( fr );
}

void Game::AddEvent( event::Event* const event ) {
	std::lock_guard guard( m_pending_events_mutex );
	m_pending_events.push_back({ event, "", false });
}

void Game::AddSerializedEvent( const std::string& serialized_event, const bool from_server ) {
	if ( serialized_event.empty() ) {
		THROW( "cannot queue an empty serialized event" );
	}
	std::lock_guard guard( m_pending_events_mutex );
	m_pending_events.push_back({ nullptr, serialized_event, from_server });
}

void Game::AddEventResponse( const std::string& event_id, const bool result, gse::Value* const resolved ) {
	std::lock_guard guard( m_pending_event_responses_mutex );
	m_pending_event_responses.push_back({
		event_id,
		result,
		resolved
	});
}

void Game::ClearEvents() {
	std::lock_guard guard( m_event_handlers_mutex );
/*#if defined( DEBUG ) || defined( FASTDEBUG )
	for ( const auto& it : m_event_handlers ) {
		g_engine->Log( "Removing event: \"" + it.first + "\"" );
	}
#endif*/
	m_event_handlers.clear();
}

void Game::Event( GSE_CALLABLE, const std::string& name, const gse::value::object_properties_t& args ) {
	if ( IsGameOver() && name != "chat_message" ) {
		MTModule::Log( "Event rejected: Game has ended" );
		return;
	}
	{
		std::lock_guard guard( m_event_handlers_mutex );
		const auto& it = m_event_handlers.find( name );
		if ( it == m_event_handlers.end() ) {
			return;
		}
	}
	AddEvent( new event::Event( this, event::Event::ES_LOCAL, m_slot_num, GSE_CALL, name, args ) );
}

WRAPIMPL_BEGIN( Game )
	WRAPIMPL_PROPS
	WRAPIMPL_TRIGGERS
	WRAPIMPL_CUSTOM_SETTERS
		{
			"is_master",
			NATIVE_CALL( this ) {
				return VALUE( gse::value::Bool, , m_state->IsMaster() );
			} ),
		},
		{
			"is_slave",
			NATIVE_CALL( this ) {
			return VALUE( gse::value::Bool, , m_state->IsSlave() );
		} ),
		},
		{
			"is_loaded_game",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				return VALUE( gse::value::Bool, , m_is_loaded_game );
			} ),
		},
		{
			"random",
			m_random->Wrap( GSE_CALL )
		},
		{
			"message",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 1 );
				N_GETVALUE( text, 0, String );
				Message( text );
				return VALUE( gse::value::Undefined );
			})
		},
		{
			"get_player",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS_MIN_MAX( 0, 1 );
				size_t slot_id = m_slot_num;
				if ( arguments.size() > 0 ) {
					N_GETVALUE( id, 0, Int );
					slot_id = id;
				}
				auto& slots = m_state->m_slots->GetSlots();
				if ( slot_id < slots.size() ) {
					auto& slot = slots.at( slot_id );
					return slot.Wrap( GSE_CALL );
				}
				GSE_ERROR( gse::EC.GAME_ERROR, "Player id " + std::to_string( slot_id ) + " not found" );
			}),
		},
		{
			"get_players",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				auto& slots = m_state->m_slots->GetSlots();
				gse::value::array_elements_t elements = {};
				for ( auto& slot : slots ) {
					const auto state = slot.GetState();
					if ( state == slot::Slot::SS_OPEN || state == slot::Slot::SS_CLOSED ) {
						continue; // skip
					}
					if ( slot.GetPlayer()->IsNative() ) {
						continue;
					}
					elements.push_back( slot.Wrap( GSE_CALL ) );
				}
				return VALUE( gse::value::Array,, elements );
			} )
		},
		{
			"get_native_player",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				for ( auto& slot : m_state->m_slots->GetSlots() ) {
					if (
						slot.GetState() == slot::Slot::SS_PLAYER &&
						slot.GetPlayer() && slot.GetPlayer()->IsNative()
					) {
						return slot.Wrap( GSE_CALL );
					}
				}
				GSE_ERROR( gse::EC.GAME_ERROR, "Native Planet player is not configured" );
			} )
		},
		{
			"get_turn",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				return VALUE( gse::value::Int,, m_current_turn.GetId() );
			} )
		},
		{
			"get_year",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				return VALUE( gse::value::Int,, m_current_turn.GetId() + 2100 /* TODO: better way to define starting year? */ );
			} )
		},
		{
			"is_game_over",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				return VALUE( gse::value::Bool, , IsGameOver() );
			} )
		},
		{
			"get_victory_state",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				return VALUEEXT( gse::value::Object, GSE_CALL, gse::value::object_properties_t{
					{ "type", VALUE( gse::value::String, , GetVictoryTypeString( m_victory_state.type ) ) },
					{ "winner", VALUE( gse::value::Int, , IsGameOver() ? static_cast< int64_t >( m_victory_state.winner_slot ) : -1 ) },
					{ "turn", VALUE( gse::value::Int, , m_victory_state.turn_id ) },
				} );
			} )
		},
		{
			"get_conquest_winner",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				auto* const winner = GetConquestWinner();
				return winner
					? winner->Wrap( GSE_CALL )
					: VALUE( gse::value::Null );
			} )
		},
		{
			"declare_victory",
			NATIVE_CALL( this ) {
				CheckRW( GSE_CALL );
				N_EXPECT_ARGS( 2 );
				N_GETVALUE( type_name, 0, String );
				N_GETVALUE( winner_slot, 1, Int );
				victory_type_t type = VT_NONE;
				if ( !ParseVictoryType( type_name, type ) || type == VT_NONE ) {
					GSE_ERROR( gse::EC.INVALID_CALL, "Unsupported victory type: " + type_name );
				}
				if ( winner_slot < 0 ) {
					GSE_ERROR( gse::EC.INVALID_CALL, "Victory winner slot cannot be negative" );
				}
				DeclareVictory( GSE_CALL, type, static_cast< size_t >( winner_slot ) );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"is_turn_complete",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 1 );
				N_GETVALUE( slot_id, 0, Int );

				const auto& slots = m_state->m_slots->GetSlots();
				if ( slot_id >= slots.size() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Player id " + std::to_string( slot_id ) + " not found" );
				}

				const auto& slot = slots.at( slot_id );
				ASSERT( slot.GetState() != slot::Slot::SS_PLAYER || slot.GetPlayer(), "player is null" );
				return VALUE( gse::value::Bool,,
					slot.GetState() == slot::Slot::SS_PLAYER
						? slot.GetPlayer()->IsTurnCompleted()
						: true // ai has always turn completed during turns of players
				);
			} )
		},
		{
			"complete_turn",
			NATIVE_CALL( this ) {

				CheckRW( GSE_CALL );

				N_EXPECT_ARGS( 1 );
				N_GETVALUE( slot_id, 0, Int );

				const auto& slots = m_state->m_slots->GetSlots();
				if ( slot_id >= slots.size() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Player id " + std::to_string( slot_id ) + " not found" );
				}

				const auto& slot = slots.at( slot_id );
				if ( slot.GetState() != slot::Slot::SS_PLAYER ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Player id " + std::to_string( slot_id ) + " is not player" );
				}
				ASSERT( slot.GetPlayer(), "player is null" );
				ASSERT( !slot.GetPlayer()->IsTurnCompleted(), "player turn already completed" );
				CompleteTurn( GSE_CALL, slot_id );

				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"uncomplete_turn",
			NATIVE_CALL( this ) {

				CheckRW( GSE_CALL );

				N_EXPECT_ARGS( 1 );
				N_GETVALUE( slot_id, 0, Int );

				const auto& slots = m_state->m_slots->GetSlots();
				if ( slot_id >= slots.size() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Player id " + std::to_string( slot_id ) + " not found" );
				}

				const auto& slot = slots.at( slot_id );
				if ( slot.GetState() != slot::Slot::SS_PLAYER ) {
					GSE_ERROR( gse:: EC.GAME_ERROR, "Player id " + std::to_string( slot_id ) + " is not player" );
				}
				ASSERT( slot.GetPlayer(), "player is null" );
				ASSERT( slot.GetPlayer()->IsTurnCompleted(), "player turn not completed" );
				UncompleteTurn( slot_id );

				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"advance_turn",
			NATIVE_CALL( this ) {

				CheckRW( GSE_CALL );

				N_EXPECT_ARGS( 1 );
				N_GETVALUE( turn_id, 0, Int );

				AdvanceTurn( turn_id );

				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"get_settings", // deprecated
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				if ( !m_state ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Game not initialized" );
				}
				return m_state->m_settings.Wrap( GSE_CALL );
			} )
		},
		{
			"get_map",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				if ( !m_map ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Map not initialized" );
				}
				return m_map->Wrap( GSE_CALL );
			} )
		},
		{
			"register_event",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 2 );
				N_GETVALUE( name, 0, String );
				{
					std::lock_guard guard( m_event_handlers_mutex );
					if ( m_event_handlers.find( name ) != m_event_handlers.end() ) {
						GSE_ERROR( gse::EC.INVALID_HANDLER, "Event already registered: " + name );
					}
				}
				N_GETVALUE( def, 1, Object );
				auto validate_it = def.find( "validate" );
				if ( validate_it == def.end() || validate_it->second->type != gse::VT_CALLABLE ) {
					GSE_ERROR( gse::EC.INVALID_HANDLER, "Event handler does not provide validate method" );
				}
				gse::value::Callable* resolve = nullptr;
				auto resolve_it = def.find( "resolve" );
				if ( resolve_it != def.end() ) {
					if ( resolve_it->second->type != gse::VT_CALLABLE ) {
						GSE_ERROR( gse::EC.INVALID_HANDLER, "Event handler does not provide resolve method" );
					}
					resolve = (gse::value::Callable*)resolve_it->second;
				}
				auto apply_it = def.find( "apply" );
				if ( apply_it == def.end() || apply_it->second->type != gse::VT_CALLABLE ) {
					GSE_ERROR( gse::EC.INVALID_HANDLER, "Event handler does not provide apply method" );
				}
				auto rollback_it = def.find( "rollback" );
				if ( rollback_it == def.end() || rollback_it->second->type != gse::VT_CALLABLE ) {
					GSE_ERROR( gse::EC.INVALID_HANDLER, "Event handler does not provide rollback method" );
				}
				bool private_unit_event = false;
				bool unit_snapshot_event = false;
				bool private_player_event = false;
				const auto visibility_it = def.find( "unit_visibility" );
				if ( visibility_it != def.end() ) {
					if ( visibility_it->second->type != gse::VT_STRING ) {
						GSE_ERROR( gse::EC.INVALID_HANDLER, "Event unit_visibility must be a string" );
					}
					const auto& visibility = ( (gse::value::String*)visibility_it->second )->value;
					if ( visibility == "private" ) {
						private_unit_event = true;
					}
					else if ( visibility == "snapshot" ) {
						unit_snapshot_event = true;
					}
					else if ( visibility != "public" ) {
						GSE_ERROR(
							gse::EC.INVALID_HANDLER,
							"Event unit_visibility must be public, private, or snapshot"
						);
					}
				}
				const auto player_visibility_it = def.find( "player_visibility" );
				if ( player_visibility_it != def.end() ) {
					if ( player_visibility_it->second->type != gse::VT_STRING ) {
						GSE_ERROR( gse::EC.INVALID_HANDLER, "Event player_visibility must be a string" );
					}
					const auto& visibility = ( (gse::value::String*)player_visibility_it->second )->value;
					if ( visibility == "private" ) {
						private_player_event = true;
					}
					else if ( visibility != "public" ) {
						GSE_ERROR(
							gse::EC.INVALID_HANDLER,
							"Event player_visibility must be public or private"
						);
					}
				}
				{
					std::lock_guard guard( m_event_handlers_mutex );
					m_event_handlers.insert(
						{ name, new event::EventHandler(
							gc_space, name,
							(gse::value::Callable*)validate_it->second,
							resolve,
							(gse::value::Callable*)apply_it->second,
							(gse::value::Callable*)rollback_it->second,
							private_unit_event,
							unit_snapshot_event,
							private_player_event
						) }
					);
				}
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"event",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 2 );
				N_GETVALUE( name, 0, String );
				{
					std::lock_guard guard( m_event_handlers_mutex );
					const auto& it = m_event_handlers.find( name );
					if ( it == m_event_handlers.end() ) {
						GSE_ERROR( gse::EC.INVALID_HANDLER, "Unknown event: " + name );
					}
				}
				N_GET( args, 1, Object );
				if ( !args->object_class.empty() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Invalid event data - expected: primitive object, found: " + args->object_class );
				}
				AddEvent( new event::Event( this, event::Event::ES_LOCAL, m_slot_num, GSE_CALL, name, args->value ) );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"event_as",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 3 );
				if ( !m_state->IsMaster() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Only the game master can submit AI events" );
				}
				N_GETVALUE( caller, 0, Int );
				if ( caller < 0 || static_cast< size_t >( caller ) >= m_state->m_slots->GetCount() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "AI event caller is out of bounds" );
				}
				auto& caller_slot = m_state->m_slots->GetSlot( static_cast< size_t >( caller ) );
				if (
					caller_slot.GetState() != slot::Slot::SS_PLAYER
					|| !caller_slot.GetPlayer()
					|| ( !caller_slot.GetPlayer()->IsAI() && !caller_slot.GetPlayer()->IsNative() )
				) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Delegated events require a computer-controlled caller" );
				}
				N_GETVALUE( name, 1, String );
				{
					std::lock_guard guard( m_event_handlers_mutex );
					if ( m_event_handlers.find( name ) == m_event_handlers.end() ) {
						GSE_ERROR( gse::EC.INVALID_HANDLER, "Unknown event: " + name );
					}
				}
				N_GET( args, 2, Object );
				if ( !args->object_class.empty() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Invalid event data - expected primitive object" );
				}
				AddEvent( new event::Event(
					this,
					event::Event::ES_LOCAL,
					static_cast< size_t >( caller ),
					GSE_CALL,
					name,
					args->value
				) );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"get_fm",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				return m_state
					? m_state->GetFM()->Wrap( GSE_CALL )
					: VALUE( gse::value::Undefined )
					;
			} )
		},
#define X( _x ) \
		{ \
			"get_" # _x, \
			NATIVE_CALL( this ) { \
				N_EXPECT_ARGS( 0 ); \
				return m_##_x \
					? m_##_x->Wrap( GSE_CALL ) \
					: VALUE( gse::value::Undefined ) \
					; \
			} ) \
		},
		X( um )
		X( bm )
		X( rm )
		X( tm )
#undef X
		{
			"is_started",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				return VALUE( gse::value::Bool,, m_game_state != GS_NONE );
			} )
		},
		{
			"select_tile",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 1 );
				N_GETVALUE_UNWRAP( tile, 0, map::tile::Tile );
				auto fr = FrontendRequest( FrontendRequest::FR_TILE_SELECT );
				fr.data.tile_select.x = tile->coord.x;
				fr.data.tile_select.y = tile->coord.y;
				AddFrontendRequest( fr );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"select_unit",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 1 );
				N_GETVALUE_UNWRAP( unit, 0, unit::Unit );
				auto fr = FrontendRequest( FrontendRequest::FR_UNIT_SELECT );
				fr.data.unit_select.unit_id = unit->m_id;
				AddFrontendRequest( fr );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"select_base",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 1 );
				N_GETVALUE_UNWRAP( base, 0, base::Base );
				auto fr = FrontendRequest( FrontendRequest::FR_BASE_SELECT );
				fr.data.base_select.base_id = base->m_id;
				AddFrontendRequest( fr );
				return VALUE( gse::value::Undefined );
			} )
		},
	};
	if ( m_tm ) {
		properties.insert(
			{
				"tm",
				m_tm->Wrap( GSE_CALL )
			}
		);
	}
	if ( m_rm ) {
		properties.insert(
			{
				"rm",
				m_rm->Wrap( GSE_CALL )
			}
		);
	}
	if ( m_um ) {
		properties.insert(
			{
				"um",
				m_um->Wrap( GSE_CALL )
			}
		);
	}
	if ( m_bm ) {
		properties.insert(

			{
				"bm",
				m_bm->Wrap( GSE_CALL ),
			}
		);
	}
	if ( m_am ) {
		properties.insert(
			{
				"am",
				m_am->Wrap( GSE_CALL )
			}
		);
	}
WRAPIMPL_END_PTR()

UNWRAPIMPL_PTR( Game )

void Game::GetReachableObjects( std::unordered_set< Object* >& reachable_objects ) {
	gse::GCWrappable::GetReachableObjects( reachable_objects );

	GC_DEBUG_BEGIN( "Game" );

	if ( m_tm ) {
		GC_REACHABLE( m_tm );
	}
	if ( m_rm ) {
		GC_REACHABLE( m_rm );
	}
	if ( m_um ) {
		GC_REACHABLE( m_um );
	}
	if ( m_bm ) {
		GC_REACHABLE( m_bm );
	}
	if ( m_am ) {
		GC_REACHABLE( m_am );
	}

	if ( m_map ) {
		GC_REACHABLE( m_map );
	}

	GC_DEBUG_BEGIN( "events" );
	{
		std::lock_guard guard( m_pending_events_mutex );
		for ( const auto& pending : m_pending_events ) {
			if ( pending.event ) {
				GC_REACHABLE( pending.event );
			}
		}
	}
	GC_DEBUG_END();

	GC_DEBUG_BEGIN( "event_handlers" );
	{
		std::lock_guard guard( m_event_handlers_mutex );
		for ( const auto& it : m_event_handlers ) {
			GC_REACHABLE( it.second );
		}
	}
	GC_DEBUG_END();

	if ( !m_events_waiting_for_responses.empty() ) {
		std::lock_guard guard( m_events_waiting_for_responses_mutex );
		GC_DEBUG_BEGIN( "events_waiting_for_responses" );
		for ( const auto& it : m_events_waiting_for_responses ) {
			GC_REACHABLE( it.second.event );
			if ( it.second.rollback_data ) {
				GC_REACHABLE( it.second.rollback_data );
			}
		}
		GC_DEBUG_END();
	}

	if ( !m_pending_event_responses.empty() ) {
		std::lock_guard guard( m_pending_event_responses_mutex );
		GC_DEBUG_BEGIN( "pending_event_responses" );
		for ( const auto& it : m_pending_event_responses ) {
			if ( it.resolved ) {
				GC_REACHABLE( it.resolved );
			}
		}
		GC_DEBUG_END();
	}

	GC_DEBUG_END();
}

void Game::RootSessionManagers() {
	ASSERT( m_state && m_state->m_ctx, "game state context not set" );
	ASSERT( !m_session_gse, "session managers already rooted" );
	ASSERT( m_tm && m_rm && m_um && m_bm && m_am, "session manager not set" );
	m_session_gse = m_state->m_ctx->GetGSE();
	m_session_gse->AddRootObject( m_tm );
	m_session_gse->AddRootObject( m_rm );
	m_session_gse->AddRootObject( m_um );
	m_session_gse->AddRootObject( m_bm );
	m_session_gse->AddRootObject( m_am );
}

void Game::UnrootSessionManagers() {
	if ( !m_session_gse ) {
		return;
	}
	if ( m_tm ) {
		m_session_gse->RemoveRootObject( m_tm );
	}
	if ( m_rm ) {
		m_session_gse->RemoveRootObject( m_rm );
	}
	if ( m_um ) {
		m_session_gse->RemoveRootObject( m_um );
	}
	if ( m_bm ) {
		m_session_gse->RemoveRootObject( m_bm );
	}
	if ( m_am ) {
		m_session_gse->RemoveRootObject( m_am );
	}
	m_session_gse = nullptr;
}

const MT_Response Game::ProcessRequest( const MT_Request& request, MT_CANCELABLE ) {
	MT_Response response = {};
	response.op = request.op;

	switch ( request.op ) {
		case OP_INIT: {
			//MTModule::Log( "Got init request" );

			ASSERT( m_state, "state not set" );

			m_state->WithGSE(
				this,
				[ this ]( GSE_CALLABLE ) {
					m_state->TriggerObject(
						this, "initialize", ARGS_F( this ) {
							{
								"game",
								Wrap( GSE_CALL )
							}
						}; }
					);
				}
			);
			//m_state->SetGame( this );

			InitGame( response, MT_C );
			if ( response.result == R_SUCCESS ) {
				response.data.init.slot_index = m_slot_num;
			}
			break;
		}
		case OP_GET_MAP_DATA: {
			//MTModule::Log( "Got get-map-data request" );
			if ( m_game_state != GS_RUNNING ) {
				if ( m_initialization_error.empty() ) {
					response.result = R_PENDING;
				}
				else {
					response.result = R_ERROR;
					NEW( response.data.error.error_text, std::string, m_initialization_error );
				}
			}
			else if ( m_response_map_data ) {
				response.result = R_SUCCESS;
				response.data.get_map_data = m_response_map_data;
				m_response_map_data = nullptr;
			}
			else if ( m_init_cancel ) {
				response.result = R_ABORTED;
			}
			else {
				response.result = R_ERROR;
				NEW( response.data.error.error_text, std::string, m_initialization_error );
			}
			break;
		}
		case OP_RESET: {
			//MTModule::Log( "Got reset request" );
			ResetGame();
			response.result = R_SUCCESS;
			break;
		}
		case OP_PING: {
			//MTModule::Log( "Got ping request" );
			response.result = R_SUCCESS;
			break;
		}
		case OP_SAVE_MAP: {
			//MTModule::Log( "got save map request" );
			const auto ec = m_map->SaveToFile( *request.data.save_map.path );
			if ( ec ) {
				response.result = R_ERROR;
				NEW( response.data.error.error_text, std::string, map::Map::GetErrorString( ec ) );
			}
			else {
				response.result = R_SUCCESS;
				NEW( response.data.save_map.path, std::string );
				*response.data.save_map.path = *request.data.save_map.path;
			}
			break;
		}
		case OP_SAVE_GAME: {
			try {
				if ( !IsRunning() || !m_map ) {
					THROW( "Game is not running" );
				}
				if ( !m_state->IsMaster() || m_state->m_connection ) {
					THROW( "Saving currently supports offline games only" );
				}
				if ( !m_player || m_player->GetRole() != Player::PR_SINGLE ) {
					THROW( "Saving requires a single-player commander" );
				}

				types::Buffer buf;
				buf.WriteString( SAVE_GAME_MAGIC );
				buf.WriteInt( SAVE_GAME_VERSION );
				buf.WriteString( m_state->Serialize().ToString() );
				buf.WriteString( m_state->m_slots->Serialize().ToString() );
				buf.WriteInt( m_slot_num );
				buf.WriteString( m_random->GetStateString() );
				buf.WriteString( SerializeWorldSnapshot( nullptr ) );
				util::FS::WriteFile( *request.data.save_map.path, buf.ToString() );
				if ( !util::FS::FileExists( *request.data.save_map.path ) ) {
					THROW( "Save file was not created" );
				}

				response.result = R_SUCCESS;
				NEW( response.data.save_map.path, std::string, *request.data.save_map.path );
			}
			catch ( const std::exception& e ) {
				response.result = R_ERROR;
				NEW( response.data.error.error_text, std::string, e.what() );
			}
			break;
		}
		case OP_GET_FRONTEND_REQUESTS: {
			//MTModule::Log( "got events request" );
			if ( !m_pending_frontend_requests->empty() ) {
				//MTModule::Log( "Sending " + std::to_string( m_pending_frontend_requests->size() ) + " events to frontend" );
				response.data.get_frontend_requests.requests = m_pending_frontend_requests; // will be destroyed in DestroyResponse
				NEW( m_pending_frontend_requests, std::vector< FrontendRequest > ); // reset
			}
			else {
				response.data.get_frontend_requests.requests = nullptr;
			}
			response.result = R_SUCCESS;
			break;
		}
		case OP_SEND_BACKEND_REQUESTS: {
			try {
				auto* gc_space = GetGCSpace();
				for ( const auto& r : *request.data.send_backend_requests.requests ) {
					switch ( r.type ) {
						case BackendRequest::BR_ANIMATION_FINISHED: {
							const auto animation_id = r.data.animation_finished.animation_id;
							gc_space->Accumulate( this, [ this, animation_id ] () {
								m_am->FinishAnimation( animation_id );
							});
							break;
						}
						default:
							THROW( "unknown backend request type: " + std::to_string( r.type ) );
					}
				}
				response.result = R_SUCCESS;
			}
			catch ( const gse::Exception& e ) {
				OnGSEError( e );
				response.result = R_ERROR;
			}
			catch ( std::runtime_error& e ) {
				OnError( e );
				response.result = R_ERROR;
			}
			break;
		}
		case OP_ADD_EVENT: {
			THROW( "deprecated: OP_ADD_EVENT" );
			/*m_state->WithGSE( [ this, &event, &errmsg, &buf ]( GSE_CALLABLE ) {
				event = event::Event::Deserialize( GSE_CALL, buf );
				errmsg = event->Validate( GSE_CALL, this );
				if ( errmsg ) {
					// log and do nothing
					MTModule::Log( "Event declined: " + *errmsg );
					delete errmsg;
					delete event;
				}
				else {
					AddEvent( GSE_CALL, event );
				}
			});*/
			break;
		}
		default: {
			THROW( "unknown request op " + std::to_string( request.op ) );
		}
	}

	return response;
}

void Game::DestroyRequest( const MT_Request& request ) {
	switch ( request.op ) {
		case OP_SAVE_MAP:
		case OP_SAVE_GAME: {
			if ( request.data.save_map.path ) {
				DELETE( request.data.save_map.path );
			}
			break;
		}
		case OP_ADD_EVENT: {
			DELETE( request.data.add_event.serialized_event );
			break;
		}
		case OP_SEND_BACKEND_REQUESTS: {
			if ( request.data.send_backend_requests.requests ) {
				DELETE( request.data.send_backend_requests.requests );
			}
		}
		default: {
			// nothing to delete
		}
	}
}

void Game::DestroyResponse( const MT_Response& response ) {
	if ( response.result == R_ERROR ) {
		switch ( response.op ) {
			case OP_INIT:
			case OP_GET_MAP_DATA:
			case OP_SAVE_MAP:
			case OP_SAVE_GAME: {
				if ( response.data.error.error_text ) {
					DELETE( response.data.error.error_text );
				}
				break;
			}
			default: {
				// no error payload
			}
		}
		return;
	}
	if ( response.result == R_SUCCESS ) {
		switch ( response.op ) {
			case OP_GET_MAP_DATA: {
				if ( response.data.get_map_data ) {
					DELETE( response.data.get_map_data );
				}
				break;
			}
			case OP_SAVE_MAP:
			case OP_SAVE_GAME: {
				if ( response.data.save_map.path ) {
					DELETE( response.data.save_map.path );
				}
				break;
			}
			case OP_GET_FRONTEND_REQUESTS: {
				if ( response.data.get_frontend_requests.requests ) {
					DELETE( response.data.get_frontend_requests.requests );
				}
				break;
			}
			default: {
				// nothing to delete
			}
		}
	}
}

void Game::Message( const std::string& text ) {
	m_state->WithGSE( this, [ this, text ]( GSE_CALLABLE ){
		m_state->TriggerObject(
			this, "message", ARGS_F( text ) {
				{ "text", VALUE( gse::value::String,, text ) }
			}; }
		);
	});
}

void Game::Quit( const std::string& reason ) {
	auto fr = FrontendRequest( FrontendRequest::FR_QUIT );
	NEW( fr.data.quit.reason, std::string, reason );
	AddFrontendRequest( fr );
}

void Game::OnError( std::runtime_error& err ) {
	auto fr = FrontendRequest( FrontendRequest::FR_ERROR );
	NEW( fr.data.error.what, std::string, (std::string)"Script error: " + err.what() );
	fr.data.error.stacktrace = nullptr;
	AddFrontendRequest( fr );
}

void Game::OnGSEError( const gse::Exception& err ) {
	auto fr = FrontendRequest( FrontendRequest::FR_ERROR );
	NEW( fr.data.error.what, std::string, (std::string)"Script error: " + err.what() );
	NEW( fr.data.error.stacktrace, std::string, err.ToString() );
	AddFrontendRequest( fr );
}

const size_t Game::GetTurnId() const {
	return m_current_turn.GetId();
}

const bool Game::IsGameOver() const {
	return m_victory_state.type != VT_NONE;
}

const Game::victory_state_t& Game::GetVictoryState() const {
	return m_victory_state;
}

Player* Game::GetConquestWinner() const {
	if ( m_state && !m_state->IsMaster() ) {
		if (
			m_victory_state.type != VT_CONQUEST ||
			m_victory_state.winner_slot >= m_state->m_slots->GetCount()
		) {
			return nullptr;
		}
		auto& winner = m_state->m_slots->GetSlot( m_victory_state.winner_slot );
		return winner.GetState() == slot::Slot::SS_PLAYER
			? winner.GetPlayer()
			: nullptr;
	}
	if ( m_current_turn.GetId() == 0 || !m_state || !m_bm || !m_um ) {
		return nullptr;
	}

	size_t active_player_count = 0;
	std::unordered_set< size_t > surviving_slots = {};
	const auto& slots = m_state->m_slots->GetSlots();
	for ( const auto& slot : slots ) {
		if (
			slot.GetState() == slot::Slot::SS_PLAYER &&
			!slot.GetPlayer()->IsNative()
		) {
			active_player_count++;
		}
	}
	if ( active_player_count < 2 ) {
		return nullptr;
	}

	for ( const auto& it : m_bm->GetBases() ) {
		const auto* const owner = it.second->m_owner;
		if (
			owner && owner->GetState() == slot::Slot::SS_PLAYER &&
			!owner->GetPlayer()->IsNative()
		) {
			surviving_slots.insert( owner->GetIndex() );
		}
	}
	for ( const auto& it : m_um->GetUnits() ) {
		const auto* const unit = it.second;
		if (
			unit->m_health > 0.0f &&
			unit->m_def &&
			unit->m_def->m_can_found_base &&
			unit->m_owner &&
			unit->m_owner->GetState() == slot::Slot::SS_PLAYER &&
			!unit->m_owner->GetPlayer()->IsNative()
		) {
			surviving_slots.insert( unit->m_owner->GetIndex() );
		}
	}

	std::unordered_set< size_t > claimant_slots = {};
	for ( const auto surviving_slot : surviving_slots ) {
		size_t claimant_slot = surviving_slot;
		std::unordered_set< size_t > visited = { surviving_slot };
		while ( claimant_slot < slots.size() ) {
			const auto& claimant = slots.at( claimant_slot );
			if ( claimant.GetState() != slot::Slot::SS_PLAYER || !claimant.GetPlayer() ) {
				break;
			}
			const auto master_id = claimant.GetPlayer()->GetSubmissiveToId();
			if (
				master_id < 0 ||
				master_id >= static_cast< int64_t >( slots.size() ) ||
				surviving_slots.find( static_cast< size_t >( master_id ) ) == surviving_slots.end() ||
				!visited.insert( static_cast< size_t >( master_id ) ).second
			) {
				break;
			}
			claimant_slot = static_cast< size_t >( master_id );
		}
		claimant_slots.insert( claimant_slot );
	}

	if ( claimant_slots.size() != 1 ) {
		return nullptr;
	}
	const auto winner_slot = *claimant_slots.begin();
	if ( winner_slot >= slots.size() ) {
		return nullptr;
	}
	const auto& winner = slots.at( winner_slot );
	return winner.GetState() == slot::Slot::SS_PLAYER
		? winner.GetPlayer()
		: nullptr;
}

void Game::DeclareVictory( GSE_CALLABLE, const victory_type_t type, const size_t winner_slot ) {
	if ( IsGameOver() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Game already has a winner" );
	}
	if (
		type != VT_CONQUEST && type != VT_TRANSCENDENCE &&
		type != VT_ECONOMIC && type != VT_DIPLOMATIC
	) {
		GSE_ERROR( gse::EC.INVALID_CALL, "Unsupported victory type" );
	}
	if ( !m_state || winner_slot >= m_state->m_slots->GetCount() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Victory winner slot does not exist" );
	}
	const auto& winner = m_state->m_slots->GetSlot( winner_slot );
	if ( winner.GetState() != slot::Slot::SS_PLAYER || !winner.GetPlayer() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Victory winner slot has no player" );
	}
	if ( winner.GetPlayer()->IsNative() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Planet cannot claim a faction victory" );
	}
	if ( type == VT_CONQUEST && m_state->IsMaster() ) {
		auto* const expected_winner = GetConquestWinner();
		if (
			!expected_winner || !expected_winner->GetSlot() ||
			expected_winner->GetSlot()->GetIndex() != winner_slot
		) {
			GSE_ERROR( gse::EC.GAME_ERROR, "Player has not met the conquest victory condition" );
		}
	}

	m_victory_state = { type, winner_slot, m_current_turn.GetId() };
	const auto type_name = GetVictoryTypeString( type );
	auto* const winner_player = winner.GetPlayer();
	m_state->TriggerObject(
		this, "victory_declared", ARGS_F( type_name, winner_player, this ) {
			{
				"type",
				VALUE( gse::value::String,, type_name ),
			},
			{
				"winner",
				winner_player->Wrap( GSE_CALL ),
			},
			{
				"turn",
				VALUE( gse::value::Int,, m_current_turn.GetId() ),
			},
		}; }
	);
}

const std::string Game::GetVictoryTypeString( const victory_type_t type ) {
	switch ( type ) {
		case VT_NONE:
			return "";
		case VT_CONQUEST:
			return "conquest";
		case VT_TRANSCENDENCE:
			return "transcendence";
		case VT_ECONOMIC:
			return "economic";
		case VT_DIPLOMATIC:
			return "diplomatic";
		default:
			THROW( "Unknown victory type: " + std::to_string( type ) );
	}
}

const bool Game::ParseVictoryType( const std::string& value, victory_type_t& result ) {
	if ( value == "conquest" ) {
		result = VT_CONQUEST;
		return true;
	}
	if ( value == "transcendence" ) {
		result = VT_TRANSCENDENCE;
		return true;
	}
	if ( value == "economic" ) {
		result = VT_ECONOMIC;
		return true;
	}
	if ( value == "diplomatic" ) {
		result = VT_DIPLOMATIC;
		return true;
	}
	result = VT_NONE;
	return value.empty();
}

const bool Game::IsTurnCompleted( const size_t slot_num ) const {
	const auto& slot = m_state->m_slots->GetSlot( slot_num );
	ASSERT( slot.GetState() == slot::Slot::SS_PLAYER, "slot is not player" );
	const auto* player = slot.GetPlayer();
	ASSERT( player, "slot player not set" );
	return player->IsTurnCompleted();
}

const bool Game::IsTurnChecksumValid( const util::crc32::crc_t checksum ) const {
	return m_turn_checksum == checksum;
}

void Game::CompleteTurn( GSE_CALLABLE, const size_t slot_num ) {
	const auto& slot = m_state->m_slots->GetSlot( slot_num );
	ASSERT( slot.GetState() == slot::Slot::SS_PLAYER, "slot is not player" );
	auto* player = slot.GetPlayer();
	ASSERT( player, "slot player not set" );
	player->CompleteTurn();
	SetTurnStatus( turn::TS_WAITING_FOR_PLAYERS );
}

void Game::UncompleteTurn( const size_t slot_num ) {
	const auto& slot = m_state->m_slots->GetSlot( slot_num );
	ASSERT( slot.GetState() == slot::Slot::SS_PLAYER, "slot is not player" );
	auto* player = slot.GetPlayer();
	ASSERT( player, "slot player not set" );
	player->UncompleteTurn();
	if ( slot_num == m_slot_num ) {
		m_is_turn_complete = false;
		CheckTurnComplete();
		if ( !m_is_turn_complete ) {
			SetTurnStatus( turn::TS_TURN_ACTIVE );
		}
	}
}

void Game::AdvanceTurn( const size_t turn_id ) {
	m_current_turn.AdvanceTurn( turn_id );
	m_is_turn_complete = false;
	MTModule::Log( "Turn started: " + std::to_string( turn_id ) );

	{
		auto fr = FrontendRequest( FrontendRequest::FR_TURN_ADVANCE );
		fr.data.turn_advance.turn_id = turn_id;
		AddFrontendRequest( fr );
	}

	m_state->WithGSE( this, [ this, turn_id ]( GSE_CALLABLE ) {
		if ( turn_id > 1 ) {
			for ( const auto& slot : m_state->m_slots->GetSlots() ) {
				if (
					slot.GetState() == slot::Slot::SS_PLAYER &&
					!slot.GetPlayer()->IsNative()
				) {
					slot.GetPlayer()->SetOrbitalDefenseDeployments( 0 );
				}
			}

			for ( auto& it : m_um->GetUnits() ) {
				auto* unit = it.second;
				m_state->TriggerObject(
					m_um, "unit_turn", ARGS_F( &unit ) {
						{
							"unit",
							unit->Wrap( GSE_CALL )
						},
					}; }
				);
				unit->m_moved_this_turn = false;
				unit->m_airdropped_this_turn = false;
				m_um->RefreshUnit( GSE_CALL, unit );
			}

			for ( auto& it : m_bm->GetBases() ) {
				auto* base = it.second;
				m_state->TriggerObject(
					m_bm, "base_turn", ARGS_F( &base ) {
						{
							"base",
							base->Wrap( GSE_CALL )
						},
					}; }
				);
				m_bm->RefreshBase( base );
			}

		}

		m_state->TriggerObject( this, "turn", ARGS_F( this ) {
			{
				"year",
				VALUE( gse::value::Int,, m_current_turn.GetId() + 2100 /* TODO: better way to define starting year? */ ),
			},
			{
				"initial",
				VALUE( gse::value::Bool,, m_current_turn.GetId() == 1 ),
			},
		}; } );
	});

	for ( const auto& slot : m_state->m_slots->GetSlots() ) {
		if (
			slot.GetState() == slot::Slot::SS_PLAYER
		) {
			slot.GetPlayer()->UncompleteTurn();
		}
	}

	m_is_turn_complete = false;
	CheckTurnComplete();
	if ( !m_is_turn_complete ) {
		SetTurnStatus( turn::TS_TURN_ACTIVE );
	}

}

void Game::RestoreTurn( const size_t turn_id ) {
	m_current_turn.AdvanceTurn( turn_id );
	m_is_turn_complete = false;
	MTModule::Log( "Turn restored: " + std::to_string( turn_id ) );

	auto fr = FrontendRequest( FrontendRequest::FR_TURN_ADVANCE );
	fr.data.turn_advance.turn_id = turn_id;
	AddFrontendRequest( fr );
}

const std::string Game::SerializeWorldSnapshot(
	const size_t* viewer_slot,
	const projected_bases_t* const projected_bases_override
) const {
	ASSERT( m_map, "map is not initialized" );
	ASSERT( m_rm && m_um && m_bm && m_am, "world managers are not initialized" );
	ASSERT( viewer_slot || !projected_bases_override, "base projection override requires a viewer" );
	types::Buffer buf;

	m_map->SaveToBuffer( buf );

	{
		types::Buffer resources;
		m_rm->Serialize( resources );
		buf.WriteString( resources.ToString() );
	}

	{
		types::Buffer units;
		if ( viewer_slot ) {
			const auto visible_unit_ids = GetVisibleUnitIdsForSlot( *viewer_slot );
			m_um->Serialize( units, &visible_unit_ids );
		}
		else {
			m_um->Serialize( units );
		}
		buf.WriteString( units.ToString() );
	}

	{
		types::Buffer bases;
		if ( projected_bases_override ) {
			m_bm->Serialize( bases, projected_bases_override );
		}
		else if ( viewer_slot ) {
			const auto projected_bases = GetProjectedBasesForSlot( *viewer_slot );
			m_bm->Serialize( bases, &projected_bases );
		}
		else {
			m_bm->Serialize( bases );
		}
		buf.WriteString( bases.ToString() );
	}

	{
		types::Buffer animations;
		m_am->Serialize( animations );
		buf.WriteString( animations.ToString() );
	}

	buf.WriteInt( m_current_turn.GetId() );
	buf.WriteBool( IsGameOver() );
	if ( IsGameOver() ) {
		buf.WriteString( GetVictoryTypeString( m_victory_state.type ) );
		buf.WriteInt( m_victory_state.winner_slot );
		buf.WriteInt( m_victory_state.turn_id );
	}
	return buf.ToString();
}

const bool Game::DeserializeWorldSnapshot( GSE_CALLABLE, const std::string& serialized_snapshot ) {
	auto buf = types::Buffer( serialized_snapshot );
	NEW( m_map, map::Map, this );
	auto map_buffer = types::Buffer( buf.ReadString() );
	const auto ec = m_map->LoadFromBuffer( map_buffer );
	if ( ec != map::Map::EC_NONE ) {
		DELETE( m_map );
		m_map = nullptr;
		return false;
	}

	auto resource_buffer = types::Buffer( buf.ReadString() );
	auto unit_buffer = types::Buffer( buf.ReadString() );
	auto base_buffer = types::Buffer( buf.ReadString() );
	auto animation_buffer = types::Buffer( buf.ReadString() );
	m_rm->Deserialize( resource_buffer );
	m_um->Deserialize( GSE_CALL, unit_buffer );
	m_bm->Deserialize( GSE_CALL, base_buffer );
	m_am->Deserialize( animation_buffer );

	const auto turn_id = buf.ReadInt< size_t >( "snapshot turn id" );
	const auto has_victory = buf.ReadBool();
	victory_type_t victory_type = VT_NONE;
	size_t winner_slot = 0;
	size_t victory_turn = 0;
	if ( has_victory ) {
		const auto victory_type_name = buf.ReadString();
		if ( !ParseVictoryType( victory_type_name, victory_type ) || victory_type == VT_NONE ) {
			THROW( "invalid world snapshot victory type" );
		}
		winner_slot = buf.ReadInt< size_t >( "snapshot victory winner slot" );
		victory_turn = buf.ReadInt< size_t >( "snapshot victory turn" );
		if ( victory_turn == 0 || victory_turn != turn_id ) {
			THROW( "invalid world snapshot victory turn" );
		}
	}
	if ( buf.GetRemaining() != 0 ) {
		THROW( "unexpected data after serialized world snapshot" );
	}
	if ( turn_id > 0 ) {
		MTModule::Log( "Restoring turn ID: " + std::to_string( turn_id ) );
		RestoreTurn( turn_id );
	}
	if ( has_victory ) {
		DeclareVictory( GSE_CALL, victory_type, winner_slot );
	}
	return true;
}

void Game::GlobalFinalizeTurn( GSE_CALLABLE ) {
	ASSERT( m_state->IsMaster(), "not master" );
	ASSERT( m_verified_turn_checksum_slots.empty(), "turn finalization slots not empty" );
	MTModule::Log( "Finalizing turn ( checksum = " + std::to_string( m_turn_checksum ) + " )" );
	THROW( "TODO: GLOBAL FINALIZE TURN");
	//AddEvent( GSE_CALL, new event::FinalizeTurn( m_slot_num ) );
}

void Game::FirstTurn( GSE_CALLABLE ) {
	ASSERT( m_state->IsMaster(), "not master" );

	// reset some states
	m_current_turn.AdvanceTurn( 1 );
	m_verified_turn_checksum_slots.clear();
	m_turn_checksum = 0;

	MTModule::Log( "Advancing turn ( id = " + std::to_string( m_current_turn.GetId() ) + " )" );
	m_state->WithGSE( this, [ this ]( GSE_CALLABLE ){
		Event( GSE_CALL, "advance_turn", {
			{ "turn_id", VALUE( gse::value::Int,, m_current_turn.GetId() ) }
		} );
	});
}

faction::Faction* Game::GetFaction( const std::string& id ) const {
	auto* faction = m_state->GetFM()->Get( id ); // TODO: store factions in Game itself?
	ASSERT( faction, "faction not found: " + id );
	return faction;
}

map::tile::TileManager* Game::GetTM() const {
	return m_tm;
}

resource::ResourceManager* Game::GetRM() const {
	return m_rm;
}

unit::UnitManager* Game::GetUM() const {
	return m_um;
}

base::BaseManager* Game::GetBM() const {
	return m_bm;
}

animation::AnimationManager* Game::GetAM() const {
	return m_am;
}

gc::Space* const Game::GetGCSpace() const {
	ASSERT( m_state, "state not set" );
	ASSERT( m_state->m_gc_space, "state gc space not set" );
	return m_state->m_gc_space;
}

const types::Vec3 Game::GetTileRenderCoords( const map::tile::Tile* tile ) {
	const auto* ts = m_map->GetTileState( tile );
	ASSERT( ts, "ts not set" );
	const auto l = tile->is_water_tile
		? map::tile::LAYER_WATER
		: map::tile::LAYER_LAND;
	const auto& layer = ts->layers[ l ];
	const auto& c = layer.coords.center;
	return {
		c.x,
		-c.y,
		c.z
	};
}

void Game::WithRW( const std::function< void() >& f ) {
	m_rw_counter++;
	f();
	m_rw_counter--;
}

void Game::InitComplete( GSE_CALLABLE ) {
	ASSERT( m_game_state != GS_RUNNING, "game already initialized" );

	try {
		m_state->TriggerObject(
			this, "start", ARGS_F( this ) {
				{
					"game",
					Wrap( GSE_CALL )
				},
			}; }
		);
	}
	catch ( const gse::Exception& e ) {
		MTModule::Log( (std::string)"Initialization failed: " + e.ToString() );
		InitFailed( e.what() );
		return;
	}

	m_game_state = GS_RUNNING;
	m_um->ProcessUnprocessed( GSE_CALL );
	m_bm->ProcessUnprocessed( GSE_CALL );
	m_um->ValidateHomeBases();
	if ( m_state->m_connection ) {
		m_state->m_connection->IfServer(
			[]( connection::Server* connection ) -> void {
				connection->SetGameState( connection::Connection::GS_RUNNING ); // allow clients to download map
			}
		);
	}
}

void Game::InitFailed( const std::string& error_text ) {
	MTModule::Log( "Initialization failed: " + error_text );
	// need to delete these here because they weren't passed to main thread
	if ( m_map->m_textures.terrain ) {
		DELETE( m_map->m_textures.terrain );
		m_map->m_textures.terrain = nullptr;
	}
	if ( m_map->m_meshes.terrain ) {
		DELETE( m_map->m_meshes.terrain );
		m_map->m_meshes.terrain = nullptr;
	}
	if ( m_map->m_meshes.terrain_data ) {
		DELETE( m_map->m_meshes.terrain_data );
		m_map->m_meshes.terrain_data = nullptr;
	}

	ASSERT( m_state, "state not set" );
	if ( m_state->m_connection ) {
		m_state->m_connection->Disconnect( "Failed to initialize game" );
	}

	m_initialization_error = error_text;
	ResetGame();
	m_state = nullptr;

	if ( m_old_map ) {
		MTModule::Log( "Restoring old map state" );
		m_map = m_old_map; // restore old state // TODO: test
		m_old_map = nullptr;
	}
}

static const std::unordered_map< backend::turn::turn_status_t, std::string > s_turn_status_str = {
	{ turn::TS_PLEASE_WAIT, "please_wait" },
	{ turn::TS_TURN_ACTIVE, "active" },
	{ turn::TS_TURN_COMPLETE, "turn_complete" },
	{ turn::TS_WAITING_FOR_PLAYERS, "waiting_for_players" },
};

void Game::SetTurnStatus( const backend::turn::turn_status_t status ) {
	auto fr = FrontendRequest( FrontendRequest::FR_TURN_STATUS );
	fr.data.turn_status.status = status;
	AddFrontendRequest( fr );
	ASSERT( s_turn_status_str.find( status ) != s_turn_status_str.end(), "unknown status: " + std::to_string( status ) );
	m_state->WithGSE( this, [ this, status ]( GSE_CALLABLE ) {
		m_state->TriggerObject( this, "turn_status", ARGS_F( &status ) {
			{
				"status",
				VALUE( gse::value::String,, s_turn_status_str.at( status ) ),
			},
		}; } );
	});
}

void Game::ProcessEvents() {
	std::vector< pending_event_t > events;
	{
		std::lock_guard guard( m_pending_events_mutex );
		events = m_pending_events;
		m_pending_events.clear();
	}
	if ( !events.empty() ) {
		m_state->WithGSE( this, [ this, events ]( GSE_CALLABLE ) {
			const std::string* errptr = nullptr;
			for ( size_t event_index = 0 ; event_index < events.size() ; event_index++ ) {
				const auto& pending = events.at( event_index );
				auto* const event = pending.event
					? pending.event
					: event::Event::Deserialize(
						this,
						pending.from_server ? event::Event::ES_SERVER : event::Event::ES_CLIENT,
						GSE_CALL,
						types::Buffer( pending.serialized_event )
					);
				errptr = nullptr;
#if defined(DEBUG) || defined(FASTDEBUG)
				MTModule::Log( "Event begin: " + event->ToString() );
#endif
				if ( event->GetEventName() == "__unit_visibility" ) {
					const auto& data = event->GetOriginalData();
					const auto payload_it = data.find( "payload" );
					if (
						m_state->IsMaster() || event->GetSource() != event::Event::ES_SERVER ||
						data.size() != 1 || payload_it == data.end() ||
						!payload_it->second || payload_it->second->type != gse::VT_STRING
					) {
						THROW( "invalid internal unit visibility event" );
					}
					const auto payload = ( (gse::value::String*)payload_it->second )->value;
					auto dependency_buf = types::Buffer( payload );
					const auto after_event_id = dependency_buf.ReadString();
					if ( !after_event_id.empty() ) {
						bool is_waiting_for_response = false;
						{
							std::lock_guard guard( m_events_waiting_for_responses_mutex );
							is_waiting_for_response =
								m_events_waiting_for_responses.find( after_event_id ) !=
								m_events_waiting_for_responses.end();
						}
						if ( is_waiting_for_response ) {
							std::lock_guard guard( m_pending_events_mutex );
							m_pending_events.insert(
								m_pending_events.begin(),
								events.begin() + event_index,
								events.end()
							);
							break;
						}
					}
					WithRW( [ this, &ctx, &gc_space, &si, &ep, &payload ]() {
						ApplyUnitVisibilityUpdate( GSE_CALL, payload );
					} );
					continue;
				}
				if ( event->GetEventName() == "__base_visibility" ) {
					const auto& data = event->GetOriginalData();
					const auto payload_it = data.find( "payload" );
					if (
						m_state->IsMaster() || event->GetSource() != event::Event::ES_SERVER ||
						data.size() != 1 || payload_it == data.end() ||
						!payload_it->second || payload_it->second->type != gse::VT_STRING
					) {
						THROW( "invalid internal base visibility event" );
					}
					const auto payload = ( (gse::value::String*)payload_it->second )->value;
					auto dependency_buf = types::Buffer( payload );
					const auto after_event_id = dependency_buf.ReadString();
					if ( !after_event_id.empty() ) {
						bool is_waiting_for_response = false;
						{
							std::lock_guard guard( m_events_waiting_for_responses_mutex );
							is_waiting_for_response =
								m_events_waiting_for_responses.find( after_event_id ) !=
								m_events_waiting_for_responses.end();
						}
						if ( is_waiting_for_response ) {
							std::lock_guard guard( m_pending_events_mutex );
							m_pending_events.insert(
								m_pending_events.begin(),
								events.begin() + event_index,
								events.end()
							);
							break;
						}
					}
					WithRW( [ this, &ctx, &gc_space, &si, &ep, &payload ]() {
						ApplyBaseVisibilityUpdate( GSE_CALL, payload );
					} );
					continue;
				}
				if ( event->GetEventName() == "__player_visibility" ) {
					const auto& data = event->GetOriginalData();
					const auto payload_it = data.find( "payload" );
					if (
						m_state->IsMaster() || event->GetSource() != event::Event::ES_SERVER ||
						data.size() != 1 || payload_it == data.end() ||
						!payload_it->second || payload_it->second->type != gse::VT_STRING
					) {
						THROW( "invalid internal player visibility event" );
					}
					const auto payload = ( (gse::value::String*)payload_it->second )->value;
					auto dependency_buf = types::Buffer( payload );
					const auto after_event_id = dependency_buf.ReadString();
					if ( !after_event_id.empty() ) {
						bool is_waiting_for_response = false;
						{
							std::lock_guard guard( m_events_waiting_for_responses_mutex );
							is_waiting_for_response =
								m_events_waiting_for_responses.find( after_event_id ) !=
								m_events_waiting_for_responses.end();
						}
						if ( is_waiting_for_response ) {
							std::lock_guard guard( m_pending_events_mutex );
							m_pending_events.insert(
								m_pending_events.begin(),
								events.begin() + event_index,
								events.end()
							);
							break;
						}
					}
					WithRW( [ this, &ctx, &gc_space, &si, &ep, &payload ]() {
						ApplyPlayerVisibilityUpdate( GSE_CALL, payload );
					} );
					continue;
				}
				if ( event->GetEventName() == "__map_projection" ) {
					const auto& data = event->GetOriginalData();
					const auto payload_it = data.find( "payload" );
					if (
						m_state->IsMaster() || event->GetSource() != event::Event::ES_SERVER ||
						data.size() != 1 || payload_it == data.end() ||
						!payload_it->second || payload_it->second->type != gse::VT_STRING
					) {
						THROW( "invalid internal map projection event" );
					}
					const auto payload = ( (gse::value::String*)payload_it->second )->value;
					auto dependency_buf = types::Buffer( payload );
					const auto after_event_id = dependency_buf.ReadString();
					if ( !after_event_id.empty() ) {
						bool is_waiting_for_response = false;
						{
							std::lock_guard guard( m_events_waiting_for_responses_mutex );
							is_waiting_for_response =
								m_events_waiting_for_responses.find( after_event_id ) !=
								m_events_waiting_for_responses.end();
						}
						if ( is_waiting_for_response ) {
							std::lock_guard guard( m_pending_events_mutex );
							m_pending_events.insert(
								m_pending_events.begin(),
								events.begin() + event_index,
								events.end()
							);
							break;
						}
					}
					WithRW( [ this, &ctx, &gc_space, &si, &ep, &payload ]() {
						ApplyMapProjectionUpdate( GSE_CALL, payload );
					} );
					continue;
				}
				auto* obj = VALUE( gse::value::Object, , GSE_CALL_NOGC, event->GetData() );
				const auto fargs = gse::value::function_arguments_t{ obj };
				event::EventHandler* handler = nullptr;
				{
					std::lock_guard guard( m_event_handlers_mutex );
					const auto& it = m_event_handlers.find( event->GetEventName() );
					handler = it != m_event_handlers.end()
						? it->second
						: nullptr;
				}
				if ( event->HasInvalidatedReferences() ) {
					errptr = new std::string( "Event references an object that no longer exists" );
				}
				else if ( IsGameOver() && event->GetEventName() != "chat_message" ) {
					errptr = new std::string( "Game has ended" );
				}
				else if ( handler ) {
					errptr = handler->Validate( GSE_CALL, fargs );
				}
				else {
					errptr = new std::string( "Unknown event: " + event->GetEventName() );
				}
				if ( !errptr ) {

					const auto f_process = [ &handler, &fargs, &gc_space, &ctx, &si, &ep, &obj ] () {
						auto* applied = handler->Apply( GSE_CALL, fargs );
						if ( applied ) {
							obj->Set( "applied", applied, GSE_CALL );
						}
						return applied;
					};

					if ( m_state->IsMaster() ) { // either singleplayer or multiplayer host
						ASSERT( event->GetSource() != event::Event::ES_SERVER, "got event from server to server" );
						// process event
						gse::Value* resolved = nullptr;
						if ( handler->HasResolve() ) {
							resolved = handler->Resolve( GSE_CALL, fargs );
							if ( resolved ) {
								event->SetResolved( resolved );
								obj->Set( "resolved", resolved, GSE_CALL );
							}
						}
						if ( m_state->m_connection ) {
							if ( event->GetSource() == event::Event::ES_CLIENT ) {
								// notify caller of acceptance
								m_state->m_connection->AsServer()->SendGameEventResponse( event->GetCaller(), event->GetId(), true, resolved );
							}
							// broadcast to clients
							ASSERT( m_state->m_connection->IsServer(), "master but not server" );
							m_state->m_connection->SendGameEvent(
								event,
								handler->IsPrivateUnitEvent(),
								handler->IsUnitSnapshotEvent(),
								handler->IsPrivatePlayerEvent()
							);
						}
						WithRW( f_process );
						if ( m_state->m_connection ) {
							m_state->m_connection->FinalizeGameEvent( event );
						}
					}
					else { // multiplayer non-host
						ASSERT( event->GetSource() != event::Event::ES_CLIENT, "got event from client to client" );
						ASSERT( m_state->m_connection, "not master but no connection" );
						bool process_now = false;
						if ( handler->HasResolve() ) {
							if ( event->GetSource() == event::Event::ES_LOCAL ) {
								// just send to server and wait for resolution
								ASSERT( !event->GetResolved(), "client event already resolved" );
								process_now = false;
							}
							else {
								// resolution came from server
								auto* const resolved = event->GetResolved();
								ASSERT( resolved, "server sent unresolved event" );
								obj->Set( "resolved", resolved, GSE_CALL );
								process_now = true;
							}
						}
						else {
							process_now = true;
						}
						gse::Value* rollback_data = nullptr;
						if ( process_now ) {
							WithRW( [ &f_process, &rollback_data ](){
								rollback_data = f_process();
							} );
						}
						if ( event->GetSource() == event::Event::ES_LOCAL ) {
							std::lock_guard guard( m_events_waiting_for_responses_mutex );
							// send to server and wait for response asynchonously
							ASSERT( m_events_waiting_for_responses.find( event->GetId() ) == m_events_waiting_for_responses.end(), "event already waiting for response" );
							m_events_waiting_for_responses.insert(
								{
									event->GetId(),
									{
										event,
										rollback_data,
										process_now
									}
								}
							);
							m_state->m_connection->SendGameEvent(
								event,
								handler->IsPrivateUnitEvent(),
								handler->IsUnitSnapshotEvent(),
								handler->IsPrivatePlayerEvent()
							);
						}
					}
				}
				else {
					MTModule::Log( "Event rejected: " + *errptr );
					if ( m_state->m_connection && m_state->IsMaster() ) {
						if ( event->GetSource() == event::Event::ES_CLIENT ) {
							// notify caller of rejection
							m_state->m_connection->AsServer()->SendGameEventResponse( event->GetCaller(), event->GetId(), false, nullptr );
						}
					}
					delete ( errptr );
				}
#if defined(DEBUG) || defined(FASTDEBUG)
				MTModule::Log( "Event end: " + event->ToString() );
#endif
			}
		});
	}
}

void Game::ApplyUnitVisibilityUpdate( GSE_CALLABLE, const std::string& payload ) {
	ASSERT( !m_state->IsMaster(), "unit visibility update applied on master" );
	auto buf = types::Buffer( payload );
	buf.ReadString(); // optional local event response dependency, handled by ProcessEvents
	const auto hidden_count = buf.ReadCollectionSize( "hidden unit" );
	std::unordered_set< size_t > hidden_ids = {};
	for ( size_t i = 0 ; i < hidden_count ; i++ ) {
		const auto unit_id = buf.ReadInt< size_t >( "hidden unit id" );
		if ( unit_id == 0 || !hidden_ids.insert( unit_id ).second ) {
			THROW( "invalid or duplicate hidden unit id" );
		}
	}
	const auto revealed_count = buf.ReadCollectionSize( "revealed unit" );
	std::map< size_t, std::string > revealed_units = {};
	for ( size_t i = 0 ; i < revealed_count ; i++ ) {
		const auto serialized_unit = buf.ReadString();
		auto unit_buf = types::Buffer( serialized_unit );
		auto id_buf = unit_buf;
		const auto unit_id = id_buf.ReadInt< size_t >( "revealed unit id" );
		if (
			unit_id == 0 || hidden_ids.find( unit_id ) != hidden_ids.end() ||
			!revealed_units.insert( { unit_id, serialized_unit } ).second
		) {
			THROW( "invalid, duplicate, or simultaneously hidden revealed unit id" );
		}
	}
	const auto next_unit_id = buf.ReadInt< size_t >( "next unit id" );
	if ( buf.GetRemaining() != 0 ) {
		THROW( "unexpected data after unit visibility update" );
	}

	std::unordered_set< size_t > removed_ids = hidden_ids;
	while ( !removed_ids.empty() ) {
		bool removed_any = false;
		for ( auto it = removed_ids.begin() ; it != removed_ids.end() ; ) {
			auto* const existing = m_um->GetUnit( *it );
			if ( !existing ) {
				it = removed_ids.erase( it );
				removed_any = true;
				continue;
			}
			const auto cargo = m_um->GetCargo( existing );
			bool has_retained_cargo = false;
			for ( const auto* const carried : cargo ) {
				if ( removed_ids.find( carried->m_id ) == removed_ids.end() ) {
					has_retained_cargo = true;
					break;
				}
			}
			if ( has_retained_cargo ) {
				THROW( "unit visibility update would hide a transport but retain its cargo" );
			}
			if ( !cargo.empty() ) {
				++it;
				continue;
			}
			const auto unit_id = *it;
			it = removed_ids.erase( it );
			m_um->DespawnUnit( GSE_CALL, unit_id );
			removed_any = true;
		}
		if ( !removed_any ) {
			THROW( "could not order unit visibility removals" );
		}
	}

	for ( const auto& it : revealed_units ) {
		auto unit_buf = types::Buffer( it.second );
		auto* const existing = m_um->GetUnit( it.first );
		if ( existing ) {
			existing->ApplySerializedSnapshot( GSE_CALL, unit_buf );
		}
		else {
			auto revealed = std::unique_ptr< unit::Unit >(
				unit::Unit::Deserialize( GSE_CALL, unit_buf, m_um )
			);
			m_um->SpawnUnit( GSE_CALL, revealed.release() );
		}
	}
	m_um->ValidateTransports();
	if ( next_unit_id != 0 ) {
		size_t max_unit_id = 0;
		for ( const auto& it : m_um->GetUnits() ) {
			max_unit_id = std::max( max_unit_id, it.first );
		}
		if ( next_unit_id <= max_unit_id ) {
			THROW( "invalid authoritative next unit id" );
		}
		unit::Unit::SetNextId( next_unit_id );
	}
}

void Game::ApplyBaseVisibilityUpdate( GSE_CALLABLE, const std::string& payload ) {
	ASSERT( !m_state->IsMaster(), "base visibility update applied on master" );
	auto buf = types::Buffer( payload );
	buf.ReadString(); // optional local event response dependency, handled by ProcessEvents
	const auto hidden_count = buf.ReadCollectionSize( "hidden base" );
	std::unordered_set< size_t > hidden_ids = {};
	for ( size_t i = 0 ; i < hidden_count ; i++ ) {
		const auto base_id = buf.ReadInt< size_t >( "hidden base id" );
		if ( base_id == 0 || !hidden_ids.insert( base_id ).second ) {
			THROW( "invalid or duplicate hidden base id" );
		}
	}
	const auto projected_count = buf.ReadCollectionSize( "projected base" );
	std::map< size_t, std::string > projected_bases = {};
	for ( size_t i = 0 ; i < projected_count ; i++ ) {
		const auto serialized_base = buf.ReadString();
		auto id_buf = types::Buffer( serialized_base );
		const auto base_id = id_buf.ReadInt< size_t >( "projected base id" );
		if (
			base_id == 0 || hidden_ids.find( base_id ) != hidden_ids.end() ||
			!projected_bases.insert({ base_id, serialized_base }).second
		) {
			THROW( "invalid, duplicate, or simultaneously hidden projected base id" );
		}
	}
	const auto next_base_id = buf.ReadInt< size_t >( "next base id" );
	if ( buf.GetRemaining() != 0 ) {
		THROW( "unexpected data after base visibility update" );
	}

	std::unordered_set< size_t > removed_ids = hidden_ids;
	for ( const auto& it : projected_bases ) {
		if ( m_bm->GetBase( it.first ) ) {
			removed_ids.insert( it.first );
		}
	}
	for ( const auto base_id : removed_ids ) {
		if ( m_bm->GetBase( base_id ) ) {
			m_bm->DespawnBase( GSE_CALL, base_id );
		}
	}
	for ( const auto& it : projected_bases ) {
		m_bm->RestoreBase( GSE_CALL, it.second );
	}
	if ( next_base_id != 0 ) {
		size_t max_base_id = 0;
		for ( const auto& it : m_bm->GetBases() ) {
			max_base_id = std::max( max_base_id, it.first );
		}
		if ( next_base_id <= max_base_id ) {
			THROW( "invalid authoritative next base id" );
		}
		base::Base::SetNextId( next_base_id );
	}
}

void Game::ApplyPlayerVisibilityUpdate( GSE_CALLABLE, const std::string& payload ) {
	ASSERT( !m_state->IsMaster(), "player visibility update applied on master" );
	auto buf = types::Buffer( payload );
	buf.ReadString(); // optional local event response dependency, handled by ProcessEvents
	const auto projected_count = buf.ReadCollectionSize( "projected player" );
	std::map< size_t, std::string > projected_players = {};
	for ( size_t i = 0 ; i < projected_count ; i++ ) {
		const auto slot_num = buf.ReadInt< size_t >( "projected player slot" );
		const auto serialized_player = buf.ReadString();
		if (
			slot_num >= m_state->m_slots->GetCount() ||
			m_state->m_slots->GetSlot( slot_num ).GetState() != slot::Slot::SS_PLAYER ||
			!projected_players.insert({ slot_num, serialized_player }).second
		) {
			THROW( "invalid or duplicate projected player slot" );
		}
		Player validation{ types::Buffer( serialized_player ) };
	}
	if ( buf.GetRemaining() != 0 ) {
		THROW( "unexpected data after player visibility update" );
	}

	for ( const auto& projected_player : projected_players ) {
		auto& player_slot = m_state->m_slots->GetSlot( projected_player.first );
		player_slot.GetPlayer()->Deserialize( types::Buffer( projected_player.second ) );
	}
	// Observers must see one internally consistent projected roster in every
	// callback, even when several players changed in the same event.
	for ( const auto& projected_player : projected_players ) {
		auto& player_slot = m_state->m_slots->GetSlot( projected_player.first );
		Trigger(
			GSE_CALL, "player_update", ARGS_F( &player_slot ) {
				{
					"player", player_slot.Wrap( GSE_CALL )
				}
			}; }
		);
	}
}

void Game::ApplyMapProjectionUpdate( GSE_CALLABLE, const std::string& payload ) {
	ASSERT( !m_state->IsMaster(), "map projection update applied on master" );
	ASSERT( m_map, "map projection update applied without a map" );
	auto buf = types::Buffer( payload );
	buf.ReadString(); // optional local event response dependency, handled by ProcessEvents
	const auto tile_count = buf.ReadCollectionSize( "projected map tile" );
	const auto tile_limit = m_map->GetWidth() * m_map->GetHeight() / 2;
	if ( tile_count > tile_limit ) {
		THROW( "too many projected map tiles" );
	}
	std::map< size_t, std::string > tile_snapshots = {};
	for ( size_t i = 0 ; i < tile_count ; i++ ) {
		const auto key = buf.ReadInt< size_t >( "projected map tile key" );
		const auto snapshot = buf.ReadString();
		if ( !tile_snapshots.insert({ key, snapshot }).second ) {
			THROW( "duplicate projected map tile key" );
		}
	}

	const auto map_state_changed = buf.ReadBool();
	auto sea_level = m_map->GetSeaLevel();
	auto climate = m_map->GetClimateState();
	if ( map_state_changed ) {
		sea_level = buf.ReadInt< map::tile::elevation_t >( "projected map sea level" );
		climate.level = buf.ReadInt< int64_t >( "projected climate level" );
		climate.future_change = buf.ReadInt< int64_t >( "projected climate future change" );
		climate.progress = buf.ReadInt< int64_t >( "projected climate progress" );
		climate.dust_cloud_duration = buf.ReadInt< int64_t >( "projected dust-cloud duration" );
	}
	if ( buf.GetRemaining() != 0 ) {
		THROW( "unexpected data after map projection update" );
	}
	m_map->ApplyEventProjection( tile_snapshots, map_state_changed, sea_level, climate );
}

void Game::CheckRW( GSE_CALLABLE ) const {
	if ( !m_rw_counter ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Game state is read-only. Try using events?");
	}
}

void Game::SetSlotNum( const size_t slotnum ) {
	m_slot_num = slotnum;
}

void Game::AddFrontendRequest( const FrontendRequest& request ) {
	//MTModule::Log( "Sending frontend request (type=" + std::to_string( request.type ) + ")" ); // spammy
	m_pending_frontend_requests->push_back( request );
}

void Game::PushExplorationUpdate() {
	if ( m_game_state != GS_RUNNING || !m_state || !m_map ) {
		return;
	}
	const auto* const player = GetPlayer();
	if ( !player ) {
		return;
	}
	const auto& explored = player->GetExploredTiles();
	if ( m_frontend_exploration_initialized && explored == m_frontend_explored_tiles ) {
		return;
	}

	NEWV( tiles, FrontendRequest::map_exploration_t );
	tiles->reserve( m_map->GetWidth() * m_map->GetHeight() / 2 );
	for ( size_t y = 0 ; y < m_map->GetHeight() ; y++ ) {
		for ( size_t x = y & 1 ; x < m_map->GetWidth() ; x += 2 ) {
			if ( player->HasExploredTile( x, y ) ) {
				tiles->push_back( { x, y } );
			}
		}
	}

	auto fr = FrontendRequest( FrontendRequest::FR_MAP_EXPLORATION );
	fr.data.map_exploration.tiles = tiles;
	fr.data.map_exploration.is_initial = !m_frontend_exploration_initialized;
	AddFrontendRequest( fr );
	m_frontend_explored_tiles = explored;
	m_frontend_exploration_initialized = true;
}

void Game::PushTerritoryVisibilityUpdate() {
	if ( m_game_state != GS_RUNNING || !m_state || !m_state->m_slots ) {
		return;
	}
	const auto* const player = GetPlayer();
	if ( !player ) {
		return;
	}

	uint64_t visible_slots = 0;
	const auto& slots = m_state->m_slots->GetSlots();
	for ( const auto& slot : slots ) {
		const auto slot_index = slot.GetIndex();
		if ( slot_index >= 64 || slot.GetState() != slot::Slot::SS_PLAYER || !slot.GetPlayer() ) {
			continue;
		}
		if (
			slot_index == m_slot_num ||
			(
				player->HasContacted( slot_index ) &&
				slot.GetPlayer()->HasContacted( m_slot_num )
			)
		) {
			visible_slots |= uint64_t( 1 ) << slot_index;
		}
	}
	if (
		m_frontend_territory_visibility_initialized &&
		visible_slots == m_frontend_territory_visible_slots
	) {
		return;
	}

	auto fr = FrontendRequest( FrontendRequest::FR_TERRITORY_VISIBILITY );
	fr.data.territory_visibility.visible_slots = visible_slots;
	AddFrontendRequest( fr );
	m_frontend_territory_visible_slots = visible_slots;
	m_frontend_territory_visibility_initialized = true;
}

void Game::InitGame( MT_Response& response, MT_CANCELABLE ) {

	if ( m_game_state != GS_NONE ) {
		ResetGame();
	}

	ASSERT( !m_state || !m_state->m_connection || m_game_state == GS_NONE, "multiplayer game already initializing or running" );
	ASSERT( m_game_state == GS_NONE, "game still initializing" );

	MTModule::Log( "Initializing game" );
	m_is_loaded_game = m_state->HasPendingGameLoad();

	m_state->WithGSE( this, [ this ]( GSE_CALLABLE ) {
		ASSERT( !m_tm, "tm not null" );
		m_tm = new map::tile::TileManager( this );
		ASSERT( !m_rm, "rm not null" );
		m_rm = new resource::ResourceManager( this );
		ASSERT( !m_um, "um not null" );
		m_um = new unit::UnitManager( this );
		ASSERT( !m_bm, "bm not null" );
		m_bm = new base::BaseManager( this );
		ASSERT( !m_am, "am not null" );
		m_am = new animation::AnimationManager( this );
		RootSessionManagers();
		m_state->TriggerObject( this, "configure", ARGS_F( this ) {
			{
				"game",
				Wrap( GSE_CALL )
			},
		}; } );
	});

	ASSERT( m_pending_frontend_requests, "pending events not set" );
	m_pending_frontend_requests->clear();

	m_game_state = GS_PREPARING_MAP;
	m_initialization_error = "";

	auto* const connection = m_state->m_connection;

	if ( m_state->IsMaster() && !m_is_loaded_game ) {

		// assign random factions to players
		const auto factions = m_state->GetFM()->GetAll();
		std::vector< size_t > available_factions = {};
		available_factions.reserve( factions.size() );
		for ( size_t i = 0 ; i < factions.size() ; i++ ) {
			if ( !( factions.at( i )->m_flags & faction::Faction::FF_NATIVE ) ) {
				available_factions.push_back( i );
			}
		}
		const auto& slots = m_state->m_slots->GetSlots();
		for ( const auto& slot : slots ) {
			if (
				slot.GetState() == slot::Slot::SS_PLAYER &&
				!slot.GetPlayer()->IsNative()
			) {
				auto* const player = slot.GetPlayer();
				ASSERT( player, "player not set" );
				if ( player->GetFaction() ) {
					const auto selected = std::find( factions.begin(), factions.end(), player->GetFaction() );
					if ( selected == factions.end() ) {
						THROW( "Selected faction is not registered: " + player->GetFaction()->m_id );
					}
					const auto index = static_cast< size_t >( selected - factions.begin() );
					const auto available = std::find( available_factions.begin(), available_factions.end(), index );
					if ( available == available_factions.end() ) {
						THROW( "Faction selected by multiple players: " + player->GetFaction()->m_id );
					}
					available_factions.erase( available );
				}
			}
		}
		for ( const auto& slot : slots ) {
			if (
				slot.GetState() == slot::Slot::SS_PLAYER &&
				!slot.GetPlayer()->IsNative()
			) {
				auto* const player = slot.GetPlayer();
				ASSERT( player, "player not set" );
				if ( !player->GetFaction() ) {
					if ( available_factions.empty() ) {
						THROW( "Not enough unique factions for all players" );
					}
					ASSERT( available_factions.size() <= UINT32_MAX, "too many factions" );
					const auto it = available_factions.begin() + m_random->GetUInt( 0, static_cast< uint32_t >( available_factions.size() ) - 1 );
					player->SetFaction( factions.at( *it ) );
					available_factions.erase( it );
				}
			}
		}
		if ( connection ) {
			connection->AsServer()->SendPlayersList();
		}

	}

	if ( connection ) {

		m_slot_num = connection->GetSlotNum();

		connection->ResetHandlers();
		connection->IfServer(
			[ this ]( connection::Server* connection ) -> void {

				/*connection->m_on_player_join = [ this, connection ]( const size_t slot_num, slot::Slot* slot, const Player* player ) -> void {
					MTModule::Log( "Player " + player->GetFullName() + " is connecting..." );
					connection->GlobalMessage( "Connection from " + player->GetFullName() + "..." );
					// actual join will happen after he downloads and initializes map
				};*/

				connection->m_on_flags_update = [ this, connection ]( const size_t slot_num, slot::Slot* slot, const slot::player_flag_t old_flags, const slot::player_flag_t new_flags ) -> void {
					if ( !( old_flags & slot::PF_GAME_INITIALIZED ) && ( new_flags & slot::PF_GAME_INITIALIZED ) ) {
						const auto* player = slot->GetPlayer();
						MTModule::Log( player->GetFullName() + " joined the game." );
						connection->GlobalMessage( player->GetFullName() + " joined the game." );
					}
				};

				/*connection->m_on_player_leave = [ this, connection ]( const size_t slot_num, slot::Slot* slot, const Player* player ) -> void {
					MTModule::Log( "Player " + player->GetFullName() + " left the game." );
					connection->GlobalMessage( player->GetFullName() + " left the game." );
					m_tm->ReleaseTileLocks( slot_num );
				};*/

				connection->m_on_download_request = [ this ](
					const size_t slot_num,
					const projected_bases_t& projected_bases
				) -> const std::string {
					if ( !m_map ) {
						// map not generated yet
						return "";
					}
					MTModule::Log( "Preparing snapshot for download" );
					MTModule::Log( "Sending turn ID: " + std::to_string( m_current_turn.GetId() ) );
					return SerializeWorldSnapshot( &slot_num, &projected_bases );
				};

				connection->SetGameState( connection::Connection::GS_INITIALIZING );
			}
		);

		connection->IfClient(
			[ this ]( connection::Client* connection ) -> void {
				connection->m_on_disconnect = [ this ]() -> bool {
					MTModule::Log( "Connection lost" );
					m_state->DetachConnection();
					if ( m_game_state != GS_RUNNING ) {
						m_initialization_error = "Lost connection to server";
					}
					else {
						Quit( "Lost connection to server" );
					}
					return true;
				};
				connection->m_on_error = [ this ]( const std::string& reason ) -> bool {
					m_initialization_error = reason;
					return true;
				};
			}
		);

		connection->m_on_message = [ this ]( const std::string& message ) -> void {
			Message( message );
		};

		connection->m_on_game_event_validate = [ this ]( event::Event* event ) -> void {
			if ( m_state->IsMaster() ) {
				ASSERT( m_game_state == GS_RUNNING, "game is not running but received event" );
			}
			THROW( "TODO: m_on_game_event_validate");
			if ( m_game_state == GS_RUNNING ) {
/*				m_state->WithGSE( this, [ this, event ]( GSE_CALLABLE ) {
					ValidateEvent( GSE_CALL, event );
				} );*/
			}
			else {
				//m_unprocessed_events.push_back( event );
			}

		};

		connection->m_on_game_event_apply = [ this ]( event::Event* event ) -> void {
			if ( m_state->IsMaster() ) {
				ASSERT( m_game_state == GS_RUNNING, "game is not running but received event" );
			}
			THROW( "TODO: m_on_game_event_apply");
			if ( m_game_state == GS_RUNNING ) {
				/*m_state->WithGSE( this, [ this, event ]( GSE_CALLABLE ) {
					ProcessEvent( GSE_CALL, event );
				});*/
			}
		};

		connection->m_on_game_event_rollback = [ this ]( event::Event* event ) -> void {
			if ( m_state->IsMaster() ) {
				ASSERT( m_game_state == GS_RUNNING, "game is not running but received event" );
			}
			THROW( "TODO: m_on_game_event_rollback");
			if ( m_game_state == GS_RUNNING ) {
				/*m_state->WithGSE( this, [ this, event ]( GSE_CALLABLE ) {
					ProcessEvent( GSE_CALL, event );
				});*/
			}
		};

	}
	else {
		m_slot_num = m_is_loaded_game
			? m_state->GetPendingGameLoad().local_slot
			: 0;
	}
	m_player = m_state->m_slots->GetSlot( m_slot_num ).GetPlayer();
	ASSERT( m_player, "local player is not configured" );
	m_slot = m_player->GetSlot();
	ASSERT( m_slot, "local player slot is not configured" );

	if ( m_is_loaded_game ) {
		ASSERT( m_state->IsMaster(), "loaded game is not authoritative" );
		ASSERT( !connection, "loaded game unexpectedly has a network connection" );
		const auto load = m_state->GetPendingGameLoad();
		m_random->SetState( Random::GetStateFromString( load.random_state ) );
		MTModule::Log( "Loading saved game at turn snapshot" );
		m_state->WithGSE( this, [ this, load ]( GSE_CALLABLE ) {
			try {
				if ( !DeserializeWorldSnapshot( GSE_CALL, load.world_snapshot ) ) {
					THROW( "Saved world map format is not supported" );
				}
				m_state->ClearPendingGameLoad();
				m_slot->SetPlayerFlag( slot::PF_MAP_DOWNLOADED );
				m_game_state = GS_INITIALIZING;
			}
			catch ( const std::exception& e ) {
				m_state->ClearPendingGameLoad();
				InitFailed( (std::string)"Failed to load saved game: " + e.what() );
			}
		});
		response.result = R_SUCCESS;
		return;
	}

	if ( m_state->IsMaster() ) {
		// generate map

		MTModule::Log( "Game seed: " + m_random->GetStateString() );

		ASSERT( !m_old_map, "old map not null" );
		m_old_map = nullptr;
		if ( m_map ) {
			m_old_map = m_map;
		}
		NEW( m_map, map::Map, this );

		const auto* config = g_engine->GetConfig();

#ifdef DEBUG
		// if crash happens - it's handy to have a seed to reproduce it
		util::FS::WriteFile( config->GetDebugPath() + map::s_consts.debug.lastseed_filename, m_random->GetStateString() );
#endif

		map::Map::error_code_t ec = map::Map::EC_UNKNOWN;

#ifdef DEBUG
		if ( !connection && config->HasDebugFlag( config::Config::DF_QUICKSTART_MAP_DUMP ) ) {
			const std::string& filename = config->GetQuickstartMapDump();
			ASSERT( util::FS::FileExists( filename ), "map dump file \"" + filename + "\" not found" );
			MTModule::Log( (std::string)"Loading map dump from " + filename );
			SetLoaderText( "Loading dump" );
			m_map->Deserialize( types::Buffer( util::FS::ReadTextFile( filename ) ) );
			ec = map::Map::EC_NONE;
		}
		else
#endif
		{
			if ( !connection && config->HasLaunchFlag( config::Config::LF_QUICKSTART_MAP_FILE ) ) {
				const std::string& filename = config->GetQuickstartMapFile();
				ec = m_map->LoadFromFile( filename );
			}
			else {
				auto& map_settings = m_state->m_settings.global.map;
				if ( map_settings.type == settings::MapSettings::MT_MAPFILE ) {
					ASSERT( !map_settings.filename.empty(), "loading map requested but map file not specified" );
					ec = m_map->LoadFromFile( map_settings.filename );
				}
				else {
					ec = m_map->Generate( &map_settings, MT_C );
				}
			}

		}

		if ( !ec && canceled ) {
			ec = map::Map::EC_ABORTED;
		}

		if ( !ec ) {
			m_slot->SetPlayerFlag( slot::PF_MAP_DOWNLOADED ); // map was generated locally
			if ( connection ) {
				connection->UpdateSlot( m_slot_num, m_slot, true );
			}
			m_game_state = GS_INITIALIZING;
			response.result = R_SUCCESS;
		}
		else if ( ec == map::Map::EC_ABORTED ) {
			response.result = R_ABORTED;
		}
		else {
			const std::string error_text = map::Map::GetErrorString( ec );
			response.result = R_ERROR;
			NEW( response.data.error.error_text, std::string, error_text );
			InitFailed( error_text );
		}
	}
	else {
		connection->IfClient(
			[ this, &response ]( connection::Client* connection ) -> void {

				// wait for server to initialize
				SetLoaderText( "Waiting for server" );

				const auto f_download_map = [ this, connection ] {

					SetLoaderText( "Downloading world snapshot" );

					connection->m_on_download_progress = [ this ]( const float progress ) -> void {
						SetLoaderText( "Downloading world snapshot:  " + std::to_string( (size_t)std::round( progress * 100 ) ) + "%" );
					};
					connection->m_on_download_complete = [ this, connection ]( const std::string serialized_snapshot ) -> void {
						connection->m_on_download_complete = nullptr;
						connection->m_on_download_progress = nullptr;
						MTModule::Log( "Unpacking world snapshot" );

						m_state->WithGSE( this, [ this, connection, serialized_snapshot ]( GSE_CALLABLE ) {
							if ( DeserializeWorldSnapshot( GSE_CALL, serialized_snapshot ) ) {
								m_game_state = GS_INITIALIZING;
							}
							else {
								MTModule::Log( "WARNING: failed to unpack world snapshot" );
								connection->Disconnect( "Snapshot format mismatch" );
							}
						});
					};
					connection->RequestDownload();
				};
				if ( connection->GetGameState() == connection::Connection::GS_RUNNING ) {
					// server already initialized
					f_download_map();
				}
				else {
					// wait for server to initialize
					connection->m_on_game_state_change = [ this, f_download_map ]( const connection::Connection::game_state_t state ) -> void {
						switch ( state ) {
							case connection::Connection::GS_INITIALIZING: {
								// waiting
								break;
							}
							case connection::Connection::GS_RUNNING: {
								f_download_map();
								break;
							}
							default: {
								THROW( "unexpected game state: " + std::to_string( state ) );
							}
						}
					};
				}
				response.result = R_SUCCESS;
			}
		);
	}
}

void Game::ResetGame() {

	ClearHandlers();

	if ( m_game_state != GS_NONE ) {
		// TODO: do something?
		m_game_state = GS_NONE;
	}
	m_init_cancel = false;
	m_player = nullptr;
	m_slot_num = 0;
	m_slot = nullptr;
	m_frontend_exploration_initialized = false;
	m_frontend_explored_tiles.clear();
	m_frontend_territory_visibility_initialized = false;
	m_frontend_territory_visible_slots = 0;

	{
		std::lock_guard guard( m_events_waiting_for_responses_mutex );
		m_events_waiting_for_responses.clear();
	}
	{
		std::lock_guard guard( m_pending_events_mutex );
		m_pending_events.clear();
	}
	{
		std::lock_guard guard( m_event_handlers_mutex );
		m_event_handlers.clear();
	}
	m_next_event_id = 0;

	UnrootSessionManagers();
	m_tm = nullptr;
	m_rm = nullptr;
	m_um = nullptr;
	m_bm = nullptr;
	m_am = nullptr;

	if ( m_map ) {
		MTModule::Log( "Resetting map" );
		DELETE( m_map );
		m_map = nullptr;
	}

	ASSERT( m_pending_frontend_requests, "pending events not set" );
	m_pending_frontend_requests->clear();

	m_current_turn.Reset();
	m_victory_state = {};
	m_is_loaded_game = false;
	m_is_turn_complete = false;

	if ( m_state ) {
		// ui thread will reset state as needed
		m_state->UnsetGame();
		if ( m_state->m_connection ) {
			m_state->m_connection->Disconnect();
			m_state->m_connection->ResetHandlers();
		}
	}
}

void Game::CheckTurnComplete() {
	if ( IsGameOver() ) {
		return;
	}

	bool is_turn_complete = true;

	for ( const auto& unit : m_um->GetUnits() ) {
		if ( unit.second->m_owner == m_slot && unit.second->HasMovesLeft() ) {
			is_turn_complete = false;
			break;
		}
	}

	if ( m_is_turn_complete != is_turn_complete ) {
		m_is_turn_complete = is_turn_complete;
		MTModule::Log( "Sending turn complete status: " + std::to_string( m_is_turn_complete ) );
		SetTurnStatus( m_is_turn_complete
			? turn::TS_TURN_COMPLETE
			: turn::TS_TURN_ACTIVE
		);
	}

}

const bool Game::IsRunning() const {
	return m_game_state == GS_RUNNING;
}

const bool Game::IsMapReady() const {
	return m_game_state > GS_PREPARING_MAP;
}

const std::string Game::GenerateEventId() {
	return std::to_string( m_slot_num ) + "_" + std::to_string( ++m_next_event_id );
}

void Game::SetState( State* const state ) {
	ASSERT( state, "state is null" );
	if ( state != m_state ) {
		ASSERT( !m_state, "game state already set" );
		m_state = state;
	}
}

}
}
