#include "GLSMAC.h"

#include "util/FS.h"
#include "util/String.h"
#include "util/random/Random.h"
#include "types/Buffer.h"
#include "engine/Engine.h"
#include "config/Config.h"
#include "resource/ResourceManager.h"
#include "scheduler/Scheduler.h"
#include "util/LogHelper.h"
#include "gc/Space.h"
#include "console/Console.h"
#include "ui/UI.h"

#include "gse/GSE.h"
#include "gse/ExecutionPointer.h"
#include "gse/Async.h"
#include "gse/context/GlobalContext.h"
#include "gse/callable/Native.h"
#include "gse/Exception.h"
#include "gse/value/Undefined.h"
#include "gse/value/Bool.h"

#include "game/backend/Game.h"
#include "game/backend/State.h"
#include "game/backend/slot/Slots.h"
#include "game/backend/Player.h"
#include "game/backend/faction/Faction.h"
#include "game/backend/faction/FactionManager.h"
#include "game/backend/connection/Server.h"
#include "game/backend/connection/Client.h"
#include "game/backend/map/OriginalMapLoader.h"

#include "game/frontend/Game.h"

static GLSMAC* s_glsmac = nullptr;

GLSMAC::GLSMAC()
	: gse::GCWrappable( nullptr ) {

	// there can only be one GLSMAC
	ASSERT( !s_glsmac, "GLSMAC already defined" );
	s_glsmac = this;

	Log( "Creating global state" );

	// scripting stuff
	NEW( m_gse, gse::GSE );
	m_gse->AddRootObject( this );
	m_gse->AddBindings( this );
	m_ctx = m_gse->CreateGlobalContext();
	m_gc_space = m_gse->GetGCSpace();

	const auto& c = g_engine->GetConfig();

	const auto entry_script =
		util::FS::GeneratePath(
			{
				c->GetDataPath(),
				"default", // only 'default' mod for now
				c->GetMainScript() // script name (extension is appended automatically)
			}, gse::GSE::PATH_SEPARATOR
		)
	;

	m_gc_space->Accumulate( this, [ this ]() {
		gse::ExecutionPointer ep;
		// init UI
		m_ui = new ui::UI( m_gc_space, m_ctx, { "" }, ep );
	}, nullptr, true);

	// init console
	InitConsole();

	m_gc_space->Accumulate( this, [ this, &entry_script ]() {
		gse::ExecutionPointer ep;
		// load main scripts (will be run in RunMain())
		m_gse->RunScript( m_gc_space, m_ctx, {}, ep, entry_script );
		for ( const auto& mod_path : g_engine->GetConfig()->GetModPaths() ) {
			m_gse->RunScript(
				m_gc_space, m_ctx, {}, ep, util::FS::GeneratePath(
					{
						mod_path,
						"main"
					}
				)
			);
		}
	}, nullptr, true );

}

GLSMAC::~GLSMAC() {

	if ( m_load_thread ) {
		Log( "Waiting for load thread to stop" );
		m_load_thread.load()->join();
		delete m_load_thread;
	}

	if ( m_is_loader_shown ) {
		HideLoader();
	}

	Log( "Destroying global state" );

	m_gse->BeginShutdown();

	if ( m_game ) {
		m_game->Stop();
		delete m_game;
	}

	if ( m_console ) {
		m_console->Stop();
		delete m_console;
	}

	m_gc_space->Accumulate( this, [ this ](){
		gse::ExecutionPointer ep;
		m_ui->Destroy( m_gc_space, m_ctx, { "" }, ep );
	}, nullptr, true);

	DELETE( m_gse );

	s_glsmac = nullptr;
}

void GLSMAC::ShutDown( const int result ) {
	if ( s_glsmac && s_glsmac->m_gse ) {
		s_glsmac->m_gse->BeginShutdown();
	}
	g_engine->ShutDown( result );
}

