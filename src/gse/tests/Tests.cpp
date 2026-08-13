#include "Tests.h"

#include <array>
#include <limits>
#include <memory>
#include <utility>

#include "GSE.h"
#include "Parser.h"
#include "Runner.h"
#include "Scripts.h"

#include "engine/Engine.h"
#include "config/Config.h"
#include "task/gsetests/GSETests.h"

#include "gse/program/Program.h"
#include "gse/program/Variable.h"
#include "gse/program/Value.h"
#include "gse/program/Function.h"
#include "gse/program/Call.h"
#include "gse/program/Array.h"
#include "gse/program/If.h"
#include "gse/program/Else.h"
#include "gse/program/While.h"
#include "gse/program/Try.h"
#include "gse/program/Catch.h"
#include "gse/program/Statement.h"
#include "gse/program/Expression.h"
#include "gse/program/Operator.h"
#include "gse/program/Object.h"
#include "gse/program/SimpleCondition.h"
#include "gse/value/Bool.h"
#include "gse/value/Int.h"
#include "gse/value/String.h"
#include "gse/value/Null.h"
#include "gse/value/Range.h"
#include "game/backend/faction/Faction.h"
#include "game/backend/Player.h"
#include "game/backend/Game.h"
#include "game/backend/animation/Def.h"
#include "game/backend/base/FacilityDef.h"
#include "game/backend/base/PopDef.h"
#include "game/backend/map/MapState.h"
#include "game/backend/map/tile/Tile.h"
#include "game/backend/map/tile/TileState.h"
#include "game/backend/map/tile/Tiles.h"
#include "game/backend/settings/Settings.h"
#include "game/backend/slot/Slot.h"
#include "game/backend/resource/Resource.h"
#include "game/backend/unit/Def.h"
#include "types/Buffer.h"
#include "types/Color.h"
#include "types/mesh/Mesh.h"
#include "types/Packet.h"
#include "types/texture/Texture.h"
#include "util/FS.h"

