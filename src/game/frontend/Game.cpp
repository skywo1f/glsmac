#include "Game.h"

#include <algorithm>
#include <map>

#include "engine/Engine.h"
#include "util/random/Random.h"
#include "config/Config.h"
#include "scheduler/Scheduler.h"
#include "game/backend/Game.h"
#include "game/backend/unit/Def.h"
#include "game/backend/base/PopDef.h"
#include "game/backend/animation/Def.h"
#include "game/backend/connection/Connection.h"
#include "graphics/Graphics.h"
#include "util/FS.h"
#include "util/Time.h"
#include "game/backend/State.h"
#include "Types.h"
#include "game/frontend/tile/TileManager.h"
#include "game/frontend/unit/UnitManager.h"
#include "game/frontend/unit/Unit.h"
#include "game/frontend/base/BaseManager.h"
#include "game/frontend/base/Base.h"
#include "game/frontend/resource/ResourceManager.h"
#include "game/frontend/faction/FactionManager.h"
#include "game/frontend/faction/Faction.h"
#include "game/frontend/sprite/InstancedSpriteManager.h"
#include "game/frontend/text/InstancedTextManager.h"
#include "Animation.h"
#include "AnimationDef.h"
#include "game/frontend/unit/UnitDef.h"
#include "Slot.h"
#include "game/frontend/unit/BadgeDefs.h"
#include "scene/actor/Instanced.h"
#include "scene/actor/Mesh.h"
#include "game/frontend/sprite/InstancedSprite.h"
#include "loader/texture/TextureLoader.h"
#include "game/frontend/actor/Actor.h"
#include "game/frontend/actor/TileSelection.h"
#include "scene/Camera.h"
#include "scene/Light.h"
#include "scene/Scene.h"
#include "types/texture/Texture.h"
#include "types/mesh/Render.h"
#include "types/mesh/Data.h"
#include "types/Buffer.h"
#include "game/backend/map/Consts.h"
#include "input/Types.h"
#include "GLSMAC.h"
#include "game/backend/unit/UnitManager.h"
#include "game/backend/unit/Unit.h"
#include "game/backend/base/BaseManager.h"
#include "game/backend/base/Base.h"
#include "game/backend/map/Map.h"
#include "game/backend/map/tile/Tile.h"
#include "ui/UI.h"
#include "ui/dom/Widget.h"
#include "widget/Minimap.h"
#include "widget/TilePreview.h"
#include "widget/TileResources.h"
#include "widget/UnitPreview.h"
#include "widget/BasePreview.h"
#include "gse/value/Null.h"
#include "input/Event.h"
#include "game/backend/resource/Resource.h"

#define INITIAL_CAMERA_ANGLE { -(float)M_PI * 0.5f, (float)M_PI * 0.75f, 0.0f }