void GLSMAC::Iterate() {
	if ( g_engine->IsShuttingDown() ) {
		return;
	}
	{
		bool ticked = false;
		while ( m_loader_dots_timer.HasTicked() ) {
			m_loader_dots++;
			if ( m_loader_dots > 3 ) {
				m_loader_dots = 1;
			}
			ticked = true;
		}
		if ( ticked ) {
			UpdateLoaderText();
		}
	}
	if ( m_load_thread ) {
		if ( !m_is_loading ) {
			ASSERT( m_f_after_load, "f_after_load not set" );
			m_load_thread.load()->join();
			delete m_load_thread;
			m_load_thread = nullptr;
			m_gc_space->Accumulate( this, [ this ](){
				HideLoader();
				m_f_after_load();
			});
			m_f_after_load = nullptr;
		}
	}
	m_gse->Iterate();
	if ( g_engine->IsShuttingDown() ) {
		return;
	}
	m_ui->Iterate();
	if ( g_engine->IsShuttingDown() ) {
		return;
	}
	if ( m_game ) {
		m_game->Iterate();
	}
	if ( g_engine->IsShuttingDown() ) {
		return;
	}
	if ( m_reset_needed ) {
		m_reset_needed = false;
		auto* game = g_engine->GetGame();
		const auto mt_id = game->MT_Reset();
		const auto& response = game->MT_WaitResponse( mt_id );
		ASSERT( response.result == game::backend::R_SUCCESS, "failed to reset game thread" );
		game->MT_DestroyResponse( response );
		RunMain();
	}
	if ( m_console ) {
		m_console->Iterate();
	}
}