namespace gse {
namespace tests {

void AddTests( task::gsetests::GSETests* task ) {

	if ( !g_engine->GetConfig()->HasDebugFlag( config::Config::DF_GSE_TESTS_SCRIPT ) ) {
		task->AddTest(
			"test if tests work",
			GT() {
				GT_OK();
			}
		);
		task->AddTest(
			"filesystem normalization tolerates missing write targets",
			GT() {
				const auto path = g_engine->GetConfig()->GetPrefix() + "debug/path-normalization-regression/missing.txt";
				const auto normalized = util::FS::NormalizePath( path );
				GT_ASSERT( !normalized.empty(), "missing path normalized to an empty string" );
				GT_ASSERT( normalized.find( "missing.txt" ) != std::string::npos, "missing path lost its filename while normalizing" );
				GT_OK();
			}
		);
		task->AddTest(
			"buffer ownership and validation",
			GT() {
				types::Buffer source;
				source.WriteInt( 11 );
				types::Buffer copy( source );
				copy.WriteInt( 22 );
				types::Buffer assigned;
				assigned.WriteString( "discarded" );
				assigned = copy;

				GT_ASSERT( source.ReadInt() == 11, "source buffer changed after copy" );
				GT_ASSERT( source.GetRemaining() == 0, "source buffer gained copied data" );
				GT_ASSERT( copy.ReadInt() == 11 && copy.ReadInt() == 22, "copied buffer append failed" );
				GT_ASSERT( assigned.ReadInt() == 11 && assigned.ReadInt() == 22, "buffer copy assignment failed" );

				types::Buffer valid_count;
				valid_count.WriteInt( 2 );
				valid_count.WriteBool( false );
				valid_count.WriteBool( true );
				GT_ASSERT( valid_count.ReadCollectionSize( "test" ) == 2, "valid collection count rejected" );

				bool rejected_negative_count = false;
				try {
					types::Buffer negative_count;
					negative_count.WriteInt( -1 );
					negative_count.ReadCollectionSize( "test" );
				}
				catch ( const std::runtime_error& ) {
					rejected_negative_count = true;
				}
				GT_ASSERT( rejected_negative_count, "negative collection count accepted" );

				bool rejected_impossible_count = false;
				try {
					types::Buffer impossible_count;
					impossible_count.WriteInt( 1 );
					impossible_count.ReadCollectionSize( "test" );
				}
				catch ( const std::runtime_error& ) {
					rejected_impossible_count = true;
				}
				GT_ASSERT( rejected_impossible_count, "impossible collection count accepted" );

				types::Buffer string_buffer;
				string_buffer.WriteString( "x" );
				auto malformed_data = string_buffer.ToString();
				for ( size_t i = 1 ; i < 5 ; i++ ) {
					malformed_data[ i ] = static_cast< char >( 0xff );
				}
				bool rejected_overflowing_size = false;
				try {
					types::Buffer malformed_buffer( malformed_data );
					malformed_buffer.ReadString();
				}
				catch ( const std::runtime_error& ) {
					rejected_overflowing_size = true;
				}
				GT_ASSERT( rejected_overflowing_size, "overflowing buffer field size accepted" );

				bool rejected_data_size_mismatch = false;
				try {
					const uint8_t value = 7;
					types::Buffer data_buffer;
					data_buffer.WriteData( &value, sizeof( value ) );
					data_buffer.ReadData( sizeof( value ) + 1 );
				}
				catch ( const std::runtime_error& ) {
					rejected_data_size_mismatch = true;
				}
				GT_ASSERT( rejected_data_size_mismatch, "buffer data size mismatch accepted" );

				bool rejected_oversized_write = false;
				try {
					const uint8_t value = 0;
					types::Buffer oversized_write;
					oversized_write.WriteData( &value, UINT32_MAX );
				}
				catch ( const std::runtime_error& ) {
					rejected_oversized_write = true;
				}
				GT_ASSERT( rejected_oversized_write, "oversized buffer field write accepted" );

				bool rejected_noncanonical_bool = false;
				try {
					types::Buffer invalid_bool;
					invalid_bool.WriteBool( false );
					const size_t value_offset = sizeof( uint8_t ) + sizeof( uint32_t );
					invalid_bool.data[ value_offset ] = 2;
					invalid_bool.data[ invalid_bool.lenw - 1 ] = 2;
					invalid_bool.ReadBool();
				}
				catch ( const std::runtime_error& ) {
					rejected_noncanonical_bool = true;
				}
				GT_ASSERT( rejected_noncanonical_bool, "noncanonical serialized boolean accepted" );
				GT_OK();
			}
		);
		task->AddTest(
			"settings serialization validation",
			GT() {
				using game::backend::settings::MapSettings;

				types::Buffer invalid_map;
				invalid_map.WriteInt( MapSettings::MT_CUSTOM );
				invalid_map.WriteString( "" );
				invalid_map.WriteInt( 112 );
				invalid_map.WriteInt( 56 );
				invalid_map.WriteFloat( 0.4f );
				invalid_map.WriteFloat( 0.75f );
				invalid_map.WriteFloat( 1.5f );
				invalid_map.WriteFloat( 0.5f );

				MapSettings settings;
				bool rejected_invalid_fraction = false;
				try {
					settings.Deserialize( invalid_map );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_fraction = true;
				}
				GT_ASSERT( rejected_invalid_fraction, "invalid map fraction accepted" );
				GT_ASSERT( settings.type == MapSettings::MT_RANDOM, "invalid map settings partially applied" );

				types::Buffer invalid_local;
				invalid_local.WriteInt( 99 );
				invalid_local.WriteInt( game::backend::settings::LocalSettings::NT_NONE );
				invalid_local.WriteInt( game::backend::settings::LocalSettings::NR_NONE );
				invalid_local.WriteString( "player" );
				invalid_local.WriteString( "127.0.0.1" );
				bool rejected_invalid_mode = false;
				try {
					game::backend::settings::LocalSettings local;
					local.Deserialize( invalid_local );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_mode = true;
				}
				GT_ASSERT( rejected_invalid_mode, "invalid local game mode accepted" );
				GT_OK();
			}
		);
		task->AddTest(
			"network integer validation",
			GT() {
				bool rejected_negative_slot = false;
				try {
					types::Buffer serialized_packet;
					serialized_packet.WriteInt( types::Packet::PT_PLAYERS );
					serialized_packet.WriteInt( -1 );
					serialized_packet.WriteString( "" );
					types::Packet packet( types::Packet::PT_NONE );
					packet.Deserialize( serialized_packet );
				}
				catch ( const std::runtime_error& ) {
					rejected_negative_slot = true;
				}
				GT_ASSERT( rejected_negative_slot, "negative packet slot accepted" );

				bool rejected_slot_flags = false;
				try {
					types::Buffer serialized_slot;
					serialized_slot.WriteInt( game::backend::slot::Slot::SS_PLAYER );
					serialized_slot.WriteString( "" );
					serialized_slot.WriteInt( 0x80 );
					serialized_slot.WriteString( "" );
					game::backend::slot::Slot slot( 0, nullptr );
					slot.Deserialize( serialized_slot );
				}
				catch ( const std::runtime_error& ) {
					rejected_slot_flags = true;
				}
				GT_ASSERT( rejected_slot_flags, "unknown slot player flags accepted" );
				GT_OK();
			}
		);
		task->AddTest(
			"player research serialization validation",
			GT() {
				using game::backend::Game;
				using game::backend::Player;

				Player source( "Researcher", Player::PR_SINGLE, nullptr, "Citizen" );
				source.SetResearchState( { "CentauriEcology" }, "", 0 );
				source.SetEnergyCredits( 73 );
				source.SetEcologicalDamageEvents( 4 );
				source.SetCleanMineralFacilities( 3 );
				source.SetMajorAtrocities( 2 );
				source.SetSanctionTurns( 10 );
				source.SetIntegrityBlemishes( 4 );
				source.SetMindControlTotal( 12 );
				source.SetPrototypedComponents({ "Laser" });
				source.SetDiplomaticExcuseTurn( 5, 44 );
				const Player::diplomatic_grievance_t grievance = { true, true, true };
				source.SetDiplomaticGrievance( 6, grievance );
				source.SetObsoleteUnitDesigns( {
					"WorkshopP1_Infantry_Laser_NoArmor_FissionPlant"
				} );
				source.SetRetiredUnitDesigns( {
					"WorkshopP1_Infantry_Laser_NoArmor_FissionPlant"
				} );
				source.SetOrbitalFacilityCount( "SkyHydroponicsLab", 3 );
				source.SetOrbitalDefenseDeployments( 2 );
				const Player::council_state_t council_state = {
					false, 42, "", -1, -1, -1, Player::COUNCIL_VOTE_PENDING,
					true, true, true, true, 2, Player::SUPREME_RESPONSE_DEFY, true,
				};
				source.SetCouncilState( council_state );
				Player council_policy_validator( "Council", Player::PR_SINGLE, nullptr, "Citizen" );
				council_policy_validator.SetCouncilState( {
					false, 42, "launch_solar_shade", 1, 1, 0,
					Player::COUNCIL_VOTE_PENDING, false, false, false, false,
				} );
				council_policy_validator.SetCouncilState( {
					false, 42, "melt_polar_caps", 1, 1, 0,
					Player::COUNCIL_VOTE_PENDING, false, false, false, false,
				} );
				bool rejected_inactive_supreme_response = false;
				try {
					council_policy_validator.SetCouncilState( {
						false, 42, "", -1, -1, -1, Player::COUNCIL_VOTE_PENDING,
						false, false, false, false, -1, Player::SUPREME_RESPONSE_DEFY, false,
					} );
				}
				catch ( const std::runtime_error& ) {
					rejected_inactive_supreme_response = true;
				}
				GT_ASSERT(
					rejected_inactive_supreme_response,
					"inactive Supreme Leader state accepted a faction response"
				);
				bool rejected_conflicting_supreme_session = false;
				try {
					council_policy_validator.SetCouncilState( {
						false, 42, "governor", 1, 1, 0, Player::COUNCIL_VOTE_PENDING,
						false, false, false, false, 2, Player::SUPREME_RESPONSE_PENDING, false,
					} );
				}
				catch ( const std::runtime_error& ) {
					rejected_conflicting_supreme_session = true;
				}
				GT_ASSERT(
					rejected_conflicting_supreme_session,
					"Supreme Leader accession accepted a concurrent Council session"
				);
				bool rejected_invalid_supreme_leader = false;
				try {
					council_policy_validator.SetCouncilState( {
						false, 42, "", -1, -1, -1, Player::COUNCIL_VOTE_PENDING,
						false, false, false, false, 64, Player::SUPREME_RESPONSE_PENDING, false,
					} );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_supreme_leader = true;
				}
				GT_ASSERT(
					rejected_invalid_supreme_leader,
					"out-of-range Supreme Leader ID was accepted"
				);
				source.SetSocialEngineering( {{ "Democratic", "Green", "Knowledge", "Cybernetic" }} );
				source.SetDiplomaticRelation( 2, Player::DR_TREATY );
				source.SetDiplomaticOffer( 3, Player::DR_PACT );
				source.SetContacted( 6, true );
				source.SetExploredTile( 4, 2, true );
				source.SetInfiltrated( 4, true );
				const Player::diplomatic_trade_t trade = {
					25,
					"CentauriEcology",
					0,
					"IndustrialBase",
					6,
					-1,
					true,
					false,
					11,
					21,
				};
				source.SetDiplomaticTrade( 5, trade );
				const Player::diplomatic_trade_t commlink_trade = {
					0, "", 0, "", 6, -1,
				};
				source.SetDiplomaticTrade( 4, commlink_trade );
				Player::diplomatic_trade_t ultimatum = {};
				ultimatum.request_energy = 50;
				ultimatum.is_ultimatum = true;
				source.SetDiplomaticTrade( 8, ultimatum );
				Player::diplomatic_trade_t military_request = {};
				military_request.request_vendetta_player = 3;
				source.SetDiplomaticTrade( 9, military_request );
				const Player::diplomatic_loan_offer_t loan_offer = { false, 100, 6, 20 };
				const Player::diplomatic_loan_t loan = { 120, 6 };
				source.SetDiplomaticLoanOffer( 6, loan_offer );
				source.SetDiplomaticLoan( 7, loan );
				source.SetSubmissiveToId( 4 );
				source.SetSurrenderOfferToId( 6 );
				Player cloned( &source );
				GT_ASSERT(
					cloned.GetCleanMineralFacilities() == 3,
					"player clean mineral facility count was not cloned"
				);
				GT_ASSERT( cloned.GetMajorAtrocities() == 2, "player major atrocity count was not cloned" );
				GT_ASSERT( cloned.GetSanctionTurns() == 10, "player sanction duration was not cloned" );
				GT_ASSERT(
					cloned.GetIntegrityBlemishes() == 4,
					"player diplomatic integrity was not cloned"
				);
				GT_ASSERT(
					cloned.GetMindControlTotal() == 12,
					"player mind control total was not cloned"
				);
				GT_ASSERT(
					cloned.GetDiplomaticExcuseTurn( 5 ) == 44,
					"player diplomatic excuse was not cloned"
				);
				GT_ASSERT(
					cloned.GetDiplomaticGrievance( 6 ) == grievance,
					"player diplomatic grievance was not cloned"
				);
				GT_ASSERT(
					cloned.IsUnitDesignObsolete(
						"WorkshopP1_Infantry_Laser_NoArmor_FissionPlant"
					),
					"obsolete unit design state was not cloned"
				);
				GT_ASSERT(
					cloned.IsUnitDesignRetired(
						"WorkshopP1_Infantry_Laser_NoArmor_FissionPlant"
					),
					"retired unit design state was not cloned"
				);
				bool rejected_retired_reactivation = false;
				try {
					cloned.SetObsoleteUnitDesigns( {} );
				}
				catch ( const std::runtime_error& ) {
					rejected_retired_reactivation = true;
				}
				GT_ASSERT(
					rejected_retired_reactivation &&
						cloned.IsUnitDesignObsolete(
							"WorkshopP1_Infantry_Laser_NoArmor_FissionPlant"
						),
					"retired unit design was reactivated or partially mutated"
				);
				Player active_design( "Designer", Player::PR_SINGLE, nullptr, "Citizen" );
				bool rejected_active_retirement = false;
				try {
					active_design.SetRetiredUnitDesigns( {
						"WorkshopP1_Infantry_Laser_NoArmor_FissionPlant"
					} );
				}
				catch ( const std::runtime_error& ) {
					rejected_active_retirement = true;
				}
				GT_ASSERT(
					rejected_active_retirement && active_design.GetRetiredUnitDesigns().empty(),
					"active unit design was retired or partially mutated"
				);
				GT_ASSERT(
					cloned.GetOrbitalFacilityCount( "SkyHydroponicsLab" ) == 3,
					"player orbital facilities were not cloned"
				);
				GT_ASSERT(
					cloned.GetOrbitalDefenseDeployments() == 2,
					"player orbital defense deployments were not cloned"
				);
				GT_ASSERT(
					cloned.GetCouncilState() == council_state,
					"Planetary Council state was not cloned"
				);
				GT_ASSERT(
					cloned.GetDiplomaticTrade( 5 ) && *cloned.GetDiplomaticTrade( 5 ) == trade,
					"pending diplomatic trade was not cloned"
				);
				GT_ASSERT( cloned.HasContacted( 6 ), "player contact was not cloned" );
				GT_ASSERT( !cloned.HasContacted( 5 ), "missing player contact was cloned" );
				GT_ASSERT( cloned.HasExploredTile( 4, 2 ), "explored tile was not cloned" );
				GT_ASSERT( !cloned.HasExploredTile( 6, 2 ), "unexplored tile was cloned" );
				GT_ASSERT(
					cloned.GetDiplomaticTrade( 4 ) &&
						*cloned.GetDiplomaticTrade( 4 ) == commlink_trade,
					"commlink-only diplomatic trade was not cloned"
				);
				GT_ASSERT(
					cloned.GetDiplomaticTrade( 8 ) &&
						*cloned.GetDiplomaticTrade( 8 ) == ultimatum,
					"pending diplomatic ultimatum was not cloned"
				);
				GT_ASSERT(
					cloned.GetDiplomaticTrade( 9 ) &&
						*cloned.GetDiplomaticTrade( 9 ) == military_request,
					"pending military request was not cloned"
				);
				GT_ASSERT(
					cloned.GetDiplomaticLoanOffer( 6 ) &&
						*cloned.GetDiplomaticLoanOffer( 6 ) == loan_offer,
					"pending diplomatic loan offer was not cloned"
				);
				GT_ASSERT(
					cloned.GetDiplomaticLoan( 7 ) && *cloned.GetDiplomaticLoan( 7 ) == loan,
					"diplomatic loan was not cloned"
				);
				GT_ASSERT(
					cloned.GetSubmissiveToId() == 4 && cloned.GetSurrenderOfferToId() == 6,
					"diplomatic submission state was not cloned"
				);
				Player roundtrip( source.Serialize() );
				GT_ASSERT( roundtrip.HasTechnology( "CentauriEcology" ), "known technology was not serialized" );
				GT_ASSERT( roundtrip.GetResearchTarget().empty(), "completed research target was not serialized" );
				GT_ASSERT( roundtrip.GetResearchProgress() == 0, "completed research progress was not serialized" );
				GT_ASSERT( roundtrip.GetEnergyCredits() == 73, "player energy credits were not serialized" );
				GT_ASSERT(
					roundtrip.GetEcologicalDamageEvents() == 4,
					"player ecological damage event count was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetCleanMineralFacilities() == 3,
					"player clean mineral facility count was not serialized"
				);
				GT_ASSERT( roundtrip.GetMajorAtrocities() == 2, "player major atrocity count was not serialized" );
				GT_ASSERT( roundtrip.GetSanctionTurns() == 10, "player sanction duration was not serialized" );
				GT_ASSERT(
					roundtrip.GetIntegrityBlemishes() == 4,
					"player diplomatic integrity was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetMindControlTotal() == 12,
					"player mind control total was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetDiplomaticExcuseTurn( 5 ) == 44,
					"player diplomatic excuse was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetDiplomaticGrievance( 6 ) == grievance,
					"player diplomatic grievance was not serialized"
				);
				GT_ASSERT(
					roundtrip.IsUnitDesignObsolete(
						"WorkshopP1_Infantry_Laser_NoArmor_FissionPlant"
					),
					"obsolete unit design state was not serialized"
				);
				GT_ASSERT(
					roundtrip.IsUnitDesignRetired(
						"WorkshopP1_Infantry_Laser_NoArmor_FissionPlant"
					),
					"retired unit design state was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetOrbitalFacilityCount( "SkyHydroponicsLab" ) == 3,
					"player orbital facilities were not serialized"
				);
				GT_ASSERT(
					roundtrip.GetOrbitalDefenseDeployments() == 2,
					"player orbital defense deployments were not serialized"
				);
				GT_ASSERT(
					roundtrip.GetCouncilState() == council_state,
					"Planetary Council state was not serialized"
				);
				Player viewer( "Observer", Player::PR_SINGLE, nullptr, "Citizen" );
				Player redacted( source.Serialize( &viewer ) );
				GT_ASSERT( redacted.IsRedacted(), "foreign player projection was not marked redacted" );
				GT_ASSERT(
					redacted.GetTechnologies().empty() && redacted.GetResearchTarget().empty() &&
					redacted.GetResearchProgress() == 0 && redacted.GetEnergyCredits() == 0,
					"foreign player projection exposed research or energy"
				);
				const Player::social_engineering_t default_social_engineering =
					{{ "Frontier", "Simple", "Survival", "None" }};
				GT_ASSERT(
					redacted.GetSocialEngineering() == default_social_engineering &&
					redacted.GetEcologicalDamageEvents() == 0 &&
					redacted.GetCleanMineralFacilities() == 0 &&
					redacted.GetMindControlTotal() == 0,
					"foreign player projection exposed private economic state"
				);
				GT_ASSERT(
					redacted.GetDiplomaticRelations().empty() &&
					redacted.GetDiplomaticOffers().empty() &&
					redacted.GetDiplomaticTrades().empty() &&
					redacted.GetDiplomaticLoanOffers().empty() &&
					redacted.GetDiplomaticLoans().empty() &&
					redacted.GetDiplomaticExcuses().empty() &&
					redacted.GetDiplomaticGrievances().empty(),
					"foreign player projection exposed third-party diplomacy"
				);
				GT_ASSERT(
					redacted.GetInfiltratedPlayers().empty() &&
					redacted.GetPrototypedComponents().empty() &&
					redacted.GetObsoleteUnitDesigns().empty() &&
					redacted.GetRetiredUnitDesigns().empty() &&
					redacted.GetExploredTiles().empty(),
					"foreign player projection exposed intelligence or map state"
				);
				GT_ASSERT(
					redacted.GetMajorAtrocities() == 2 && redacted.GetSanctionTurns() == 10 &&
					redacted.GetIntegrityBlemishes() == 4 &&
					redacted.GetOrbitalFacilityCount( "SkyHydroponicsLab" ) == 3 &&
					redacted.GetOrbitalDefenseDeployments() == 2 &&
					redacted.GetCouncilState() == council_state &&
					redacted.GetSubmissiveToId() == 4 &&
					redacted.GetSurrenderOfferToId() == Player::NO_DIPLOMATIC_PLAYER,
					"foreign player projection lost public state or exposed a private surrender offer"
				);
				Player redacted_roundtrip( redacted.Serialize() );
				GT_ASSERT(
					redacted_roundtrip.IsRedacted() && redacted_roundtrip.GetEnergyCredits() == 0,
					"redacted player became authoritative when reserialized"
				);
				Player private_council_source( "Voter", Player::PR_SINGLE, nullptr, "Citizen" );
				private_council_source.SetCouncilState({
					false, 43, "trade_pact", 1, Player::COUNCIL_VOTE_YES,
					Player::COUNCIL_VOTE_NO, Player::COUNCIL_VOTE_YES,
					false, false, false, false,
				});
				Player private_vote( private_council_source.Serialize( &viewer ) );
				GT_ASSERT(
					private_vote.GetCouncilState().vote_id == Player::COUNCIL_VOTE_PENDING,
					"foreign player projection exposed an active Planetary Council ballot"
				);
				private_council_source.SetCouncilState({
					false, 43, "", -1, -1, -1, Player::COUNCIL_VOTE_PENDING,
					false, false, false, false, 2, Player::SUPREME_RESPONSE_DEFY, false,
				});
				Player private_supreme_response( private_council_source.Serialize( &viewer ) );
				GT_ASSERT(
					private_supreme_response.GetCouncilState().supreme_response ==
						Player::SUPREME_RESPONSE_PENDING,
					"foreign player projection exposed an unresolved Supreme Leader response"
				);
				viewer.SetInfiltrated( 0, true );
				Player infiltrated( source.Serialize( &viewer ) );
				GT_ASSERT(
					!infiltrated.IsRedacted() && infiltrated.GetEnergyCredits() == 73 &&
					infiltrated.HasTechnology( "CentauriEcology" ) &&
					infiltrated.GetExploredTiles() == source.GetExploredTiles(),
					"infiltrated player projection did not include private state"
				);
				Player self_view( source.Serialize( &source ) );
				GT_ASSERT(
					!self_view.IsRedacted() && self_view.GetEnergyCredits() == 73,
					"self player projection was redacted"
				);
				source.ClearDiplomaticTrade( 4 );
				source.ClearDiplomaticTrade( 8 );
				source.ClearDiplomaticTrade( 9 );
				types::Buffer bool_field;
				bool_field.WriteBool( true );
				const auto bool_field_size = bool_field.ToString().size();
				types::Buffer obsolete_designs_field;
				obsolete_designs_field.WriteInt( source.GetObsoleteUnitDesigns().size() );
				for ( const auto& id : source.GetObsoleteUnitDesigns() ) {
					obsolete_designs_field.WriteString( id );
				}
				const auto obsolete_designs_field_size = obsolete_designs_field.ToString().size();
				types::Buffer retired_designs_field;
				retired_designs_field.WriteInt( source.GetRetiredUnitDesigns().size() );
				for ( const auto& id : source.GetRetiredUnitDesigns() ) {
					retired_designs_field.WriteString( id );
				}
				const auto retired_designs_field_size = retired_designs_field.ToString().size();
				types::Buffer player_extension;
				player_extension.WriteInt( 5 );
				player_extension.WriteBool( false );
				player_extension.WriteInt( source.GetContactedPlayers().size() );
				for ( const auto player_id : source.GetContactedPlayers() ) {
					player_extension.WriteInt( player_id );
				}
				player_extension.WriteInt( 1 );
				player_extension.WriteInt( 5 );
				player_extension.WriteInt( trade.offer_contact );
				player_extension.WriteInt( trade.request_contact );
				player_extension.WriteBool( trade.offer_map );
				player_extension.WriteBool( trade.request_map );
				player_extension.WriteInt( trade.offer_base );
				player_extension.WriteInt( trade.request_base );
				player_extension.WriteBool( trade.is_ultimatum );
				player_extension.WriteInt( trade.request_vendetta_player );
				player_extension.WriteBool( false );
				player_extension.WriteInt( source.GetExploredTiles().size() );
				for ( const auto& [ x, y ] : source.GetExploredTiles() ) {
					player_extension.WriteInt( x );
					player_extension.WriteInt( y );
				}
				player_extension.WriteInt( source.GetCleanMineralFacilities() );
				player_extension.WriteBool( source.GetCouncilState().is_expelled );
				player_extension.WriteInt( source.GetCouncilState().supreme_leader_id );
				player_extension.WriteInt( source.GetCouncilState().supreme_response );
				player_extension.WriteBool( source.GetCouncilState().supreme_resolved );
				player_extension.WriteInt( source.GetSubmissiveToId() );
				player_extension.WriteInt( source.GetSurrenderOfferToId() );
				player_extension.WriteInt( source.GetMindControlTotal() );
				player_extension.WriteInt( source.GetDiplomaticExcuses().size() );
				for ( const auto& [ player_id, expiry_turn ] : source.GetDiplomaticExcuses() ) {
					player_extension.WriteInt( player_id );
					player_extension.WriteInt( expiry_turn );
				}
				player_extension.WriteInt( source.GetDiplomaticGrievances().size() );
				for ( const auto& [ player_id, state ] : source.GetDiplomaticGrievances() ) {
					player_extension.WriteInt( player_id );
					player_extension.WriteBool( state.wants_revenge );
					player_extension.WriteBool( state.atrocity_victim );
					player_extension.WriteBool( state.major_atrocity_victim );
				}
				const auto player_extension_size = player_extension.ToString().size();
				types::Buffer clean_mineral_facilities_field;
				clean_mineral_facilities_field.WriteInt( source.GetCleanMineralFacilities() );
				const auto clean_mineral_facilities_field_size =
					clean_mineral_facilities_field.ToString().size();
				types::Buffer council_expulsion_field;
				council_expulsion_field.WriteBool( source.GetCouncilState().is_expelled );
				const auto council_expulsion_field_size = council_expulsion_field.ToString().size();
				types::Buffer supreme_state_fields;
				supreme_state_fields.WriteInt( source.GetCouncilState().supreme_leader_id );
				supreme_state_fields.WriteInt( source.GetCouncilState().supreme_response );
				supreme_state_fields.WriteBool( source.GetCouncilState().supreme_resolved );
				const auto supreme_state_fields_size = supreme_state_fields.ToString().size();
				types::Buffer submission_state_fields;
				submission_state_fields.WriteInt( source.GetSubmissiveToId() );
				submission_state_fields.WriteInt( source.GetSurrenderOfferToId() );
				const auto submission_state_fields_size = submission_state_fields.ToString().size();
				types::Buffer mind_control_total_field;
				mind_control_total_field.WriteInt( source.GetMindControlTotal() );
				const auto mind_control_total_field_size =
					mind_control_total_field.ToString().size();
				types::Buffer diplomatic_excuses_field;
				diplomatic_excuses_field.WriteInt( source.GetDiplomaticExcuses().size() );
				for ( const auto& [ player_id, expiry_turn ] : source.GetDiplomaticExcuses() ) {
					diplomatic_excuses_field.WriteInt( player_id );
					diplomatic_excuses_field.WriteInt( expiry_turn );
				}
				const auto diplomatic_excuses_field_size =
					diplomatic_excuses_field.ToString().size();
				types::Buffer diplomatic_grievances_field;
				diplomatic_grievances_field.WriteInt( source.GetDiplomaticGrievances().size() );
				for ( const auto& [ player_id, state ] : source.GetDiplomaticGrievances() ) {
					diplomatic_grievances_field.WriteInt( player_id );
					diplomatic_grievances_field.WriteBool( state.wants_revenge );
					diplomatic_grievances_field.WriteBool( state.atrocity_victim );
					diplomatic_grievances_field.WriteBool( state.major_atrocity_victim );
				}
				const auto diplomatic_grievances_field_size =
					diplomatic_grievances_field.ToString().size();
				auto pre_diplomatic_grievances_data = source.Serialize().ToString();
				pre_diplomatic_grievances_data.resize(
					pre_diplomatic_grievances_data.size() - diplomatic_grievances_field_size
				);
				Player pre_diplomatic_grievances( pre_diplomatic_grievances_data );
				GT_ASSERT(
					pre_diplomatic_grievances.GetDiplomaticExcuseTurn( 5 ) == 44 &&
						pre_diplomatic_grievances.GetDiplomaticGrievances().empty(),
					"older player data did not default diplomatic grievances"
				);
				auto pre_diplomatic_excuses_data = source.Serialize().ToString();
				pre_diplomatic_excuses_data.resize(
					pre_diplomatic_excuses_data.size() - diplomatic_excuses_field_size -
						diplomatic_grievances_field_size
				);
				Player pre_diplomatic_excuses( pre_diplomatic_excuses_data );
				GT_ASSERT(
					pre_diplomatic_excuses.GetMindControlTotal() == 12 &&
						pre_diplomatic_excuses.GetDiplomaticExcuses().empty() &&
						pre_diplomatic_excuses.GetDiplomaticGrievances().empty(),
					"older player data did not default diplomatic excuses"
				);
				bool rejected_serialized_diplomatic_excuse = false;
				try {
					types::Buffer invalid_excuse;
					invalid_excuse.WriteInt( 1 );
					invalid_excuse.WriteInt( 5 );
					invalid_excuse.WriteInt( Player::MAX_DIPLOMATIC_EXCUSE_TURN + 1 );
					auto invalid_data = pre_diplomatic_excuses_data + invalid_excuse.ToString();
					Player invalid( invalid_data );
				}
				catch ( const std::runtime_error& ) {
					rejected_serialized_diplomatic_excuse = true;
				}
				GT_ASSERT(
					rejected_serialized_diplomatic_excuse,
					"out-of-range serialized diplomatic excuse was accepted"
				);
				bool rejected_duplicate_diplomatic_excuse = false;
				try {
					types::Buffer duplicate_excuse;
					duplicate_excuse.WriteInt( 2 );
					duplicate_excuse.WriteInt( 5 );
					duplicate_excuse.WriteInt( 44 );
					duplicate_excuse.WriteInt( 5 );
					duplicate_excuse.WriteInt( 45 );
					auto invalid_data = pre_diplomatic_excuses_data + duplicate_excuse.ToString();
					Player invalid( invalid_data );
				}
				catch ( const std::runtime_error& ) {
					rejected_duplicate_diplomatic_excuse = true;
				}
				GT_ASSERT(
					rejected_duplicate_diplomatic_excuse,
					"duplicate serialized diplomatic excuse was accepted"
				);
				bool rejected_inconsistent_diplomatic_grievance = false;
				try {
					types::Buffer invalid_grievance;
					invalid_grievance.WriteInt( 1 );
					invalid_grievance.WriteInt( 6 );
					invalid_grievance.WriteBool( false );
					invalid_grievance.WriteBool( true );
					invalid_grievance.WriteBool( false );
					auto invalid_data =
						pre_diplomatic_grievances_data + invalid_grievance.ToString();
					Player invalid( invalid_data );
				}
				catch ( const std::runtime_error& ) {
					rejected_inconsistent_diplomatic_grievance = true;
				}
				GT_ASSERT(
					rejected_inconsistent_diplomatic_grievance,
					"inconsistent serialized diplomatic grievance was accepted"
				);
				bool rejected_duplicate_diplomatic_grievance = false;
				try {
					types::Buffer duplicate_grievance;
					duplicate_grievance.WriteInt( 2 );
					for ( size_t i = 0 ; i < 2 ; ++i ) {
						duplicate_grievance.WriteInt( 6 );
						duplicate_grievance.WriteBool( true );
						duplicate_grievance.WriteBool( false );
						duplicate_grievance.WriteBool( false );
					}
					auto invalid_data =
						pre_diplomatic_grievances_data + duplicate_grievance.ToString();
					Player invalid( invalid_data );
				}
				catch ( const std::runtime_error& ) {
					rejected_duplicate_diplomatic_grievance = true;
				}
				GT_ASSERT(
					rejected_duplicate_diplomatic_grievance,
					"duplicate serialized diplomatic grievance was accepted"
				);
				auto pre_submission_data = source.Serialize().ToString();
				pre_submission_data.resize(
					pre_submission_data.size() - submission_state_fields_size -
						mind_control_total_field_size - diplomatic_excuses_field_size -
						diplomatic_grievances_field_size
				);
				Player pre_submission( pre_submission_data );
				GT_ASSERT(
					pre_submission.GetSubmissiveToId() == Player::NO_DIPLOMATIC_PLAYER &&
						pre_submission.GetSurrenderOfferToId() == Player::NO_DIPLOMATIC_PLAYER &&
						pre_submission.GetMindControlTotal() == 0,
					"older player data did not default diplomatic submission state"
				);
				auto pre_supreme_data = source.Serialize().ToString();
				pre_supreme_data.resize(
					pre_supreme_data.size() - submission_state_fields_size -
						supreme_state_fields_size - mind_control_total_field_size -
						diplomatic_excuses_field_size - diplomatic_grievances_field_size
				);
				Player pre_supreme( pre_supreme_data );
				GT_ASSERT(
					pre_supreme.GetCouncilState().is_expelled &&
					pre_supreme.GetCouncilState().supreme_leader_id == -1 &&
					pre_supreme.GetCouncilState().supreme_response ==
						Player::SUPREME_RESPONSE_NONE &&
					!pre_supreme.GetCouncilState().supreme_resolved,
					"older player data did not default Supreme Leader state"
				);
				auto pre_expulsion_data = source.Serialize().ToString();
				pre_expulsion_data.resize(
					pre_expulsion_data.size() - council_expulsion_field_size -
						supreme_state_fields_size - submission_state_fields_size -
						mind_control_total_field_size - diplomatic_excuses_field_size -
						diplomatic_grievances_field_size
				);
				Player pre_expulsion( pre_expulsion_data );
				GT_ASSERT(
					!pre_expulsion.GetCouncilState().is_expelled &&
					pre_expulsion.GetCleanMineralFacilities() == 3,
					"older player data did not default Council expulsion state"
				);
				auto pre_clean_mineral_data = source.Serialize().ToString();
				pre_clean_mineral_data.resize(
					pre_clean_mineral_data.size() - clean_mineral_facilities_field_size -
						council_expulsion_field_size - supreme_state_fields_size -
						submission_state_fields_size - mind_control_total_field_size -
						diplomatic_excuses_field_size - diplomatic_grievances_field_size
				);
				Player pre_clean_mineral( pre_clean_mineral_data );
				GT_ASSERT(
					pre_clean_mineral.GetCleanMineralFacilities() == 0,
					"older player data did not default its clean mineral facility count"
				);
				types::Buffer version_one_extension;
				version_one_extension.WriteInt( 1 );
				version_one_extension.WriteBool( false );
				version_one_extension.WriteInt( source.GetContactedPlayers().size() );
				for ( const auto player_id : source.GetContactedPlayers() ) {
					version_one_extension.WriteInt( player_id );
				}
				version_one_extension.WriteInt( 1 );
				version_one_extension.WriteInt( 5 );
				version_one_extension.WriteInt( trade.offer_contact );
				version_one_extension.WriteInt( trade.request_contact );
				auto version_one_data = source.Serialize().ToString();
				version_one_data.resize( version_one_data.size() - player_extension_size );
				version_one_data += version_one_extension.ToString();
				Player version_one( version_one_data );
				GT_ASSERT(
					version_one.HasExploredTile( 100, 100 ),
					"version-one player data did not preserve legacy map visibility"
				);
				GT_ASSERT(
					version_one.GetCleanMineralFacilities() == 0,
					"version-one player data did not default its clean mineral facility count"
				);
				GT_ASSERT(
					version_one.GetDiplomaticTrade( 5 ) &&
					!version_one.GetDiplomaticTrade( 5 )->offer_map &&
					version_one.GetDiplomaticTrade( 5 )->offer_base == -1 &&
					version_one.GetDiplomaticTrade( 5 )->request_base == -1 &&
					version_one.GetDiplomaticTrade( 5 )->request_vendetta_player == -1 &&
					!version_one.GetDiplomaticTrade( 5 )->is_ultimatum,
					"version-one diplomatic trade unexpectedly gained a map term"
				);
				types::Buffer version_two_extension;
				version_two_extension.WriteInt( 2 );
				version_two_extension.WriteBool( false );
				version_two_extension.WriteInt( source.GetContactedPlayers().size() );
				for ( const auto player_id : source.GetContactedPlayers() ) {
					version_two_extension.WriteInt( player_id );
				}
				version_two_extension.WriteInt( 1 );
				version_two_extension.WriteInt( 5 );
				version_two_extension.WriteInt( trade.offer_contact );
				version_two_extension.WriteInt( trade.request_contact );
				version_two_extension.WriteBool( trade.offer_map );
				version_two_extension.WriteBool( trade.request_map );
				version_two_extension.WriteBool( false );
				version_two_extension.WriteInt( source.GetExploredTiles().size() );
				for ( const auto& [ x, y ] : source.GetExploredTiles() ) {
					version_two_extension.WriteInt( x );
					version_two_extension.WriteInt( y );
				}
				auto version_two_data = source.Serialize().ToString();
				version_two_data.resize( version_two_data.size() - player_extension_size );
				version_two_data += version_two_extension.ToString();
				Player version_two( version_two_data );
				GT_ASSERT(
					version_two.GetDiplomaticTrade( 5 ) &&
					version_two.GetDiplomaticTrade( 5 )->offer_map == trade.offer_map &&
					version_two.GetDiplomaticTrade( 5 )->request_map == trade.request_map &&
					version_two.GetDiplomaticTrade( 5 )->offer_base == -1 &&
					version_two.GetDiplomaticTrade( 5 )->request_base == -1 &&
					version_two.GetDiplomaticTrade( 5 )->request_vendetta_player == -1 &&
					!version_two.GetDiplomaticTrade( 5 )->is_ultimatum,
					"version-two diplomatic trade did not preserve map terms or default base terms"
				);
				types::Buffer version_three_extension;
				version_three_extension.WriteInt( 3 );
				version_three_extension.WriteBool( false );
				version_three_extension.WriteInt( source.GetContactedPlayers().size() );
				for ( const auto player_id : source.GetContactedPlayers() ) {
					version_three_extension.WriteInt( player_id );
				}
				version_three_extension.WriteInt( 1 );
				version_three_extension.WriteInt( 5 );
				version_three_extension.WriteInt( trade.offer_contact );
				version_three_extension.WriteInt( trade.request_contact );
				version_three_extension.WriteBool( trade.offer_map );
				version_three_extension.WriteBool( trade.request_map );
				version_three_extension.WriteInt( trade.offer_base );
				version_three_extension.WriteInt( trade.request_base );
				version_three_extension.WriteBool( false );
				version_three_extension.WriteInt( source.GetExploredTiles().size() );
				for ( const auto& [ x, y ] : source.GetExploredTiles() ) {
					version_three_extension.WriteInt( x );
					version_three_extension.WriteInt( y );
				}
				auto version_three_data = source.Serialize().ToString();
				version_three_data.resize( version_three_data.size() - player_extension_size );
				version_three_data += version_three_extension.ToString();
				Player version_three( version_three_data );
				GT_ASSERT(
					version_three.GetDiplomaticTrade( 5 ) &&
					version_three.GetDiplomaticTrade( 5 )->offer_base == trade.offer_base &&
					version_three.GetDiplomaticTrade( 5 )->request_base == trade.request_base &&
					version_three.GetDiplomaticTrade( 5 )->request_vendetta_player == -1 &&
					!version_three.GetDiplomaticTrade( 5 )->is_ultimatum,
					"version-three diplomatic trade did not preserve bases or default ultimatum state"
				);
				types::Buffer version_four_extension;
				version_four_extension.WriteInt( 4 );
				version_four_extension.WriteBool( false );
				version_four_extension.WriteInt( source.GetContactedPlayers().size() );
				for ( const auto player_id : source.GetContactedPlayers() ) {
					version_four_extension.WriteInt( player_id );
				}
				version_four_extension.WriteInt( 1 );
				version_four_extension.WriteInt( 5 );
				version_four_extension.WriteInt( trade.offer_contact );
				version_four_extension.WriteInt( trade.request_contact );
				version_four_extension.WriteBool( trade.offer_map );
				version_four_extension.WriteBool( trade.request_map );
				version_four_extension.WriteInt( trade.offer_base );
				version_four_extension.WriteInt( trade.request_base );
				version_four_extension.WriteBool( trade.is_ultimatum );
				version_four_extension.WriteBool( false );
				version_four_extension.WriteInt( source.GetExploredTiles().size() );
				for ( const auto& [ x, y ] : source.GetExploredTiles() ) {
					version_four_extension.WriteInt( x );
					version_four_extension.WriteInt( y );
				}
				auto version_four_data = source.Serialize().ToString();
				version_four_data.resize( version_four_data.size() - player_extension_size );
				version_four_data += version_four_extension.ToString();
				Player version_four( version_four_data );
				GT_ASSERT(
					version_four.GetDiplomaticTrade( 5 ) &&
					version_four.GetDiplomaticTrade( 5 )->is_ultimatum == trade.is_ultimatum &&
					version_four.GetDiplomaticTrade( 5 )->request_vendetta_player == -1,
					"version-four diplomatic trade did not default military request state"
				);
				auto pre_retirement_data = source.Serialize().ToString();
				pre_retirement_data.resize(
					pre_retirement_data.size() - player_extension_size - retired_designs_field_size
				);
				Player pre_retirement( pre_retirement_data );
				GT_ASSERT(
					pre_retirement.IsUnitDesignObsolete(
						"WorkshopP1_Infantry_Laser_NoArmor_FissionPlant"
					) &&
					!pre_retirement.IsUnitDesignRetired(
						"WorkshopP1_Infantry_Laser_NoArmor_FissionPlant"
					),
					"pre-retirement player data did not preserve obsolete design state"
				);
				auto trade_only_council_data = source.Serialize().ToString();
				trade_only_council_data.resize(
					trade_only_council_data.size() - player_extension_size - retired_designs_field_size -
						obsolete_designs_field_size -
						bool_field_size * 2
				);
				Player trade_only_council( trade_only_council_data );
				GT_ASSERT(
					trade_only_council.GetCouncilState().global_trade_pact &&
					!trade_only_council.GetCouncilState().unity_core_salvaged &&
					!trade_only_council.GetCouncilState().un_charter_repealed,
					"older Planetary Council state did not preserve the Trade Pact defaults"
				);
				auto legacy_council_data = source.Serialize().ToString();
				legacy_council_data.resize(
					legacy_council_data.size() - player_extension_size - retired_designs_field_size -
						obsolete_designs_field_size -
						bool_field_size * 3
				);
				Player legacy_council( legacy_council_data );
				GT_ASSERT(
					!legacy_council.GetCouncilState().global_trade_pact &&
					!legacy_council.GetCouncilState().unity_core_salvaged &&
					!legacy_council.GetCouncilState().un_charter_repealed &&
					!legacy_council.GetCouncilState().is_expelled,
					"legacy Planetary Council policies did not default to their initial state"
				);
				GT_ASSERT(
					roundtrip.GetSocialEngineering() == source.GetSocialEngineering(),
					"player social engineering choices were not serialized"
				);
				GT_ASSERT(
					roundtrip.GetDiplomaticRelation( 2 ) == Player::DR_TREATY,
					"player diplomatic relation was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetDiplomaticRelation( 3 ) == Player::DR_NEUTRAL,
					"missing player diplomatic relation was not neutral"
				);
				GT_ASSERT(
					roundtrip.GetDiplomaticOffer( 3 ) == Player::DR_PACT,
					"pending diplomatic offer was not serialized"
				);
				GT_ASSERT( roundtrip.HasInfiltrated( 4 ), "player infiltration was not serialized" );
				GT_ASSERT( !roundtrip.HasInfiltrated( 5 ), "missing player infiltration was present" );
				GT_ASSERT( roundtrip.HasContacted( 6 ), "player contact was not serialized" );
				GT_ASSERT( !roundtrip.HasContacted( 5 ), "missing player contact was serialized" );
				GT_ASSERT( roundtrip.HasExploredTile( 4, 2 ), "explored tile was not serialized" );
				GT_ASSERT( !roundtrip.HasExploredTile( 6, 2 ), "unexplored tile was serialized" );
				GT_ASSERT(
					roundtrip.GetDiplomaticTrade( 5 ) && *roundtrip.GetDiplomaticTrade( 5 ) == trade,
					"pending diplomatic trade was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetDiplomaticTrade( 4 ) &&
						*roundtrip.GetDiplomaticTrade( 4 ) == commlink_trade,
					"commlink-only diplomatic trade was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetDiplomaticTrade( 8 ) &&
						*roundtrip.GetDiplomaticTrade( 8 ) == ultimatum,
					"pending diplomatic ultimatum was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetDiplomaticTrade( 9 ) &&
						*roundtrip.GetDiplomaticTrade( 9 ) == military_request,
					"pending military request was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetDiplomaticLoanOffer( 6 ) &&
						*roundtrip.GetDiplomaticLoanOffer( 6 ) == loan_offer,
					"pending diplomatic loan offer was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetDiplomaticLoan( 7 ) && *roundtrip.GetDiplomaticLoan( 7 ) == loan,
					"diplomatic loan was not serialized"
				);
				GT_ASSERT(
					roundtrip.GetSubmissiveToId() == 4 &&
						roundtrip.GetSurrenderOfferToId() == 6,
					"diplomatic submission state was not serialized"
				);
				bool rejected_invalid_submission_player = false;
				try {
					roundtrip.SetSubmissiveToId( 64 );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_submission_player = true;
				}
				GT_ASSERT(
					rejected_invalid_submission_player && roundtrip.GetSubmissiveToId() == 4,
					"out-of-range submission player ID was accepted or partially mutated"
				);
				bool rejected_invalid_mind_control_total = false;
				try {
					roundtrip.SetMindControlTotal( Player::MAX_MIND_CONTROL_TOTAL + 1 );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_mind_control_total = true;
				}
				GT_ASSERT(
					rejected_invalid_mind_control_total && roundtrip.GetMindControlTotal() == 12,
					"out-of-range mind control total was accepted or partially mutated"
				);
				bool rejected_invalid_diplomatic_excuse = false;
				try {
					roundtrip.SetDiplomaticExcuseTurn(
						5,
						Player::MAX_DIPLOMATIC_EXCUSE_TURN + 1
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_diplomatic_excuse = true;
				}
				GT_ASSERT(
					rejected_invalid_diplomatic_excuse &&
						roundtrip.GetDiplomaticExcuseTurn( 5 ) == 44,
					"out-of-range diplomatic excuse was accepted or partially mutated"
				);
				roundtrip.SetDiplomaticExcuseTurn( 5, Player::NO_DIPLOMATIC_EXCUSE );
				GT_ASSERT(
					roundtrip.GetDiplomaticExcuses().empty(),
					"cleared diplomatic excuse was retained"
				);
				bool rejected_inconsistent_grievance = false;
				try {
					roundtrip.SetDiplomaticGrievance( 6, { false, true, false } );
				}
				catch ( const std::runtime_error& ) {
					rejected_inconsistent_grievance = true;
				}
				GT_ASSERT(
					rejected_inconsistent_grievance &&
						roundtrip.GetDiplomaticGrievance( 6 ) == grievance,
					"inconsistent diplomatic grievance was accepted or partially mutated"
				);
				roundtrip.SetDiplomaticGrievance( 6, {} );
				GT_ASSERT(
					roundtrip.GetDiplomaticGrievances().empty(),
					"cleared diplomatic grievance was retained"
				);
				roundtrip.ClearDiplomaticTrade( 5 );
				roundtrip.ClearDiplomaticTrade( 4 );
				roundtrip.ClearDiplomaticTrade( 8 );
				roundtrip.ClearDiplomaticTrade( 9 );
				GT_ASSERT( roundtrip.GetDiplomaticTrades().empty(), "cleared diplomatic trade was retained" );
				roundtrip.ClearDiplomaticLoanOffer( 6 );
				roundtrip.ClearDiplomaticLoan( 7 );
				GT_ASSERT(
					roundtrip.GetDiplomaticLoanOffers().empty() && roundtrip.GetDiplomaticLoans().empty(),
					"cleared diplomatic loan state was retained"
				);
				roundtrip.SetInfiltrated( 4, false );
				GT_ASSERT(
					roundtrip.GetInfiltratedPlayers().empty(),
					"cleared player infiltration was retained"
				);
				roundtrip.SetDiplomaticRelation( 2, Player::DR_NEUTRAL );
				GT_ASSERT(
					roundtrip.GetDiplomaticRelations().empty(),
					"neutral diplomatic relation was retained"
				);

				Player ai_source( "Computer", Player::PR_AI, nullptr, "Citizen" );
				Player ai_roundtrip( ai_source.Serialize() );
				GT_ASSERT( ai_roundtrip.IsAI(), "AI player role was not serialized" );
				Player native_source( "Planet", Player::PR_NATIVE, nullptr, "Citizen" );
				Player native_roundtrip( native_source.Serialize() );
				GT_ASSERT( native_roundtrip.IsNative(), "native player role was not serialized" );
				GT_ASSERT( !native_roundtrip.IsAI(), "native player was exposed as normal AI" );

				const auto make_player = [](
					const std::vector< std::string >& technologies,
					const std::string& target,
					const int64_t progress
				) {
					types::Buffer player;
					player.WriteString( "Researcher" );
					player.WriteInt( Player::PR_SINGLE );
					player.WriteBool( false );
					player.WriteString( "Citizen" );
					player.WriteBool( false );
					player.WriteInt( technologies.size() );
					for ( const auto& id : technologies ) {
						player.WriteString( id );
					}
					player.WriteString( target );
					player.WriteInt( progress );
					return player;
				};

				bool rejected_duplicate = false;
				try {
					Player invalid( make_player(
						{ "CentauriEcology", "CentauriEcology" },
						"",
						0
					) );
				}
				catch ( const std::runtime_error& ) {
					rejected_duplicate = true;
				}
				GT_ASSERT( rejected_duplicate, "duplicate player technology accepted" );

				bool rejected_known_target = false;
				try {
					Player invalid( make_player(
						{ "CentauriEcology" },
						"CentauriEcology",
						1
					) );
				}
				catch ( const std::runtime_error& ) {
					rejected_known_target = true;
				}
				GT_ASSERT( rejected_known_target, "known technology accepted as research target" );

				bool rejected_negative_progress = false;
				try {
					Player invalid( make_player( {}, "CentauriEcology", -1 ) );
				}
				catch ( const std::runtime_error& ) {
					rejected_negative_progress = true;
				}
				GT_ASSERT( rejected_negative_progress, "negative player research progress accepted" );

				bool rejected_negative_energy = false;
				try {
					auto player = make_player( {}, "", 0 );
					player.WriteInt( -1 );
					Player invalid( player );
				}
				catch ( const std::runtime_error& ) {
					rejected_negative_energy = true;
				}
				GT_ASSERT( rejected_negative_energy, "negative player energy credits accepted" );

				bool rejected_social_count = false;
				try {
					auto player = make_player( {}, "", 0 );
					player.WriteInt( 0 );
					player.WriteInt( 3 );
					player.WriteString( "Frontier" );
					player.WriteString( "Simple" );
					player.WriteString( "Survival" );
					Player invalid( player );
				}
				catch ( const std::runtime_error& ) {
					rejected_social_count = true;
				}
				GT_ASSERT( rejected_social_count, "invalid player social engineering choice count accepted" );

				bool rejected_negative_ecological_damage_events = false;
				try {
					auto player = make_player( {}, "", 0 );
					player.WriteInt( 0 );
					player.WriteInt( Player::SOCIAL_ENGINEERING_CATEGORY_COUNT );
					player.WriteString( "Frontier" );
					player.WriteString( "Simple" );
					player.WriteString( "Survival" );
					player.WriteString( "None" );
					player.WriteInt( -1 );
					Player invalid( player );
				}
				catch ( const std::runtime_error& ) {
					rejected_negative_ecological_damage_events = true;
				}
				GT_ASSERT(
					rejected_negative_ecological_damage_events,
					"negative player ecological damage event count accepted"
				);

				const auto make_diplomatic_player = [ &make_player ]() {
					auto player = make_player( {}, "", 0 );
					player.WriteInt( 0 );
					player.WriteInt( Player::SOCIAL_ENGINEERING_CATEGORY_COUNT );
					player.WriteString( "Frontier" );
					player.WriteString( "Simple" );
					player.WriteString( "Survival" );
					player.WriteString( "None" );
					player.WriteInt( 0 );
					return player;
				};
				Player legacy( make_diplomatic_player() );
				GT_ASSERT(
					legacy.HasContacted( 63 ),
					"legacy player data did not preserve unrestricted diplomacy"
				);
				GT_ASSERT(
					legacy.GetMajorAtrocities() == 0,
					"legacy player major atrocity count did not default to zero"
				);
				GT_ASSERT(
					legacy.GetDiplomaticTrades().empty(),
					"legacy player diplomatic trades did not default to empty"
				);
				GT_ASSERT(
					legacy.GetDiplomaticLoanOffers().empty() && legacy.GetDiplomaticLoans().empty(),
					"legacy player diplomatic loans did not default to empty"
				);
				GT_ASSERT( legacy.GetSanctionTurns() == 0, "legacy player sanctions did not default to zero" );
				GT_ASSERT(
					legacy.GetIntegrityBlemishes() == 0,
					"legacy player diplomatic integrity did not default to noble"
				);
				GT_ASSERT(
					legacy.GetMindControlTotal() == 0,
					"legacy player mind control total did not default to zero"
				);
				GT_ASSERT(
					legacy.GetDiplomaticExcuses().empty(),
					"legacy player diplomatic excuses did not default to empty"
				);
				GT_ASSERT(
					legacy.GetDiplomaticGrievances().empty(),
					"legacy player diplomatic grievances did not default to empty"
				);
				GT_ASSERT(
					legacy.GetOrbitalFacilities().empty(),
					"legacy player orbital facilities did not default to empty"
				);
				GT_ASSERT(
					legacy.GetOrbitalDefenseDeployments() == 0,
					"legacy player orbital defense deployments did not default to zero"
				);
				GT_ASSERT(
					legacy.GetCouncilState() == Player::council_state_t{},
					"legacy Planetary Council state did not default to inactive"
				);
				bool rejected_duplicate_relation = false;
				try {
					auto player = make_diplomatic_player();
					player.WriteInt( 2 );
					player.WriteInt( 1 );
					player.WriteInt( Player::DR_TREATY );
					player.WriteInt( 1 );
					player.WriteInt( Player::DR_PACT );
					Player invalid( player );
				}
				catch ( const std::runtime_error& ) {
					rejected_duplicate_relation = true;
				}
				GT_ASSERT( rejected_duplicate_relation, "duplicate diplomatic relation accepted" );

				bool rejected_invalid_relation = false;
				try {
					auto player = make_diplomatic_player();
					player.WriteInt( 1 );
					player.WriteInt( 1 );
					player.WriteInt( 99 );
					Player invalid( player );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_relation = true;
				}
				GT_ASSERT( rejected_invalid_relation, "invalid diplomatic relation accepted" );

				bool rejected_duplicate_infiltration = false;
				try {
					auto player = make_diplomatic_player();
					player.WriteInt( 0 );
					player.WriteInt( 0 );
					player.WriteInt( 2 );
					player.WriteInt( 1 );
					player.WriteInt( 1 );
					Player invalid( player );
				}
				catch ( const std::runtime_error& ) {
					rejected_duplicate_infiltration = true;
				}
				GT_ASSERT( rejected_duplicate_infiltration, "duplicate player infiltration accepted" );

				bool rejected_invalid_infiltration = false;
				try {
					auto player = make_diplomatic_player();
					player.WriteInt( 0 );
					player.WriteInt( 0 );
					player.WriteInt( 1 );
					player.WriteInt( Player::MAX_INFILTRATED_PLAYERS );
					Player invalid( player );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_infiltration = true;
				}
				GT_ASSERT( rejected_invalid_infiltration, "invalid player infiltration accepted" );

				bool rejected_invalid_major_atrocities = false;
				try {
					auto player = make_diplomatic_player();
					player.WriteInt( 0 );
					player.WriteInt( 0 );
					player.WriteInt( 0 );
					player.WriteInt( Player::MAX_MAJOR_ATROCITIES + 1 );
					Player invalid( player );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_major_atrocities = true;
				}
				GT_ASSERT( rejected_invalid_major_atrocities, "invalid player major atrocity count accepted" );

				bool rejected_empty_trade = false;
				try {
					Player invalid( "Trader", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetDiplomaticTrade( 1, {} );
				}
				catch ( const std::runtime_error& ) {
					rejected_empty_trade = true;
				}
				GT_ASSERT( rejected_empty_trade, "empty diplomatic trade accepted" );

				bool rejected_bidirectional_energy_trade = false;
				try {
					Player invalid( "Trader", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetDiplomaticTrade( 1, { 10, "", 10, "" } );
				}
				catch ( const std::runtime_error& ) {
					rejected_bidirectional_energy_trade = true;
				}
				GT_ASSERT(
					rejected_bidirectional_energy_trade,
					"bidirectional diplomatic energy trade accepted"
				);

				bool rejected_invalid_trade_base = false;
				try {
					Player invalid( "Trader", Player::PR_SINGLE, nullptr, "Citizen" );
					Player::diplomatic_trade_t invalid_trade = {};
					invalid_trade.offer_base = Player::MAX_DIPLOMATIC_TRADE_BASE_ID + 1;
					invalid.SetDiplomaticTrade( 1, invalid_trade );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_trade_base = true;
				}
				GT_ASSERT(
					rejected_invalid_trade_base,
					"out-of-range diplomatic trade base ID accepted"
				);

				bool rejected_invalid_military_request = false;
				try {
					Player invalid( "Commander", Player::PR_SINGLE, nullptr, "Citizen" );
					Player::diplomatic_trade_t invalid_request = {};
					invalid_request.request_vendetta_player = 64;
					invalid.SetDiplomaticTrade( 1, invalid_request );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_military_request = true;
				}
				GT_ASSERT(
					rejected_invalid_military_request,
					"out-of-range military request player ID accepted"
				);

				bool rejected_bundled_military_request = false;
				try {
					Player invalid( "Commander", Player::PR_SINGLE, nullptr, "Citizen" );
					Player::diplomatic_trade_t invalid_request = {};
					invalid_request.request_vendetta_player = 3;
					invalid_request.offer_energy = 10;
					invalid.SetDiplomaticTrade( 1, invalid_request );
				}
				catch ( const std::runtime_error& ) {
					rejected_bundled_military_request = true;
				}
				GT_ASSERT(
					rejected_bundled_military_request,
					"military request bundled with trade terms was accepted"
				);

				bool rejected_invalid_ultimatum = false;
				try {
					Player invalid( "Demander", Player::PR_SINGLE, nullptr, "Citizen" );
					Player::diplomatic_trade_t invalid_ultimatum = {};
					invalid_ultimatum.offer_energy = 10;
					invalid_ultimatum.request_energy = 25;
					invalid_ultimatum.is_ultimatum = true;
					invalid.SetDiplomaticTrade( 1, invalid_ultimatum );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_ultimatum = true;
				}
				GT_ASSERT(
					rejected_invalid_ultimatum,
					"bundled diplomatic ultimatum accepted"
				);
				Player valid_demander( "Demander", Player::PR_SINGLE, nullptr, "Citizen" );
				Player::diplomatic_trade_t energy_ultimatum = {};
				energy_ultimatum.request_energy = 25;
				energy_ultimatum.is_ultimatum = true;
				valid_demander.SetDiplomaticTrade( 1, energy_ultimatum );
				Player::diplomatic_trade_t technology_ultimatum = {};
				technology_ultimatum.request_technology = "CentauriEcology";
				technology_ultimatum.is_ultimatum = true;
				valid_demander.SetDiplomaticTrade( 2, technology_ultimatum );
				GT_ASSERT(
					valid_demander.GetDiplomaticTrade( 1 )->is_ultimatum &&
					valid_demander.GetDiplomaticTrade( 2 )->is_ultimatum,
					"valid diplomatic ultimatum was not retained"
				);

				bool rejected_underfunded_loan_offer = false;
				try {
					Player invalid( "Borrower", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetDiplomaticLoanOffer( 1, { false, 100, 4, 20 } );
				}
				catch ( const std::runtime_error& ) {
					rejected_underfunded_loan_offer = true;
				}
				GT_ASSERT( rejected_underfunded_loan_offer, "underfunded diplomatic loan offer accepted" );

				bool rejected_empty_loan = false;
				try {
					Player invalid( "Borrower", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetDiplomaticLoan( 1, {} );
				}
				catch ( const std::runtime_error& ) {
					rejected_empty_loan = true;
				}
				GT_ASSERT( rejected_empty_loan, "empty diplomatic loan accepted" );

				bool rejected_invalid_sanctions = false;
				try {
					Player invalid( "Sanctioned", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetSanctionTurns( Player::MAX_SANCTION_TURNS + 1 );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_sanctions = true;
				}
				GT_ASSERT( rejected_invalid_sanctions, "invalid sanction duration accepted" );

				bool rejected_invalid_integrity = false;
				try {
					Player invalid( "Untrustworthy", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetIntegrityBlemishes( Player::MAX_INTEGRITY_BLEMISHES + 1 );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_integrity = true;
				}
				GT_ASSERT( rejected_invalid_integrity, "invalid diplomatic integrity accepted" );

				bool rejected_invalid_orbital_count = false;
				try {
					Player invalid( "Orbital", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetOrbitalFacilityCount(
						"SkyHydroponicsLab",
						Player::MAX_ORBITAL_FACILITY_COUNT + 1
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_orbital_count = true;
				}
				GT_ASSERT( rejected_invalid_orbital_count, "invalid orbital facility count accepted" );

				bool rejected_invalid_orbital_deployments = false;
				try {
					Player invalid( "Orbital", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetOrbitalDefenseDeployments( Player::MAX_ORBITAL_FACILITY_COUNT + 1 );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_orbital_deployments = true;
				}
				GT_ASSERT(
					rejected_invalid_orbital_deployments,
					"invalid orbital defense deployment count accepted"
				);

				bool rejected_invalid_council_vote = false;
				try {
					Player invalid( "Delegate", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetCouncilState( { false, 12, "governor", 1, 1, 2, 3 } );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_council_vote = true;
				}
				GT_ASSERT( rejected_invalid_council_vote, "invalid Planetary Council vote accepted" );

				Player valid_policy( "Delegate", Player::PR_SINGLE, nullptr, "Citizen" );
				valid_policy.SetCouncilState( {
					false,
					12,
					"repeal_un_charter",
					1,
					Player::COUNCIL_VOTE_YES,
					Player::COUNCIL_VOTE_NO,
					Player::COUNCIL_VOTE_ABSTAIN,
					false,
					false,
					false,
				} );
				GT_ASSERT(
					valid_policy.GetCouncilState().proposal == "repeal_un_charter",
					"supported Planetary Council policy was rejected"
				);

				bool rejected_invalid_council_policy = false;
				try {
					Player invalid( "Delegate", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetCouncilState( {
						false,
						12,
						"trade_pact",
						1,
						2,
						0,
						Player::COUNCIL_VOTE_YES,
						false,
					} );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_council_policy = true;
				}
				GT_ASSERT(
					rejected_invalid_council_policy,
					"invalid Planetary Council policy choices accepted"
				);

				bool rejected_inactive_council_session_data = false;
				try {
					Player invalid( "Delegate", Player::PR_SINGLE, nullptr, "Citizen" );
					invalid.SetCouncilState( { false, 12, "", 1, -1, -1, Player::COUNCIL_VOTE_PENDING } );
				}
				catch ( const std::runtime_error& ) {
					rejected_inactive_council_session_data = true;
				}
				GT_ASSERT(
					rejected_inactive_council_session_data,
					"inactive Planetary Council session data accepted"
				);
				Game::victory_type_t victory_type = Game::VT_NONE;
				GT_ASSERT(
					Game::ParseVictoryType( "diplomatic", victory_type ) &&
						victory_type == Game::VT_DIPLOMATIC &&
						Game::GetVictoryTypeString( victory_type ) == "diplomatic",
					"diplomatic victory type did not round-trip"
				);
				GT_OK();
			}
		);
		task->AddTest(
			"snapshot definition validation",
			GT() {
				bool rejected_unknown_pop_flags = false;
				try {
					types::Buffer pop_def;
					pop_def.WriteString( "WORKER" );
					pop_def.WriteString( "Worker" );
					for ( size_t i = 0 ; i < 2 ; i++ ) {
						pop_def.WriteInt( 1 );
						pop_def.WriteString( "bases.pcx" );
						pop_def.WriteInt( 0 );
						pop_def.WriteInt( 0 );
						pop_def.WriteInt( 32 );
						pop_def.WriteInt( 32 );
					}
					pop_def.WriteInt( 0x80 );
					std::unique_ptr< game::backend::base::PopDef > parsed(
						game::backend::base::PopDef::Deserialize( pop_def )
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_unknown_pop_flags = true;
				}
				GT_ASSERT( rejected_unknown_pop_flags, "unknown base population flags accepted" );

				bool rejected_negative_facility_cost = false;
				try {
					types::Buffer facility_def;
					facility_def.WriteString( "TEST_FACILITY" );
					facility_def.WriteString( "Test Facility" );
					facility_def.WriteInt( -1 );
					facility_def.WriteInt( 0 );
					facility_def.WriteInt( 0 );
					facility_def.WriteInt( 0 );
					facility_def.WriteInt( 0 );
					std::unique_ptr< game::backend::base::FacilityDef > parsed(
						game::backend::base::FacilityDef::Deserialize( facility_def )
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_negative_facility_cost = true;
				}
				GT_ASSERT( rejected_negative_facility_cost, "negative facility mineral cost accepted" );

				game::backend::base::FacilityDef facility_source(
					"NETWORK_NODE",
					"Network Node",
					80,
					0,
					0,
					0,
					1,
					"InformationNetworks",
					0,
					0.5f,
					1.0f,
					0.0f,
					0,
					0,
					0.5f,
					0.25f,
					14,
					"HabComplex",
					-2,
					2,
					true,
					1,
					2,
					3,
					1.5f,
					2.0f,
					2,
					1
				);
				auto facility_serialized = game::backend::base::FacilityDef::Serialize( &facility_source );
				std::unique_ptr< game::backend::base::FacilityDef > facility_roundtrip(
					game::backend::base::FacilityDef::Deserialize( facility_serialized )
				);
				GT_ASSERT(
					facility_roundtrip->m_required_technology == "InformationNetworks",
					"facility technology prerequisite was not serialized"
				);
				GT_ASSERT(
					facility_roundtrip->m_research_multiplier == 0.5f,
					"facility research multiplier was not serialized"
				);
				GT_ASSERT(
					facility_roundtrip->m_mineral_multiplier == 0.5f,
					"facility mineral multiplier was not serialized"
				);
				GT_ASSERT(
					facility_roundtrip->m_psych_multiplier == 0.25f,
					"facility psych multiplier was not serialized"
				);
				GT_ASSERT(
					facility_roundtrip->m_population_limit == 14 &&
					facility_roundtrip->m_required_facility == "HabComplex",
					"facility population requirements were not serialized"
				);
				GT_ASSERT(
					facility_roundtrip->m_drone_modifier == -2 &&
					facility_roundtrip->m_talent_bonus == 2 &&
					facility_roundtrip->m_suppress_psych,
					"facility social effects were not serialized"
				);
				GT_ASSERT(
					facility_roundtrip->m_unit_morale_land_bonus == 1 &&
					facility_roundtrip->m_unit_morale_water_bonus == 2 &&
					facility_roundtrip->m_unit_morale_air_bonus == 3 &&
					facility_roundtrip->m_water_defense_multiplier == 1.5f &&
					facility_roundtrip->m_air_defense_multiplier == 2.0f,
					"facility triad effects were not serialized"
				);
				GT_ASSERT(
					facility_roundtrip->m_growth_rating_bonus == 2 &&
					facility_roundtrip->m_native_lifecycle_bonus == 1 &&
					!facility_roundtrip->m_psi_gate,
					"facility growth, native lifecycle, or Psi Gate effect was not serialized"
				);

				types::Buffer legacy_facility;
				legacy_facility.WriteString( "LEGACY" );
				legacy_facility.WriteString( "Legacy Facility" );
				legacy_facility.WriteInt( 40 );
				legacy_facility.WriteInt( 0 );
				legacy_facility.WriteInt( 0 );
				legacy_facility.WriteInt( 0 );
				legacy_facility.WriteInt( 1 );
				std::unique_ptr< game::backend::base::FacilityDef > legacy_facility_parsed(
					game::backend::base::FacilityDef::Deserialize( legacy_facility )
				);
				GT_ASSERT(
					legacy_facility_parsed->m_required_technology.empty(),
					"legacy facility definition gained a technology prerequisite"
				);
				GT_ASSERT(
					legacy_facility_parsed->m_research_multiplier == 0.0f,
					"legacy facility definition gained a research multiplier"
				);
				GT_ASSERT(
					legacy_facility_parsed->m_mineral_multiplier == 0.0f &&
					legacy_facility_parsed->m_psych_multiplier == 0.0f,
					"legacy facility definition gained a resource multiplier"
				);
				GT_ASSERT(
					legacy_facility_parsed->m_population_limit == 0 &&
					legacy_facility_parsed->m_required_facility.empty(),
					"legacy facility definition gained a population requirement"
				);
				GT_ASSERT(
					legacy_facility_parsed->m_drone_modifier == 0 &&
					legacy_facility_parsed->m_talent_bonus == 0 &&
					!legacy_facility_parsed->m_suppress_psych,
					"legacy facility definition gained a social effect"
				);
				GT_ASSERT(
					legacy_facility_parsed->m_unit_morale_land_bonus == 0 &&
					legacy_facility_parsed->m_unit_morale_water_bonus == 0 &&
					legacy_facility_parsed->m_unit_morale_air_bonus == 0 &&
					legacy_facility_parsed->m_water_defense_multiplier == 1.0f &&
					legacy_facility_parsed->m_air_defense_multiplier == 1.0f,
					"legacy facility definition gained a triad effect"
				);
				GT_ASSERT(
					legacy_facility_parsed->m_growth_rating_bonus == 0 &&
					legacy_facility_parsed->m_native_lifecycle_bonus == 0,
					"legacy facility definition gained a growth or lifecycle effect"
				);
				GT_ASSERT(
					legacy_facility_parsed->m_global_police_rating_bonus == 0 &&
					legacy_facility_parsed->m_global_extra_police_units == 0,
					"legacy facility definition gained a police effect"
				);
				GT_ASSERT(
					legacy_facility_parsed->m_efficiency_rating_bonus == 0 &&
					legacy_facility_parsed->m_defender_morale_minimum == 0 &&
					!legacy_facility_parsed->m_psi_gate,
					"legacy facility definition gained a local rating or Psi Gate effect"
				);

				const auto make_unit_def = [](
					const int64_t mineral_cost,
					const int64_t offense,
					const int64_t defense,
					const bool can_found_base,
					const bool can_terraform
				) {
					types::Buffer unit_def;
					unit_def.WriteString( "TEST" );
					unit_def.WriteString( "NATIVE" );
					unit_def.WriteString( "Test Unit" );
					unit_def.WriteInt( mineral_cost );
					unit_def.WriteString( "" );
					unit_def.WriteBool( false );
					unit_def.WriteInt( offense );
					unit_def.WriteInt( defense );
					unit_def.WriteBool( can_found_base );
					unit_def.WriteBool( can_terraform );
					unit_def.WriteInt( game::backend::unit::DT_STATIC );
					return unit_def;
				};

				bool rejected_negative_unit_cost = false;
				try {
					auto unit_def = make_unit_def( -1, 1, 1, false, false );
					std::unique_ptr< game::backend::unit::Def > parsed(
						game::backend::unit::Def::Deserialize( unit_def )
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_negative_unit_cost = true;
				}
				GT_ASSERT( rejected_negative_unit_cost, "negative unit mineral cost accepted" );

				bool rejected_invalid_unit_strength = false;
				try {
					auto unit_def = make_unit_def( 10, 1, 0, false, false );
					std::unique_ptr< game::backend::unit::Def > parsed(
						game::backend::unit::Def::Deserialize( unit_def )
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_unit_strength = true;
				}
				GT_ASSERT( rejected_invalid_unit_strength, "invalid unit combat strength accepted" );

				bool rejected_conflicting_unit_capabilities = false;
				try {
					auto unit_def = make_unit_def( 10, 1, 1, true, true );
					std::unique_ptr< game::backend::unit::Def > parsed(
						game::backend::unit::Def::Deserialize( unit_def )
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_conflicting_unit_capabilities = true;
				}
				GT_ASSERT( rejected_conflicting_unit_capabilities, "conflicting unit capabilities accepted" );

				bool rejected_air_colony_unit = false;
				try {
					auto unit_def = make_unit_def( 10, 0, 1, true, false );
					unit_def.WriteInt( game::backend::unit::MT_AIR );
					unit_def.WriteFloat( 1.0f );
					std::unique_ptr< game::backend::unit::Def > parsed(
						game::backend::unit::Def::Deserialize( unit_def )
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_air_colony_unit = true;
				}
				GT_ASSERT( rejected_air_colony_unit, "air colony unit capability accepted" );

				bool rejected_air_former_unit = false;
				try {
					auto unit_def = make_unit_def( 10, 0, 1, false, true );
					unit_def.WriteInt( game::backend::unit::MT_AIR );
					unit_def.WriteFloat( 1.0f );
					std::unique_ptr< game::backend::unit::Def > parsed(
						game::backend::unit::Def::Deserialize( unit_def )
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_air_former_unit = true;
				}
				GT_ASSERT( rejected_air_former_unit, "air former unit capability accepted" );

				bool rejected_invalid_resource_coordinates = false;
				try {
					types::Buffer resource;
					resource.WriteString( "NUTRIENTS" );
					resource.WriteString( "Nutrients" );
					resource.WriteString( "newicons.pcx" );
					resource.WriteInt( 1 );
					resource.WriteInt( -1 );
					resource.WriteInt( 0 );
					resource.WriteInt( 20 );
					resource.WriteInt( 20 );
					std::unique_ptr< game::backend::resource::Resource > parsed(
						game::backend::resource::Resource::Deserialize( resource )
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_resource_coordinates = true;
				}
				GT_ASSERT( rejected_invalid_resource_coordinates, "invalid resource coordinates accepted" );

				bool rejected_impossible_animation_timing = false;
				try {
					types::Buffer animation;
					animation.WriteString( "MOVE" );
					animation.WriteInt( game::backend::animation::AT_FRAMES_ROW );
					animation.WriteFloat( 1.0f );
					animation.WriteFloat( 1.0f );
					animation.WriteInt( 1 );
					animation.WriteString( "" );
					animation.WriteString( "animations.pcx" );
					animation.WriteInt( 0 );
					animation.WriteInt( 0 );
					animation.WriteInt( 32 );
					animation.WriteInt( 32 );
					animation.WriteInt( 16 );
					animation.WriteInt( 16 );
					animation.WriteInt( 0 );
					animation.WriteInt( 2 );
					animation.WriteInt( 2 );
					std::unique_ptr< game::backend::animation::Def > parsed(
						game::backend::animation::Def::Deserialize( animation )
					);
				}
				catch ( const std::runtime_error& ) {
					rejected_impossible_animation_timing = true;
				}
				GT_ASSERT( rejected_impossible_animation_timing, "impossible animation timing accepted" );
				GT_OK();
			}
		);
		task->AddTest(
			"tile serialization validation",
			GT() {
				using namespace game::backend::map::tile;

				Tile source;
				elevation_t source_center = 0;
				elevation_t source_left = -1200;
				elevation_t source_top = -300;
				elevation_t source_right = 700;
				elevation_t source_bottom = 1800;
				source.elevation.center = &source_center;
				source.elevation.left = &source_left;
				source.elevation.top = &source_top;
				source.elevation.right = &source_right;
				source.elevation.bottom = &source_bottom;
				source.elevation.corners = {
					&source_left,
					&source_top,
					&source_right,
					&source_bottom,
				};
				source.coord = { 6, 3 };
				source.moisture = MOISTURE_RAINY;
				source.rockiness = ROCKINESS_ROCKY;
				source.bonus = BONUS_MINERALS;
				source.features = FEATURE_RIVER | FEATURE_XENOFUNGUS;
				source.terraforming = TERRAFORMING_ROAD | TERRAFORMING_FARM;
				source.Update();

				Tile restored;
				elevation_t restored_center = ELEVATION_MIN;
				elevation_t restored_left = ELEVATION_MIN;
				elevation_t restored_top = ELEVATION_MIN;
				elevation_t restored_right = ELEVATION_MIN;
				elevation_t restored_bottom = ELEVATION_MIN;
				restored.elevation.center = &restored_center;
				restored.elevation.left = &restored_left;
				restored.elevation.top = &restored_top;
				restored.elevation.right = &restored_right;
				restored.elevation.bottom = &restored_bottom;
				restored.elevation.corners = {
					&restored_left,
					&restored_top,
					&restored_right,
					&restored_bottom,
				};
				restored.Deserialize( source.Serialize() );

				GT_ASSERT( restored.coord.x == source.coord.x, "tile x coordinate changed" );
				GT_ASSERT( restored.coord.y == source.coord.y, "tile y coordinate changed" );
				GT_ASSERT( restored_center == source_center, "tile center elevation changed" );
				GT_ASSERT( restored_left == source_left, "tile left elevation changed" );
				GT_ASSERT( restored_top == source_top, "tile top elevation changed" );
				GT_ASSERT( restored_right == source_right, "tile right elevation changed" );
				GT_ASSERT( restored_bottom == source_bottom, "tile bottom elevation changed" );
				GT_ASSERT( restored.moisture == source.moisture, "tile moisture changed" );
				GT_ASSERT( restored.rockiness == source.rockiness, "tile rockiness changed" );
				GT_ASSERT( restored.bonus == source.bonus, "tile bonus changed" );
				GT_ASSERT( restored.features == source.features, "tile features changed" );
				GT_ASSERT( restored.terraforming == source.terraforming, "tile terraforming changed" );
				GT_ASSERT( restored.is_water_tile == source.is_water_tile, "tile water state changed" );

				// Rendering may temporarily adjust the cached center without changing its corners.
				source_center++;
				restored.Deserialize( source.Serialize() );
				source.Update();
				GT_ASSERT(
					restored_center == source_center,
					"tile serialization preserved a stale derived center elevation"
				);

				const auto serialize_source = [&]( const int moisture, const feature_t features, const terraforming_t terraforming ) {
					types::Buffer serialized;
					serialized.WriteInt( source.coord.x );
					serialized.WriteInt( source.coord.y );
					serialized.WriteInt( source_center );
					serialized.WriteInt( source_left );
					serialized.WriteInt( source_top );
					serialized.WriteInt( source_right );
					serialized.WriteInt( source_bottom );
					serialized.WriteInt( moisture );
					serialized.WriteInt( source.rockiness );
					serialized.WriteInt( source.bonus );
					serialized.WriteInt( features );
					serialized.WriteInt( terraforming );
					return serialized;
				};
				const auto rejects_tile = [&]( types::Buffer serialized ) {
					try {
						restored.Deserialize( std::move( serialized ) );
					}
					catch ( const std::runtime_error& ) {
						return true;
					}
					return false;
				};
				const auto restored_before_invalid_data = restored.Serialize().ToString();
				GT_ASSERT(
					rejects_tile( serialize_source( MOISTURE_RAINY + 1, source.features, source.terraforming ) ),
					"invalid tile moisture accepted"
				);
				GT_ASSERT(
					rejects_tile( serialize_source( source.moisture, static_cast< feature_t >( 1 << 15 ), source.terraforming ) ),
					"unknown tile feature accepted"
				);
				GT_ASSERT(
					rejects_tile( serialize_source( source.moisture, source.features, static_cast< terraforming_t >( 1 << 15 ) ) ),
					"unknown tile terraforming accepted"
				);
				auto trailing_tile = source.Serialize();
				trailing_tile.WriteBool( false );
				GT_ASSERT( rejects_tile( std::move( trailing_tile ) ), "trailing tile data accepted" );
				GT_ASSERT(
					restored.Serialize().ToString() == restored_before_invalid_data,
					"invalid tile data was partially applied"
				);

				Tiles grid( nullptr, 4, 4 );
				grid.Clear();
				Tiles grid_round_trip( nullptr );
				grid_round_trip.Deserialize( grid.Serialize() );
				GT_ASSERT( grid_round_trip.GetWidth() == 4, "tile grid width changed" );
				GT_ASSERT( grid_round_trip.GetHeight() == 4, "tile grid height changed" );

				const auto make_first_grid_tile = [](
					const size_t x,
					const elevation_t center,
					const elevation_t bottom
				) {
					types::Buffer serialized;
					serialized.WriteInt( x );
					serialized.WriteInt( 0 );
					serialized.WriteInt( center );
					serialized.WriteInt( 0 );
					serialized.WriteInt( 0 );
					serialized.WriteInt( 0 );
					serialized.WriteInt( bottom );
					serialized.WriteInt( MOISTURE_NONE );
					serialized.WriteInt( ROCKINESS_NONE );
					serialized.WriteInt( BONUS_NONE );
					serialized.WriteInt( FEATURE_NONE );
					serialized.WriteInt( TERRAFORMING_NONE );
					return serialized.ToString();
				};
				const auto make_grid = [&]( const std::string& first_tile ) {
					types::Buffer serialized;
					serialized.WriteInt( grid.GetWidth() );
					serialized.WriteInt( grid.GetHeight() );
					bool is_first = true;
					for ( size_t y = 0 ; y < grid.GetHeight() ; y++ ) {
						for ( size_t x = y & 1 ; x < grid.GetWidth() ; x += 2 ) {
							serialized.WriteString(
								is_first
									? first_tile
									: grid.AtConst( x, y ).Serialize().ToString()
							);
							is_first = false;
						}
					}
					serialized.WriteBool( false );
					return serialized;
				};
				const auto rejects_grid = []( types::Buffer serialized ) {
					try {
						Tiles restored_grid( nullptr );
						restored_grid.Deserialize( std::move( serialized ) );
					}
					catch ( const std::runtime_error& ) {
						return true;
					}
					return false;
				};
				GT_ASSERT(
					rejects_grid( make_grid( make_first_grid_tile( 2, 0, 0 ) ) ),
					"mismatched tile grid coordinates accepted"
				);
				GT_ASSERT(
					rejects_grid( make_grid( make_first_grid_tile( 0, 1, 4 ) ) ),
					"conflicting shared tile elevations accepted"
				);
				GT_OK();
			}
		);
		task->AddTest(
			"render state serialization validation",
			GT() {
				using namespace types::mesh;
				using game::backend::map::tile::ELEVATION_MAX;
				using game::backend::map::tile::TileState;

				const std::array< coord_t, 9 > valid_vertices = {
					0.0f, 0.0f, 0.0f,
					1.0f, 0.0f, 0.0f,
					0.0f, 1.0f, 0.0f,
				};
				const std::array< index_t, 3 > valid_indices = { 0, 1, 2 };
				const auto make_mesh = [](
					const std::array< coord_t, 9 >& vertices,
					const std::array< index_t, 3 >& indices
				) {
					types::Buffer serialized;
					serialized.WriteInt( Mesh::MT_DATA );
					serialized.WriteInt( Mesh::DT_BARE );
					serialized.WriteInt( 3 );
					serialized.WriteInt( 3 );
					serialized.WriteData(
						vertices.data(),
						static_cast< uint32_t >( vertices.size() * sizeof( coord_t ) )
					);
					serialized.WriteInt( 3 );
					serialized.WriteInt( 1 );
					serialized.WriteInt( 1 );
					serialized.WriteData(
						indices.data(),
						static_cast< uint32_t >( indices.size() * sizeof( index_t ) )
					);
					serialized.WriteBool( true );
					return serialized;
				};

				Mesh restored_mesh( Mesh::MT_DATA, Mesh::DT_BARE, Mesh::VERTEX_COORD_SIZE, 3, 1 );
				restored_mesh.Deserialize( make_mesh( valid_vertices, valid_indices ) );
				types::Vec3 restored_vertex;
				restored_mesh.GetVertexCoord( 1, &restored_vertex );
				GT_ASSERT( restored_vertex.x == 1.0f, "valid mesh vertex changed" );
				const auto restored_mesh_before_invalid_data = restored_mesh.Serialize().ToString();

				auto nonfinite_vertices = valid_vertices;
				nonfinite_vertices[ 0 ] = ( std::numeric_limits< coord_t >::quiet_NaN )();
				bool rejected_nonfinite_mesh = false;
				try {
					restored_mesh.Deserialize( make_mesh( nonfinite_vertices, valid_indices ) );
				}
				catch ( const std::runtime_error& ) {
					rejected_nonfinite_mesh = true;
				}
				GT_ASSERT( rejected_nonfinite_mesh, "non-finite mesh vertex accepted" );

				auto overflowing_indices = valid_indices;
				overflowing_indices[ 2 ] = 3;
				bool rejected_overflowing_mesh_index = false;
				try {
					restored_mesh.Deserialize( make_mesh( valid_vertices, overflowing_indices ) );
				}
				catch ( const std::runtime_error& ) {
					rejected_overflowing_mesh_index = true;
				}
				GT_ASSERT( rejected_overflowing_mesh_index, "out-of-bounds mesh index accepted" );
				GT_ASSERT(
					restored_mesh.Serialize().ToString() == restored_mesh_before_invalid_data,
					"invalid mesh data was partially applied"
				);

				types::texture::Texture texture( 2, 1 );
				const auto texture_before_invalid_data = texture.Serialize().ToString();
				types::Buffer invalid_texture;
				invalid_texture.WriteString( "" );
				invalid_texture.WriteInt( texture.GetWidth() );
				invalid_texture.WriteInt( texture.GetHeight() );
				invalid_texture.WriteFloat( ( std::numeric_limits< float >::quiet_NaN )() );
				invalid_texture.WriteInt( 4 );
				invalid_texture.WriteInt( texture.GetBitmapSize() );
				invalid_texture.WriteData(
					texture.GetBitmap(),
					static_cast< uint32_t >( texture.GetBitmapSize() )
				);
				invalid_texture.WriteBool( false );
				bool rejected_nonfinite_texture = false;
				try {
					texture.Deserialize( std::move( invalid_texture ) );
				}
				catch ( const std::runtime_error& ) {
					rejected_nonfinite_texture = true;
				}
				GT_ASSERT( rejected_nonfinite_texture, "non-finite texture aspect ratio accepted" );
				GT_ASSERT(
					texture.Serialize().ToString() == texture_before_invalid_data,
					"invalid texture data was partially applied"
				);

				TileState::tile_elevations_t invalid_elevations = { 0, 0, 0, 0, ELEVATION_MAX + 1 };
				TileState::tile_elevations_t restored_elevations = {};
				bool rejected_invalid_elevations = false;
				try {
					restored_elevations.Deserialize( invalid_elevations.Serialize() );
				}
				catch ( const std::runtime_error& ) {
					rejected_invalid_elevations = true;
				}
				GT_ASSERT( rejected_invalid_elevations, "invalid tile-state elevation accepted" );

				TileState::tile_layer_t invalid_layer = {};
				invalid_layer.texture_stretch.x = ( std::numeric_limits< float >::quiet_NaN )();
				TileState::tile_layer_t restored_layer = {};
				bool rejected_nonfinite_layer = false;
				try {
					restored_layer.Deserialize( invalid_layer.Serialize() );
				}
				catch ( const std::runtime_error& ) {
					rejected_nonfinite_layer = true;
				}
				GT_ASSERT( rejected_nonfinite_layer, "non-finite tile layer accepted" );

				TileState tile_state = {};
				tile_state.layers[ 0 ].indices.center = 3;
				bool rejected_mesh_reference = false;
				try {
					tile_state.ValidateMeshReferences( 3, 1, 3 );
				}
				catch ( const std::runtime_error& ) {
					rejected_mesh_reference = true;
				}
				GT_ASSERT( rejected_mesh_reference, "out-of-bounds tile mesh reference accepted" );
				GT_OK();
			}
		);
		task->AddTest(
			"faction serialization round trip",
			GT() {
				using game::backend::faction::Faction;

				Faction source( "CARETAKERS", "Caretakers" );
				source.m_flags = Faction::FF_NAVAL | Faction::FF_PROGENITOR | Faction::FF_NATIVE;
				source.m_colors.text = types::Color::FromRGBA( 0x10203040 );
				source.m_colors.text_shadow = types::Color::FromRGBA( 0x50607080 );
				source.m_colors.border = types::Color::FromRGBA( 0x90a0b0c0 );
				source.m_bases_render = { "caretake.pcx", 1, 2, 100, 75, 50, 37, 1, 0.75f, 1.25f };
				source.m_base_names.land = { "Alpha Prime", "Tau Ceti" };
				source.m_base_names.water = { "Deep Home" };
				source.m_starting_technologies = { "CentauriEcology" };

				Faction restored;
				restored.Deserialize( source.Serialize() );

				GT_ASSERT( restored.m_id == source.m_id, "faction id changed" );
				GT_ASSERT( restored.m_name == source.m_name, "faction name changed" );
				GT_ASSERT( restored.m_flags == source.m_flags, "faction flags changed" );
				GT_ASSERT( restored.m_colors.text.GetRGBA() == source.m_colors.text.GetRGBA(), "faction text color changed" );
				GT_ASSERT( restored.m_colors.text_shadow.GetRGBA() == source.m_colors.text_shadow.GetRGBA(), "faction shadow color changed" );
				GT_ASSERT( restored.m_colors.border.GetRGBA() == source.m_colors.border.GetRGBA(), "faction border color changed" );
				GT_ASSERT( restored.m_bases_render.file == source.m_bases_render.file, "faction base sprite changed" );
				GT_ASSERT( restored.m_bases_render.cell_width == source.m_bases_render.cell_width, "faction base cell width changed" );
				GT_ASSERT( restored.m_bases_render.scale_x == source.m_bases_render.scale_x, "faction base scale changed" );
				GT_ASSERT( restored.m_base_names.land == source.m_base_names.land, "faction land base names changed" );
				GT_ASSERT( restored.m_base_names.water == source.m_base_names.water, "faction water base names changed" );
				GT_ASSERT(
					restored.m_starting_technologies == source.m_starting_technologies,
					"faction starting technologies changed"
				);

				source.m_starting_technologies.push_back( "CentauriEcology" );
				bool rejected_duplicate_technology = false;
				try {
					Faction invalid;
					invalid.Deserialize( source.Serialize() );
				}
				catch ( const std::runtime_error& ) {
					rejected_duplicate_technology = true;
				}
				GT_ASSERT( rejected_duplicate_technology, "duplicate faction starting technology accepted" );
				GT_OK();
			}
		);
		task->AddTest(
			"map state rejects invalid dimensions",
			GT() {
				types::Buffer serialized;
				serialized.WriteBool( false );
				serialized.WriteVec2f( { 0.0f, 0.0f } );
				serialized.WriteVec2u( { UINT32_MAX, UINT32_MAX } );
				serialized.WriteVec2f( { 1.0f, 1.0f } );

				bool rejected_dimensions = false;
				try {
					game::backend::map::MapState state;
					state.Deserialize( serialized );
				}
				catch ( const std::runtime_error& ) {
					rejected_dimensions = true;
				}
				GT_ASSERT( rejected_dimensions, "oversized map-state dimensions accepted" );
				GT_OK();
			}
		);
		task->AddTest(
			"packed color conversion",
			GT() {
				const types::Color::color_t color = {
					0.425f,
					0.378f,
					0.311f,
					1.0f,
				};
				const auto rgba = types::Color::ToRGBA( color );

				GT_ASSERT( rgba == types::Color( color ).GetRGBA(), "raw and wrapped color packing differ" );
				GT_ASSERT( ( rgba & 0xff ) == 108, "packed red channel changed" );
				GT_ASSERT( ( ( rgba >> 8 ) & 0xff ) == 96, "packed green channel changed" );
				GT_ASSERT( ( ( rgba >> 16 ) & 0xff ) == 79, "packed blue channel changed" );
				GT_ASSERT( ( ( rgba >> 24 ) & 0xff ) == 255, "packed alpha channel changed" );
				GT_ASSERT( types::Color::RGBA( 0x12, 0x34, 0x56, 0x78 ) == 0x78563412, "RGBA byte order changed" );
				GT_OK();
			}
		);
		tests::AddGSETests( task );
		tests::AddParserTests( task );
		tests::AddRunnerTests( task );
	}
	if ( !g_engine->GetConfig()->HasDebugFlag( config::Config::DF_GSE_TESTS_NATIVE_ONLY ) ) {
		tests::AddScriptsTests( task );
	}

}

const std::string& GetTestFilename() {
	const static std::string filename = "<TEST>.gls.js";
	return filename;
}

const std::string& GetTestSource() {
	const static std::string source = ""
									  "// test script\n"
									  "\n"
									  "let a = 5;\n"
									  "a++;\n"
									  "let b = a + 2 * 4;\n"
									  "let c=(a+2)*4;\n"
									  "{\n"
									  "	a = 15;\n"
									  "	a += 10;\n"
									  "};\n"
									  "c = 123;\n"
									  "c -= 23;\n"
									  "\n"
									  "let testmethod1 = (a, b, c) => { return a + b + c; };\n"
									  "\n"
									  "let testmethod2 = (a, b, c) => {\n"
									  "	/*\n"
									  "		this method is a bit different\n"
									  "	*/\n"
									  "	return\n"
									  "		a\n"
									  "			+\n"
									  "		b\n"
									  "			-\n"
									  "		c\n"
									  "	;\n"
									  "};\n"
									  "\n"
									  "let testarr1 = [];\n"
									  "let testarr2 = [ 3, 'TEST', {\n"
									  "  key1: 'value1',\n"
									  "  key2: 'value2',\n"
									  "} ];\n"
									  "testarr1 :+ 'first';\n"
									  "testarr1 :+ 'second';\n"
									  "testarr1 :+ 1 + 2 + 3;\n"
									  "testarr1 += testarr2;\n"
									  "testarr1 :+ testarr2;\n"
									  "let testarr3 = #clone(testarr1);\n"
									  "testarr3[1] = 'SECOND';\n"
									  "testarr3[ testmethod2(a, b, c) + 61 ] = 'FIRST';\n"
									  "testarr3[2::5] = testarr1[0::1] + testarr2[0::1];\n"
									  "let testarr4 = testarr3[::3];\n"
									  "testarr4[ c + 1 - 100 :: c - 100 + 2 ] = [ 'new first', 'new second' ];\n"
									  "\n"
									  "let testobj1 = {};\n"
									  "let testobj2 = {\n"
									  "	propertyString: 'STRING',\n"
									  "	propertyInt1: 111 + a + b,\n"
									  "	propertyInt2: 222,\n"
									  "};\n"
									  "let testobj3 = {\n"
									  "  child1: {\n"
									  "    child2: {\n"
									  "      value: 'CHILD VALUE'\n"
									  "    }\n"
									  "  },\n"
									  "};\n"
									  "testobj1.propertyInt = testobj2.propertyInt1 + testobj2.propertyInt2;\n"
									  "\n"
									  "let d = null;\n"
									  "let x = a > b;\n"
									  "\n"
									  "     #print( d );\n"
									  "     #print( d == null );\n"
									  "     #print( x, x == b > c );\n"
									  "\n"
									  "     #print( a != b, b != c, c != a, a != a );\n"
									  "     #print( a > b, b > c );\n"
									  "     #print( b >= a, a >= 2, c <= 200, a <= 200 );\n"
									  "     #print( 10 < 10, 10 <= 10, a < a, a <= a );\n"
									  "     #print( true && true, true && false, true || true, true || false );\n"
									  "     #print( (( 5 > 10 ) && ( 2 > 1 )) || (( 5 <= 10 ) && !( 5 > 35 ) && ( 100 >= 20 )) );\n"
									  "     #print(testmethod1(11, b, 20), testmethod2(a, b, c));\n"
									  "let testmethod = testmethod1;\n"
									  "     #print( testmethod( 1, testmethod( 2, testmethod( 3, 3, 3 ), testmethod( 4, 4, 4 ) ), testmethod( 5, 5, testmethod( 6, 6, 6 )) ), 10 );\n"
									  "     #print( testarr1 );      #print( testarr2 );      #print( testarr3 );      #print( testarr4 );\n"
									  "     #print( testarr1[0] );      #print( testarr1[1] );      #print( testarr1[0::1] );\n"
									  "     #print( testarr1[5::] );      #print( testarr1[::3] );\n"
									  "     #print( testarr1[4::5] + testarr1[2::3] );\n"
									  "     #print(testobj3.child1.child2.value);\n"
									  "     #print(testobj1.propertyInt == 272 + c);      #print(testobj1, testobj2);\n"
									  "\n"
									  "if ( a > b ) {\n"
									  "       #print( 'YES' );\n"
									  "}\n"
									  "else {\n"
									  "       #print( 'NO' );\n"
									  "};\n"
									  "if ( b > a ) {\n"
									  "       #print( 'YES' );\n"
									  "}\n"
									  "else {\n"
									  "       #print( 'NO' );\n"
									  "};\n"
									  "if ( false ) {      #print( 'FALSE' ); };\n"
									  "if ( false ) {\n"
									  "       #print('FAIL');\n"
									  "} else if ( false ) {\n"
									  "       #print( 'FAIL' );\n"
									  "} else if ( true ) {\n"
									  "       #print( 'OK' );\n"
									  "} else {\n"
									  "       #print( 'FAIL' );\n"
									  "};\n"
									  "\n"
									  "let i = 0;\n"
									  "while ( i++ < 5 ) {\n"
									  "       #print(i);\n"
									  "};\n"
									  "\n"
									  "try {\n"
									  "       #print( 'BEFORE EXCEPTION' ); // should be printed\n"
									  "  let failfunc = () => {\n"
									  "         #print('failfunc');\n"
									  "    throw TestError('something happened');\n"
									  "  };\n"
									  "  failfunc();\n"
									  "       #print( 'AFTER EXCEPTION' ); // should not be printed\n"
									  "}\n"
									  "catch {\n"
									  "  UnknownError: (e) => {\n"
									  "         #print('shouldnt catch this');\n"
									  "  },\n"
									  "  TestError: (e) => {\n"
									  "         #print('CAUGHT ' + e.type + ' : ' + e.reason);\n"
									  "         #print(e.stacktrace);\n"
									  "  }\n"
									  "};\n"
									  "\n"
									  ";;;\n"
									  "     #print('bye!');\n";
	return source;
}

using namespace program;

const Program* GetTestProgram( gc::Space* const gc_space ) {
	const auto& filename = GetTestFilename();
// TODO: other parsers will need different values here
#define SI( _fromline, _fromcol, _toline, _tocol ) { \
    filename, \
    { \
        _fromline, \
            _fromcol \
    }, \
    { \
        _toline, \
            _tocol \
    } \
}

// skip validation in some places
#define SI_SKIP() { "", { 0, 0 }, { 0, 0 } }

	const auto print = [ &filename ]( const size_t line, size_t col_begin, const std::vector< const Expression* >& arguments ) -> Statement* {
		return new Statement(
			SI_SKIP(),
			new Expression(
				SI_SKIP(),
				new Call(
					SI_SKIP(),
					new Expression(
						SI( line, col_begin, line, col_begin + 6 ),
						new Variable( SI( line, col_begin, line, col_begin + 6 ), "#print" )
					),
					arguments
				)
			)
		);
	};

	const auto* program = new Program(
		new Scope(
			SI( 3, 1, 132, 21 ),
			{
				new Statement(
					SI( 3, 1, 3, 10 ),
					new Expression(
						SI( 3, 5, 3, 10 ),
						new Variable( SI( 3, 5, 3, 6 ), "a", VH_CREATE_VAR ),
						new Operator( SI( 3, 7, 3, 8 ), OT_ASSIGN ),
						new program::Value( SI( 3, 9, 3, 10 ), VALUE( value::Int, , 5 ) )
					)
				),
				new Statement(
					SI( 4, 1, 4, 4 ),
					new Expression(
						SI( 4, 1, 4, 4 ),
						new Variable( SI( 4, 1, 4, 2 ), "a" ),
						new Operator( SI( 4, 2, 4, 4 ), OT_INC )
					)
				),
				new Statement(
					SI( 5, 1, 5, 18 ),
					new Expression(
						SI( 5, 5, 5, 18 ),
						new Variable( SI( 5, 5, 5, 6 ), "b", VH_CREATE_VAR ),
						new Operator( SI( 5, 7, 5, 8 ), OT_ASSIGN ),
						new Expression(
							SI( 5, 9, 5, 18 ),
							new Variable( SI( 5, 9, 5, 10 ), "a" ),
							new Operator( SI( 5, 11, 5, 12 ), OT_ADD ),
							new Expression(
								SI( 5, 13, 5, 18 ),
								new program::Value( SI( 5, 13, 5, 14 ), VALUE( value::Int, , 2 ) ),
								new Operator( SI( 5, 15, 5, 16 ), OT_MULT ),
								new program::Value( SI( 5, 17, 5, 18 ), VALUE( value::Int, , 4 ) )
							)
						)
					)
				),
				new Statement(
					SI( 6, 1, 6, 14 ),
					new Expression(
						SI( 6, 5, 6, 14 ),
						new Variable( SI( 6, 5, 6, 6 ), "c", VH_CREATE_VAR ),
						new Operator( SI( 6, 6, 6, 7 ), OT_ASSIGN ),
						new Expression(
							SI( 6, 8, 6, 14 ),
							new Expression(
								SI( 6, 8, 6, 11 ),
								new Variable( SI( 6, 8, 6, 9 ), "a" ),
								new Operator( SI( 6, 9, 6, 10 ), OT_ADD ),
								new program::Value( SI( 6, 10, 6, 11 ), VALUE( value::Int, , 2 ) )
							),
							new Operator( SI( 6, 12, 6, 13 ), OT_MULT ),
							new program::Value( SI( 6, 13, 6, 14 ), VALUE( value::Int, , 4 ) )
						)
					)
				),
				new Statement(
					SI( 7, 1, 10, 2 ),
					new Expression(
						SI( 8, 2, 9, 10 ),
						new Scope(
							SI( 8, 2, 9, 10 ),
							{
								new Statement(
									SI( 8, 2, 8, 8 ),
									new Expression(
										SI( 8, 2, 8, 8 ),
										new Variable( SI( 8, 2, 8, 3 ), "a" ),
										new Operator( SI( 8, 4, 8, 5 ), OT_ASSIGN ),
										new program::Value( SI( 8, 6, 8, 8 ), VALUE( value::Int, , 15 ) )
									)
								),
								new Statement(
									SI( 9, 2, 9, 9 ),
									new Expression(
										SI( 9, 2, 9, 9 ),
										new Variable( SI( 9, 2, 9, 3 ), "a" ),
										new Operator( SI( 9, 4, 9, 6 ), OT_INC_BY ),
										new program::Value( SI( 9, 7, 9, 9 ), VALUE( value::Int, , 10 ) )
									)
								)
							}
						)
					)
				),
				new Statement(
					SI( 11, 1, 11, 8 ),
					new Expression(
						SI( 11, 1, 11, 8 ),
						new Variable( SI( 11, 1, 11, 2 ), "c" ),
						new Operator( SI( 11, 3, 11, 4 ), OT_ASSIGN ),
						new program::Value( SI( 11, 5, 11, 8 ), VALUE( value::Int, , 123 ) )
					)
				),
				new Statement(
					SI( 12, 1, 12, 8 ),
					new Expression(
						SI( 12, 1, 12, 8 ),
						new Variable( SI( 12, 1, 12, 2 ), "c" ),
						new Operator( SI( 12, 3, 12, 5 ), OT_DEC_BY ),
						new program::Value( SI( 12, 6, 12, 8 ), VALUE( value::Int, , 23 ) )
					)
				),
				new Statement(
					SI( 14, 1, 14, 53 ),
					new Expression(
						SI( 14, 5, 14, 53 ),
						new Variable( SI( 14, 5, 14, 16 ), "testmethod1", VH_CREATE_VAR ),
						new Operator( SI( 14, 17, 14, 18 ), OT_ASSIGN ),
						new Function(
							SI( 14, 19, 14, 53 ),
							{
								new Variable( SI( 14, 20, 14, 21 ), "a" ),
								new Variable( SI( 14, 23, 14, 24 ), "b" ),
								new Variable( SI( 14, 26, 14, 27 ), "c" )
							},
							new Scope(
								SI( 14, 34, 14, 51 ),
								{
									new Statement(
										SI( 14, 34, 14, 50 ),
										new Expression(
											SI( 14, 34, 14, 50 ),
											nullptr,
											new Operator( SI( 14, 34, 14, 40 ), OT_RETURN ),
											new Expression(
												SI( 14, 41, 14, 50 ),
												new Expression(
													SI( 14, 41, 14, 46 ),
													new Variable( SI( 14, 41, 14, 42 ), "a" ),
													new Operator( SI( 14, 43, 14, 44 ), OT_ADD ),
													new Variable( SI( 14, 45, 14, 46 ), "b" )
												),
												new Operator( SI( 14, 47, 14, 48 ), OT_ADD ),
												new Variable( SI( 14, 49, 14, 50 ), "c" )
											)
										)
									)
								}
							)
						)
					)
				),
				new Statement(
					SI( 16, 1, 27, 2 ),
					new Expression(
						SI( 16, 5, 27, 2 ),
						new Variable( SI( 16, 5, 16, 16 ), "testmethod2", VH_CREATE_VAR ),
						new Operator( SI( 16, 17, 16, 18 ), OT_ASSIGN ),
						new Function(
							SI( 16, 19, 27, 2 ),
							{
								new Variable( SI( 16, 20, 16, 21 ), "a" ),
								new Variable( SI( 16, 23, 16, 24 ), "b" ),
								new Variable( SI( 16, 26, 16, 27 ), "c" )
							},
							new Scope(
								SI( 20, 2, 26, 3 ),
								{
									new Statement(
										SI( 20, 2, 25, 4 ),
										new Expression(
											SI( 20, 2, 25, 4 ),
											nullptr,
											new Operator( SI( 20, 2, 20, 8 ), OT_RETURN ),
											new Expression(
												SI( 21, 3, 25, 4 ),
												new Expression(
													SI( 21, 3, 23, 4 ),
													new Variable( SI( 21, 3, 21, 4 ), "a" ),
													new Operator( SI( 22, 4, 22, 5 ), OT_ADD ),
													new Variable( SI( 23, 3, 23, 4 ), "b" )
												),
												new Operator( SI( 24, 4, 24, 5 ), OT_SUB ),
												new Variable( SI( 25, 3, 25, 4 ), "c" )
											)
										)
									)
								}
							)
						)
					)
				),
				new Statement(
					SI( 29, 1, 29, 18 ),
					new Expression(
						SI( 29, 5, 29, 18 ),
						new Variable( SI( 29, 5, 29, 13 ), "testarr1", VH_CREATE_VAR ),
						new Operator( SI( 29, 14, 29, 15 ), OT_ASSIGN ),
						new Array( SI( 29, 16, 29, 18 ), {} )
					)
				),
				new Statement(
					SI( 30, 1, 33, 4 ),
					new Expression(
						SI( 30, 5, 33, 4 ),
						new Variable( SI( 30, 5, 30, 13 ), "testarr2", VH_CREATE_VAR ),
						new Operator( SI( 30, 14, 30, 15 ), OT_ASSIGN ),
						new Array(
							SI( 30, 16, 33, 4 ),
							{
								new Expression(
									SI( 30, 18, 30, 19 ),
									new program::Value( SI( 30, 18, 30, 19 ), VALUE( value::Int, , 3 ) )
								),
								new Expression(
									SI( 30, 21, 30, 27 ),
									new program::Value( SI( 30, 21, 30, 27 ), VALUE( value::String, , "TEST" ) )
								),
								new Expression(
									SI( 30, 29, 33, 2 ),
									new Object(
										SI( 30, 29, 33, 2 ),
										{
											{
												"key1",
												new Expression(
													SI( 31, 9, 31, 17 ),
													new program::Value( SI( 31, 9, 31, 17 ), VALUE( value::String, , "value1" ) )
												)
											},
											{
												"key2",
												new Expression(
													SI( 32, 9, 32, 17 ),
													new program::Value( SI( 32, 9, 32, 17 ), VALUE( value::String, , "value2" ) )
												)
											}
										}
									)
								)
							}
						)
					)
				),
				new Statement(
					SI( 34, 1, 34, 20 ),
					new Expression(
						SI( 34, 1, 34, 20 ),
						new Variable( SI( 34, 1, 34, 9 ), "testarr1" ),
						new Operator( SI( 34, 10, 34, 12 ), OT_PUSH ),
						new program::Value( SI( 34, 13, 34, 20 ), VALUE( value::String, , "first" ) )
					)
				),
				new Statement(
					SI( 35, 1, 35, 21 ),
					new Expression(
						SI( 35, 1, 35, 21 ),
						new Variable( SI( 35, 1, 35, 9 ), "testarr1" ),
						new Operator( SI( 35, 10, 35, 12 ), OT_PUSH ),
						new program::Value( SI( 35, 13, 35, 21 ), VALUE( value::String, , "second" ) )
					)
				),
				new Statement(
					SI( 36, 1, 36, 22 ),
					new Expression(
						SI( 36, 1, 36, 22 ),
						new Variable( SI( 36, 1, 36, 9 ), "testarr1" ),
						new Operator( SI( 36, 10, 36, 12 ), OT_PUSH ),
						new Expression(
							SI( 36, 13, 36, 22 ),
							new Expression(
								SI( 36, 13, 36, 18 ),
								new program::Value( SI( 36, 13, 36, 14 ), VALUE( value::Int, , 1 ) ),
								new Operator( SI( 36, 15, 36, 16 ), OT_ADD ),
								new program::Value( SI( 36, 17, 36, 18 ), VALUE( value::Int, , 2 ) )
							),
							new Operator( SI( 36, 19, 36, 20 ), OT_ADD ),
							new program::Value( SI( 36, 21, 36, 22 ), VALUE( value::Int, , 3 ) )
						)
					)
				),
				new Statement(
					SI( 37, 1, 37, 21 ),
					new Expression(
						SI( 37, 1, 37, 21 ),
						new Variable( SI( 37, 1, 37, 9 ), "testarr1" ),
						new Operator( SI( 37, 10, 37, 12 ), OT_INC_BY ),
						new Variable( SI( 37, 13, 37, 21 ), "testarr2" )
					)
				),
				new Statement(
					SI( 38, 1, 38, 21 ),
					new Expression(
						SI( 38, 1, 38, 21 ),
						new Variable( SI( 38, 1, 38, 9 ), "testarr1" ),
						new Operator( SI( 38, 10, 38, 12 ), OT_PUSH ),
						new Variable( SI( 38, 13, 38, 21 ), "testarr2" )
					)
				),
				new Statement(
					SI( 39, 1, 39, 32 ),
					new Expression(
						SI( 39, 5, 39, 32 ),
						new Variable( SI( 39, 5, 39, 13 ), "testarr3", VH_CREATE_VAR ),
						new Operator( SI( 39, 14, 39, 15 ), OT_ASSIGN ),
						new Call(
							SI( 39, 16, 39, 32 ),
							new Expression(
								SI( 39, 16, 39, 22 ),
								new Variable( SI( 39, 16, 39, 22 ), "#clone" )
							),
							{
								new Expression(
									SI( 39, 23, 39, 31 ),
									new Variable( SI( 39, 23, 39, 31 ), "testarr1" )
								),
							}
						)
					)
				),
				new Statement(
					SI( 40, 1, 40, 23 ),
					new Expression(
						SI( 40, 1, 40, 23 ),
						new Expression(
							SI( 40, 1, 40, 12 ),
							new Variable( SI( 40, 1, 40, 9 ), "testarr3" ),
							new Operator( SI( 40, 9, 40, 12 ), OT_AT ),
							new program::Value( SI( 40, 10, 40, 11 ), VALUE( value::Int, , 1 ) )
						),
						new Operator( SI( 40, 13, 40, 14 ), OT_ASSIGN ),
						new program::Value( SI( 40, 15, 40, 23 ), VALUE( value::String, , "SECOND" ) )
					)
				),
				new Statement(
					SI( 41, 1, 41, 48 ),
					new Expression(
						SI( 41, 1, 41, 48 ),
						new Expression(
							SI( 41, 1, 41, 38 ),
							new Variable( SI( 41, 1, 41, 9 ), "testarr3" ),
							new Operator( SI( 41, 9, 41, 38 ), OT_AT ),
							new Expression(
								SI( 41, 11, 41, 36 ),
								new Call(
									SI( 41, 11, 41, 31 ),
									new Expression(
										SI( 41, 11, 41, 22 ),
										new Variable( SI( 41, 11, 41, 22 ), "testmethod2" )
									),
									{
										{
											new Expression(
												SI( 41, 23, 41, 24 ),
												new Variable( SI( 41, 23, 41, 24 ), "a" )
											),
											new Expression(
												SI( 41, 26, 41, 27 ),
												new Variable( SI( 41, 26, 41, 27 ), "b" )
											),
											new Expression(
												SI( 41, 29, 41, 30 ),
												new Variable( SI( 41, 29, 41, 30 ), "c" )
											)
										}
									}
								),
								new Operator( SI( 41, 32, 41, 33 ), OT_ADD ),
								new program::Value( SI( 41, 34, 41, 36 ), VALUE( value::Int, , 61 ) )
							)
						),
						new Operator( SI( 41, 39, 41, 40 ), OT_ASSIGN ),
						new program::Value( SI( 41, 41, 41, 48 ), VALUE( value::String, , "FIRST" ) )
					)
				),
				new Statement(
					SI( 42, 1, 42, 49 ),
					new Expression(
						SI( 42, 1, 42, 49 ),
						new Expression(
							SI( 42, 1, 42, 15 ),
							new Variable( SI( 42, 1, 42, 9 ), "testarr3" ),
							new Operator( SI( 42, 9, 42, 15 ), OT_AT ),
							new Expression(
								SI( 42, 10, 42, 14 ),
								new program::Value( SI( 42, 10, 42, 11 ), VALUE( value::Int, , 2 ) ),
								new Operator( SI( 42, 11, 42, 13 ), OT_RANGE ),
								new program::Value( SI( 42, 13, 42, 14 ), VALUE( value::Int, , 5 ) )
							)
						),
						new Operator( SI( 42, 16, 42, 17 ), OT_ASSIGN ),
						new Expression(
							SI( 42, 18, 42, 49 ),
							new Expression(
								SI( 42, 18, 42, 32 ),
								new Variable( SI( 42, 18, 42, 26 ), "testarr1" ),
								new Operator( SI( 42, 26, 42, 32 ), OT_AT ),
								new Expression(
									SI( 42, 27, 42, 31 ),
									new program::Value( SI( 42, 27, 42, 28 ), VALUE( value::Int, , 0 ) ),
									new Operator( SI( 42, 28, 42, 30 ), OT_RANGE ),
									new program::Value( SI( 42, 30, 42, 31 ), VALUE( value::Int, , 1 ) )
								)
							),
							new Operator( SI( 42, 33, 42, 34 ), OT_ADD ),
							new Expression(
								SI( 42, 35, 42, 49 ),
								new Variable( SI( 42, 35, 42, 43 ), "testarr2" ),
								new Operator( SI( 42, 43, 42, 49 ), OT_AT ),
								new Expression(
									SI( 42, 44, 42, 48 ),
									new program::Value( SI( 42, 44, 42, 45 ), VALUE( value::Int, , 0 ) ),
									new Operator( SI( 42, 45, 42, 47 ), OT_RANGE ),
									new program::Value( SI( 42, 47, 42, 48 ), VALUE( value::Int, , 1 ) )
								)
							)
						)
					)
				),
				new Statement(
					SI( 43, 1, 43, 29 ),
					new Expression(
						SI( 43, 5, 43, 29 ),
						new Variable( SI( 43, 5, 43, 13 ), "testarr4", VH_CREATE_VAR ),
						new Operator( SI( 43, 14, 43, 15 ), OT_ASSIGN ),
						new Expression(
							SI( 43, 16, 43, 29 ),
							new Variable( SI( 43, 16, 43, 24 ), "testarr3" ),
							new Operator( SI( 43, 24, 43, 29 ), OT_AT ),
							new Expression(
								SI( 43, 25, 43, 28 ),
								nullptr,
								new Operator( SI( 43, 25, 43, 27 ), OT_RANGE ),
								new program::Value( SI( 43, 27, 43, 28 ), VALUE( value::Int, , 3 ) )
							)
						)
					)
				),
				new Statement(
					SI( 44, 1, 44, 71 ),
					new Expression(
						SI( 44, 1, 44, 71 ),
						new Expression(
							SI( 44, 1, 44, 39 ),
							new Variable( SI( 44, 1, 44, 9 ), "testarr4" ),
							new Operator( SI( 44, 9, 44, 39 ), OT_AT ),
							new Expression(
								SI( 44, 11, 44, 37 ),
								new Expression(
									SI( 44, 11, 44, 22 ),
									new Expression(
										SI( 44, 11, 44, 16 ),
										new Variable( SI( 44, 11, 44, 12 ), "c" ),
										new Operator( SI( 44, 13, 44, 14 ), OT_ADD ),
										new program::Value( SI( 44, 15, 44, 16 ), VALUE( value::Int, , 1 ) )
									),
									new Operator( SI( 44, 17, 44, 18 ), OT_SUB ),
									new program::Value( SI( 44, 19, 44, 22 ), VALUE( value::Int, , 100 ) )
								),
								new Operator( SI( 44, 23, 44, 25 ), OT_RANGE ),
								new Expression(
									SI( 44, 26, 44, 37 ),
									new Expression(
										SI( 44, 26, 44, 33 ),
										new Variable( SI( 44, 26, 44, 27 ), "c" ),
										new Operator( SI( 44, 28, 44, 29 ), OT_SUB ),
										new program::Value( SI( 44, 30, 44, 33 ), VALUE( value::Int, , 100 ) )
									),
									new Operator( SI( 44, 34, 44, 35 ), OT_ADD ),
									new program::Value( SI( 44, 36, 44, 37 ), VALUE( value::Int, , 2 ) )
								)
							)
						),
						new Operator( SI( 44, 40, 44, 41 ), OT_ASSIGN ),
						new Array(
							SI( 44, 42, 44, 71 ),
							{
								new Expression(
									SI( 44, 44, 44, 55 ),
									new program::Value( SI( 44, 44, 44, 55 ), VALUE( value::String, , "new first" ) )
								),
								new Expression(
									SI( 44, 57, 44, 69 ),
									new program::Value( SI( 44, 57, 44, 69 ), VALUE( value::String, , "new second" ) )
								)
							}
						)
					)
				),
				new Statement(
					SI( 46, 1, 46, 18 ),
					new Expression(
						SI( 46, 5, 46, 18 ),
						new Variable( SI( 46, 5, 46, 13 ), "testobj1", VH_CREATE_VAR ),
						new Operator( SI( 46, 14, 46, 15 ), OT_ASSIGN ),
						new Object( SI( 46, 16, 46, 18 ), {} )
					)
				),
				new Statement(
					SI( 47, 1, 51, 2 ),
					new Expression(
						SI( 47, 5, 51, 2 ),
						new Variable( SI( 47, 5, 47, 13 ), "testobj2", VH_CREATE_VAR ),
						new Operator( SI( 47, 14, 47, 15 ), OT_ASSIGN ),
						new Object(
							SI( 47, 16, 51, 2 ),
							{
								{
									"propertyString",
									new Expression(
										SI( 48, 18, 48, 26 ),
										new program::Value( SI( 48, 18, 48, 26 ), VALUE( value::String, , "STRING" ) )
									)
								},
								{
									"propertyInt1",
									new Expression(
										SI( 49, 16, 49, 27 ),
										new Expression(
											SI( 49, 16, 49, 23 ),
											new program::Value( SI( 49, 16, 49, 19 ), VALUE( value::Int, , 111 ) ),
											new Operator( SI( 49, 20, 49, 21 ), OT_ADD ),
											new Variable( SI( 49, 22, 49, 23 ), "a" )
										),
										new Operator( SI( 49, 24, 49, 25 ), OT_ADD ),
										new Variable( SI( 49, 26, 49, 27 ), "b" )
									)
								},
								{
									"propertyInt2",
									new Expression(
										SI( 50, 16, 50, 19 ),
										new program::Value( SI( 50, 16, 50, 19 ), VALUE( value::Int, , 222 ) )
									)
								}
							}
						)
					)
				),
				new Statement(
					SI( 52, 1, 58, 2 ),
					new Expression(
						SI( 52, 5, 58, 2 ),
						new Variable( SI( 52, 5, 52, 13 ), "testobj3", VH_CREATE_VAR ),
						new Operator( SI( 52, 14, 52, 15 ), OT_ASSIGN ),
						new Object(
							SI( 52, 16, 58, 2 ),
							{
								{
									"child1",
									new Expression(
										SI( 53, 11, 57, 4 ),
										new Object(
											SI( 53, 11, 57, 4 ),
											{
												{
													"child2",
													new Expression(
														SI( 54, 13, 56, 6 ),
														new Object(
															SI( 54, 13, 56, 6 ),
															{
																{
																	"value",
																	new Expression(
																		SI( 55, 14, 55, 27 ),
																		new program::Value( SI( 55, 14, 55, 27 ), VALUE( value::String, , "CHILD VALUE" ) )
																	)
																}
															}
														)
													)
												}
											}
										)
									)
								}
							}
						)
					)
				),
				new Statement(
					SI( 59, 1, 59, 69 ),
					new Expression(
						SI( 59, 1, 59, 69 ),
						new Expression(
							SI( 59, 1, 59, 21 ),
							new Variable( SI( 59, 1, 59, 9 ), "testobj1" ),
							new Operator( SI( 59, 9, 59, 10 ), OT_CHILD ),
							new Variable( SI( 59, 10, 59, 21 ), "propertyInt" )
						),
						new Operator( SI( 59, 22, 59, 23 ), OT_ASSIGN ),
						new Expression(
							SI( 59, 24, 59, 69 ),
							new Expression(
								SI( 59, 24, 59, 45 ),
								new Variable( SI( 59, 24, 59, 32 ), "testobj2" ),
								new Operator( SI( 59, 32, 59, 33 ), OT_CHILD ),
								new Variable( SI( 59, 33, 59, 45 ), "propertyInt1" )
							),
							new Operator( SI( 59, 46, 59, 47 ), OT_ADD ),
							new Expression(
								SI( 59, 48, 59, 69 ),
								new Variable( SI( 59, 48, 59, 56 ), "testobj2" ),
								new Operator( SI( 59, 56, 59, 57 ), OT_CHILD ),
								new Variable( SI( 59, 57, 59, 69 ), "propertyInt2" )
							)
						)
					)
				),
				new Statement(
					SI( 61, 1, 61, 13 ),
					new Expression(
						SI( 61, 5, 61, 13 ),
						new Variable( SI( 61, 5, 61, 6 ), "d", VH_CREATE_VAR ),
						new Operator( SI( 61, 7, 61, 8 ), OT_ASSIGN ),
						new program::Value( SI( 61, 9, 61, 13 ), VALUE( value::Null ) )
					)
				),
				new Statement(
					SI( 62, 1, 62, 14 ),
					new Expression(
						SI( 62, 5, 62, 14 ),
						new Variable( SI( 62, 5, 62, 6 ), "x", VH_CREATE_VAR ),
						new Operator( SI( 62, 7, 62, 8 ), OT_ASSIGN ),
						new Expression(
							SI( 62, 9, 62, 14 ),
							new Variable( SI( 62, 9, 62, 10 ), "a" ),
							new Operator( SI( 62, 11, 62, 12 ), OT_GT ),
							new Variable( SI( 62, 13, 62, 14 ), "b" )
						)
					)
				),
				print(
					64, 6,
					{
						new Expression(
							SI( 64, 14, 64, 15 ),
							new Variable( SI( 64, 14, 64, 15 ), "d" )
						)
					}
				),
				print(
					65, 6,
					{
						new Expression(
							SI( 65, 14, 65, 23 ),
							new Variable( SI( 65, 14, 65, 15 ), "d" ),
							new Operator( SI( 65, 16, 65, 18 ), OT_EQ ),
							new program::Value( SI( 65, 19, 65, 23 ), VALUE( value::Null ) )
						)
					}
				),
				print(
					66, 6,
					{
						new Expression(
							SI( 66, 14, 66, 15 ),
							new Variable( SI( 66, 14, 66, 15 ), "x" )
						),
						new Expression(
							SI( 66, 17, 66, 27 ),
							new Variable( SI( 66, 17, 66, 18 ), "x" ),
							new Operator( SI( 66, 19, 66, 21 ), OT_EQ ),
							new Expression(
								SI( 66, 22, 66, 27 ),
								new Variable( SI( 66, 22, 66, 23 ), "b" ),
								new Operator( SI( 66, 24, 66, 25 ), OT_GT ),
								new Variable( SI( 66, 26, 66, 27 ), "c" )
							)
						)
					}
				),
				print(
					68, 6,
					{
						new Expression(
							SI( 68, 14, 68, 20 ),
							new Variable( SI( 68, 14, 68, 15 ), "a" ),
							new Operator( SI( 68, 16, 68, 18 ), OT_NE ),
							new Variable( SI( 68, 19, 68, 20 ), "b" )
						),
						new Expression(
							SI( 68, 22, 68, 28 ),
							new Variable( SI( 68, 22, 68, 23 ), "b" ),
							new Operator( SI( 68, 24, 68, 26 ), OT_NE ),
							new Variable( SI( 68, 27, 68, 28 ), "c" )
						),
						new Expression(
							SI( 68, 30, 68, 36 ),
							new Variable( SI( 68, 30, 68, 31 ), "c" ),
							new Operator( SI( 68, 32, 68, 34 ), OT_NE ),
							new Variable( SI( 68, 35, 68, 36 ), "a" )
						),
						new Expression(
							SI( 68, 38, 68, 44 ),
							new Variable( SI( 68, 38, 68, 39 ), "a" ),
							new Operator( SI( 68, 40, 68, 42 ), OT_NE ),
							new Variable( SI( 68, 43, 68, 44 ), "a" )
						),
					}
				),
				print(
					69, 6,
					{
						new Expression(
							SI( 69, 14, 69, 19 ),
							new Variable( SI( 69, 14, 69, 15 ), "a" ),
							new Operator( SI( 69, 16, 69, 17 ), OT_GT ),
							new Variable( SI( 69, 18, 69, 19 ), "b" )
						),
						new Expression(
							SI( 69, 21, 69, 26 ),
							new Variable( SI( 69, 21, 69, 22 ), "b" ),
							new Operator( SI( 69, 23, 69, 24 ), OT_GT ),
							new Variable( SI( 69, 25, 69, 26 ), "c" )
						)
					}
				),
				print(
					70, 6,
					{
						new Expression(
							SI( 70, 14, 70, 20 ),
							new Variable( SI( 70, 14, 70, 15 ), "b" ),
							new Operator( SI( 70, 16, 70, 18 ), OT_GTE ),
							new Variable( SI( 70, 19, 70, 20 ), "a" )
						),
						new Expression(
							SI( 70, 22, 70, 28 ),
							new Variable( SI( 70, 22, 70, 23 ), "a" ),
							new Operator( SI( 70, 24, 70, 26 ), OT_GTE ),
							new program::Value( SI( 70, 27, 70, 28 ), VALUE( value::Int, , 2 ) )
						),
						new Expression(
							SI( 70, 30, 70, 38 ),
							new Variable( SI( 70, 30, 70, 31 ), "c" ),
							new Operator( SI( 70, 32, 70, 34 ), OT_LTE ),
							new program::Value( SI( 70, 35, 70, 38 ), VALUE( value::Int, , 200 ) )
						),
						new Expression(
							SI( 70, 40, 70, 48 ),
							new Variable( SI( 70, 40, 70, 41 ), "a" ),
							new Operator( SI( 70, 42, 70, 44 ), OT_LTE ),
							new program::Value( SI( 70, 45, 70, 48 ), VALUE( value::Int, , 200 ) )
						)
					}
				),
				print(
					71, 6,
					{
						new Expression(
							SI( 71, 14, 71, 21 ),
							new program::Value( SI( 71, 14, 71, 16 ), VALUE( value::Int, , 10 ) ),
							new Operator( SI( 71, 17, 71, 18 ), OT_LT ),
							new program::Value( SI( 71, 19, 71, 21 ), VALUE( value::Int, , 10 ) )
						),
						new Expression(
							SI( 71, 23, 71, 31 ),
							new program::Value( SI( 71, 23, 71, 25 ), VALUE( value::Int, , 10 ) ),
							new Operator( SI( 71, 26, 71, 28 ), OT_LTE ),
							new program::Value( SI( 71, 29, 71, 31 ), VALUE( value::Int, , 10 ) )
						),
						new Expression(
							SI( 71, 33, 71, 38 ),
							new Variable( SI( 71, 33, 71, 34 ), "a" ),
							new Operator( SI( 71, 35, 71, 36 ), OT_LT ),
							new Variable( SI( 71, 37, 71, 38 ), "a" )
						),
						new Expression(
							SI( 71, 40, 71, 46 ),
							new Variable( SI( 71, 40, 71, 41 ), "a" ),
							new Operator( SI( 71, 42, 71, 44 ), OT_LTE ),
							new Variable( SI( 71, 45, 71, 46 ), "a" )
						)
					}
				),
				print(
					72, 6,
					{
						new Expression(
							SI( 72, 14, 72, 26 ),
							new program::Value( SI( 72, 14, 72, 18 ), VALUE( value::Bool, , true ) ),
							new Operator( SI( 72, 19, 72, 21 ), OT_AND ),
							new program::Value( SI( 72, 22, 72, 26 ), VALUE( value::Bool, , true ) )
						),
						new Expression(
							SI( 72, 28, 72, 41 ),
							new program::Value( SI( 72, 28, 72, 32 ), VALUE( value::Bool, , true ) ),
							new Operator( SI( 72, 33, 72, 35 ), OT_AND ),
							new program::Value( SI( 72, 36, 72, 41 ), VALUE( value::Bool, , false ) )
						),
						new Expression(
							SI( 72, 43, 72, 55 ),
							new program::Value( SI( 72, 43, 72, 47 ), VALUE( value::Bool, , true ) ),
							new Operator( SI( 72, 48, 72, 50 ), OT_OR ),
							new program::Value( SI( 72, 51, 72, 55 ), VALUE( value::Bool, , true ) )
						),
						new Expression(
							SI( 72, 57, 72, 70 ),
							new program::Value( SI( 72, 57, 72, 61 ), VALUE( value::Bool, , true ) ),
							new Operator( SI( 72, 62, 72, 64 ), OT_OR ),
							new program::Value( SI( 72, 65, 72, 70 ), VALUE( value::Bool, , false ) )
						)
					}
				),
				print(
					73, 6,
					{
						new Expression(
							SI( 73, 17, 73, 85 ),
							new Expression(
								SI( 73, 17, 73, 36 ),
								new Expression(
									SI( 73, 17, 73, 23 ),
									new program::Value( SI( 73, 17, 73, 18 ), VALUE( value::Int, , 5 ) ),
									new Operator( SI( 73, 19, 73, 20 ), OT_GT ),
									new program::Value( SI( 73, 21, 73, 23 ), VALUE( value::Int, , 10 ) )
								),
								new Operator( SI( 73, 26, 73, 28 ), OT_AND ),
								new Expression(
									SI( 73, 31, 73, 36 ),
									new program::Value( SI( 73, 31, 73, 32 ), VALUE( value::Int, , 2 ) ),
									new Operator( SI( 73, 33, 73, 34 ), OT_GT ),
									new program::Value( SI( 73, 35, 73, 36 ), VALUE( value::Int, , 1 ) )
								)
							),
							new Operator( SI( 73, 40, 73, 42 ), OT_OR ),
							new Expression(
								SI( 73, 46, 73, 85 ),
								new Expression(
									SI( 73, 46, 73, 68 ),
									new Expression(
										SI( 73, 46, 73, 53 ),
										new program::Value( SI( 73, 46, 73, 47 ), VALUE( value::Int, , 5 ) ),
										new Operator( SI( 73, 48, 73, 50 ), OT_LTE ),
										new program::Value( SI( 73, 51, 73, 53 ), VALUE( value::Int, , 10 ) )
									),
									new Operator( SI( 73, 56, 73, 58 ), OT_AND ),
									new Expression(
										SI( 73, 59, 73, 68 ),
										nullptr,
										new Operator( SI( 73, 59, 73, 60 ), OT_NOT ),
										new Expression(
											SI( 73, 62, 73, 68 ),
											new program::Value( SI( 73, 62, 73, 63 ), VALUE( value::Int, , 5 ) ),
											new Operator( SI( 73, 64, 73, 65 ), OT_GT ),
											new program::Value( SI( 73, 66, 73, 68 ), VALUE( value::Int, , 35 ) )
										)
									)
								),
								new Operator( SI( 73, 71, 73, 73 ), OT_AND ),
								new Expression(
									SI( 73, 76, 73, 85 ),
									new program::Value( SI( 73, 76, 73, 79 ), VALUE( value::Int, , 100 ) ),
									new Operator( SI( 73, 80, 73, 82 ), OT_GTE ),
									new program::Value( SI( 73, 83, 73, 85 ), VALUE( value::Int, , 20 ) )
								)
							)
						)
					}
				),
				print(
					74, 6,
					{
						new Expression(
							SI( 74, 13, 74, 35 ),
							new Call(
								SI( 74, 13, 74, 35 ),
								new Expression(
									SI( 74, 13, 74, 24 ),
									new Variable( SI( 74, 13, 74, 24 ), "testmethod1" )
								),
								{
									new Expression(
										SI( 74, 25, 74, 27 ),
										new program::Value( SI( 74, 25, 74, 27 ), VALUE( value::Int, , 11 ) )
									),
									new Expression(
										SI( 74, 29, 74, 30 ),
										new Variable( SI( 74, 29, 74, 30 ), "b" )
									),
									new Expression(
										SI( 74, 32, 74, 34 ),
										new program::Value( SI( 74, 32, 74, 34 ), VALUE( value::Int, , 20 ) )
									)
								}
							)
						),
						new Expression(
							SI( 74, 37, 74, 57 ),
							new Call(
								SI( 74, 37, 74, 57 ),
								new Expression(
									SI( 74, 37, 74, 48 ),
									new Variable( SI( 74, 37, 74, 48 ), "testmethod2" )
								),
								{
									new Expression(
										SI( 74, 49, 74, 50 ),
										new Variable( SI( 74, 49, 74, 50 ), "a" )
									),
									new Expression(
										SI( 74, 52, 74, 53 ),
										new Variable( SI( 74, 52, 74, 53 ), "b" )
									),
									new Expression(
										SI( 74, 55, 74, 56 ),
										new Variable( SI( 74, 55, 74, 56 ), "c" )
									)
								}
							)
						)
					}
				),
				new Statement(
					SI( 75, 1, 75, 29 ),
					new Expression(
						SI( 75, 5, 75, 29 ),
						new Variable( SI( 75, 5, 75, 15 ), "testmethod", VH_CREATE_VAR ),
						new Operator( SI( 75, 16, 75, 17 ), OT_ASSIGN ),
						new Variable( SI( 75, 18, 75, 29 ), "testmethod1" )
					)
				),
				print(
					76, 6,
					{
						new Expression(
							SI( 76, 14, 76, 134 ),
							new Call(
								SI( 76, 14, 76, 134 ),
								new Expression(
									SI( 76, 14, 76, 24 ),
									new Variable( SI( 76, 14, 76, 24 ), "testmethod" )
								),
								{
									new Expression(
										SI( 76, 26, 76, 27 ),
										new program::Value( SI( 76, 26, 76, 27 ), VALUE( value::Int, , 1 ) )
									),
									new Expression(
										SI( 76, 29, 76, 90 ),
										new Call(
											SI( 76, 29, 76, 90 ),
											new Expression(
												SI( 76, 29, 76, 39 ),
												new Variable( SI( 76, 29, 76, 39 ), "testmethod" )
											),
											{
												new Expression(
													SI( 76, 41, 76, 42 ),
													new program::Value( SI( 76, 41, 76, 42 ), VALUE( value::Int, , 2 ) )
												),
												new Expression(
													SI( 76, 44, 76, 65 ),
													new Call(
														SI( 76, 44, 76, 65 ),
														new Expression(
															SI( 76, 44, 76, 54 ),
															new Variable( SI( 76, 44, 76, 54 ), "testmethod" )
														),
														{
															new Expression(
																SI( 76, 56, 76, 57 ),
																new program::Value( SI( 76, 56, 76, 57 ), VALUE( value::Int, , 3 ) )
															),
															new Expression(
																SI( 76, 59, 76, 60 ),
																new program::Value( SI( 76, 59, 76, 60 ), VALUE( value::Int, , 3 ) )
															),
															new Expression(
																SI( 76, 62, 76, 63 ),
																new program::Value( SI( 76, 62, 76, 63 ), VALUE( value::Int, , 3 ) )
															)
														}
													)
												),
												new Expression(
													SI( 76, 67, 76, 88 ),
													new Call(
														SI( 76, 67, 76, 88 ),
														new Expression(
															SI( 76, 67, 76, 77 ),
															new Variable( SI( 76, 67, 76, 77 ), "testmethod" )
														),
														{
															new Expression(
																SI( 76, 79, 76, 80 ),
																new program::Value( SI( 76, 79, 76, 80 ), VALUE( value::Int, , 4 ) )
															),
															new Expression(
																SI( 76, 82, 76, 83 ),
																new program::Value( SI( 76, 82, 76, 83 ), VALUE( value::Int, , 4 ) )
															),
															new Expression(
																SI( 76, 85, 76, 86 ),
																new program::Value( SI( 76, 85, 76, 86 ), VALUE( value::Int, , 4 ) )
															)
														}
													)
												)
											}
										)
									),
									new Expression(
										SI( 76, 92, 76, 132 ),
										new Call(
											SI( 76, 92, 76, 132 ),
											new Expression(
												SI( 76, 92, 76, 102 ),
												new Variable( SI( 76, 92, 76, 102 ), "testmethod" )
											),
											{
												new Expression(
													SI( 76, 104, 76, 105 ),
													new program::Value( SI( 76, 104, 76, 105 ), VALUE( value::Int, , 5 ) )
												),
												new Expression(
													SI( 76, 107, 76, 108 ),
													new program::Value( SI( 76, 107, 76, 108 ), VALUE( value::Int, , 5 ) )
												),
												new Expression(
													SI( 76, 110, 76, 131 ),
													new Call(
														SI( 76, 110, 76, 131 ),
														new Expression(
															SI( 76, 110, 76, 120 ),
															new Variable( SI( 76, 110, 76, 120 ), "testmethod" )
														),
														{
															new Expression(
																SI( 76, 122, 76, 123 ),
																new program::Value( SI( 76, 122, 76, 123 ), VALUE( value::Int, , 6 ) )
															),
															new Expression(
																SI( 76, 125, 76, 126 ),
																new program::Value( SI( 76, 125, 76, 126 ), VALUE( value::Int, , 6 ) )
															),
															new Expression(
																SI( 76, 128, 76, 129 ),
																new program::Value( SI( 76, 128, 76, 129 ), VALUE( value::Int, , 6 ) )
															)
														}
													)
												)
											}
										)
									)
								}
							)
						),
						new Expression(
							SI( 76, 136, 76, 138 ),
							new program::Value( SI( 76, 136, 76, 138 ), VALUE( value::Int, , 10 ) )
						)
					}
				),
				print(
					77, 6,
					{
						new Expression(
							SI( 77, 14, 77, 22 ),
							new Variable( SI( 77, 14, 77, 22 ), "testarr1" )
						)
					}
				),
				print(
					77, 31,
					{
						new Expression(
							SI( 77, 39, 77, 47 ),
							new Variable( SI( 77, 39, 77, 47 ), "testarr2" )
						)
					}
				),
				print(
					77, 56,
					{
						new Expression(
							SI( 77, 64, 77, 72 ),
							new Variable( SI( 77, 64, 77, 72 ), "testarr3" )
						)
					}
				),
				print(
					77, 81,
					{
						new Expression(
							SI( 77, 89, 77, 97 ),
							new Variable( SI( 77, 89, 77, 97 ), "testarr4" )
						)
					}
				),
				print(
					78, 6,
					{
						new Expression(
							SI( 78, 14, 78, 25 ),
							new Variable( SI( 78, 14, 78, 22 ), "testarr1" ),
							new Operator( SI( 78, 22, 78, 25 ), OT_AT ),
							new program::Value( SI( 78, 23, 78, 24 ), VALUE( value::Int, , 0 ) )
						)
					}
				),
				print(
					78, 34,
					{
						new Expression(
							SI( 78, 42, 78, 53 ),
							new Variable( SI( 78, 42, 78, 50 ), "testarr1" ),
							new Operator( SI( 78, 50, 78, 53 ), OT_AT ),
							new program::Value( SI( 78, 51, 78, 52 ), VALUE( value::Int, , 1 ) )
						)
					}
				),
				print(
					78, 62,
					{
						new Expression(
							SI( 78, 70, 78, 84 ),
							new Variable( SI( 78, 70, 78, 78 ), "testarr1" ),
							new Operator( SI( 78, 78, 78, 84 ), OT_AT ),
							new Expression(
								SI( 78, 79, 78, 83 ),
								new program::Value( SI( 78, 79, 78, 80 ), VALUE( value::Int, , 0 ) ),
								new Operator( SI( 78, 80, 78, 82 ), OT_RANGE ),
								new program::Value( SI( 78, 82, 78, 83 ), VALUE( value::Int, , 1 ) )
							)
						)
					}
				),
				print(
					79, 6,
					{
						new Expression(
							SI( 79, 14, 79, 27 ),
							new Variable( SI( 79, 14, 79, 22 ), "testarr1" ),
							new Operator( SI( 79, 22, 79, 27 ), OT_AT ),
							new Expression(
								SI( 79, 23, 79, 26 ),
								new program::Value( SI( 79, 23, 79, 24 ), VALUE( value::Int, , 5 ) ),
								new Operator( SI( 79, 24, 79, 26 ), OT_RANGE ),
								nullptr
							)
						)
					}
				),
				print(
					79, 36,
					{
						new Expression(
							SI( 79, 44, 79, 57 ),
							new Variable( SI( 79, 44, 79, 52 ), "testarr1" ),
							new Operator( SI( 79, 52, 79, 57 ), OT_AT ),
							new Expression(
								SI( 79, 53, 79, 56 ),
								nullptr,
								new Operator( SI( 79, 53, 79, 55 ), OT_RANGE ),
								new program::Value( SI( 79, 55, 79, 56 ), VALUE( value::Int, , 3 ) )
							)
						)
					}
				),
				print(
					80, 6,
					{
						new Expression(
							SI( 80, 14, 80, 45 ),
							new Expression(
								SI( 80, 14, 80, 28 ),
								new Variable( SI( 80, 14, 80, 22 ), "testarr1" ),
								new Operator( SI( 80, 22, 80, 28 ), OT_AT ),
								new Expression(
									SI( 80, 23, 80, 27 ),
									new program::Value( SI( 80, 23, 80, 24 ), VALUE( value::Int, , 4 ) ),
									new Operator( SI( 80, 24, 80, 26 ), OT_RANGE ),
									new program::Value( SI( 80, 26, 80, 27 ), VALUE( value::Int, , 5 ) )
								)
							),
							new Operator( SI( 80, 29, 80, 30 ), OT_ADD ),
							new Expression(
								SI( 80, 31, 80, 45 ),
								new Variable( SI( 80, 31, 80, 39 ), "testarr1" ),
								new Operator( SI( 80, 39, 80, 45 ), OT_AT ),
								new Expression(
									SI( 80, 40, 80, 44 ),
									new program::Value( SI( 80, 40, 80, 41 ), VALUE( value::Int, , 2 ) ),
									new Operator( SI( 80, 41, 80, 43 ), OT_RANGE ),
									new program::Value( SI( 80, 43, 80, 44 ), VALUE( value::Int, , 3 ) )
								)
							)
						)
					}
				),
				print(
					81, 6,
					{
						new Expression(
							SI( 81, 13, 81, 41 ),
							new Expression(
								SI( 81, 13, 81, 35 ),
								new Expression(
									SI( 81, 13, 81, 28 ),
									new Variable( SI( 81, 13, 81, 21 ), "testobj3" ),
									new Operator( SI( 81, 21, 81, 22 ), OT_CHILD ),
									new Variable( SI( 81, 22, 81, 28 ), "child1" )
								),
								new Operator( SI( 81, 28, 81, 29 ), OT_CHILD ),
								new Variable( SI( 81, 29, 81, 35 ), "child2" )
							),
							new Operator( SI( 81, 35, 81, 36 ), OT_CHILD ),
							new Variable( SI( 81, 36, 81, 41 ), "value" )
						)
					}
				),
				print(
					82, 6,
					{
						new Expression(
							SI( 82, 13, 82, 44 ),
							new Expression(
								SI( 82, 13, 82, 33 ),
								new Variable( SI( 82, 13, 82, 21 ), "testobj1" ),
								new Operator( SI( 82, 21, 82, 22 ), OT_CHILD ),
								new Variable( SI( 82, 22, 82, 33 ), "propertyInt" )
							),
							new Operator( SI( 82, 34, 82, 36 ), OT_EQ ),
							new Expression(
								SI( 82, 37, 82, 44 ),
								new program::Value( SI( 82, 37, 82, 40 ), VALUE( value::Int, , 272 ) ),
								new Operator( SI( 82, 41, 82, 42 ), OT_ADD ),
								new Variable( SI( 82, 43, 82, 44 ), "c" )
							)
						)
					}
				),
				print(
					82, 52,
					{
						new Expression(
							SI( 82, 59, 82, 67 ),
							new Variable( SI( 82, 59, 82, 67 ), "testobj1" )
						),
						new Expression(
							SI( 82, 69, 82, 77 ),
							new Variable( SI( 82, 69, 82, 77 ), "testobj2" )
						),
					}
				),
				new If(
					SI( 84, 1, 86, 2 ),
					new SimpleCondition(
						SI( 84, 4, 84, 5 ),
						new Expression(
							SI( 84, 6, 84, 11 ),
							new Variable( SI( 84, 6, 84, 7 ), "a" ),
							new Operator( SI( 84, 8, 84, 9 ), OT_GT ),
							new Variable( SI( 84, 10, 84, 11 ), "b" )
						)
					),
					new Scope(
						SI( 85, 8, 85, 24 ),
						{
							print(
								85, 8,
								{
									new Expression(
										SI( 85, 16, 85, 21 ),
										new program::Value( SI( 85, 16, 85, 21 ), VALUE( value::String, , "YES" ) )
									)
								}
							)
						}
					),
					new Else(
						SI( 87, 1, 89, 2 ),
						new Scope(
							SI( 88, 3, 88, 23 ),
							{
								print(
									88, 8,
									{
										new Expression(
											SI( 88, 16, 88, 20 ),
											new program::Value( SI( 88, 16, 88, 20 ), VALUE( value::String, , "NO" ) )
										)
									}
								)
							}
						)
					)
				),
				new If(
					SI( 90, 1, 92, 2 ),
					new SimpleCondition(
						SI( 90, 4, 90, 5 ),
						new Expression(
							SI( 90, 6, 90, 11 ),
							new Variable( SI( 90, 6, 90, 7 ), "b" ),
							new Operator( SI( 90, 8, 90, 9 ), OT_GT ),
							new Variable( SI( 90, 10, 90, 11 ), "a" )
						)
					),
					new Scope(
						SI( 91, 8, 91, 24 ),
						{
							print(
								91, 8,
								{
									new Expression(
										SI( 91, 16, 91, 21 ),
										new program::Value( SI( 91, 16, 91, 21 ), VALUE( value::String, , "YES" ) )
									)
								}
							)
						}
					),
					new Else(
						SI( 93, 1, 95, 2 ),
						new Scope(
							SI( 94, 3, 94, 23 ),
							{
								print(
									94, 8,
									{
										new Expression(
											SI( 94, 16, 94, 20 ),
											new program::Value( SI( 94, 16, 94, 20 ), VALUE( value::String, , "NO" ) )
										)
									}
								)
							}
						)
					)
				),
				new If(
					SI( 96, 1, 96, 41 ),
					new SimpleCondition(
						SI( 96, 4, 96, 5 ),
						new Expression(
							SI( 96, 6, 96, 11 ),
							new program::Value( SI( 96, 6, 96, 11 ), VALUE( value::Bool, , false ) )
						)
					),
					new Scope(
						SI( 96, 21, 96, 39 ),
						{
							print(
								96, 21,
								{
									new Expression(
										SI( 96, 29, 96, 36 ),
										new program::Value( SI( 96, 29, 96, 36 ), VALUE( value::String, , "FALSE" ) )
									)
								}
							)
						}
					)
				),
				new If(
					SI( 97, 1, 99, 2 ),
					new SimpleCondition(
						SI( 97, 4, 97, 5 ),
						new Expression(
							SI( 97, 6, 97, 11 ),
							new program::Value( SI( 97, 6, 97, 11 ), VALUE( value::Bool, , false ) )
						)
					),
					new Scope(
						SI( 98, 8, 98, 23 ),
						{
							print(
								98, 8,
								{
									new Expression(
										SI( 98, 15, 98, 21 ),
										new program::Value( SI( 98, 15, 98, 21 ), VALUE( value::String, , "FAIL" ) )
									)
								}
							)
						}
					),
					new If(
						SI( 99, 3, 101, 2 ),
						new SimpleCondition(
							SI( 99, 3, 101, 2 ),
							new Expression(
								SI( 99, 12, 99, 17 ),
								new program::Value( SI( 99, 12, 99, 17 ), VALUE( value::Bool, , false ) )
							)
						),
						new Scope(
							SI( 100, 3, 100, 25 ),
							{
								print(
									100, 8,
									{
										new Expression(
											SI( 100, 16, 100, 22 ),
											new program::Value( SI( 100, 16, 100, 22 ), VALUE( value::String, , "FAIL" ) )
										)
									}
								)
							}
						),
						new If(
							SI( 101, 3, 103, 2 ),
							new SimpleCondition(
								SI( 101, 3, 103, 2 ),
								new Expression(
									SI( 101, 12, 101, 16 ),
									new program::Value( SI( 101, 12, 101, 16 ), VALUE( value::Bool, , true ) )
								)
							),
							new Scope(
								SI( 102, 3, 102, 23 ),
								{
									print(
										102, 8,
										{
											new Expression(
												SI( 102, 16, 102, 20 ),
												new program::Value( SI( 102, 16, 102, 20 ), VALUE( value::String, , "OK" ) )
											)
										}
									)
								}
							),
							new Else(
								SI( 103, 3, 105, 2 ),
								new Scope(
									SI( 104, 3, 104, 25 ),
									{
										print(
											104, 8,
											{
												new Expression(
													SI( 104, 16, 104, 22 ),
													new program::Value( SI( 104, 16, 104, 22 ), VALUE( value::String, , "FAIL" ) )
												)
											}
										)
									}
								)
							)
						)
					)
				),
				new Statement(
					SI( 107, 1, 107, 10 ),
					new Expression(
						SI( 107, 5, 107, 10 ),
						new Variable( SI( 107, 5, 107, 6 ), "i", VH_CREATE_VAR ),
						new Operator( SI( 107, 7, 107, 8 ), OT_ASSIGN ),
						new program::Value( SI( 107, 9, 107, 10 ), VALUE( value::Int, , 0 ) )
					)
				),
				new While(
					SI( 108, 1, 110, 2 ),
					new SimpleCondition(
						SI( 108, 7, 108, 8 ),
						new Expression(
							SI( 108, 9, 108, 16 ),
							new Expression(
								SI( 108, 9, 108, 12 ),
								new Variable( SI( 108, 9, 108, 10 ), "i" ),
								new Operator( SI( 108, 10, 108, 12 ), OT_INC )
							),
							new Operator( SI( 108, 13, 108, 14 ), OT_LT ),
							new program::Value( SI( 108, 15, 108, 16 ), VALUE( value::Int, , 5 ) )
						)
					),
					new Scope(
						SI( 109, 8, 109, 18 ),
						{
							print(
								109, 8,
								{
									new Expression(
										SI( 109, 15, 109, 16 ),
										new Variable( SI( 109, 15, 109, 16 ), "i" )
									)
								}
							)
						}
					)
				),
				new Try(
					SI( 112, 1, 120, 2 ),
					new Scope(
						SI( 113, 8, 119, 36 ),
						{
							print(
								113, 8,
								{
									new Expression(
										SI( 113, 16, 113, 34 ),
										new program::Value( SI( 113, 16, 113, 34 ), VALUE( value::String, , "BEFORE EXCEPTION" ) )
									)
								}
							),
							new Statement(
								SI( 114, 3, 117, 4 ),
								new Expression(
									SI( 114, 7, 117, 4 ),
									new Variable( SI( 114, 7, 114, 15 ), "failfunc", VH_CREATE_VAR ),
									new Operator( SI( 114, 16, 114, 17 ), OT_ASSIGN ),
									new Function(
										SI( 114, 18, 117, 4 ),
										{},
										new Scope(
											SI( 115, 10, 116, 43 ),
											{
												print(
													115, 10,
													{
														new Expression(
															SI( 115, 17, 115, 27 ),
															new program::Value( SI( 115, 17, 115, 27 ), VALUE( value::String, , "failfunc" ) )
														),
													}
												),
												new Statement(
													SI( 116, 5, 116, 42 ),
													new Expression(
														SI( 116, 5, 116, 42 ),
														nullptr,
														new Operator( SI( 116, 5, 116, 10 ), OT_THROW ),
														new Call(
															SI( 116, 11, 116, 42 ),
															new Expression(
																SI( 116, 11, 116, 20 ),
																new Variable( SI( 116, 11, 116, 20 ), "TestError" )
															),
															{
																new Expression(
																	SI( 116, 21, 116, 41 ),
																	new program::Value( SI( 116, 21, 116, 41 ), VALUE( value::String, , "something happened" ) )
																)
															}
														)
													)
												),
											}
										)
									)
								)
							),
							new Statement(
								SI( 118, 3, 118, 13 ),
								new Expression(
									SI( 118, 3, 118, 13 ),
									new Call(
										SI( 118, 3, 118, 13 ),
										new Expression(
											SI( 118, 3, 118, 11 ),
											new Variable( SI( 118, 3, 118, 11 ), "failfunc" )
										),
										{}
									)
								)
							),
							print(
								119, 8,
								{
									new Expression(
										SI( 119, 16, 119, 33 ),
										new program::Value( SI( 119, 16, 119, 33 ), VALUE( value::String, , "AFTER EXCEPTION" ) )
									)
								}
							),
						}
					),
					new Catch(
						SI( 121, 1, 129, 2 ),
						new Object(
							SI( 121, 7, 129, 2 ),
							{
								{
									"UnknownError",
									new Expression(
										SI( 122, 17, 124, 4 ),
										new Function(
											SI( 122, 17, 124, 4 ),
											{
												new Variable( SI( 122, 18, 122, 19 ), "e" )
											}, new Scope(
												SI( 123, 10, 123, 40 ),
												{
													print(
														123, 10,
														{
															new Expression(
																SI( 123, 17, 123, 38 ),
																new program::Value( SI( 123, 17, 123, 38 ), VALUE( value::String, , "shouldnt catch this" ) )
															)
														}
													)
												}
											)
										)
									)
								},
								{
									"TestError",
									new Expression(
										SI( 125, 14, 128, 4 ),
										new Function(
											SI( 125, 14, 128, 4 ),
											{
												new Variable( SI( 125, 15, 125, 16 ), "e" )
											}, new Scope(
												SI( 126, 10, 127, 31 ),
												{
													print(
														126, 10,
														{
															new Expression(
																SI( 126, 17, 126, 54 ),
																new Expression(
																	SI( 126, 17, 126, 43 ),
																	new Expression(
																		SI( 126, 17, 126, 35 ),
																		new program::Value( SI( 126, 17, 126, 26 ), VALUE( value::String, , "CAUGHT " ) ),
																		new Operator( SI( 126, 27, 126, 28 ), OT_ADD ),
																		new Expression(
																			SI( 126, 29, 126, 35 ),
																			new Variable( SI( 126, 29, 126, 30 ), "e" ),
																			new Operator( SI( 126, 30, 126, 31 ), OT_CHILD ),
																			new Variable( SI( 126, 31, 126, 35 ), "type" )
																		)
																	),
																	new Operator( SI( 126, 36, 126, 37 ), OT_ADD ),
																	new program::Value( SI( 126, 38, 126, 43 ), VALUE( value::String, , " : " ) )
																),
																new Operator( SI( 126, 44, 126, 45 ), OT_ADD ),
																new Expression(
																	SI( 126, 46, 126, 54 ),
																	new Variable( SI( 126, 46, 126, 47 ), "e" ),
																	new Operator( SI( 126, 47, 126, 48 ), OT_CHILD ),
																	new Variable( SI( 126, 48, 126, 54 ), "reason" )
																)
															)
														}
													),
													print(
														127, 10,
														{
															new Expression(
																SI( 127, 17, 127, 29 ),
																new Variable( SI( 127, 17, 127, 18 ), "e" ),
																new Operator( SI( 127, 18, 127, 19 ), OT_CHILD ),
																new Variable( SI( 127, 19, 127, 29 ), "stacktrace" )
															)
														}
													)
												}
											)
										)
									)
								}
							}
						)
					)
				),
				print(
					132, 6,
					{
						new Expression(
							SI( 132, 13, 132, 19 ),
							new program::Value( SI( 132, 13, 132, 19 ), VALUE( value::String, , "bye!" ) )
						)
					}
				),
			}
		), true
	);
	return program;
}

const std::string& GetExpectedResult() {
	const static std::string result = "null\n"
									  "true\n"
									  "true false\n"
									  "true true true false\n"
									  "true false\n"
									  "false true true true\n"
									  "false true false true\n"
									  "true false true true\n"
									  "true\n"
									  "45 -61\n"
									  "52 10\n"
									  "[ first, second, 6, 3, TEST, { key1: value1, key2: value2 }, [ 3, TEST, { key1: value1, key2: value2 } ] ]\n"
									  "[ 3, TEST, { key1: value1, key2: value2 } ]\n"
									  "[ FIRST, SECOND, first, second, 3, TEST, [ 3, TEST, { key1: value1, key2: value2 } ] ]\n"
									  "[ FIRST, new first, new second, second ]\n"
									  "first\n"
									  "second\n"
									  "[ first, second ]\n"
									  "[ { key1: value1, key2: value2 }, [ 3, TEST, { key1: value1, key2: value2 } ] ]\n"
									  "[ first, second, 6, 3 ]\n"
									  "[ TEST, { key1: value1, key2: value2 }, 6, 3 ]\n"
									  "CHILD VALUE\n"
									  "true\n"
									  "{ propertyInt: 372 } { propertyInt1: 150, propertyInt2: 222, propertyString: STRING }\n"
									  "YES\n"
									  "NO\n"
									  "OK\n"
									  "1\n"
									  "2\n"
									  "3\n"
									  "4\n"
									  "5\n"
									  "BEFORE EXCEPTION\n"
									  "failfunc\n"
									  "CAUGHT TestError : something happened\n"
									  "[ \tat <TEST>.gls.js:116: throw TestError('something happened');, \tat <TEST>.gls.js:118: failfunc(); ]\n"
									  "bye!\n";
	return result;
}

}
}