namespace game {
namespace frontend {

const Game::consts_t Game::s_consts = {};

Game::Game( GLSMAC* glsmac, backend::State* state, ui::UI* const ui, const std::function< void() > on_start, const std::function< void() > on_cancel )
	: m_glsmac( glsmac )
	, m_state( state )
	, m_ui( ui )
	, m_on_start( on_start )
	, m_on_cancel( on_cancel ) {
	ASSERT( glsmac, "glsmac not set" );
	ASSERT( state, "state not set" );
	ASSERT( ui, "UI not set" );
}

Game::~Game() {
	if ( m_is_initialized ) {
		Log( "WARNING: game task destroyed while still running" );
	}
}

void Game::Start() {

	// note: game thread has it's own random, this one is mostly for UI and small things
	NEW( m_random, util::random::Random );

	auto* game = g_engine->GetGame();
	auto* config = g_engine->GetConfig();

	if ( m_state->IsMaster() ) {
		if ( config->HasLaunchFlag( config::Config::LF_QUICKSTART_MAP_FILE ) ) {
			m_state->m_settings.global.map.type = backend::settings::MapSettings::MT_MAPFILE;
			m_state->m_settings.global.map.filename = config->GetQuickstartMapFile();
		}
		if ( m_state->m_settings.global.map.type == backend::settings::MapSettings::MT_MAPFILE ) {
			m_map_data.filename = util::FS::GetBaseName( m_state->m_settings.global.map.filename );
			m_map_data.last_directory = util::FS::GetDirName( m_state->m_settings.global.map.filename );
		}

	}

	NEW( m_world_scene, scene::Scene, "World", scene::SCENE_TYPE_WORLD );
	g_engine->GetGraphics()->AddScene( m_world_scene );

	NEW( m_ism, sprite::InstancedSpriteManager, m_world_scene );
	NEW( m_itm, text::InstancedTextManager, m_ism );
	NEW( m_fm, faction::FactionManager, this );
	NEW( m_tm, tile::TileManager, this );
	NEW( m_um, unit::UnitManager, this );
	NEW( m_bm, base::BaseManager, this );
	NEW( m_rm, resource::ResourceManager, this );

	RegisterWidgets();

	ShowLoader(
		"Starting game", [ this ]() {
			CancelGame();
			return false;
		}
	);
	m_mt_ids.init = game->MT_Init( m_state );
}

void Game::Stop() {

	if ( !m_is_initialized ) {
		return;
	}

	// cancel incoming requests
	auto* const game = g_engine->GetGame();
	ASSERT( game, "game not set" );
#define GAME_MT_ID_X( _x ) \
    if ( m_mt_ids._x ) { \
        game->MT_Cancel( m_mt_ids._x ); \
        m_mt_ids._x = 0; \
    }
	GAME_MT_IDS_X
#undef GAME_MT_ID_X

	if ( m_is_initialized ) {
		Deinitialize();
	}

	UnregisterWidgets();

	if ( m_um ) {
		DELETE( m_um );
		m_um = nullptr;
	}

	if ( m_bm ) {
		DELETE( m_bm );
		m_bm = nullptr;
	}

	if ( m_rm ) {
		DELETE( m_rm );
		m_rm = nullptr;
	}

	if ( m_tm ) {
		DELETE( m_tm );
		m_tm = nullptr;
	}

	if ( m_fm ) {
		DELETE( m_fm );
		m_fm = nullptr;
	}

	if ( m_itm ) {
		DELETE( m_itm );
		m_itm = nullptr;
	}

	if ( m_ism ) {
		DELETE( m_ism );
		m_ism = nullptr;
	}

	if ( m_world_scene ) {
		g_engine->GetGraphics()->RemoveScene( m_world_scene );
		DELETE( m_world_scene );
		m_world_scene = nullptr;
	}

	if ( game ) {
		ASSERT( !m_state || game->GetState() == m_state, "backend has different state" );
	}
	else if ( m_state ) {
		m_state = nullptr;
	}

	if ( m_random ) {
		DELETE( m_random );
		m_random = nullptr;
	}

}

void Game::Iterate() {
	if ( g_engine->IsShuttingDown() ) {
		return;
	}

	auto* game = g_engine->GetGame();

	const auto f_handle_nonsuccess_init = [ this ]( const backend::MT_Response& response ) -> void {
		switch ( response.result ) {
			case backend::R_ABORTED: {
				CancelGame();
				break;
			}
			case backend::R_ERROR: {
				const std::string error_text = response.data.error.error_text
					? *response.data.error.error_text
					: "Unknown error";
				HideLoader();
				m_glsmac->ShowError(
					"Game initialization failed: " + error_text,
					[ this ]() {
						CancelGame();
					}
				);
				break;
			}
			default: {
				THROW( "unknown response result " + std::to_string( response.result ) );
			}
		}
	};

	if ( m_mt_ids.init ) {
		auto response = game->MT_GetResponse( m_mt_ids.init );
		if ( response.result != backend::R_NONE ) {
			m_mt_ids.init = 0;
			if ( response.result == backend::R_SUCCESS ) {
				// game thread will manage state from now on
				m_state = nullptr;
				// set own slot
				m_slot_index = response.data.init.slot_index;
				// get map data to display it
				m_mt_ids.get_map_data = game->MT_GetMapData();
			}
			else {
				f_handle_nonsuccess_init( response );
			}
		}
		game->MT_DestroyResponse( response );
	}
	if ( m_mt_ids.get_map_data ) {
		auto response = game->MT_GetResponse( m_mt_ids.get_map_data );
		if ( response.result != backend::R_NONE ) {
			if ( response.result == backend::R_PENDING ) {
				// still initializing, try later
				m_mt_ids.get_map_data = game->MT_GetMapData();
			}
			else {
				HideLoader();
				m_mt_ids.get_map_data = 0;

				if ( response.result == backend::R_SUCCESS ) {
					// at this point starting continues in this thread so is not cancelable anymore
					if ( m_on_start ) {
						m_on_start();
						m_on_start = nullptr;
					}

					if ( m_is_initialized ) {
						Deinitialize();
					}

					Initialize(
						{
							response.data.get_map_data->map_width,
							response.data.get_map_data->map_height
						},
						response.data.get_map_data->terrain_texture,
						response.data.get_map_data->terrain_mesh,
						response.data.get_map_data->terrain_data_mesh,
						*response.data.get_map_data->sprites.actors,
						*response.data.get_map_data->sprites.instances,
						response.data.get_map_data->tiles,
						response.data.get_map_data->tile_states
					);
					response.data.get_map_data->terrain_texture = nullptr;
					response.data.get_map_data->terrain_mesh = nullptr;
					response.data.get_map_data->terrain_data_mesh = nullptr;

					UpdateCameraRange();
					UpdateMapInstances();
					UpdateMinimap();
				}
				else {
					f_handle_nonsuccess_init( response );
				}
			}

			game->MT_DestroyResponse( response );
		}
	}
	if ( m_mt_ids.reset ) {
		auto response = game->MT_GetResponse( m_mt_ids.reset );
		if ( response.result != backend::R_NONE ) {
			HideLoader();
			m_mt_ids.reset = 0;

			switch ( response.result ) {
				case backend::R_SUCCESS: {
					ASSERT( m_on_game_exit, "game exit handler not set" );
					const auto on_game_exit = m_on_game_exit;
					m_on_game_exit = nullptr;
					on_game_exit();
					return; // callback may start frontend or engine teardown
				}
				default: {
					THROW( "unknown response result " + std::to_string( response.result ) );
				}
			}
		}
	}
	if ( m_mt_ids.ping ) {
		auto response = game->MT_GetResponse( m_mt_ids.ping );
		if ( response.result != backend::R_NONE ) {
			HideLoader();
			m_mt_ids.ping = 0;
			ASSERT( response.result == backend::R_SUCCESS, "ping not successful" );
			CancelGame();
		}
	}
	if ( m_mt_ids.save_map ) {
		auto response = game->MT_GetResponse( m_mt_ids.save_map );
		if ( response.result != backend::R_NONE ) {
			HideLoader();
			m_mt_ids.save_map = 0;
			if ( response.result == backend::R_SUCCESS ) {
				m_map_data.last_directory = util::FS::GetDirName( *response.data.save_map.path );
				m_map_data.filename = util::FS::GetBaseName( *response.data.save_map.path );
			}
			else {
				const std::string error_text = response.data.error.error_text
					? *response.data.error.error_text
					: "Unknown error";
				m_glsmac->ShowError( "Failed to save map: " + error_text, {} );
			}
			game->MT_DestroyResponse( response );
		}
	}
	if ( m_mt_ids.chat ) {
		auto response = game->MT_GetResponse( m_mt_ids.chat );
		if ( response.result != backend::R_NONE ) {
			ASSERT( response.result == backend::R_SUCCESS, "failed to send chat message to game thread" );
			m_mt_ids.chat = 0;
		}
	}

	{
		auto it = m_animations.begin();
		while ( it != m_animations.end() ) {
			it->second->Iterate();
			if ( it->second->IsFinished() ) {
				SendAnimationFinished( it->first );
				delete it->second;
				it = m_animations.erase( it );
			}
			else {
				it++;
			}
		}
	}

	if ( m_is_initialized ) { // do not check anything else if still starting or error

		// poll backend for frontend requests
		if ( m_mt_ids.get_frontend_requests ) {
			auto response = game->MT_GetResponse( m_mt_ids.get_frontend_requests );
			if ( response.result != backend::R_NONE ) {
				ASSERT( response.result == backend::R_SUCCESS, "unexpected frontend requests response" );
				m_mt_ids.get_frontend_requests = 0;
				const auto* requests = response.data.get_frontend_requests.requests;
				if ( requests ) {
					//Log( "got " + std::to_string( requests->size() ) + " frontend requests" );

					for ( const auto& request : *requests ) {
						ProcessRequest( &request );
						if ( m_on_game_exit ) {
							break; // exiting game
						}
					}
				}
				game->MT_DestroyResponse( response );
				if ( !m_on_game_exit ) {
					m_mt_ids.get_frontend_requests = game->MT_GetFrontendRequests();
				}
			}
		}
		else {
			m_mt_ids.get_frontend_requests = game->MT_GetFrontendRequests();
		}
		if ( !m_on_game_exit ) {
			RefreshMapVisibility();
		}

		// check if previous backend requests were sent successfully
		if ( m_mt_ids.send_backend_requests ) {
			auto response = game->MT_GetResponse( m_mt_ids.send_backend_requests );
			if ( response.result != backend::R_NONE ) {
				//ASSERT( response.result == backend::R_SUCCESS, "backend requests result not successful" );
				m_mt_ids.send_backend_requests = 0;
			}
		}

		// send pending backend requests if present and not sending already
		if ( !m_mt_ids.send_backend_requests && !m_pending_backend_requests.empty() ) {
			m_mt_ids.send_backend_requests = game->MT_SendBackendRequests( m_pending_backend_requests );
			m_pending_backend_requests.clear();
		}

		// response for clicked tile (if click happened)
		const auto tile_at = GetTileAtScreenCoordsResult();
		if ( tile_at.is_set ) {
			ASSERT( m_tile_at_query_purpose != backend::TQP_NONE, "tile preferred mode not set" );
			auto* tile = m_tm->GetTile( tile_at.tile_pos );
			size_t selected_unit_id = 0;
			bool need_scroll = true;
			SelectTileOrUnit( tile, selected_unit_id );
			if ( need_scroll ) {
				ScrollToTile( tile, true );
			}
		}

		auto minimap_texture = GetMinimapTextureResult();
		if ( minimap_texture ) {
			m_widgets.Minimap->Update( nullptr, minimap_texture );
		}

		bool is_camera_position_updated = false;
		bool is_camera_scale_updated = false;
		while ( m_map_control.edge_scrolling.timer.HasTicked() ) {
			m_camera_position.x += m_map_control.edge_scrolling.speed.x;
			m_camera_position.y += m_map_control.edge_scrolling.speed.y;
			is_camera_position_updated = true;
		}

		while ( m_scroller.HasTicked() ) {
			const auto& new_position = m_scroller.GetPosition();
			is_camera_position_updated = true;
			if ( new_position.z != m_camera_position.z ) {
				is_camera_scale_updated = true;
			}

			m_camera_position = new_position;
		}
		if ( !m_scroller.IsRunning() ) {
			if ( m_map_control.key_zooming != 0 ) {
				SmoothScroll( m_map_control.key_zooming );
			}
		}

		if ( is_camera_scale_updated ) {
			UpdateCameraScale();
			UpdateCameraRange();
		}
		if ( is_camera_position_updated ) {
			UpdateCameraPosition();
		}

		for ( auto& actor : m_actors_map ) {
			actor.first->Iterate();
		}

		m_um->Iterate();
	}
}

::game::backend::Game* const Game::GetBackend() const {
	ASSERT( m_game, "backend not set" );
	return m_game;
}

tile::TileManager* Game::GetTM() const {
	ASSERT( m_tm, "tm not set" );
	return m_tm;
}

unit::UnitManager* Game::GetUM() const {
	ASSERT( m_um, "um not set" );
	return m_um;
}

base::BaseManager* Game::GetBM() const {
	ASSERT( m_bm, "bm not set" );
	return m_bm;
}

resource::ResourceManager* Game::GetRM() const {
	ASSERT( m_rm, "bm not set" );
	return m_rm;
}

sprite::InstancedSpriteManager* Game::GetISM() const {
	ASSERT( m_ism, "ism not set" );
	return m_ism;
}

text::InstancedTextManager* Game::GetITM() const {
	ASSERT( m_itm, "itm not set" );
	return m_itm;
}

types::texture::Texture* Game::GetSourceTexture( const ::resource::resource_t res ) {
	const auto it = m_textures.source.find( res );
	if ( it != m_textures.source.end() ) {
		return it->second;
	}
	auto* texture = g_engine->GetTextureLoader()->LoadTexture( res, types::texture::TF_MIPMAPS );
	ASSERT( texture, "texture not loaded" );
	m_textures.source.insert(
		{
			res,
			texture
		}
	);
	return texture;
}

sprite::InstancedSprite* Game::GetTerrainInstancedSprite( const backend::map::sprite_actor_t& actor ) {
	return m_ism->GetInstancedSprite(
		"Terrain_" + actor.name,
		GetSourceTexture( ::resource::PCX_TER1 ),
		actor.tex_coords,
		backend::map::s_consts.tc.ter1_pcx.dimensions,
		{
			actor.tex_coords.x + backend::map::s_consts.tc.ter1_pcx.center.x,
			actor.tex_coords.y + backend::map::s_consts.tc.ter1_pcx.center.y
		},
		{
			backend::map::s_consts.tile.scale.x,
			backend::map::s_consts.tile.scale.y * backend::map::s_consts.sprite.y_scale
		},
		ZL_TERRAIN,
		actor.z_index
	);
}

void Game::CenterAtCoordinatePercents( const types::Vec2< float > position_percents ) {
	const types::Vec2< float > position = {
		m_map_data.range.percent_to_absolute.x.Clamp( position_percents.x ),
		m_map_data.range.percent_to_absolute.y.Clamp( position_percents.y )
	};
	//Log( "Scrolling to percents " + position_percents.ToString() );
	m_camera_position = {
		GetFixedX( -position.x * m_camera_position.z * m_viewport.window_aspect_ratio ),
		-position.y * m_camera_position.z * m_viewport.ratio.y * 0.707f,
		m_camera_position.z
	};
	UpdateCameraPosition();
}

void Game::SetCameraPosition( const types::Vec3 camera_position ) {
	if ( camera_position != m_camera_position ) {
		bool position_updated =
			( m_camera_position.x != camera_position.x ) ||
				( m_camera_position.y != camera_position.y );
		bool scale_updated = m_camera_position.z != camera_position.z;
		m_camera_position = camera_position;
		if ( position_updated ) {
			UpdateCameraPosition();
		}
		if ( scale_updated ) {
			UpdateCameraScale();
		}
	}
}

void Game::FixCameraX() {
	m_camera_position.x = GetFixedX( m_camera_position.x );
}

void Game::UpdateViewport() {
	auto* graphics = g_engine->GetGraphics();
	m_viewport.window_width = graphics->GetViewportWidth();
	m_viewport.window_height = graphics->GetViewportHeight();
	m_viewport.window_aspect_ratio = graphics->GetAspectRatio();
	m_viewport.max.x = std::max< ssize_t >( m_viewport.min.x, m_viewport.window_width );
	size_t bh = 256; // TODO: determine bottombar height from scripts
	m_viewport.max.y = std::max< ssize_t >( m_viewport.min.y, m_viewport.window_height - bh + m_viewport.bottom_bar_overlap );
	m_viewport.ratio.x = (float)m_viewport.window_width / m_viewport.max.x;
	m_viewport.ratio.y = (float)m_viewport.window_height / m_viewport.max.y;
	m_viewport.width = m_viewport.max.x - m_viewport.min.x;
	m_viewport.height = m_viewport.max.y - m_viewport.min.y;
	m_viewport.aspect_ratio = (float)m_viewport.width / m_viewport.height;
	m_viewport.is_fullscreen = graphics->IsFullscreen();
	m_clamp.x.SetSrcRange(
		{
			(float)m_viewport.min.x,
			(float)m_viewport.max.x
		}
	);
	m_clamp.y.SetSrcRange(
		{
			(float)m_viewport.min.y,
			(float)m_viewport.max.y
		}
	);
}

void Game::UpdateCameraPosition() {

	// prevent vertical scrolling outside viewport
	if ( m_camera_position.y < m_camera_range.min.y ) {
		m_camera_position.y = m_camera_range.min.y;
	}
	if ( m_camera_position.y > m_camera_range.max.y ) {
		m_camera_position.y = m_camera_range.max.y;
		if ( m_camera_position.y < m_camera_range.min.y ) {
			m_camera_position.y = ( m_camera_range.min.y + m_camera_range.max.y ) / 2;
		}
	}

	if ( !m_scroller.IsRunning() ) {
		FixCameraX();
	}

	m_camera->SetPosition(
		{
			( 0.5f + m_camera_position.x ) / m_viewport.window_aspect_ratio,
			( 0.5f + m_camera_position.y ) / m_viewport.ratio.y + backend::map::s_consts.tile.scale.z * m_camera_position.z / 1.414f, // TODO: why 1.414?
			( 0.5f + m_camera_position.y ) / m_viewport.ratio.y + m_camera_position.z
		}
	);

	const types::Vec2< float >& percents = {
		1.0f - m_map_data.range.percent_to_absolute.x.Unclamp( m_camera_position.x / m_camera_position.z / m_viewport.window_aspect_ratio ),
		1.0f - m_map_data.range.percent_to_absolute.y.Unclamp( m_camera_position.y / m_camera_position.z / m_viewport.ratio.y / 0.707f )
	};
	const types::Vec2< float >& zoom = {
		2.0f / ( (float)( m_map_data.width ) * m_camera_position.z * m_viewport.window_aspect_ratio ),
		2.0f / ( (float)( m_map_data.height ) * m_camera_position.z * m_viewport.ratio.y * 0.707f ),
	};
	m_widgets.Minimap->SetMinimapSelection( percents, zoom );
}

void Game::UpdateCameraScale() {
	m_camera->SetScale(
		{
			m_camera_position.z,
			m_camera_position.z,
			m_camera_position.z
		}
	);
	//UpdateUICamera();
}

void Game::UpdateCameraAngle() {
	m_camera->SetAngle( m_camera_angle );
	//UpdateUICamera();
}

void Game::UpdateCameraRange() {
	m_camera_range.min.z = 2.82f / ( m_map_data.height + 1 ) / m_viewport.ratio.y; // TODO: why 2.82?
	m_camera_range.max.z = 0.22f; // TODO: fix camera z and allow to zoom in more
	if ( m_camera_position.z < m_camera_range.min.z ) {
		m_camera_position.z = m_camera_range.min.z;
	}
	if ( m_camera_position.z > m_camera_range.max.z ) {
		m_camera_position.z = m_camera_range.max.z;
	}
	m_camera_range.max.y = ( m_camera_position.z - m_camera_range.min.z ) * ( m_map_data.height + 1 ) * m_viewport.ratio.y * 0.1768f; // TODO: why 0.1768?
	m_camera_range.min.y = -m_camera_range.max.y;

	//Log( "Camera range change: Z=[" + to_string( m_camera_range.min.z ) + "," + to_string( m_camera_range.max.z ) + "] Y=[" + to_string( m_camera_range.min.y ) + "," + to_string( m_camera_range.max.y ) + "], z=" + to_string( m_camera_position.z ) );

	m_camera_range.max.x = ( m_map_data.width ) * m_camera_position.z * m_viewport.window_aspect_ratio * 0.25f;
	m_camera_range.min.x = -m_camera_range.max.x;

	UpdateCameraPosition();
	UpdateCameraScale();
}

void Game::UpdateMapInstances() {
	// needed for horizontal scrolling
	std::vector< types::Vec3 > instances;

	const float mhw = backend::map::s_consts.tile.scale.x * m_map_data.width / 2;

	const size_t instances_before_after = (size_t)std::floor(
		m_viewport.aspect_ratio
			/
				(
					(float)m_map_data.width
						/
							m_map_data.height
				)
			/
				2
	) + 1;

	for ( size_t i = instances_before_after ; i > 0 ; i-- ) {
		instances.push_back(
			{
				-mhw * i,
				0.0f,
				0.0f
			}
		);
	}
	instances.push_back(
		{
			0.0f,
			0.0f,
			0.0f
		}
	);
	for ( uint8_t i = 1 ; i <= instances_before_after ; i++ ) {
		instances.push_back(
			{
				+mhw * i,
				0.0f,
				0.0f
			}
		);
	}

	m_world_scene->SetWorldInstancePositions( instances );
}

void Game::UpdateUICamera() {
	// TODO: finish it
	// snapshot camera matrix for world ui
	/*m_camera->GetMatrix()*/
	// tmp/hack
	/*for ( auto& a : m_map->GetActors() ) {
		for ( auto& m : ((scene::actor::Instanced*)a)->GetGameMatrices() ) {
			g_engine->GetUI()->SetGameUIMatrix( m );
			break;
		}
		break;
	}*/
}

const size_t Game::GetViewportHeight() const {
	return m_viewport.height;
}

void Game::LoadMap( const std::string& path ) {
	ASSERT( util::FS::FileExists( path ), "map file \"" + path + "\" not found" );

	auto* game = g_engine->GetGame();
	ShowLoader(
		"Loading map", [ this ]() {
			CancelRequests();
			return false;
		}
	);
	ASSERT( m_state, "state not set" );
	m_state->m_settings.global.map.type = backend::settings::MapSettings::MT_MAPFILE;
	m_state->m_settings.global.map.filename = path;
	m_map_data.filename = util::FS::GetBaseName( path );
	m_map_data.last_directory = util::FS::GetDirName( path );
	if ( m_mt_ids.init ) {
		game->MT_Cancel( m_mt_ids.init );
	}
	if ( m_mt_ids.get_map_data ) {
		game->MT_Cancel( m_mt_ids.get_map_data );
		m_mt_ids.get_map_data = 0;
	}
	m_mt_ids.init = game->MT_Init( m_state );
}

void Game::SaveMap( const std::string& path ) {

	auto* game = g_engine->GetGame();
	ShowLoader( "Saving game" );
	if ( m_mt_ids.save_map ) {
		game->MT_Cancel( m_mt_ids.save_map );

	}
	m_mt_ids.save_map = game->MT_SaveMap( path );
}

types::texture::Texture* Game::GetTerrainTexture() const {
	return m_textures.terrain;
}

const types::Vec3 Game::GetCloserCoords( const types::Vec3& coords, const types::Vec3& ref_coords ) const {
	return {
		GetCloserX( coords.x, ref_coords.x ),
		coords.y,
		coords.z
	};
}

Slot* Game::GetSlot( const size_t index ) const {
	ASSERT( m_slots.find( index ) != m_slots.end(), "slot not found" );
	return m_slots.at( index );
}

void Game::SetWidgetRelation( const ui::widget_type_t type, const size_t id, ui::dom::Widget* const widget ) {
	//Log( "WR SET ( " + std::to_string( type ) + ", " + std::to_string( id ) + ", " + std::to_string( (long long)widget ) + " )" );
	auto it = m_widget_relations.find( type );
	if ( it == m_widget_relations.end() ) {
		it = m_widget_relations.insert( { type, {} } ).first;
	}
	const auto& it2 = it->second.find( widget );
	if ( it2 != it->second.end() ) {
		if ( it2->second == id ) {
			return; // nothing changed
		}
		// clear previous relation
		ASSERT(
			m_related_widgets.find( type ) != m_related_widgets.end() &&
				m_related_widgets.at( type ).find( it2->second ) != m_related_widgets.at( type ).end() &&
				m_related_widgets.at( type ).at( it2->second ).find( widget ) != m_related_widgets.at( type ).at( it2->second ).end(),
			"no related widgets entry or mismatch (on set)" );
		m_related_widgets.at( type ).at( it2->second ).erase( widget );
		it->second.erase( it2 );
	}
	it->second.insert_or_assign( widget, id );
	auto it3 = m_related_widgets.find( type );
	if ( it3 == m_related_widgets.end() ) {
		it3 = m_related_widgets.insert( { type, {} } ).first;
	}
	auto it4 = it3->second.find( id );
	if ( it4 == it3->second.end() ) {
		it4 = it3->second.insert( { id, {} } ).first;
	}
	it4->second.insert( widget );
	switch ( type ) {
		case ui::WT_UNIT_PREVIEW: {
			UpdateRelatedWidgets( type, id, m_um->GetUnitById( id ) );
			break;
		}
		case ui::WT_BASE_PREVIEW: {
			UpdateRelatedWidgets( type, id, m_bm->GetBaseById( id ) );
			break;
		}
		default: {
			// nothing
		}
	}
}

void Game::ClearWidgetRelation( const ui::widget_type_t type, ui::dom::Widget* const widget ) {
	//Log( "WR CLEAR ( " + std::to_string( type ) + ", " + std::to_string( (long long)widget ) + " )" );
	const auto& it = m_widget_relations.find( type );
	ASSERT(
		it != m_widget_relations.end() &&
			it->second.find( widget ) != m_widget_relations.at( type ).end(),
		"widget relation entry not found" );
	const auto related_id = it->second.at( widget );
	ASSERT(
		m_related_widgets.find( type ) != m_related_widgets.end() &&
			m_related_widgets.at( type ).find( related_id ) != m_related_widgets.at( type ).end() &&
			m_related_widgets.at( type ).at( related_id ).find( widget ) != m_related_widgets.at( type ).at( related_id ).end(),
		"no related widgets entry or mismatch (on clear)"
	);
	m_related_widgets.at( type ).at( related_id ).erase( widget );
	it->second.erase( widget );
}

void Game::DefineSlot(
	const size_t slot_index,
	faction::Faction* faction
) {
	if ( m_slots.find( slot_index ) == m_slots.end() ) {
		Log( "Initializing slot: " + std::to_string( slot_index ) );
		m_slots.insert(
			{
				slot_index,
				new Slot(
					slot_index,
					faction
				)
			}
		);
	}
}

void Game::ShowAnimation( AnimationDef* def, const size_t animation_id, const types::Vec3& render_coords ) {
#if defined( DEBUG ) || defined( FASTDEBUG ) || defined( GLSMAC_TESTING )
	if ( g_engine->GetConfig()->HasDebugFlag( config::Config::DF_HEADLESS ) ) {
		SendAnimationFinished( animation_id );
		return;
	}
#endif
	ASSERT( m_animations.find( animation_id ) == m_animations.end(), "animation id already exists" );
	m_animations.insert(
		{
			animation_id,
			new Animation( animation_id, def, render_coords ),
		}
	);
}

void Game::AbortAnimation( const size_t animation_id ) {
	const auto it = m_animations.find( animation_id );
	if ( it == m_animations.end() ) {
		return;
	}
	delete it->second;
	m_animations.erase( it );
}

void Game::DefineAnimation( const backend::animation::Def* def ) {
	ASSERT( m_animationdefs.find( def->m_id ) == m_animationdefs.end(), "animation def already exists" );

	Log( "Defining animation definition: " + def->m_id );

	m_animationdefs.insert(
		{
			def->m_id,
			new AnimationDef(
				m_ism,
				def
			)
		}
	);
}

void Game::UndefineAnimation( const std::string& id ) {
	ASSERT( m_animationdefs.find( id ) != m_animationdefs.end(), "animation def not found" );

	Log( "Undefining animation definition: " + id );

	m_animationdefs.erase( id );
}

void Game::ProcessRequest( const FrontendRequest* request ) {
	//Log( "Received frontend request (type=" + std::to_string( request->type ) + ")" ); // spammy
	const auto f_exit = [ this ]( const std::string& quit_reason ) -> void {
		ExitGame(
			[ this, quit_reason ]() -> void {
				const auto* config = g_engine->GetConfig();
				if (
					config->HasLaunchFlag( config::Config::LF_QUICKSTART ) ||
					config->HasLaunchFlag( config::Config::LF_HOST ) ||
					config->HasLaunchFlag( config::Config::LF_JOIN )
				) {
					GLSMAC::ShutDown();
				}
				else {
					m_glsmac->Reset();
				}
			}
		);
	};
	switch ( request
		? request->type
		: FrontendRequest::FR_QUIT ) {
		case FrontendRequest::FR_QUIT: {
			f_exit(
				request && request->data.quit.reason
					? *request->data.quit.reason
					: ""
			);
			break;
		}
		case FrontendRequest::FR_ERROR: {
			const auto& errmsg = *request->data.error.what;
			if ( request->data.error.stacktrace ) {
				Log( *request->data.error.stacktrace );
			}
			else {
				Log( errmsg );
			}
			m_glsmac->ShowError(
				errmsg, [ f_exit, errmsg ]() {
					f_exit( errmsg );
				}
			);
			break;
		}
		case FrontendRequest::FR_UPDATE_TILES: {
			if ( request->data.update_tiles.serialized_terrain_mesh ) {
				ASSERT(
					request->data.update_tiles.serialized_terrain_data_mesh,
					"terrain mesh update is missing its data mesh"
				);
				auto* const terrain_actor = m_actors.terrain->GetMeshActor();
				terrain_actor->UpdateMesh(
					types::Buffer( *request->data.update_tiles.serialized_terrain_mesh )
				);
				terrain_actor->UpdateDataMesh(
					types::Buffer( *request->data.update_tiles.serialized_terrain_data_mesh )
				);
			}
			else {
				ASSERT(
					!request->data.update_tiles.serialized_terrain_data_mesh,
					"terrain data mesh update is missing its render mesh"
				);
			}
			types::texture::Texture texture_patch(
				request->data.update_tiles.terrain_texture_width,
				request->data.update_tiles.terrain_texture_height
			);
			texture_patch.Deserialize( types::Buffer( *request->data.update_tiles.serialized_terrain_texture_patch ) );
			ASSERT( !texture_patch.IsEmpty(), "tile terrain texture patch is empty" );
			const auto texture_right = request->data.update_tiles.terrain_texture_x + texture_patch.GetWidth() - 1;
			const auto texture_bottom = request->data.update_tiles.terrain_texture_y + texture_patch.GetHeight() - 1;
			m_textures.terrain->AddFrom(
				&texture_patch,
				types::texture::AM_DEFAULT,
				0,
				0,
				texture_patch.GetWidth() - 1,
				texture_patch.GetHeight() - 1,
				request->data.update_tiles.terrain_texture_x,
				request->data.update_tiles.terrain_texture_y
			);
			m_textures.terrain->Update(
				{
					request->data.update_tiles.terrain_texture_x,
					request->data.update_tiles.terrain_texture_y,
					texture_right,
					texture_bottom,
				}
			);
			for ( const auto& actor : *request->data.update_tiles.sprite_actors ) {
				GetTerrainInstancedSprite( actor.second );
			}
			for ( const auto& removal : *request->data.update_tiles.sprite_removals ) {
				auto* actor = m_ism->GetInstancedSpriteByKey( removal.second )->actor;
				ASSERT( actor, "tile sprite actor not found" );
				actor->RemoveInstance( removal.first );
			}
			for ( const auto& addition : *request->data.update_tiles.sprite_additions ) {
				auto* actor = m_ism->GetInstancedSpriteByKey( addition.second.first )->actor;
				ASSERT( actor, "tile sprite actor not found" );
				actor->SetInstance( addition.first, addition.second.second );
			}
			const auto& tiles_data = *request->data.update_tiles.tile_updates;
			for ( const auto& snapshot : tiles_data ) {
				auto* tile = m_tm->GetTile( snapshot.coords.x, snapshot.coords.y );
				ASSERT( tile, "matching tile not found" );

				Log( "Updating tile: " + tile->GetCoords().ToString() );
				tile->Update( snapshot );
				UpdateFogTileGeometry( tile );
			}
			RefreshSelectedTile( m_um->GetSelectedUnit() );
			UpdateMinimap();
			break;
		}
		case FrontendRequest::FR_MAP_EXPLORATION: {
			std::unordered_set< size_t > explored_tiles = {};
			explored_tiles.reserve( request->data.map_exploration.tiles->size() );
			for ( const auto& coords : *request->data.map_exploration.tiles ) {
				ASSERT(
					coords.x < m_map_data.width && coords.y < m_map_data.height &&
					( coords.x & 1 ) == ( coords.y & 1 ),
					"invalid explored tile received from backend"
				);
				explored_tiles.insert( GetTileIndex( coords ) );
			}
			for ( const auto tile_key : m_explored_tiles ) {
				if ( explored_tiles.find( tile_key ) == explored_tiles.end() ) {
					m_pending_territory_observations.erase( tile_key );
					ForgetTerritoryTile( tile_key );
				}
			}
			for ( const auto tile_key : explored_tiles ) {
				if (
					!request->data.map_exploration.is_initial &&
					m_explored_tiles.find( tile_key ) == m_explored_tiles.end()
				) {
					m_pending_territory_observations.insert( tile_key );
				}
			}
			m_exploration_changed = explored_tiles != m_explored_tiles;
			m_explored_tiles = std::move( explored_tiles );
			m_map_visibility_dirty = true;
			break;
		}
		case FrontendRequest::FR_TERRITORY_VISIBILITY: {
			const auto visible_slots = request->data.territory_visibility.visible_slots;
			if ( m_territory_visible_slots != visible_slots ) {
				m_territory_visible_slots = visible_slots;
				m_territory_borders_dirty = true;
				m_map_visibility_dirty = true;
			}
			break;
		}
		case FrontendRequest::FR_TURN_STATUS: {
			m_turn_status = request->data.turn_status.status;
			bool is_turn_active = m_turn_status == backend::turn::TS_TURN_ACTIVE || m_turn_status == backend::turn::TS_TURN_COMPLETE;
			if ( m_is_turn_active != is_turn_active ) {
				m_is_turn_active = is_turn_active;
				if ( m_is_initialized ) {
					if ( m_is_turn_active ) {
						/*const auto* previously_selected_unit = m_selected_unit;
-                                               m_selected_unit = nullptr;
-                                               if ( previously_selected_unit ) {
-                                                       RenderTile( previously_selected_unit->GetTile() );
-                                               }*/ // ???????
						m_um->SelectNextUnitOrSwitchToTileSelection();
					}
					else {
						//DeselectTileOrUnit(); // TODO: why was it needed?
						//GetTileAtCoords( backend::TQP_TILE_SELECT, m_selected_tile_data.tile_position ); // TODO ?
					}
				}
			}
			break;
		}
		case FrontendRequest::FR_TURN_ADVANCE: {
			m_turn_id = request->data.turn_advance.turn_id;
			break;
		}
		case FrontendRequest::FR_FACTION_DEFINE: {
			for ( const auto& faction : *request->data.faction_define.factiondefs ) {
				m_fm->DefineFaction( faction );
			}
			break;
		}
		case FrontendRequest::FR_SLOT_DEFINE: {
			for ( const auto& d : *request->data.slot_define.slotdefs ) {
				auto* faction = m_fm->GetFactionById( d.faction_id );
				DefineSlot( d.slot_index, faction );
				m_um->DefineSlotBadges( d.slot_index, faction );
				m_bm->DefineSlotBadges( d.slot_index, faction );
			}
			break;
		}
		case FrontendRequest::FR_ANIMATION_DEFINE: {
			types::Buffer buf( *request->data.unit_define.serialized_unitdef );
			const auto* animationdef = backend::animation::Def::Deserialize( buf );
			DefineAnimation( animationdef );
			delete animationdef;
			break;
		}
		case FrontendRequest::FR_ANIMATION_UNDEFINE: {
			UndefineAnimation( *request->data.animation_undefine.animation_id );
			break;
		}
		case FrontendRequest::FR_ANIMATION_SHOW: {
			const auto& d = request->data.animation_show;

			const auto animationdef_it = m_animationdefs.find( *d.animation_id );
			ASSERT( animationdef_it != m_animationdefs.end(), "animation id not found" );
			auto* animationdef = animationdef_it->second;

			const auto& c = d.render_coords;
			ShowAnimation(
				animationdef, d.running_animation_id, {
					c.x,
					c.y,
					c.z
				}
			);

			break;
		}
		case FrontendRequest::FR_ANIMATION_ABORT: {
			AbortAnimation( request->data.animation_abort.running_animation_id );
			break;
		}
		case FrontendRequest::FR_TILE_SELECT: {
			auto* const tile = m_tm->GetTile( request->data.tile_select.x, request->data.tile_select.y );
			ASSERT( tile, "tile not found" );
			m_tile_at_query_purpose = backend::TQP_TILE_SELECT;
			SelectTileOrUnit( tile, 0 );
			break;
		}
		case FrontendRequest::FR_UNIT_SELECT: {
			auto* const unit = m_um->GetUnitById( request->data.unit_select.unit_id );
			if ( unit && unit->IsActive() ) {
				m_um->SelectUnit( unit, true );
				ScrollToTile( unit->GetTile(), true );
			}
			break;
		}
		case FrontendRequest::FR_BASE_SELECT: {
			auto* const base = m_bm->GetBaseById( request->data.base_select.base_id );
			if ( base ) {
				m_bm->SelectBase( base );
				ScrollToTile( base->GetTile(), true );
			}
			break;
		}
		case FrontendRequest::FR_UNIT_DEFINE: {
			types::Buffer buf( *request->data.unit_define.serialized_unitdef );
			const auto* unitdef = backend::unit::Def::Deserialize( buf );
			m_um->DefineUnit( unitdef );
			delete unitdef;
			break;
		}
		case FrontendRequest::FR_UNIT_UNDEFINE: {
			m_um->UndefineUnit( *request->data.unit_undefine.id );
			break;
		}
		case FrontendRequest::FR_UNIT_SPAWN: {
			const auto& d = request->data.unit_spawn;
			const auto& tc = d.tile_coords;
			const auto& rc = d.render_coords;
			m_um->SpawnUnit(
				d.unit_id,
				*d.unitdef_id,
				d.slot_index,
				{
					tc.x,
					tc.y
				},
				{
					rc.x,
					rc.y,
					rc.z
				},
				d.movement,
				d.morale,
				*d.morale_string,
				d.health,
				d.embarked,
				d.active
			);
			break;
		}
		case FrontendRequest::FR_UNIT_DESPAWN: {
			m_um->DespawnUnit( request->data.unit_despawn.unit_id );
			break;
		}
		case FrontendRequest::FR_UNIT_UPDATE: {
			const auto& d = request->data.unit_update;
			auto* unit = m_um->GetUnitById( d.unit_id );
			ASSERT( unit, "unit is null" );
			unit->SetMovement( d.movement );
			unit->SetMorale( d.morale, *d.morale_string );
			unit->SetHealth( d.health );
			unit->SetEmbarked( d.embarked );
			unit->SetAvailableForOrders( d.active );
			const auto& c = unit->GetTile()->GetCoords();
			if ( d.tile_coords.x != c.x || d.tile_coords.y != c.y ) {
				if ( !d.embarked ) {
					THROW( "non-embarked unit changed tiles without a move request" );
				}
				unit->SetTile(
					m_tm->GetTile( { d.tile_coords.x, d.tile_coords.y } ),
					false
				);
			}
			unit->Refresh();
			break;
		}
		case FrontendRequest::FR_UNIT_MOVE: {
			const auto& d = request->data.unit_move;
			auto* unit = m_um->GetUnitById( d.unit_id );
			ASSERT( unit, "unit is null" );
			auto* dst_tile = m_tm->GetTile(
				{
					d.dst_tile_coords.x,
					d.dst_tile_coords.y
				}
			);
			m_um->MoveUnit( unit, dst_tile, d.running_animation_id );
			break;
		}
		case FrontendRequest::FR_UNIT_TELEPORT: {
			const auto& d = request->data.unit_teleport;
			auto* const unit = m_um->GetUnitById( d.unit_id );
			ASSERT( unit, "unit is null" );
			auto* const src_tile = unit->GetTile();
			auto* const dst_tile = m_tm->GetTile(
				{
					d.dst_tile_coords.x,
					d.dst_tile_coords.y
				}
			);
			auto* const selected_unit = m_um->GetSelectedUnit();
			if ( selected_unit == unit ) {
				SetSelectedTile( dst_tile );
			}
			unit->SetTile( dst_tile );
			RenderTile( src_tile, selected_unit );
			m_um->RefreshUnit( unit );
			break;
		}
		case FrontendRequest::FR_BASE_POP_DEFINE: {
			types::Buffer buf( *request->data.base_pop_define.serialized_popdef );
			const auto* popdef = backend::base::PopDef::Deserialize( buf );
			m_bm->DefinePop( popdef );
			delete popdef;
			break;
		}
		case FrontendRequest::FR_BASE_POP_UNDEFINE: {
			m_bm->UndefinePop( *request->data.base_pop_undefine.id );
			break;
		}
		case FrontendRequest::FR_BASE_SPAWN: {
			const auto& d = request->data.base_spawn;
			const auto& tc = d.tile_coords;
			const auto& rc = d.render_coords;
			auto* const faction = m_fm->GetFactionById( *d.faction_id );
			ASSERT( faction, "base faction not found: " + *d.faction_id );
			m_bm->SpawnBase(
				d.base_id,
				d.slot_index,
				faction,
				{
					tc.x,
					tc.y
				},
				{
					rc.x,
					rc.y,
					rc.z
				},
				*d.name
			);
			break;
		}
		case FrontendRequest::FR_BASE_DESPAWN: {
			m_bm->DespawnBase( request->data.base_despawn.base_id );
			break;
		}
		case FrontendRequest::FR_BASE_UPDATE: {
			const auto& d = request->data.base_update;
			auto* base = m_bm->GetBaseById( d.base_id );
			ASSERT( base, "base is null" );
			auto* const faction = m_fm->GetFactionById( *d.faction_id );
			ASSERT( faction, "base faction not found: " + *d.faction_id );
			base::Base::pops_t pops = {};
			pops.reserve( d.pops->size() );
			for ( const auto& pop : *d.pops ) {
				pops.push_back(
					base::Pop{
						base,
						m_bm->GetPopDef( pop.type ),
						pop.variant
					}
				);
			}
			base->SetPops( pops );
			m_bm->UpdateBase( base, d.slot_index, faction, *d.name );
			m_bm->RefreshBase( base );
			break;
		}
		case FrontendRequest::FR_RESOURCE_DEFINE: {
			types::Buffer buf( *request->data.resource_define.serialized_resourcedef );
			const auto* resourcedef = backend::resource::Resource::Deserialize( buf );
			m_rm->DefineResource( resourcedef );
			delete resourcedef;
			break;
		}
		case FrontendRequest::FR_RESOURCE_UNDEFINE: {
			m_rm->UndefineResource( *request->data.resource_undefine.id );
			break;
		}
		case FrontendRequest::FR_NORESOURCE_DEFINE: {
			types::Buffer buf( *request->data.noresource_define.serialized_noresource );
			m_rm->DefineNoResource( buf );
			break;
		}
		case FrontendRequest::FR_NORESOURCE_UNDEFINE: {
			m_rm->UndefineNoResource();
			break;
		}
		case FrontendRequest::FR_LOADER_SHOW: {
			m_glsmac->ShowLoader( *request->data.loader.text );
			break;
		}
		case FrontendRequest::FR_LOADER_TEXT: {
			m_glsmac->SetLoaderText( *request->data.loader.text );
			break;
		}
		case FrontendRequest::FR_LOADER_HIDE: {
			m_glsmac->HideLoader();
			break;
		}
		default: {
			THROW( "unexpected frontend request type: " + std::to_string( request->type ) );
		}
	}

	if ( request ) {
		switch ( request->type ) {
			case FrontendRequest::FR_UPDATE_TILES:
			case FrontendRequest::FR_UNIT_SPAWN:
			case FrontendRequest::FR_UNIT_DESPAWN:
			case FrontendRequest::FR_UNIT_UPDATE:
			case FrontendRequest::FR_UNIT_MOVE:
			case FrontendRequest::FR_UNIT_TELEPORT:
			case FrontendRequest::FR_BASE_SPAWN:
			case FrontendRequest::FR_BASE_DESPAWN:
			case FrontendRequest::FR_BASE_UPDATE:
				m_map_visibility_dirty = true;
				break;
			default:
				break;
		}
	}
}

void Game::SendBackendRequest( const BackendRequest* request ) {
	m_pending_backend_requests.push_back( *request );
}

void Game::UpdateMapData( const types::Vec2< size_t >& map_size ) {

	m_map_data.width = map_size.x;
	m_map_data.height = map_size.y;
	m_map_data.range.min = {
		-(float)( m_map_data.width - 1 ) * backend::map::s_consts.tile.radius.x / 2,
		-(float)( m_map_data.height - 1 ) * backend::map::s_consts.tile.radius.y / 2,
	};
	m_map_data.range.max = {
		(float)( m_map_data.width - 1 ) * backend::map::s_consts.tile.radius.x / 2,
		(float)( m_map_data.height - 1 ) * backend::map::s_consts.tile.radius.y / 2,
	};
	m_map_data.range.percent_to_absolute.x.SetRange(
		{
			{ 0.0f,                                                          1.0f },
			{ m_map_data.range.min.x - backend::map::s_consts.tile.radius.x, m_map_data.range.max.x + backend::map::s_consts.tile.radius.x }
		}
	);
	m_map_data.range.percent_to_absolute.y.SetRange(
		{
			{ 0.0f,                                                          1.0f },
			{ m_map_data.range.min.y - backend::map::s_consts.tile.radius.y, m_map_data.range.max.y + backend::map::s_consts.tile.radius.y }
		}
	);

	m_tm->InitTiles( map_size );
}

const size_t Game::GetTileIndex( const types::Vec2< size_t >& coords ) const {
	return coords.y * m_map_data.width + coords.x;
}

const size_t Game::GetCompactTileIndex( const types::Vec2< size_t >& coords ) const {
	return coords.y * ( m_map_data.width / 2 ) + coords.x / 2;
}

void Game::InitializeFog() {
	ASSERT( !m_actors.fog, "fog actor already set" );
	ASSERT( !m_textures.fog, "fog texture already set" );
	const size_t tile_count = m_map_data.width * m_map_data.height / 2;
	NEWV( mesh, types::mesh::Render, tile_count * 5, tile_count * 4 );

	for ( size_t y = 0 ; y < m_map_data.height ; y++ ) {
		for ( size_t x = y & 1 ; x < m_map_data.width ; x += 2 ) {
			const auto& coords = m_tm->GetTile( x, y )->GetRenderData().selection_coords;
			const types::Color::color_t unexplored_tint = { 1.0f, 1.0f, 1.0f, 1.0f };
			const auto center = mesh->AddVertex( coords.center, { 0.5f, 0.5f }, unexplored_tint );
			const auto left = mesh->AddVertex( coords.left, { 0.0f, 1.0f }, unexplored_tint );
			const auto top = mesh->AddVertex( coords.top, { 0.0f, 0.0f }, unexplored_tint );
			const auto right = mesh->AddVertex( coords.right, { 1.0f, 0.0f }, unexplored_tint );
			const auto bottom = mesh->AddVertex( coords.bottom, { 1.0f, 1.0f }, unexplored_tint );
			mesh->AddSurface( { center, left, top } );
			mesh->AddSurface( { center, top, right } );
			mesh->AddSurface( { center, right, bottom } );
			mesh->AddSurface( { center, bottom, left } );
		}
	}
	mesh->Finalize();

	m_textures.fog = types::texture::Texture::FromColor( { 0.0f, 0.0f, 0.0f, 1.0f } );
	NEWV( fog_actor, scene::actor::Mesh, "MapFog", mesh );
	fog_actor->SetTexture( m_textures.fog );
	fog_actor->SetRenderFlags(
		scene::actor::Actor::RF_IGNORE_LIGHTING |
		scene::actor::Actor::RF_IGNORE_DEPTH
	);
	NEW( m_actors.fog, scene::actor::Instanced, fog_actor );
	// Fog must be composited after every world actor, including resource sprites.
	m_actors.fog->SetZIndex( 0.9f );
	m_actors.fog->AddInstance( {} );
	m_world_scene->AddActor( m_actors.fog );
	m_fog_states.assign( tile_count, FS_UNEXPLORED );
	m_territory_knowledge.assign( tile_count, {} );
}

void Game::UpdateFogTileGeometry( const tile::Tile* tile ) {
	if ( !m_actors.fog ) {
		return;
	}
	auto* const mesh = const_cast< types::mesh::Render* >(
		static_cast< const types::mesh::Render* >( m_actors.fog->GetMeshActor()->GetMesh() )
	);
	const auto& coords = tile->GetCoords();
	const auto vertex = static_cast< types::mesh::index_t >(
		( coords.y * ( m_map_data.width / 2 ) + coords.x / 2 ) * 5
	);
	const auto& fog_coords = tile->GetRenderData().selection_coords;
	mesh->SetVertex( vertex, fog_coords.center );
	mesh->SetVertex( vertex + 1, fog_coords.left );
	mesh->SetVertex( vertex + 2, fog_coords.top );
	mesh->SetVertex( vertex + 3, fog_coords.right );
	mesh->SetVertex( vertex + 4, fog_coords.bottom );
	m_territory_borders_dirty = true;
}

void Game::AddVisibleTilesInRadius(
	tile::Tile* center,
	const size_t radius,
	std::unordered_set< size_t >& visible_tiles
) const {
	std::unordered_set< tile::Tile* > seen = { center };
	std::vector< tile::Tile* > frontier = { center };
	visible_tiles.insert( GetTileIndex( center->GetCoords() ) );
	for ( size_t distance = 0 ; distance < radius ; distance++ ) {
		std::vector< tile::Tile* > next = {};
		for ( auto* const tile : frontier ) {
			for (
			auto direction = backend::map::tile::D_W ;
			direction <= backend::map::tile::D_SW ;
			direction = static_cast< backend::map::tile::direction_t >( direction + 1 )
			) {
				auto* const candidate = tile->GetNeighbour( direction );
				if ( seen.insert( candidate ).second ) {
					visible_tiles.insert( GetTileIndex( candidate->GetCoords() ) );
					next.push_back( candidate );
				}
			}
		}
		frontier = std::move( next );
	}
}

void Game::AddBaseVisibleTiles(
	tile::Tile* center,
	std::unordered_set< size_t >& visible_tiles
) const {
	const auto f_add = [ this, &visible_tiles ]( tile::Tile* tile ) {
		visible_tiles.insert( GetTileIndex( tile->GetCoords() ) );
		return tile;
	};
	const auto* const n = f_add( center->N );
	const auto* const ne = f_add( center->NE );
	const auto* const e = f_add( center->E );
	const auto* const se = f_add( center->SE );
	const auto* const s = f_add( center->S );
	const auto* const sw = f_add( center->SW );
	const auto* const w = f_add( center->W );
	const auto* const nw = f_add( center->NW );
	f_add( center );
	f_add( n->NW );
	f_add( n->NE );
	f_add( ne->NE );
	f_add( e->NE );
	f_add( e->SE );
	f_add( se->SE );
	f_add( s->SE );
	f_add( s->SW );
	f_add( sw->SW );
	f_add( w->SW );
	f_add( w->NW );
	f_add( nw->NW );
}

const size_t Game::GetTileDistance( const tile::Tile* first, const tile::Tile* second ) const {
	const auto& first_coords = first->GetCoords();
	const auto& second_coords = second->GetCoords();
	const int64_t y_distance = std::abs(
		static_cast< int64_t >( first_coords.y ) - static_cast< int64_t >( second_coords.y )
	);
	const auto f_distance = [ &first_coords, &second_coords, &y_distance ]( const int64_t x_offset ) {
		return static_cast< size_t >(
			(
				std::abs(
					static_cast< int64_t >( first_coords.x ) + x_offset -
					static_cast< int64_t >( second_coords.x )
				) + y_distance
			) / 2
		);
	};
	return std::min(
		f_distance( 0 ),
		std::min(
			f_distance( -static_cast< int64_t >( m_map_data.width ) ),
			f_distance( static_cast< int64_t >( m_map_data.width ) )
		)
	);
}

const base::Base* Game::GetClaimingBase( const tile::Tile* tile ) const {
	static constexpr size_t max_claim_distance = 8;
	static constexpr size_t coastal_claim_distance = 2;
	const auto f_choose = [](
		const base::Base* current,
		const size_t current_distance,
		const base::Base* candidate,
		const size_t candidate_distance
	) {
		return !current || candidate_distance < current_distance || (
			candidate_distance == current_distance && candidate->GetId() < current->GetId()
		);
	};

	const base::Base* connected = nullptr;
	size_t connected_distance = max_claim_distance + 1;
	std::unordered_set< const tile::Tile* > visited = { tile };
	std::vector< const tile::Tile* > frontier = { tile };
	for ( size_t distance = 0 ; distance <= max_claim_distance && !frontier.empty() ; distance++ ) {
		for ( const auto* const current : frontier ) {
			const auto* const candidate = current->GetBase();
			if ( candidate && f_choose( connected, connected_distance, candidate, distance ) ) {
				connected = candidate;
				connected_distance = distance;
			}
		}
		if ( connected || distance == max_claim_distance ) {
			break;
		}
		std::vector< const tile::Tile* > next = {};
		for ( const auto* const current : frontier ) {
			const tile::Tile* const neighbours[] = {
				current->W,
				current->NW,
				current->N,
				current->NE,
				current->E,
				current->SE,
				current->S,
				current->SW,
			};
			for ( const auto* const candidate : neighbours ) {
				if ( candidate->IsWater() == tile->IsWater() && visited.insert( candidate ).second ) {
					next.push_back( candidate );
				}
			}
		}
		frontier = std::move( next );
	}

	const base::Base* coastal = nullptr;
	size_t coastal_distance = coastal_claim_distance + 1;
	if ( tile->IsWater() ) {
		for ( const auto& it : m_bm->GetBases() ) {
			const auto* const candidate = it.second;
			if ( candidate->GetTile()->IsWater() ) {
				continue;
			}
			const auto distance = GetTileDistance( candidate->GetTile(), tile );
			if (
				distance <= coastal_claim_distance &&
				f_choose( coastal, coastal_distance, candidate, distance )
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
	return f_choose( connected, connected_distance, coastal, coastal_distance )
		? coastal
		: connected;
}

void Game::ObserveTerritoryTile( const tile::Tile* tile ) {
	auto& knowledge = m_territory_knowledge.at( GetCompactTileIndex( tile->GetCoords() ) );
	const auto* const base = GetClaimingBase( tile );
	const bool claimed = base != nullptr;
	const size_t owner_slot = claimed ? base->GetOwner()->GetIndex() : 0;
	if (
		!knowledge.known || knowledge.claimed != claimed ||
		( claimed && knowledge.owner_slot != owner_slot )
	) {
		knowledge.known = true;
		knowledge.claimed = claimed;
		knowledge.owner_slot = owner_slot;
		m_territory_borders_dirty = true;
	}
}

void Game::ForgetTerritoryTile( const size_t tile_key ) {
	const types::Vec2< size_t > coords = {
		tile_key % m_map_data.width,
		tile_key / m_map_data.width,
	};
	auto& knowledge = m_territory_knowledge.at( GetCompactTileIndex( coords ) );
	if ( knowledge.known ) {
		knowledge = {};
		m_territory_borders_dirty = true;
	}
}

void Game::RebuildTerritoryBorders() {
	if ( !m_territory_borders_dirty ) {
		return;
	}
	m_territory_borders_dirty = false;

	if ( m_actors.territory ) {
		m_world_scene->RemoveActor( m_actors.territory );
		DELETE( m_actors.territory );
		m_actors.territory = nullptr;
	}

	struct border_edge_t {
		const tile::Tile* tile;
		const types::Vec3* start;
		const types::Vec3* end;
		size_t owner_slot;
	};
	std::vector< border_edge_t > edges = {};
	for ( const auto& it : m_tm->GetTiles() ) {
		const auto* const tile = &it.second;
		const auto& knowledge = m_territory_knowledge.at( GetCompactTileIndex( tile->GetCoords() ) );
		if (
			!knowledge.known || !knowledge.claimed || knowledge.owner_slot >= 64 ||
			!( m_territory_visible_slots & ( uint64_t( 1 ) << knowledge.owner_slot ) )
		) {
			continue;
		}
		const auto& coords = tile->GetRenderData().selection_coords;
		const struct {
			const tile::Tile* neighbour;
			const types::Vec3* start;
			const types::Vec3* end;
		} candidates[] = {
			{ tile->NW, &coords.left, &coords.top },
			{ tile->NE, &coords.top, &coords.right },
			{ tile->SE, &coords.right, &coords.bottom },
			{ tile->SW, &coords.bottom, &coords.left },
		};
		for ( const auto& candidate : candidates ) {
			const auto& neighbour = m_territory_knowledge.at(
				GetCompactTileIndex( candidate.neighbour->GetCoords() )
			);
			const bool neighbour_is_visible_claim =
				neighbour.claimed && neighbour.owner_slot < 64 &&
				( m_territory_visible_slots & ( uint64_t( 1 ) << neighbour.owner_slot ) );
			if (
				neighbour.known &&
				( !neighbour_is_visible_claim || neighbour.owner_slot != knowledge.owner_slot )
			) {
				edges.push_back( { tile, candidate.start, candidate.end, knowledge.owner_slot } );
			}
		}
	}

	if ( edges.empty() ) {
		return;
	}

	NEWV( mesh, types::mesh::Render, edges.size() * 4, edges.size() * 2 );
	static constexpr float border_width = 0.13f;
	for ( const auto& edge : edges ) {
		const auto& center = edge.tile->GetRenderData().selection_coords.center;
		const auto inner_start = *edge.start + ( center - *edge.start ) * border_width;
		const auto inner_end = *edge.end + ( center - *edge.end ) * border_width;
		auto tint = GetSlot( edge.owner_slot )->GetFaction()->m_colors.border.value;
		tint.alpha = 0.92f;
		const auto v1 = mesh->AddVertex( inner_start, {}, tint );
		const auto v2 = mesh->AddVertex( *edge.start, {}, tint );
		const auto v3 = mesh->AddVertex( *edge.end, {}, tint );
		const auto v4 = mesh->AddVertex( inner_end, {}, tint );
		mesh->AddSurface( { v1, v2, v3 } );
		mesh->AddSurface( { v1, v3, v4 } );
	}
	mesh->Finalize();

	if ( !m_textures.territory ) {
		m_textures.territory = types::texture::Texture::FromColor( { 1.0f, 1.0f, 1.0f, 1.0f } );
	}
	NEWV( border_actor, scene::actor::Mesh, "MapTerritoryBorders", mesh );
	border_actor->SetTexture( m_textures.territory );
	border_actor->SetRenderFlags(
		scene::actor::Actor::RF_IGNORE_LIGHTING |
		scene::actor::Actor::RF_IGNORE_DEPTH
	);
	NEW( m_actors.territory, scene::actor::Instanced, border_actor );
	m_actors.territory->SetZIndex( 0.45f );
	m_actors.territory->AddInstance( {} );
	m_world_scene->AddActor( m_actors.territory );
	Log(
		"Territory borders: " + std::to_string( edges.size() ) +
		" visible ownership edges"
	);
}

const bool Game::CanTargetUnit( const unit::Unit* attacker, const unit::Unit* defender ) const {
	if ( !attacker || !defender || defender->IsOwned() || defender->IsEmbarked() ) {
		return false;
	}
	return defender->IsVisibleToPlayer() || (
		!attacker->IsArtillery() &&
		GetTileDistance( attacker->GetTile(), defender->GetTile() ) == 1
	);
}

void Game::RefreshMapVisibility() {
	if ( !m_map_visibility_dirty || !m_actors.fog ) {
		return;
	}

	std::unordered_set< size_t > visible_tiles = {};
	std::unordered_set< size_t > sensor_detected_tiles = {};
	std::unordered_set< size_t > radar_detected_tiles = {};
	for ( auto& it : m_tm->GetTiles() ) {
		auto* const tile = &it.second;
		const auto* const base = tile->GetBase();
		if ( base && base->IsOwned() ) {
			AddBaseVisibleTiles( tile, visible_tiles );
		}
		for ( const auto& unit : tile->GetUnits() ) {
			if ( unit.second->IsOwned() && !unit.second->IsEmbarked() ) {
				AddVisibleTilesInRadius(
					tile,
					unit.second->HasDeepRadar() ? 2 : 1,
					visible_tiles
				);
				if ( unit.second->HasDeepRadar() ) {
					AddVisibleTilesInRadius( tile, 1, radar_detected_tiles );
				}
			}
		}
	}
	size_t owned_sensor_count = 0;
	for ( auto& it : m_tm->GetTiles() ) {
		auto* const tile = &it.second;
		if ( tile->HasSensor() ) {
			const auto* const owner = GetClaimingBase( tile );
			if ( owner && owner->IsOwned() ) {
				owned_sensor_count++;
				AddVisibleTilesInRadius( tile, 2, visible_tiles );
				AddVisibleTilesInRadius( tile, 2, sensor_detected_tiles );
			}
		}
	}

	auto* const fog_mesh = const_cast< types::mesh::Render* >(
		static_cast< const types::mesh::Render* >( m_actors.fog->GetMeshActor()->GetMesh() )
	);
	auto* const selected_unit = m_um->GetSelectedUnit();
	const size_t selected_unit_id = selected_unit ? selected_unit->GetId() : 0;
	size_t concealed_visible_count = 0;
	size_t concealed_hidden_count = 0;
	bool fog_mesh_changed = false;
	for ( auto& it : m_tm->GetTiles() ) {
		auto* const tile = &it.second;
		const auto& coords = tile->GetCoords();
		const auto key = GetTileIndex( coords );
		const bool is_visible = visible_tiles.find( key ) != visible_tiles.end();
		if (
			is_visible ||
			m_pending_territory_observations.find( key ) != m_pending_territory_observations.end()
		) {
			ObserveTerritoryTile( tile );
		}
		bool needs_render = false;
		if ( tile->IsCurrentlyVisible() != is_visible ) {
			tile->SetCurrentlyVisible( is_visible );
			needs_render = true;
		}
		const bool has_sensor_detection = sensor_detected_tiles.find( key ) != sensor_detected_tiles.end();
		const bool has_radar_detection = radar_detected_tiles.find( key ) != radar_detected_tiles.end();
		for ( const auto& unit : tile->GetUnits() ) {
			auto* const candidate = unit.second;
			const bool concealment_is_detected = has_sensor_detection || (
				!candidate->IsAbilityConcealed() &&
				candidate->IsFungusConcealed() &&
				has_radar_detection
			);
			const bool unit_is_visible = candidate->IsOwned() || (
				!candidate->IsEmbarked() && is_visible &&
				( !candidate->IsConcealed() || concealment_is_detected )
			);
			needs_render = candidate->SetVisibleToPlayer( unit_is_visible ) || needs_render;
			if ( candidate->IsConcealed() && !candidate->IsOwned() ) {
				if ( unit_is_visible ) {
					concealed_visible_count++;
				}
				else {
					concealed_hidden_count++;
				}
			}
		}
		if ( needs_render ) {
			tile->Render( selected_unit_id );
		}

		const fog_state_t fog_state = is_visible
			? FS_VISIBLE
			: ( m_explored_tiles.find( key ) != m_explored_tiles.end()
				? FS_EXPLORED
				: FS_UNEXPLORED
			);
		const size_t fog_index = coords.y * ( m_map_data.width / 2 ) + coords.x / 2;
		if ( m_fog_states.at( fog_index ) != fog_state ) {
			m_fog_states.at( fog_index ) = fog_state;
			fog_mesh_changed = true;
			const float alpha = fog_state == FS_VISIBLE
				? 0.0f
				: ( fog_state == FS_EXPLORED ? 0.48f : 1.0f );
			for ( size_t i = 0 ; i < 5 ; i++ ) {
				fog_mesh->SetVertexTint(
					static_cast< types::mesh::index_t >( fog_index * 5 + i ),
					{ 1.0f, 1.0f, 1.0f, alpha }
				);
			}
		}
	}
	if ( fog_mesh_changed ) {
		fog_mesh->Update();
	}

	m_currently_visible_tiles = std::move( visible_tiles );
	m_pending_territory_observations.clear();
	RebuildTerritoryBorders();
	m_map_visibility_dirty = false;
	Log(
		"Map visibility: " + std::to_string( m_currently_visible_tiles.size() ) +
		" visible, " + std::to_string( m_explored_tiles.size() ) +
		" explored of " + std::to_string( m_tm->GetTiles().size() ) + " tiles, " +
		std::to_string( owned_sensor_count ) + " owned sensors, " +
		std::to_string( concealed_visible_count ) + " concealed detected, " +
		std::to_string( concealed_hidden_count ) + " concealed hidden"
	);
	RefreshSelectedTile( selected_unit );
	if ( m_exploration_changed ) {
		m_exploration_changed = false;
		UpdateMinimap();
	}
}

void Game::Initialize(
	const types::Vec2< size_t >& map_size,
	types::texture::Texture* terrain_texture,
	types::mesh::Render* terrain_mesh,
	types::mesh::Data* terrain_data_mesh,
	const std::unordered_map< std::string, backend::map::sprite_actor_t >& sprite_actors,
	const std::unordered_map< size_t, std::pair< std::string, types::Vec3 > >& sprite_instances,
	const std::vector< backend::map::tile::Tile >* tiles,
	const std::vector< backend::map::tile::TileState >* tile_states
) {
	ASSERT( !m_is_initialized, "already initialized" );

	m_game = g_engine->GetGame();
	ASSERT( m_game, "game is null" );

	Log( "Initializing game" );

	NEW( m_camera, scene::Camera, scene::Camera::CT_ORTHOGRAPHIC );
	m_camera_angle = INITIAL_CAMERA_ANGLE;
	UpdateCameraAngle();

	m_world_scene->SetCamera( m_camera );

	// don't set exact 45 degree angles for lights, it will produce weird straight lines because of shadows
	{
		NEW( m_light_a, scene::Light, scene::Light::LT_AMBIENT_DIFFUSE );
		m_light_a->SetPosition(
			{
				48.227f,
				20.412f,
				57.65f
			}
		);
		m_light_a->SetColor(
			{
				1.6f,
				1.8f,
				2.0f,
				1.0f
			}
		);
		m_world_scene->AddLight( m_light_a );
	}
	{
		NEW( m_light_b, scene::Light, scene::Light::LT_AMBIENT_DIFFUSE );
		m_light_b->SetPosition(
			{
				22.412f,
				62.227f,
				43.35f
			}
		);
		m_light_b->SetColor(
			{
				2.0f,
				1.8f,
				1.6f,
				1.0f
			}
		);
		m_world_scene->AddLight( m_light_b );
	}

	//g_engine->GetGraphics()->AddScene( m_world_scene );

	ASSERT( !m_textures.terrain, "terrain texture already set" );
	m_textures.terrain = terrain_texture;

	ASSERT( !m_actors.terrain, "terrain actor already set" );
	NEWV( terrain_actor, scene::actor::Mesh, "MapTerrain", terrain_mesh );
	terrain_actor->SetTexture( m_textures.terrain );
	terrain_actor->SetPosition( backend::map::s_consts.map_position );
	terrain_actor->SetAngle( backend::map::s_consts.map_rotation );
	terrain_actor->SetDataMesh( terrain_data_mesh );
	NEW( m_actors.terrain, scene::actor::Instanced, terrain_actor );
	m_actors.terrain->AddInstance( {} ); // default instance
	m_world_scene->AddActor( m_actors.terrain );

	Log( "Sprites count: " + std::to_string( sprite_actors.size() ) );
	Log( "Sprites instances: " + std::to_string( sprite_instances.size() ) );
	for ( auto& a : sprite_actors ) {
		GetTerrainInstancedSprite( a.second );
	}
	for ( auto& instance : sprite_instances ) {
		auto* actor = m_ism->GetInstancedSpriteByKey( instance.second.first )->actor;
		ASSERT( actor, "sprite actor not found" );
		ASSERT( !actor->HasInstance( instance.first ), "actor instance already exists" );
		actor->SetInstance( instance.first, instance.second.second );
	}

	// process tiles
	UpdateMapData( map_size );

	ASSERT( tiles, "tiles not set" );
	ASSERT( tiles->size() == m_map_data.width * m_map_data.height / 2, "tiles count mismatch" );
	ASSERT( tile_states, "tile states not set" );
	ASSERT( tile_states->size() == m_map_data.width * m_map_data.height / 2, "tile states count mismatch" );

	for ( size_t y = 0 ; y < m_map_data.height ; y++ ) {
		for ( size_t x = y & 1 ; x < m_map_data.width ; x += 2 ) {
			auto* tile = m_tm->GetTile( x, y );
			//Log( "Initializing tile: " + tile->GetCoords().ToString() );
			const size_t tile_index = y * ( m_map_data.width / 2 ) + x / 2;
			tile->Update( tile_render_snapshot_t( tiles->at( tile_index ), tile_states->at( tile_index ) ) );
		}
	}
	InitializeFog();

	m_viewport.bottom_bar_overlap = 32; // it has transparent area on top so let map render through it

	auto* game = g_engine->GetGame();
	const auto f_is_outside_viewport = [ this ]( const input::Event& event ) -> bool {
		if ( !( event.flags & input::EF_MOUSE ) ) {
			return false;
		}
		const auto x = event.data.mouse.x;
		const auto y = event.data.mouse.y;
		return
			x < 0 || y < 0 ||
			(size_t)x >= m_viewport.width ||
			(size_t)y >= m_viewport.height;
	};

	m_global_handlers.before = m_ui->AddGlobalHandler(
		ui::UI::GH_BEFORE, EH( this, game, f_is_outside_viewport ) {

			switch ( event.type ) {
				case input::EV_MOUSE_DOWN: {
					m_map_control.mouse_buttons_pressed++;
					break;
				}
				case input::EV_MOUSE_UP: {
					if ( m_map_control.mouse_buttons_pressed ) {
						m_map_control.mouse_buttons_pressed--;
					}
					switch ( event.data.mouse.button ) {
						case input::MB_MIDDLE: {
							if ( m_map_control.is_dragging ) {
								m_map_control.is_dragging = false;
								return true;
							}
						}
						default: {
						}
					}
					break;
				}
				default: {
				}
			}

			// ignore out-of-viewport events
			if ( f_is_outside_viewport( event ) ) {
				return false;
			}

			switch ( event.type ) {
				case input::EV_KEY_DOWN: {
					if ( event.data.key.key == 'z' ) {
						m_map_control.key_zooming = 1;
						return true;
					}
					if ( event.data.key.key == 'x' ) {
						m_map_control.key_zooming = -1;
						return true;
					}
					break;
				}
				case input::EV_KEY_UP: {
					if ( event.data.key.key == 'z' || event.data.key.key == 'x' ) {
						if ( m_map_control.key_zooming ) {
							m_map_control.key_zooming = 0;
							m_scroller.Stop();
						}
					}
					break;
				}
				case input::EV_MOUSE_MOVE: {
					const auto& c = event.data.mouse;

					m_map_control.last_mouse_position = {
						GetFixedX( (float)c.x ),
						(float)c.y
					};

					if ( m_map_control.is_dragging ) {
						types::Vec2< float > current_drag_position = {
							m_clamp.x.Clamp( (float)c.x ),
							m_clamp.y.Clamp( (float)c.y )
						};
						types::Vec2< float > drag = current_drag_position - m_map_control.last_drag_position;

						m_camera_position.x += (float)drag.x;
						m_camera_position.y += (float)drag.y;
						UpdateCameraPosition();

						m_map_control.last_drag_position = current_drag_position;
					}
					else {
						if ( !m_map_control.mouse_buttons_pressed && g_engine->GetGraphics()->IsFullscreen() ) { // edge scrolling only usable when not dragging and in fullscreen
							const ssize_t edge_distance = m_viewport.is_fullscreen
								? Game::s_consts.map_scroll.static_scrolling.edge_distance_px.fullscreen
								: Game::s_consts.map_scroll.static_scrolling.edge_distance_px.windowed;
							const auto window_width = (ssize_t)m_viewport.window_width;
							const auto window_height = (ssize_t)m_viewport.window_height;
							const auto horizontal_edge_distance = std::min( edge_distance, window_width / 2 );
							const auto vertical_edge_distance = std::min( edge_distance, window_height / 2 );
							if ( c.x < horizontal_edge_distance ) {
								m_map_control.edge_scrolling.speed.x = Game::s_consts.map_scroll.static_scrolling.speed.x;
							}
							else if ( c.x >= window_width - horizontal_edge_distance ) {
								m_map_control.edge_scrolling.speed.x = -Game::s_consts.map_scroll.static_scrolling.speed.x;
							}
							else {
								m_map_control.edge_scrolling.speed.x = 0;
							}
							if ( c.y < vertical_edge_distance ) {
								m_map_control.edge_scrolling.speed.y = Game::s_consts.map_scroll.static_scrolling.speed.y;
							}
							else if ( c.y >= window_height - vertical_edge_distance ) {
								m_map_control.edge_scrolling.speed.y = -Game::s_consts.map_scroll.static_scrolling.speed.y;
							}
							else {
								m_map_control.edge_scrolling.speed.y = 0;
							}
						}
						else {
							m_map_control.edge_scrolling.speed = {
								0.0f,
								0.0f
							};
						}
						if ( m_map_control.edge_scrolling.speed ) {
							if ( !m_map_control.edge_scrolling.timer.IsRunning() ) {
								//Log( "Edge scrolling started" );
								m_map_control.edge_scrolling.timer.SetInterval( Game::s_consts.map_scroll.static_scrolling.scroll_step_ms );
							}
						}
						else {
							if ( m_map_control.edge_scrolling.timer.IsRunning() ) {
								//Log( "Edge scrolling stopped" );
								m_map_control.edge_scrolling.timer.Stop();
							}
						}
					}
					if ( m_map_control.is_dragging ) {
						return true;
					}
					break;
				}
				default: {
				}
			}

			return false;
		}
	);

	m_global_handlers.after = m_ui->AddGlobalHandler(
		ui::UI::GH_AFTER, EH( this, game, f_is_outside_viewport ) {

			// ignore out-of-viewport events
			if ( f_is_outside_viewport( event ) ) {
				return false;
			}

			switch ( event.type ) {
				case input::EV_KEY_DOWN: {
					if ( !event.data.key.modifiers ) {
						auto* selected_tile = m_tm->GetSelectedTile();
						if ( selected_tile ) {

							bool is_tile_selected = false;
							backend::map::tile::direction_t td = backend::map::tile::D_NONE;

							switch ( event.data.key.code ) {
#define X( _key, _altkey, _direction ) \
                        case ::input::_key: \
                        case ::input::_altkey: { \
                            td = backend::map::tile::_direction; \
                            is_tile_selected = true; \
                            m_tile_at_query_purpose = backend::TQP_TILE_SELECT; \
                            break; \
                        }
								X( K_LEFT, K_KP_LEFT, D_W )
								X( K_UP, K_KP_UP, D_N )
								X( K_RIGHT, K_KP_RIGHT, D_E )
								X( K_DOWN, K_KP_DOWN, D_S )
								X( K_HOME, K_KP_LEFT_UP, D_NW )
								X( K_END, K_KP_LEFT_DOWN, D_SW )
								X( K_PAGEUP, K_KP_RIGHT_UP, D_NE )
								X( K_PAGEDOWN, K_KP_RIGHT_DOWN, D_SE )
#undef X
								case input::K_TAB: {
									m_um->SelectNextUnitMaybe();
									break;
								}
								case input::K_SPACE: {
									auto* unit = m_um->GetSelectedUnit();
									if ( unit ) {
										m_glsmac->WithGSE(
											[ &game, &unit ]( GSE_CALLABLE ) {
												auto* u = game->GetUM()->GetUnit( unit->GetId() );
												game->Event(
													GSE_CALL, "unit_skip_turn", {
														{ "unit", u->Wrap( GSE_CALL ) },
													}
												);
											}
										);
									}
									break;
								}
								case input::K_B: {
									auto* selected_unit = m_um->GetSelectedUnit();
									if ( selected_unit ) {
										m_glsmac->WithGSE(
											[ &game, &selected_unit ]( GSE_CALLABLE ) {
												auto* unit = game->GetUM()->GetUnit( selected_unit->GetId() );
												if ( !unit || !unit->m_def->m_can_found_base ) {
													return;
												}
												game->Event(
													GSE_CALL, "found_base", {
														{ "unit", unit->Wrap( GSE_CALL ) },
													}
												);
											}
										);
									}
									break;
								}
								case input::K_ENTER: {
									if ( m_turn_status == backend::turn::TS_TURN_COMPLETE ) {
										CompleteTurn();
										break;
									}
									break;
								}
								default: {
									// nothing
								}
							}

							if ( is_tile_selected ) {
								auto* tile = selected_tile->GetNeighbour( td );
								auto* selected_unit = m_um->GetSelectedUnit();

								if ( !selected_unit ) {
									SelectTileOrUnit( tile );
									ScrollToTile( tile, false );
									return true;
								}
								else {
									// try moving unit to tile
									const auto& dst_tile = selected_unit->GetTile()->GetNeighbour( td );
									std::unordered_map< size_t, unit::Unit* > foreign_units = {};
									for ( const auto& it : dst_tile->GetUnits() ) {
										const auto& unit = it.second;
										if ( CanTargetUnit( selected_unit, unit ) ) { // TODO: pacts
											// TODO: skip units of treaty/truce faction?
											foreign_units.insert( it );
										}
									}
									const bool is_planet_buster = selected_unit->IsPlanetBuster();
									m_glsmac->WithGSE(
										[ &game, &selected_unit, &tile, &foreign_units, is_planet_buster ]( GSE_CALLABLE ) {
											const auto* um = game->GetUM();
											if ( foreign_units.empty() ) {
												// move
												auto* unit = um->GetUnit( selected_unit->GetId() );
												const auto& c = tile->GetCoords();
												auto* dst_tile = game->GetMap()->GetTile( c.x, c.y );
												if ( !unit ) {
													return;
												}
												game->Event(
													GSE_CALL, "move_unit", {
														{ "unit", unit->Wrap( GSE_CALL ) },
														{ "tile", dst_tile->Wrap( GSE_CALL ) },
													}
												);
											}
											else {
												// attack
												auto* attacker = um->GetUnit( selected_unit->GetId() );
												if ( !attacker ) {
													return;
												}
												auto* defender = um->GetUnit( foreign_units.at( tile::Tile::GetUnitsOrder( foreign_units, true, true ).front() )->GetId() );
												if ( !defender ) {
													return;
												}
												if ( is_planet_buster ) {
													const auto& c = tile->GetCoords();
													auto* target = game->GetMap()->GetTile( c.x, c.y );
													game->Event(
														GSE_CALL, "planet_buster", {
															{ "unit", attacker->Wrap( GSE_CALL ) },
															{ "tile", target->Wrap( GSE_CALL ) },
														}
													);
												}
												else {
													game->Event(
														GSE_CALL, "attack_unit", {
															{ "attacker", attacker->Wrap( GSE_CALL ) },
															{ "defender", defender->Wrap( GSE_CALL ) },
														}
													);
												}
											}
										}
									);

									return true;
								}
							}
						}
					}
					break;
				}
				case input::EV_MOUSE_DOWN: {

					const auto& c = event.data.mouse;

					switch ( event.data.mouse.button ) {
						case input::MB_LEFT: {
							m_map_control.left_down_time_ms = util::Time::Now();
							m_map_control.left_down_position = { c.x, c.y };
							const auto* selected_unit = m_um->GetSelectedUnit();
							m_map_control.left_down_unit_id = selected_unit && selected_unit->IsActive()
								? selected_unit->GetId()
								: 0;
							break;
						}
						case input::MB_MIDDLE: {
							m_scroller.Stop();
							m_map_control.is_dragging = true;
							m_map_control.last_drag_position = {
								m_clamp.x.Clamp( (float)c.x ),
								m_clamp.y.Clamp( (float)c.y )
							};
							break;
						}
						case input::MB_RIGHT: {
							auto* selected_unit = m_um->GetSelectedUnit();
							if ( selected_unit && selected_unit->IsActive() ) {
								m_attack_target_unit_id = selected_unit->GetId();
								SelectTileAtPoint(
									backend::TQP_ATTACK_TARGET,
									c.x,
									c.y
								);
							}
							break;
						}
						default: {
						}
					}
					break;
				}
				case input::EV_MOUSE_UP: {
					const auto& c = event.data.mouse;
					if (
						event.data.mouse.button == input::MB_LEFT &&
						m_map_control.left_down_time_ms > 0
					) {
						static constexpr uint64_t GOTO_HOLD_MS = 350;
						static constexpr ssize_t GOTO_DRAG_THRESHOLD = 8;
						const auto elapsed = util::Time::Now() - m_map_control.left_down_time_ms;
						const auto delta_x = std::abs( c.x - m_map_control.left_down_position.x );
						const auto delta_y = std::abs( c.y - m_map_control.left_down_position.y );
						// SMAC's map gesture is press-and-drag; retain long-press for stationary destinations.
						const bool was_held = elapsed >= GOTO_HOLD_MS;
						const bool was_dragged =
							delta_x > GOTO_DRAG_THRESHOLD || delta_y > GOTO_DRAG_THRESHOLD;
						const bool is_goto =
							m_map_control.left_down_unit_id > 0 &&
							( was_held || was_dragged );
						if ( is_goto ) {
							m_move_target_unit_id = m_map_control.left_down_unit_id;
							SelectTileAtPoint( backend::TQP_MOVE_TARGET, c.x, c.y );
						}
						else {
							SelectTileAtPoint( backend::TQP_OBJECT_SELECT, c.x, c.y );
						}
						m_map_control.left_down_time_ms = 0;
						m_map_control.left_down_unit_id = 0;
					}
					break;
				}
				case input::EV_MOUSE_SCROLL: {
					SmoothScroll( m_map_control.last_mouse_position, (float)event.data.mouse.scroll_y );
					break;
				}
				default: {
				}
			};
			return false;
		}
	);

	m_clamp.x.SetDstRange(
		{
			-0.5f,
			0.5f
		}
	);
	m_clamp.y.SetDstRange(
		{
			-0.5f,
			0.5f
		}
	);

	// map should continue scrolling even if mouse is outside viewport
	m_clamp.x.SetOverflowAllowed( true );
	m_clamp.y.SetOverflowAllowed( true );

	UpdateViewport();

	// assume mouse starts at center
	m_map_control.last_mouse_position = {
		(float)m_viewport.window_width / 2,
		(float)m_viewport.window_height / 2
	};

	SetCameraPosition(
		{
			0.0f,
			-0.25f,
			0.1f
		}
	);

	UpdateCameraRange();
	UpdateCameraScale();

	g_engine->GetGraphics()->AddOnWindowResizeHandler(
		this, RH( this ) {
			UpdateViewport();
			UpdateCameraRange();
			UpdateMapInstances();
			UpdateMinimap();
		}
	);
	m_is_resize_handler_set = true;

	ResetMapState();

	m_is_initialized = true;

	Trigger( m_game, "start_ui", {} );
}

void Game::Deinitialize() {
	ASSERT( m_is_initialized, "not initialized" );

	m_is_initialized = false;

	DeselectTileOrUnit();

	if ( m_is_resize_handler_set ) {
		g_engine->GetGraphics()->RemoveOnWindowResizeHandler( this );
		m_is_resize_handler_set = false;
	}

#define X( _x ) \
    if ( m_global_handlers._x ) { \
        m_ui->RemoveGlobalHandler( m_global_handlers._x ); \
        m_global_handlers._x = 0; \
    }
	X( before );
	X( after );
#undef X

	if ( m_tile_at_request_id ) {
		ASSERT( m_actors.terrain, "tileat request pending but terrain actor not set" );
		CancelTileAtRequest();
	}

	if ( m_minimap_texture_request_id ) {
		ASSERT( m_actors.terrain, "minimap texture request pending but terrain actor not set" );
		m_actors.terrain->GetMeshActor()->CancelCaptureToTextureRequest( m_minimap_texture_request_id );
		m_minimap_texture_request_id = 0;
	}
	if ( m_minimap_fog_texture_request_id ) {
		ASSERT( m_actors.fog, "minimap fog request pending but fog actor not set" );
		m_actors.fog->GetMeshActor()->CancelCaptureToTextureRequest( m_minimap_fog_texture_request_id );
		m_minimap_fog_texture_request_id = 0;
	}
	if ( m_pending_minimap_terrain ) {
		DELETE( m_pending_minimap_terrain );
		m_pending_minimap_terrain = nullptr;
	}
	if ( m_pending_minimap_fog ) {
		DELETE( m_pending_minimap_fog );
		m_pending_minimap_fog = nullptr;
	}

	if ( m_actors.territory ) {
		m_world_scene->RemoveActor( m_actors.territory );
		DELETE( m_actors.territory );
		m_actors.territory = nullptr;
	}

	if ( m_actors.fog ) {
		m_world_scene->RemoveActor( m_actors.fog );
		DELETE( m_actors.fog );
		m_actors.fog = nullptr;
	}

	if ( m_actors.terrain ) {
		m_world_scene->RemoveActor( m_actors.terrain );
		DELETE( m_actors.terrain );
		m_actors.terrain = nullptr;
	}

	if ( m_textures.terrain ) {
		DELETE( m_textures.terrain );
		m_textures.terrain = nullptr;
	}
	if ( m_textures.fog ) {
		DELETE( m_textures.fog );
		m_textures.fog = nullptr;
	}
	if ( m_textures.territory ) {
		DELETE( m_textures.territory );
		m_textures.territory = nullptr;
	}
	m_explored_tiles.clear();
	m_currently_visible_tiles.clear();
	m_fog_states.clear();
	m_territory_knowledge.clear();
	m_pending_territory_observations.clear();
	m_territory_visible_slots = 0;
	m_territory_borders_dirty = true;
	m_map_visibility_dirty = true;
	m_exploration_changed = true;

	for ( const auto& it : m_animations ) {
		delete it.second;
	}
	m_animations.clear();

	for ( const auto& it : m_animationdefs ) {
		delete it.second;
	}
	m_animationdefs.clear();

	for ( const auto& it : m_slots ) {
		delete it.second;
	}
	m_slots.clear();

	for ( auto& it : m_actors_map ) {
		m_world_scene->RemoveActor( it.second );
		DELETE( it.second );
	}
	m_actors_map.clear();

#define x( _obj ) \
    if ( _obj ) { \
        DELETE( _obj ); \
        _obj = nullptr; \
    }
	x( m_camera );
	x( m_light_a );
	x( m_light_b );
#undef x

	m_textures.terrain = nullptr;

	m_game = nullptr;
}

void Game::CompleteTurn() {
	m_is_turn_active = false;
	m_glsmac->WithGSE(
		[]( GSE_CALLABLE ) {
			g_engine->GetGame()->Event( GSE_CALL, "complete_turn", {} );
		}
	);
}

void Game::UncompleteTurn() {
	m_is_turn_active = true;
	m_glsmac->WithGSE(
		[]( GSE_CALLABLE ) {
			g_engine->GetGame()->Event( GSE_CALL, "uncomplete_turn", {} );
		}
	);
}

void Game::SelectTileAtPoint( const backend::tile_query_purpose_t tile_query_purpose, const size_t x, const size_t y ) {
	//Log( "Looking up tile at " + std::to_string( x ) + "x" + std::to_string( y ) );
	GetTileAtScreenCoords( tile_query_purpose, x, m_viewport.window_height - y ); // async
}

void Game::SelectTileOrUnit( tile::Tile* tile, const size_t selected_unit_id ) {
	if ( g_engine->IsShuttingDown() ) {
		return;
	}

	ASSERT( m_tile_at_query_purpose != backend::TQP_NONE, "tile query purpose not set" );
	if ( m_tile_at_query_purpose == backend::TQP_MOVE_TARGET ) {
		const auto unit_id = m_move_target_unit_id;
		const auto target_coords = tile->GetCoords();
		m_move_target_unit_id = 0;
		m_tile_at_query_purpose = backend::TQP_NONE;
		auto* game = m_game;
		m_glsmac->WithGSE(
			[ game, unit_id, target_coords ]( GSE_CALLABLE ) {
				auto* unit = game->GetUM()->GetUnit( unit_id );
				if ( !unit ) {
					return;
				}
				auto* destination = game->GetMap()->GetTile( target_coords.x, target_coords.y );
				game->Event(
					GSE_CALL, "move_unit_to", {
						{ "unit", unit->Wrap( GSE_CALL ) },
						{ "tile", destination->Wrap( GSE_CALL ) },
					}
				);
			}
		);
		return;
	}
	if ( m_tile_at_query_purpose == backend::TQP_ATTACK_TARGET ) {
		const auto attacker_id = m_attack_target_unit_id;
		m_attack_target_unit_id = 0;
		m_tile_at_query_purpose = backend::TQP_NONE;
		auto* selected_unit = m_um->GetUnitById( attacker_id );
		if ( !selected_unit || !selected_unit->IsActive() ) {
			return;
		}
		const bool is_planet_buster = selected_unit->IsPlanetBuster();
		std::unordered_map< size_t, unit::Unit* > foreign_units = {};
		for ( const auto& it : tile->GetUnits() ) {
			if ( CanTargetUnit( selected_unit, it.second ) ) {
				foreign_units.insert( it );
			}
		}
		if ( foreign_units.empty() && !is_planet_buster ) {
			return;
		}
		const auto defender_id = foreign_units.empty()
			? 0
			: foreign_units.at( tile::Tile::GetUnitsOrder( foreign_units, true, true ).front() )->GetId();
		const auto target_coords = tile->GetCoords();
		auto* game = m_game;
		m_glsmac->WithGSE(
			[ game, attacker_id, defender_id, target_coords, is_planet_buster ]( GSE_CALLABLE ) {
				auto* attacker = game->GetUM()->GetUnit( attacker_id );
				if ( !attacker ) {
					return;
				}
				if ( is_planet_buster ) {
					auto* target = game->GetMap()->GetTile( target_coords.x, target_coords.y );
					game->Event(
						GSE_CALL, "planet_buster", {
							{ "unit", attacker->Wrap( GSE_CALL ) },
							{ "tile", target->Wrap( GSE_CALL ) },
						}
					);
					return;
				}
				auto* defender = game->GetUM()->GetUnit( defender_id );
				if ( !defender ) {
					return;
				}
				game->Event(
					GSE_CALL, "attack_unit", {
						{ "attacker", attacker->Wrap( GSE_CALL ) },
						{ "defender", defender->Wrap( GSE_CALL ) },
					}
				);
			}
		);
		return;
	}

	DeselectTileOrUnit();

	m_tm->SelectTile( tile );

	TileObject* selected_object = nullptr;

	if ( m_tile_at_query_purpose == backend::TQP_UNIT_SELECT ||
		m_tile_at_query_purpose == backend::TQP_OBJECT_SELECT
		) {
		const auto& units = tile->GetUnits();
		if ( m_is_turn_active ) {
			if ( selected_unit_id ) {
				for ( const auto& it : units ) {
					if ( it.first == selected_unit_id ) {
						selected_object = it.second;
						break;
					}
				}
			}
			if ( !selected_object ) {
				switch ( m_tile_at_query_purpose ) {
					case backend::TQP_UNIT_SELECT: {
						selected_object = tile->GetMostImportantUnit();
						break;
					}
					case backend::TQP_OBJECT_SELECT: {
						selected_object = tile->GetMostImportantObject();
						break;
					}
					default:
						ASSERT( false, "unexpected purpose: " + std::to_string( m_tile_at_query_purpose ) );
				}
			}
		}
		if ( !selected_object ) {
			m_tile_at_query_purpose = backend::TQP_TILE_SELECT;
		}
		else if ( selected_object->GetType() == TileObject::TOT_BASE ) {
			m_bm->SelectBase( (base::Base*)selected_object );
			m_tile_at_query_purpose = backend::TQP_NONE;
		}
		else if ( selected_object->GetType() == TileObject::TOT_UNIT ) {
			if ( ( (unit::Unit*)selected_object )->IsActive() ) {
				m_tile_at_query_purpose = backend::TQP_UNIT_SELECT;
			}
			else {
				m_tile_at_query_purpose = backend::TQP_TILE_SELECT;
			}
		}
	}

	switch ( m_tile_at_query_purpose ) {
		case backend::TQP_TILE_SELECT: {
			m_um->DeselectUnit();
			Log( "Selected tile at " + tile->GetCoords().ToString() + " ( " + tile->GetRenderData().selection_coords.center.ToString() + " )" );
			const auto& c = tile->GetCoords();
			auto* const t = m_game->GetMap()->GetTile( c.x, c.y );
			Trigger(
				m_game, "tile_select", ARGS_F( &t ) {
					{
						"tile",
						t->Wrap( GSE_CALL )
					},
				}; }
			);
			ShowTileSelector();
			const auto* const selected_unit = selected_unit_id
				? this->m_um->GetUnitById( selected_unit_id )
				: nullptr;
			UpdatePreviews( tile, selected_unit );
			break;
		}
		case backend::TQP_UNIT_SELECT: {
			ASSERT( selected_object && selected_object->GetType() == TileObject::TOT_UNIT, "object not selected or is not a unit" );
			m_um->SelectUnit( (unit::Unit*)selected_object, true );
			break;
		}
		case backend::TQP_NONE: {
			// do nothing
			break;
		}
		default:
			THROW( "unknown selection mode: " + std::to_string( m_tile_at_query_purpose ) );
	}

}

void Game::DeselectTileOrUnit() {
	HideTileSelector();
	m_um->DeselectUnit();
	m_tm->DeselectTile();
}

void Game::ShowLoader( const std::string& text, const std::function< void() > on_cancel ) {
	m_glsmac->ShowLoader( text ); // TODO: on_cancel
}

void Game::HideLoader() {
	m_glsmac->HideLoader();
}

void Game::AddActor( actor::Actor* actor ) {
	ASSERT( m_actors_map.find( actor ) == m_actors_map.end(), "world actor already added" );
	NEWV( instanced, scene::actor::Instanced, actor );
	instanced->AddInstance( {} ); // default instance
	m_world_scene->AddActor( instanced );
	m_actors_map[ actor ] = instanced;
}

void Game::RemoveActor( actor::Actor* actor ) {
	auto it = m_actors_map.find( actor );
	ASSERT( it != m_actors_map.end(), "world actor not found" );
	m_world_scene->RemoveActor( it->second );
	DELETE( it->second );
	m_actors_map.erase( it );
}

const types::Vec2< float > Game::GetTileWindowCoordinates( const tile::Tile* tile ) const {
	const auto& c = tile->GetRenderData().coords;
	return {
		c.x * m_viewport.window_aspect_ratio * m_camera_position.z,
		( c.y - ( c.z - 2.0f ) ) * m_viewport.ratio.y * m_camera_position.z / 1.414f
	};
}

void Game::ScrollTo( const types::Vec3& target ) {
	if ( m_scroller.IsRunning() && true /* TODO: m_selected_tile_data.scroll_adaptively */ ) {
		const auto& target = m_scroller.GetTargetPosition();
		if ( target.z == m_camera_position.z ) {
			m_camera_position = m_scroller.GetTargetPosition();
			UpdateCameraPosition();
		}
	}
	m_scroller.Scroll( m_camera_position, target, SCROLL_DURATION_MS );
}

void Game::ScrollToTile( const tile::Tile* tile, bool center_on_tile ) {

	auto tc = GetTileWindowCoordinates( tile );

	if ( center_on_tile ) {
		const float tile_x_shifted = m_camera_position.x > 0
			? tc.x - ( m_camera_range.max.x - m_camera_range.min.x )
			: tc.x + ( m_camera_range.max.x - m_camera_range.min.x );
		if (
			fabs( tile_x_shifted - -m_camera_position.x )
				<
					fabs( tc.x - -m_camera_position.x )
			) {
			// smaller distance if going other side
			tc.x = tile_x_shifted;
		}

		ScrollTo(
			{
				-tc.x,
				-tc.y,
				m_camera_position.z
			}
		);
	}
	else {
		types::Vec2< float > uc = {
			GetFixedX( tc.x + m_camera_position.x ),
			tc.y + m_camera_position.y
		};

		types::Vec2< float > scroll_by = {
			0,
			0
		};

		//Log( "Resolved tile coordinates to " + uc.ToString() + " ( camera: " + m_camera_position.ToString() + " )" );

		// tile size
		types::Vec2< float > ts = {
			backend::map::s_consts.tile.scale.x * m_camera_position.z,
			backend::map::s_consts.tile.scale.y * m_camera_position.z
		};
		// edge size
		types::Vec2< float > es = {
			0.5f - ts.x,
			0.5f - ts.y
		};

		if ( uc.x < -es.x ) {
			scroll_by.x = ts.x - 0.5f - uc.x;
		}
		else if ( uc.x > es.x ) {
			scroll_by.x = 0.5f - ts.x - uc.x;
		}
		if ( uc.y < -es.y ) {
			scroll_by.y = ts.y - 0.5f - uc.y;
		}
		else if ( uc.y > es.y ) {
			scroll_by.y = 0.5f - ts.y - uc.y;
		}

		if ( scroll_by ) {
			//Log( "Scroll by " + scroll_by.ToString() );
			FixCameraX();
			ScrollTo(
				{
					m_camera_position.x + scroll_by.x,
					m_camera_position.y + scroll_by.y,
					m_camera_position.z
				}
			);
		}
	}
}

void Game::CancelTileAtRequest() {
	ASSERT( m_tile_at_request_id, "tileat request not found" );
	m_actors.terrain->GetMeshActor()->CancelDataRequest( m_tile_at_request_id );
	m_tile_at_request_id = 0;
}

void Game::GetTileAtScreenCoords( const backend::tile_query_purpose_t tile_query_purpose, const size_t screen_x, const size_t screen_inverse_y ) {
	if ( m_tile_at_request_id ) {
		m_actors.terrain->GetMeshActor()->CancelDataRequest( m_tile_at_request_id );
	}
	ASSERT( tile_query_purpose != backend::TQP_NONE, "tile query purpose is not set" );
	m_tile_at_query_purpose = tile_query_purpose;
	m_tile_at_request_id = m_actors.terrain->GetMeshActor()->GetDataAt( screen_x, screen_inverse_y );
}

const bool Game::IsTileAtRequestPending() const {
	return m_tile_at_request_id;
}

const Game::tile_at_result_t Game::GetTileAtScreenCoordsResult() {
	if ( m_tile_at_request_id ) {
		auto result = m_actors.terrain->GetMeshActor()->GetDataResponse( m_tile_at_request_id );
		if ( result.first ) {
			m_tile_at_request_id = 0;

			if ( result.second ) {
				auto data = *result.second;
				if ( data ) { // some tile was clicked

					data--; // we used +1 increment to differentiate 'tile at 0,0' from 'no tiles'

					return {
						true,
						{
							data % m_map_data.width,
							data / m_map_data.width
						}
					};
				}
			}
		}
	}
	// no data
	return {};
}

void Game::GetMinimapTexture(
	scene::Camera* terrain_camera,
	scene::Camera* fog_camera,
	const types::Vec2< size_t > texture_dimensions
) {
	if ( m_minimap_texture_request_id ) {
		Log( "Canceling minimap texture request" );
		m_actors.terrain->GetMeshActor()->CancelCaptureToTextureRequest( m_minimap_texture_request_id );
		m_minimap_texture_request_id = 0;
	}
	if ( m_minimap_fog_texture_request_id ) {
		Log( "Canceling minimap fog texture request" );
		m_actors.fog->GetMeshActor()->CancelCaptureToTextureRequest( m_minimap_fog_texture_request_id );
		m_minimap_fog_texture_request_id = 0;
	}
	if ( m_pending_minimap_terrain ) {
		DELETE( m_pending_minimap_terrain );
		m_pending_minimap_terrain = nullptr;
	}
	if ( m_pending_minimap_fog ) {
		DELETE( m_pending_minimap_fog );
		m_pending_minimap_fog = nullptr;
	}
	m_minimap_texture_request_id = m_actors.terrain->GetMeshActor()->CaptureToTexture(
		terrain_camera,
		texture_dimensions
	);
	m_minimap_fog_texture_request_id = m_actors.fog->GetMeshActor()->CaptureToTexture(
		fog_camera,
		texture_dimensions
	);
}

types::texture::Texture* Game::GetMinimapTextureResult() {
	if ( m_minimap_texture_request_id && !m_pending_minimap_terrain ) {
		auto result = m_actors.terrain->GetMeshActor()->GetCaptureToTextureResponse( m_minimap_texture_request_id );
		if ( result ) {
			Log( "Received minimap terrain texture" );
			m_minimap_texture_request_id = 0;
			m_pending_minimap_terrain = result;
		}
	}
	if ( m_minimap_fog_texture_request_id && !m_pending_minimap_fog ) {
		auto result = m_actors.fog->GetMeshActor()->GetCaptureToTextureResponse( m_minimap_fog_texture_request_id );
		if ( result ) {
			uint8_t minimum_alpha = 255;
			uint8_t maximum_alpha = 0;
			size_t covered_pixels = 0;
			for ( size_t y = 0 ; y < result->GetHeight() ; y++ ) {
				for ( size_t x = 0 ; x < result->GetWidth() ; x++ ) {
					const auto alpha = static_cast< uint8_t >( result->GetPixel( x, y ) >> 24 );
					minimum_alpha = std::min( minimum_alpha, alpha );
					maximum_alpha = std::max( maximum_alpha, alpha );
					if ( alpha ) {
						covered_pixels++;
					}
				}
			}
			Log(
				"Received minimap fog texture; alpha " + std::to_string( minimum_alpha ) +
				"-" + std::to_string( maximum_alpha ) + ", " +
				std::to_string( covered_pixels ) + " covered pixels"
			);
			m_minimap_fog_texture_request_id = 0;
			m_pending_minimap_fog = result;
		}
	}
	if ( m_pending_minimap_terrain && m_pending_minimap_fog ) {
		const auto width = m_pending_minimap_terrain->GetWidth();
		const auto height = m_pending_minimap_terrain->GetHeight();
		ASSERT(
			m_pending_minimap_fog->GetWidth() == width &&
			m_pending_minimap_fog->GetHeight() == height,
			"minimap terrain and fog dimensions differ"
		);
		m_pending_minimap_terrain->AddFrom(
			m_pending_minimap_fog,
			types::texture::AM_MERGE,
			0,
			0,
			width - 1,
			height - 1
		);
		DELETE( m_pending_minimap_fog );
		m_pending_minimap_fog = nullptr;
		auto* const result = m_pending_minimap_terrain;
		m_pending_minimap_terrain = nullptr;
		return result;
	}
	return nullptr;
}

void Game::UpdateMinimap() {

	const auto minimap_size = m_widgets.Minimap->FindLargestArea();
	if ( !minimap_size.x || !minimap_size.y ) {
		return;
	}
	Log( "Requesting minimap ( " + std::to_string( minimap_size.x ) + "x" + std::to_string( minimap_size.y ) + " )" );

	const auto f_create_camera = [ this, &minimap_size ]() -> scene::Camera* {
		auto* const camera = new scene::Camera( scene::Camera::CT_ORTHOGRAPHIC );
		camera->SetAngle( m_camera->GetAngle() );
		camera->SetScale(
			{
				minimap_size.x / (float)m_viewport.window_width / m_viewport.window_aspect_ratio / (float)m_map_data.width * 2.0f,
				minimap_size.y / (float)m_viewport.window_height / (float)( m_map_data.height + 1 ) * 2.82f,
				0.01f,
			}
		);
		camera->SetPosition(
			{
				0.0f,
				1.014f - ( minimap_size.y / 2.0f / (float)m_viewport.window_height ),
				0.5f
			}
		);
		return camera;
	};

	GetMinimapTexture(
		f_create_camera(),
		f_create_camera(),
		{
			(size_t)std::floor( minimap_size.x ),
			(size_t)std::floor( minimap_size.y ),
		}
	);
}

void Game::ResetMapState() {
	UpdateCameraPosition();
	UpdateMapInstances();
	UpdateUICamera();
	UpdateMinimap();

	// select tile at center
	types::Vec2< size_t > coords = {
		m_map_data.width / 2,
		m_map_data.height / 2
	};
	if ( ( coords.y % 2 ) != ( coords.x % 2 ) ) {
		coords.y++;
	}

	m_tile_at_query_purpose = backend::TQP_TILE_SELECT;
	SelectTileOrUnit( m_tm->GetTile( coords ) );
}

void Game::SmoothScroll( const float scroll_value ) {
	SmoothScroll(
		{
			(float)m_viewport.width / 2,
			(float)m_viewport.height / 2
		}, scroll_value
	);
}

void Game::SmoothScroll( const types::Vec2< float > position, const float scroll_value ) {

	float speed = Game::s_consts.map_scroll.smooth_scrolling.zoom_speed * m_camera_position.z;

	float new_z = m_camera_position.z + scroll_value * speed;

	if ( new_z < m_camera_range.min.z ) {
		new_z = m_camera_range.min.z;
	}
	if ( new_z > m_camera_range.max.z ) {
		new_z = m_camera_range.max.z;
	}

	float diff = m_camera_position.z / new_z;

	types::Vec2< float > m = {
		m_clamp.x.Clamp( position.x ),
		m_clamp.y.Clamp( position.y )
	};

	ScrollTo(
		{
			( m_camera_position.x - m.x ) / diff + m.x,
			( m_camera_position.y - m.y ) / diff + m.y,
			new_z
		}
	);
}

util::random::Random* Game::GetRandom() const {
	return m_random;
}

void Game::ExitGame( const f_exit_game on_game_exit ) {
	auto* game = g_engine->GetGame();
	ShowLoader( "Exiting game" );
	m_on_game_exit = on_game_exit;
	CancelRequests();
	if ( !m_mt_ids.reset ) {
		m_mt_ids.reset = game->MT_Reset();
	}
}

void Game::CancelRequests() {
	auto* game = g_engine->GetGame();
	if ( m_mt_ids.init ) {
		game->MT_Cancel( m_mt_ids.init );
		m_mt_ids.init = 0;
		// WHY?
		// is it even needed?
		/*ASSERT( !m_mt_ids.ping, "ping already active" );
		g_engine->GetUI()->SetLoaderText( "Canceling" );
		m_mt_ids.ping = game->MT_Ping();*/
	}
	if ( m_mt_ids.get_map_data ) {
		game->MT_Cancel( m_mt_ids.get_map_data );
		m_mt_ids.get_map_data = 0;
	}
	if ( m_mt_ids.reset ) {
		game->MT_Cancel( m_mt_ids.reset );
		m_mt_ids.reset = 0;
	}
	if ( m_mt_ids.get_frontend_requests ) {
		game->MT_Cancel( m_mt_ids.get_frontend_requests );
		m_mt_ids.get_frontend_requests = 0;
	}
	if ( m_mt_ids.send_backend_requests ) {
		game->MT_Cancel( m_mt_ids.send_backend_requests );
		m_mt_ids.send_backend_requests = 0;
	}
	// TODO: cancel other requests?
}

void Game::CancelGame() {
	ExitGame(
		[ this ]() -> void {
			if ( m_state ) {
				auto* connection = m_state->GetConnection();
				if ( connection && connection->IsConnected() ) {
					connection->Disconnect();
				}
			}
			if ( m_on_cancel ) {
				m_on_cancel();
				m_on_cancel = nullptr;
			}
		}
	);
}

const float Game::GetFixedX( const float x ) const {
	if ( x < m_camera_range.min.x ) {
		return x + m_camera_range.max.x - m_camera_range.min.x;
	}
	else if ( x > m_camera_range.max.x ) {
		return x - m_camera_range.max.x + m_camera_range.min.x;
	}
	else {
		return x;
	}
}

const float Game::GetCloserX( const float x, const float ref_x ) const {
	const auto x_range = (float)m_map_data.width * backend::map::s_consts.tile.scale.x / 2.0f;
	const float x_shifted = ref_x > 0
		? x + x_range
		: x - x_range;
	if (
		fabs( x_shifted - ref_x )
			<
				fabs( x - ref_x )
		) {
		// smaller distance if going other side
		return x_shifted;
	}
	else {
		return x;
	}
}

void Game::ShowTileSelector() {
	HideTileSelector();
	NEW( m_actors.tile_selection, actor::TileSelection, m_tm->GetSelectedTile()->GetRenderData().selection_coords );
	AddActor( m_actors.tile_selection );
}

void Game::HideTileSelector() {
	if ( m_actors.tile_selection ) {
		RemoveActor( m_actors.tile_selection );
		m_actors.tile_selection = nullptr;
	}
}

void Game::RenderTile( tile::Tile* tile, const unit::Unit* selected_unit ) {
	tile->Render(
		selected_unit
			? selected_unit->GetId()
			: 0
	);
	RefreshSelectedTileIf( tile, selected_unit );
	/*
	if ( m_selected_unit && m_selected_unit->IsActive() ) {
		m_selected_unit->StartBadgeBlink();
	}*/ // ???
}

void Game::SendAnimationFinished( const size_t animation_id ) {
	auto br = BackendRequest( BackendRequest::BR_ANIMATION_FINISHED );
	br.data.animation_finished.animation_id = animation_id;
	SendBackendRequest( &br );
}

void Game::RegisterWidgets() {
#define X_WIDGET( _x ) m_widgets._x = new widget::_x( this, m_ui );
	X_WIDGETS
#undef X_WIDGET
}

void Game::UnregisterWidgets() {

	// detach widget handlers
	for ( const auto& it : m_widget_relations ) {
		for ( const auto& it2 : it.second ) {
			it2.first->OnRemove( nullptr );
		}
	}
	m_widget_relations.clear();
	m_related_widgets.clear();

#define X_WIDGET( _x ) delete m_widgets._x; m_widgets._x = nullptr;
	X_WIDGETS
#undef X_WIDGET
}

::game::backend::Game* const Game::GetGame() const {
	return m_game;
}

void Game::Trigger( gse::GCWrappable* const object, const std::string& event, const gse::f_args_t& f_args ) {
	// TODO: some mutexes needed?
	if ( g_engine->IsShuttingDown() ) {
		return;
	}
	ASSERT( object, "triggered object is null" );
	auto* state = m_game->TryGetState();
	if ( !state ) {
		return;
	}
	state->WithGSE(
		state, [ state, object, event, f_args ]( GSE_CALLABLE ) {
			state->TriggerObject( object, event, f_args );
		}
	);
}

void Game::UpdateRelatedWidgets( const ui::widget_type_t type, const size_t id, const void* const data ) {
	//Log( "WR UPDATE ( " + std::to_string( type ) + ", " + std::to_string( id ) + ", " + std::to_string( (long long)data ) + " )" );
	const auto& it = m_related_widgets.find( type );
	if ( it == m_related_widgets.end() ) {
		return;
	}
	const auto& it2 = it->second.find( id );
	if ( it2 == it->second.end() ) {
		return;
	}
	// TODO: refactor this switch to unordered map find
	switch ( type ) {
		case ui::WT_UNIT_PREVIEW: {
			auto* const unit = m_um->GetUnitById( id );
			for ( const auto& widget : it2->second ) {
				m_widgets.UnitPreview->Update( widget, unit );
			}
			break;
		}
		case ui::WT_BASE_PREVIEW: {
			auto* const base = m_bm->GetBaseById( id );
			for ( const auto& widget : it2->second ) {
				m_widgets.BasePreview->Update( widget, base );
			}
			break;
		}
		default: {
			// nothing
		}
	}
}

const bool Game::IsTurnActive() const {
	return m_is_turn_active;
}

const size_t Game::GetMySlotIndex() const {
	return m_slot_index;
}

void Game::SetSelectedTile( tile::Tile* tile ) {
	m_tm->SelectTile( tile );
}

void Game::UpdateTilePreview( tile::Tile* const tile ) {
	if ( g_engine->IsShuttingDown() ) {
		return;
	}
	const auto& c = tile->GetCoords();
	auto* const t = m_game->GetMap()->GetTile( c.x, c.y );
	Trigger(
		m_game->GetMap(), "tile_preview", ARGS_F( &t ) {
			{
				"tile",
				t->Wrap( GSE_CALL )
			},
		}; }
	);
}

void Game::UpdateUnitPreview( const unit::Unit* const unit ) {
	if ( g_engine->IsShuttingDown() ) {
		return;
	}
	auto* const u = unit
		? m_game->GetUM()->GetUnit( unit->GetId() )
		: nullptr;
	Trigger(
		m_game->GetMap(), "unit_preview", ARGS_F( &u ) {
			{
				"unit",
				u
					? u->Wrap( GSE_CALL )
					: VALUE( gse::value::Null ),
			},
		}; }
	);
}

void Game::UpdateBasePreview( const base::Base* const base ) {
	if ( g_engine->IsShuttingDown() ) {
		return;
	}
	auto* const b = base
		? m_game->GetBM()->GetBase( base->GetId() )
		: nullptr;
	Trigger(
		m_game->GetMap(), "base_preview", ARGS_F( &b ) {
			{
				"base",
				b
					? b->Wrap( GSE_CALL )
					: VALUE( gse::value::Null ),
			},
		}; }
	);
}

void Game::UpdatePreviews( tile::Tile* const tile, const unit::Unit* const unit ) {
	// new ui
	UpdateTilePreview( tile );
	if ( unit && unit->GetTile() == tile ) {
		UpdateUnitPreview( unit );
	}
	else {
		const auto* const selected_unit = m_um->GetSelectedUnit();
		if ( !selected_unit || selected_unit->GetTile() != tile ) {
			const auto* const important_unit = tile->GetMostImportantUnit();
			const auto* base = tile->GetBase();
			if ( base && !base->IsOwned() && !tile->IsCurrentlyVisible() ) {
				base = nullptr;
			}
			if ( !important_unit && base ) {
				UpdateBasePreview( base );
			}
			else {
				UpdateUnitPreview( important_unit );
			}
		}
	}
}

void Game::RefreshSelectedTile( unit::Unit* selected_unit ) {
	auto* selected_tile = m_tm->GetSelectedTile();
	if ( selected_tile ) {
		UpdatePreviews( selected_tile, selected_unit );
	}
}

void Game::RefreshSelectedTileIf( tile::Tile* if_tile, const unit::Unit* const selected_unit ) {
	auto* selected_tile = m_tm->GetSelectedTile();
	if ( selected_tile && selected_tile == if_tile ) {
		UpdatePreviews( selected_tile, selected_unit );
	}
}

void Game::ScrollToSelectedTile( const bool center_on_tile ) {
	ASSERT( m_tm->GetSelectedTile(), "tile not selected" );
	ScrollToTile( m_tm->GetSelectedTile(), center_on_tile );
}

void Game::SelectAnyUnitAtTile( tile::Tile* tile ) {
	m_tile_at_query_purpose = backend::TQP_UNIT_SELECT;
	SelectTileOrUnit( tile );
	ScrollToTile( tile, true );
}

void Game::SelectUnitOrSelectedTile( unit::Unit* selected_unit ) {
	ASSERT( m_tm->GetSelectedTile(), "tile not selected" );
	m_tile_at_query_purpose = backend::TQP_UNIT_SELECT;
	SelectTileOrUnit(
		m_tm->GetSelectedTile(), selected_unit
			? selected_unit->GetId()
			: 0
	);
}

unit::Unit* Game::GetSelectedTileMostImportantUnit() const {
	auto* selected_tile = m_tm->GetSelectedTile();
	if ( selected_tile && !selected_tile->GetUnits().empty() ) {
		return selected_tile->GetMostImportantUnit();
	}
	else {
		return nullptr;
	}
}

Game::map_data_t::map_data_t()
	: filename( backend::map::s_consts.fs.default_map_filename + backend::map::s_consts.fs.default_map_extension )
	, last_directory( util::FS::GetCurrentDirectory() + util::FS::PATH_SEPARATOR + backend::map::s_consts.fs.default_map_directory ) {
	//
}

}
}