WRAPIMPL_BEGIN( GLSMAC )
	auto* game = g_engine->GetGame();
	WRAPIMPL_PROPS
	WRAPIMPL_TRIGGERS
		{
			"config",
			g_engine->GetConfig()->Wrap( GSE_CALL ),
		},
		{
			"ui",
			m_ui->Wrap( GSE_CALL )
		},
		{
			"run",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				S_Init( GSE_CALL, {} );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"exit",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				ShutDown();
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"mainmenu", NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				S_MainMenu( GSE_CALL );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"deinit",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				DeinitGameState( GSE_CALL );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"init",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				InitGameState( GSE_CALL );
				return VALUE( gse::value::Undefined );
			} ),
		},
		{
			"reset",
			NATIVE_CALL( this ) {
				S_Reset( GSE_CALL );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"game",
			game->Wrap( GSE_CALL ),
		},
		{
			"connect",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				if ( !m_state ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Game not initialized" );
				}
				if ( m_state->GetConnection() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Connection is already established" );
				}
				if ( m_is_game_running ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Game is already running" );
				}
				game::backend::connection::Connection* connection = nullptr;
				switch ( m_state->m_settings.local.network_role ) {
					case game::backend::settings::LocalSettings::NR_SERVER: {
						NEW( connection, game::backend::connection::Server, gc_space, &m_state->m_settings.local );
						break;
					}
					case game::backend::settings::LocalSettings::NR_CLIENT: {
						NEW( connection, game::backend::connection::Client, gc_space, &m_state->m_settings.local );
						break;
					}
					default:
						GSE_ERROR( gse::EC.GAME_ERROR, "Network role not set" );
				}
				m_state->SetConnection( connection );
				return connection->Wrap( GSE_CALL );
			} ),
		},
		{
			"add_single_player",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS_MIN_MAX( 0, 1 );
				if ( !m_state ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Game not initialized" );
				}
				if ( m_is_game_running ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Game is already running" );
				}
				if ( !m_state->m_slots->GetSlots().empty() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Single player is already prepared" );
				}
				game::backend::faction::Faction* faction = nullptr;
				if ( !arguments.empty() ) {
					N_GETVALUE( faction_id, 0, String );
					faction = m_state->GetFM()->Get( faction_id );
					if ( !faction ) {
						GSE_ERROR( gse::EC.GAME_ERROR, "Unknown playable faction: " + faction_id );
					}
					if ( faction->m_flags & game::backend::faction::Faction::FF_NATIVE ) {
						GSE_ERROR( gse::EC.GAME_ERROR, "Planet cannot be selected as a playable faction" );
					}
				}
				AddSinglePlayerSlot( faction );
				return m_state->m_slots->GetSlot( 0 ).GetPlayer()->Wrap( GSE_CALL );
			} )
		},
		{
			"get_original_map_path",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 1 );
				N_GETVALUE( filename, 0, String );
				if ( filename != "planet.MP" && filename != "planetx.MP" ) {
					GSE_ERROR( gse::EC.INVALID_CALL, "Unknown base-game original map: " + filename );
				}
				return VALUE(
					gse::value::String,,
					g_engine->GetResourceManager()->GetCustomPath( "maps/" + filename )
				);
			} )
		},
		{
			"get_map_file_path",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 1 );
				N_GETVALUE( path, 0, String );
				const auto trimmed_path = util::String::TrimCopy( path );
				if ( trimmed_path.empty() ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Enter a map file path" );
				}
				const auto normalized_path = util::FS::NormalizePath( trimmed_path );
				if ( !util::FS::FileExists( normalized_path ) ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Map file not found: " + normalized_path );
				}
				const auto extension = util::String::GetLowerCase(
					util::FS::GetExtension( normalized_path )
				);
				if ( extension != ".gsm" && extension != ".mp" ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Map files must use the .gsm or .MP extension" );
				}
				if ( extension == ".mp" ) {
					try {
						const auto data = types::Buffer( util::FS::ReadTextFile( normalized_path ) );
						game::backend::map::OriginalMapLoader::Validate( data );
					}
					catch ( const std::runtime_error& e ) {
						GSE_ERROR( gse::EC.GAME_ERROR, "Invalid original SMAC map: " + std::string( e.what() ) );
					}
				}
				return VALUE( gse::value::String,, normalized_path );
			} )
		},
		{
			"add_ai_player",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				if ( !m_state ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Game not initialized" );
				}
				if ( m_is_game_running ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Game is already running" );
				}
				if ( m_state->m_slots->GetSlots().empty() ) {
					AddSinglePlayerSlot( nullptr );
				}
				return AddAIPlayerSlot()->Wrap( GSE_CALL );
			} )
		},
		{
			"start_game",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				if ( !m_state ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Game not initialized" );
				}
				if ( m_is_game_running ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Game is already running" );
				}
				if ( m_is_loading ) {
					GSE_ERROR( gse::EC.GAME_ERROR, "Game still initializing" );
				}
				if ( m_state->m_slots->GetSlots().empty() ) {
					AddSinglePlayerSlot( nullptr );
				}
				StartGame( GSE_CALL );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"has_quicksave",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 0 );
				return BOOL_VALUE( util::FS::FileExists( GetSavePath( 0 ) ) );
			} )
		},
		{
			"has_save_game",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS( 1 );
				N_GETVALUE( slot, 0, Int );
				if ( slot < 1 || slot > MANUAL_SAVE_SLOT_COUNT ) {
					GSE_ERROR( gse::EC.INVALID_CALL, "Save slot must be between 1 and " + std::to_string( MANUAL_SAVE_SLOT_COUNT ) );
				}
				return BOOL_VALUE( util::FS::FileExists( GetSavePath( slot ) ) );
			} )
		},
		{
			"save_game",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS_MIN_MAX( 0, 1 );
				size_t save_slot = 0;
				if ( !arguments.empty() ) {
					N_GETVALUE( slot, 0, Int );
					if ( slot < 1 || slot > MANUAL_SAVE_SLOT_COUNT ) {
						GSE_ERROR( gse::EC.INVALID_CALL, "Save slot must be between 1 and " + std::to_string( MANUAL_SAVE_SLOT_COUNT ) );
					}
					save_slot = slot;
				}
				SaveGame( GSE_CALL, save_slot );
				return VALUE( gse::value::Undefined );
			} )
		},
		{
			"load_game",
			NATIVE_CALL( this ) {
				N_EXPECT_ARGS_MIN_MAX( 0, 1 );
				size_t save_slot = 0;
				if ( !arguments.empty() ) {
					N_GETVALUE( slot, 0, Int );
					if ( slot < 1 || slot > MANUAL_SAVE_SLOT_COUNT ) {
						GSE_ERROR( gse::EC.INVALID_CALL, "Save slot must be between 1 and " + std::to_string( MANUAL_SAVE_SLOT_COUNT ) );
					}
					save_slot = slot;
				}
				LoadGame( GSE_CALL, save_slot );
				return VALUE( gse::value::Undefined );
			} )
		},
	};
WRAPIMPL_END_PTR()

UNWRAPIMPL_PTR( GLSMAC )

void GLSMAC::ShowLoader( const std::string& text ) {
	if ( !m_is_loader_shown ) {
		m_is_loader_shown = true;
		m_loader_text = text;
		m_loader_dots = 1;
		m_loader_dots_timer.SetInterval( 100 );
		m_gc_space->Accumulate( this, [ this ] () {
			try {
				TriggerObject( m_ui, "loader_show" );
			} catch ( const gse::Exception& e ) {
				// tmp fix gdb race conditions // TODO
			}
		});
	}
	UpdateLoaderText();
}

void GLSMAC::SetLoaderText( const std::string& text ) {
	if ( !m_is_loader_shown ) {
		ShowLoader( text );
	}
	else {
		m_loader_text = text;
		UpdateLoaderText();
	}
}

void GLSMAC::HideLoader() {
	if ( m_is_loader_shown ) {
		m_is_loader_shown = false;
		m_loader_dots_timer.Stop();
		m_gc_space->Accumulate( this, [ this ](){
			try {
				TriggerObject( m_ui, "loader_hide" );
			} catch ( const gse::Exception& e ) {
				// tmp fix gdb race conditions // TODO
			}
		});
	}
}

void GLSMAC::ShowError( const std::string& text, const std::function< void() >& on_close ) {
	Log( text );
	m_gc_space->Accumulate( this, [ this, text, on_close ](){
		TriggerObject( m_ui, "error", ARGS_F( this, &text, &on_close ) {
			{
				"error",
				VALUE( gse::value::String,, text )
			},
			{
				"on_close",
				VALUE( gse::callable::Native,, ctx, [ on_close ]( GSE_CALLABLE, const gse::value::function_arguments_t& arguments ) -> gse::Value* {
					if ( on_close ) {
						on_close();
					}
					return VALUE( gse::value::Undefined );
				} )
			}
		}; } );
	});
}

void GLSMAC::Reset() {
	m_gc_space->Accumulate( this, [ this ](){
		gse::ExecutionPointer ep;
		Reset( m_gc_space, m_ctx, {}, ep );
	});
}

gse::Value* const GLSMAC::TriggerObject( gse::GCWrappable* object, const std::string& event, const f_args_t& f_args ) {
	gse::ExecutionPointer ep;
	return object->Trigger( m_gc_space, m_ctx, {}, ep, event, f_args );
}

void GLSMAC::WithGSE( const std::function<void( GSE_CALLABLE )>& f ) {
	if ( !g_engine->IsShuttingDown() && m_state ) {
		m_state->WithGSE( this, f );
	}
}

void GLSMAC::GetReachableObjects( std::unordered_set< gc::Object* >& reachable_objects ) {
	gse::GCWrappable::GetReachableObjects( reachable_objects );

	g_engine->GetGame()->GetReachableObjects( reachable_objects );

	if ( m_state ) {
		GC_DEBUG_BEGIN( "state" );
		GC_REACHABLE( m_state );
		GC_DEBUG_END();
	}

	if ( m_wrapobj ) {
		GC_DEBUG_BEGIN( "wrapobj" );
		GC_REACHABLE( m_wrapobj );
		GC_DEBUG_END();
	}

	if ( m_ui ) {
		GC_DEBUG_BEGIN( "ui" );
		GC_REACHABLE( m_ui );
		GC_DEBUG_END();
	}

	GC_DEBUG_BEGIN( "main callables" );
	for ( const auto& m : m_main_callables ) {
		GC_REACHABLE( m );
	}
	GC_DEBUG_END();

}

void GLSMAC::AsyncLoad( const std::string& text, const std::function< void() >& f, const std::function< void() >& f_after_load ) {
	ASSERT( !m_load_thread, "load thread already set" );
	ASSERT( !m_f_after_load, "f_after load already set" );
	m_is_loading = true;
	m_f_after_load = f_after_load;
	ShowLoader( text );
	m_load_thread = new std::thread( [ this, f ] {
		f();
		m_is_loading = false;
	});
}

void GLSMAC::S_Init( GSE_CALLABLE, const std::optional< std::string >& path ) {
	const auto& c = g_engine->GetConfig();
	auto* r = g_engine->GetResourceManager();
	if ( !m_state || r->GetDetectedSMACType() == config::ST_UNKNOWN ) {
		if ( !m_state ) {
			m_state = new game::backend::State( m_gc_space, m_ctx, this );
			m_state->m_settings.global.Initialize();
		}
		try {
			if ( path.has_value() ) {
				r->Init( { path.value() }, config::ST_AUTO );
			}
			else {
				r->Init( c->GetPossibleSMACPaths(), c->GetSMACType() );
			}
		} catch ( const std::runtime_error& e ) {
			gse::value::object_properties_t args = {
				{
					"set_smacpath", NATIVE_CALL( this ) {
						N_EXPECT_ARGS( 1 );
						N_GETVALUE( path, 0, String );
						S_Init( GSE_CALL, path );
						return VALUE( gse::value::Undefined );
					} )
				}
			};
			if ( path.has_value() ) {
				args.insert({ "last_failed_path", VALUE( gse::value::String,, path.value() ) } );
			}
			TriggerObject( this, "smacpath_prompt", ARGS( args ) );
			return;
		}
		if ( path.has_value() ) {
			c->SetSMACPath( path.value() );
		}
	}
	Reset( GSE_CALL );
}

void GLSMAC::S_Reset( GSE_CALLABLE ) {
	ClearHandlers();
	m_ui->Clear( GSE_CALL );
	auto* game = g_engine->GetGame();
	game->ClearHandlers();
	game->ClearEvents();
	m_reset_needed = true;
}

void GLSMAC::S_Intro( GSE_CALLABLE ) {
	TriggerObject( this, "intro" );
}

void GLSMAC::S_MainMenu( GSE_CALLABLE ) {
	TriggerObject( this, "mainmenu_show", ARGS_F( this ) {
		{
			"settings",
			m_state->m_settings.Wrap( GSE_CALL ),
		}
	}; } );
}

void GLSMAC::S_Game( GSE_CALLABLE ) {
	TriggerObject( this, "mainmenu_hide", {} );
	m_game->Start();
}

void GLSMAC::UpdateLoaderText() {
	ASSERT( m_is_loader_shown, "loader not shown" );
	std::string text = m_loader_text + std::string( m_loader_dots, '.' ) + std::string( 3 - m_loader_dots, ' ' );
	m_gc_space->Accumulate( this, [ this, text ]() {
		try {
			TriggerObject( m_ui, "loader_text", ARGS_F( this, &text ) {
				{
					"text", VALUEEXT( gse::value::String, m_gc_space, text )
				}
			}; } );
		} catch ( const gse::Exception& e ) {
			// tmp fix gdb race conditions // TODO
		}
	});
}

void GLSMAC::Reset( GSE_CALLABLE ) {
	const auto& c = g_engine->GetConfig();

	HideLoader();
	m_is_game_running = false;

	if ( m_game ) {
		m_game->Stop();
	}

	if ( c->HasLaunchFlag( config::Config::LF_QUICKSTART ) ) {
		InitGameState( GSE_CALL );
		m_state->m_settings.local.game_mode = game::backend::settings::LocalSettings::GM_SINGLEPLAYER;
		m_state->m_settings.global.Initialize();
		game::backend::faction::Faction* faction = nullptr;
		if ( c->HasLaunchFlag( config::Config::LF_QUICKSTART_FACTION ) ) {
			const auto* fm = m_state->GetFM();
			ASSERT( fm, "fm is null" );
			faction = fm->Get( util::String::GetUpperCase( c->GetQuickstartFaction() ) );
			if ( faction && ( faction->m_flags & game::backend::faction::Faction::FF_NATIVE ) ) {
				faction = nullptr;
			}
			if ( !faction ) {
				std::string errmsg = "Faction \"" + c->GetQuickstartFaction() + "\" does not exist. Available factions:";
				for ( const auto& f : fm->GetAll() ) {
					if ( !( f->m_flags & game::backend::faction::Faction::FF_NATIVE ) ) {
						errmsg += " " + f->m_id;
					}
				}
				ShowError( errmsg, []() {
					ShutDown();
				} );
				return;
			}
		}
		AddSinglePlayerSlot( faction );
		if ( c->HasLaunchFlag( config::Config::LF_QUICKSTART_AI ) ) {
			for ( uint8_t i = 0 ; i < c->GetQuickstartAIPlayers() ; i++ ) {
				AddAIPlayerSlot();
			}
		}
		auto ep2 = ep;
		StartGame( m_gc_space, ctx, si, ep2 );
	}
	else if (
		c->HasLaunchFlag( config::Config::LF_SKIPINTRO ) ||
			g_engine->GetResourceManager()->GetDetectedSMACType() == config::ST_LEGACY // it doesn't have firaxis logo image
		) {
		S_MainMenu( GSE_CALL );
	}
	else {
		S_Intro( GSE_CALL );
	}
}

void GLSMAC::DeinitGameState( GSE_CALLABLE ) {
	if ( m_state ) {
		if ( m_is_game_running ) {
			GSE_ERROR( gse::EC.GAME_ERROR, "Game is still running" );
		}
		m_state->Reset();
	}
}

void GLSMAC::InitGameState( GSE_CALLABLE ) {
	if ( m_is_game_running ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Game is already running" );
	}
	auto* game = g_engine->GetGame();
	m_state->Reset();
	m_state->SetGame( game );
	game->SetState( m_state );
	m_state->WithGSE( this, [ this ]( GSE_CALLABLE ) {
		TriggerObject( this, "configure_state", ARGS_F( this ) {
			{
				"fm",
				m_state->GetFM()->Wrap( GSE_CALL ),
			}
		}; } );
	});
}

void GLSMAC::RandomizeSettings( GSE_CALLABLE ) {
	if ( !m_state ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Game is not initialized" );
	}
	if ( m_is_game_running ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Game is already running" );
	}
}

void GLSMAC::AddSinglePlayerSlot( game::backend::faction::Faction* const faction ) {
	m_state->m_slots->Resize( game::backend::State::TOTAL_SLOT_COUNT );
	m_state->EnsureNativePlayer();
	const auto& rules = m_state->m_settings.global.rules;
	const auto& difficulty_level = rules.m_difficulty_levels.GetString(
		static_cast< int >( m_state->m_settings.global.difficulty_level )
	);
	m_state->m_settings.local.player_name = "Player";
	NEWV( player, ::game::backend::Player,
		m_state->m_settings.local.player_name,
		::game::backend::Player::PR_SINGLE,
		faction,
		difficulty_level
	);
	m_state->AddPlayer( player );
	size_t slot_num = 0; // player always has slot 0
	m_state->AddCIDSlot( 0, slot_num ); // for consistency
	auto& slot = m_state->m_slots->GetSlot( slot_num );
	slot.SetPlayer( player, 0, "" );
	slot.SetPlayerFlag( ::game::backend::slot::PF_READY );
	slot.SetLinkedGSID( m_state->m_settings.local.account.GetGSID() );
}

game::backend::Player* GLSMAC::AddAIPlayerSlot() {
	ASSERT( m_state, "game state is not initialized" );
	if ( m_state->m_slots->GetSlots().empty() ) {
		m_state->m_slots->Resize( game::backend::State::TOTAL_SLOT_COUNT );
	}
	m_state->EnsureNativePlayer();

	size_t slot_num = m_state->m_slots->GetCount();
	for ( size_t i = 0 ; i < m_state->m_slots->GetCount() ; i++ ) {
		if ( m_state->m_slots->GetSlot( i ).GetState() == game::backend::slot::Slot::SS_OPEN ) {
			slot_num = i;
			break;
		}
	}
	ASSERT( slot_num < m_state->m_slots->GetCount(), "no open slot is available for an AI player" );

	game::backend::faction::Faction* faction = nullptr;
	for ( auto* const candidate : m_state->GetFM()->GetAll() ) {
		if ( candidate->m_flags & (
			game::backend::faction::Faction::FF_NAVAL |
			game::backend::faction::Faction::FF_NATIVE
		) ) {
			continue;
		}
		bool is_selected = false;
		for ( const auto& slot : m_state->m_slots->GetSlots() ) {
			if (
				slot.GetState() == game::backend::slot::Slot::SS_PLAYER
				&& slot.GetPlayer()->GetFaction() == candidate
			) {
				is_selected = true;
				break;
			}
		}
		if ( !is_selected ) {
			faction = candidate;
			break;
		}
	}
	ASSERT( faction, "no land faction is available for an AI player" );

	const auto& rules = m_state->m_settings.global.rules;
	auto* const player = new game::backend::Player(
		"AI " + std::to_string( slot_num ),
		game::backend::Player::PR_AI,
		faction,
		rules.GetDefaultDifficultyLevel()
	);
	m_state->AddPlayer( player );
	auto& slot = m_state->m_slots->GetSlot( slot_num );
	slot.SetPlayer( player, 0, "AI" );
	slot.SetPlayerFlag( game::backend::slot::PF_READY );
	return player;
}

const std::string GLSMAC::GetSavePath( const size_t slot ) const {
	ASSERT( slot <= MANUAL_SAVE_SLOT_COUNT, "invalid save slot" );
	return util::FS::GeneratePath({
		g_engine->GetConfig()->GetPrefix() + "saves",
		slot == 0
			? "quicksave.glsmac"
			: "save" + std::to_string( slot ) + ".glsmac",
	});
}

void GLSMAC::SaveGame( GSE_CALLABLE, const size_t slot ) {
	if ( !m_is_game_running || !m_game ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Game is not running" );
	}
	const auto path = GetSavePath( slot );
	util::FS::CreateDirectoryIfNotExists( util::FS::GetDirName( path ) );
	auto* const game = g_engine->GetGame();
	const auto mt_id = game->MT_SaveGame( path );
	const auto& response = game->MT_WaitResponse( mt_id );
	if ( response.result != game::backend::R_SUCCESS ) {
		const std::string error = response.data.error.error_text
			? *response.data.error.error_text
			: "Unknown save error";
		game->MT_DestroyResponse( response );
		GSE_ERROR( gse::EC.GAME_ERROR, "Failed to save game: " + error );
	}
	game->MT_DestroyResponse( response );
	game->Message( "Game saved." );
}

void GLSMAC::LoadGame( GSE_CALLABLE, const size_t slot ) {
	if ( !m_state ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Game not initialized" );
	}
	if ( m_is_game_running ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Game is already running" );
	}
	if ( !m_state->m_slots->GetSlots().empty() ) {
		GSE_ERROR( gse::EC.GAME_ERROR, "Game setup is already populated" );
	}

	const auto path = GetSavePath( slot );
	if ( !util::FS::FileExists( path ) ) {
		GSE_ERROR(
			gse::EC.GAME_ERROR,
			slot == 0
				? "No quicksave exists"
				: "No saved game exists in slot " + std::to_string( slot )
		);
	}

	try {
		types::Buffer buf( util::FS::ReadTextFile( path ) );
		if ( buf.ReadString() != game::backend::Game::SAVE_GAME_MAGIC ) {
			THROW( "Not a GLSMAC saved game" );
		}
		const auto version = buf.ReadInt< uint32_t >( "save-game version" );
		if ( version != game::backend::Game::SAVE_GAME_VERSION ) {
			THROW( "Unsupported save-game version: " + std::to_string( version ) );
		}
		const auto serialized_state = buf.ReadString();
		const auto serialized_slots = buf.ReadString();
		const auto local_slot = buf.ReadInt< size_t >( "save-game local slot" );
		const auto random_state = buf.ReadString();
		const auto world_snapshot = buf.ReadString();
		if ( buf.GetRemaining() != 0 ) {
			THROW( "Unexpected data after saved game" );
		}
		util::random::Random::GetStateFromString( random_state );
		if ( world_snapshot.empty() ) {
			THROW( "Saved game has no world snapshot" );
		}

		m_state->Deserialize( types::Buffer( serialized_state ) );
		m_state->m_slots->Deserialize( types::Buffer( serialized_slots ) );
		if (
			local_slot >= game::backend::State::PLAYABLE_SLOT_COUNT ||
			local_slot >= m_state->m_slots->GetCount()
		) {
			THROW( "Saved game has an invalid local player slot" );
		}

		size_t single_player_count = 0;
		for ( auto& slot : m_state->m_slots->GetSlots() ) {
			if ( slot.GetState() != game::backend::slot::Slot::SS_PLAYER ) {
				continue;
			}
			auto* const player = slot.GetPlayer();
			if ( !player ) {
				THROW( "Saved player slot is empty" );
			}
			if ( player->GetRole() == game::backend::Player::PR_SINGLE ) {
				single_player_count++;
			}
			m_state->AddPlayer( player );
		}
		auto* const local_player = m_state->m_slots->GetSlot( local_slot ).GetPlayer();
		if (
			!local_player || local_player->GetRole() != game::backend::Player::PR_SINGLE ||
			single_player_count != 1
		) {
			THROW( "Saved game does not have one local single-player commander" );
		}

		m_state->m_settings.local.game_mode = game::backend::settings::LocalSettings::GM_SINGLEPLAYER;
		m_state->AddCIDSlot( 0, local_slot );
		m_state->SetPendingGameLoad({ local_slot, random_state, world_snapshot });
		StartGame( GSE_CALL );
	}
	catch ( const std::exception& e ) {
		GSE_ERROR(
			gse::EC.GAME_ERROR,
			( slot == 0 ? "Failed to load quicksave: " : "Failed to load saved game: " ) +
				(std::string)e.what()
		);
	}
}

void GLSMAC::StartGame( GSE_CALLABLE ) {
	// real state belongs to game task now
	// save it as backup, then make temporary shallow copy (no connection, players etc)
	//   just for the sake of passing settings to previous menu
	auto* real_state = m_state;

	//m_state = nullptr; // TODO: why?

	m_is_game_running = true;

	auto* game = g_engine->GetGame();
	ASSERT( game, "game not set" );

	if ( m_game ) {
		m_game->Stop();
		delete m_game;
	}
	m_game = new ::game::frontend::Game(
		this, real_state, m_ui, [ this, si, ep ] () {
			m_gc_space->Accumulate(
				this, [ this ]() {
					TriggerObject( this, "start_game" );
				}
			);
		}, [ this ] () {
			const auto* config = g_engine->GetConfig();
			if (
				config->HasLaunchFlag( config::Config::LF_QUICKSTART ) ||
				config->HasLaunchFlag( config::Config::LF_HOST ) ||
				config->HasLaunchFlag( config::Config::LF_JOIN )
			) {
				ShutDown();
			}
			else {
				Reset();
			}
		}
	);

	S_Game( GSE_CALL );

	TriggerObject( this, "configure_game", ARGS_F( &game ) {
		{
			"game",
			game->Wrap( GSE_CALL ),
		}
	}; } );
}

void GLSMAC::InitConsole() {
	ASSERT( !m_console, "console already initialized" );
	m_console = new console::Console();
	m_console->Start();
}

void GLSMAC::RunMain() {
	ASSERT( m_gc_space, "gc space is null" );
	for ( const auto& main : m_main_callables ) {
		ASSERT( main->type == gse::VT_CALLABLE, "main not callable" );
		m_gc_space->Accumulate( this, [ this, &main ] (){
			gse::ExecutionPointer ep;
			if ( !m_wrapobj ) {
				m_wrapobj = Wrap( m_gc_space, m_ctx, {}, ep );
			}
			( (gse::value::Callable*)main )->Run( m_gc_space, m_ctx, {}, ep, {
				m_wrapobj
			} );
		});
	}
}

void GLSMAC::AddToContext( gc::Space* const gc_space, gse::context::Context* ctx, gse::ExecutionPointer& ep ) {
	ctx->CreateBuiltin( "main", NATIVE_CALL( this ) {
		N_EXPECT_ARGS( 1 );
		const auto& main = arguments.at(0);
		N_CHECKARG( main, 0, Callable );
		m_main_callables.push_back( main );
		return VALUE( gse::value::Undefined );
	} ), ep );
}
