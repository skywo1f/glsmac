#include "Player.h"

#include <memory>

#include "game/backend/faction/Faction.h"
#include "game/backend/slot/Slot.h"
#include "game/backend/State.h"
#include "game/backend/slot/Slots.h"

#include "gse/value/String.h"
#include "gse/value/Bool.h"
#include "gse/value/Int.h"
#include "gse/value/Array.h"
#include "gse/value/Object.h"

#include "engine/Engine.h"
#include "Game.h"

namespace game {
namespace backend {

Player::Player( types::Buffer buf ) {
	Player::Deserialize( buf );
}

Player::Player(
	const std::string& name,
	const role_t role,
	faction::Faction* faction,
	const std::string& difficulty_level
)
	: m_name( name )
	, m_role( role )
	, m_faction( faction )
	, m_difficulty_level( difficulty_level ) {}

Player::Player( const Player* const other ) {
	m_is_connected = other->m_is_connected;
	m_name = other->m_name;
	m_role = other->m_role;
	m_slot = other->m_slot;
	m_slotnum = other->m_slotnum;
	m_faction = other->m_faction;
	m_difficulty_level = other->m_difficulty_level;
	m_is_turn_completed = other->m_is_turn_completed;
	m_technologies = other->m_technologies;
	m_research_target = other->m_research_target;
	m_research_progress = other->m_research_progress;
	m_energy_credits = other->m_energy_credits;
}

Player::~Player() {
	ReleaseOwnedFaction();
}

const std::string& Player::GetPlayerName() const {
	return m_name;
}

const std::string Player::GetFullName() const {
	return GetPlayerName() + " (" + m_faction->m_name + ")";
}

void Player::Connect() {
	ASSERT( !m_is_connected, "player already connected" );
	m_is_connected = true;
}

void Player::Disconnect() {
	ASSERT( m_is_connected, "player not connected" );
	m_is_connected = false;
}

const bool Player::IsConnected() const {
	return m_is_connected;
}

void Player::SetFaction( faction::Faction* faction ) {
	// TODO: validate?
	if ( m_faction != faction ) {
		ReleaseOwnedFaction();
		m_faction = faction;
	}
}

void Player::ClearFaction() {
	ReleaseOwnedFaction();
}

faction::Faction* Player::GetFaction() {
	return m_faction;
}

void Player::SetDifficultyLevel( const std::string& difficulty_level ) {
	// TODO: validate?
	m_difficulty_level = difficulty_level;
}

const std::string& Player::GetDifficultyLevel() const {
	return m_difficulty_level;
}

void Player::SetSlot( slot::Slot* slot ) {
	m_slot = slot;
	if ( m_slot ) {
		m_slotnum = m_slot->GetIndex();
	}
}

slot::Slot* Player::GetSlot() const {
	return m_slot;
}

const Player::role_t Player::GetRole() const {
	return m_role;
}

const bool Player::IsAI() const {
	return m_role == PR_AI;
}

const bool Player::IsTurnCompleted() const {
	return m_is_turn_completed;
}

void Player::CompleteTurn() {
	m_is_turn_completed = true;
}

void Player::UncompleteTurn() {
	m_is_turn_completed = false;
}

const Player::technologies_t& Player::GetTechnologies() const {
	return m_technologies;
}

bool Player::HasTechnology( const std::string& id ) const {
	return !id.empty() && m_technologies.find( id ) != m_technologies.end();
}

const std::string& Player::GetResearchTarget() const {
	return m_research_target;
}

int64_t Player::GetResearchProgress() const {
	return m_research_progress;
}

void Player::SetResearchState(
	const technologies_t& technologies,
	const std::string& target,
	const int64_t progress
) {
	std::string error;
	if ( !ValidateResearchState( technologies, target, progress, error ) ) {
		THROW( error );
	}
	m_technologies = technologies;
	m_research_target = target;
	m_research_progress = progress;
}

int64_t Player::GetEnergyCredits() const {
	return m_energy_credits;
}

void Player::SetEnergyCredits( const int64_t energy_credits ) {
	if ( energy_credits < 0 || energy_credits > MAX_ENERGY_CREDITS ) {
		THROW( "player energy credits are out of range" );
	}
	m_energy_credits = energy_credits;
}

WRAPIMPL_BEGIN( Player )
	auto* const game = g_engine->GetGame();
	WRAPIMPL_PROPS
			{
				"id",
				VALUE( gse::value::Int, , m_slotnum )
			},
			{
				"type",
				VALUE( gse::value::String, , IsAI() ? "ai" : "human" )
			},
			{
				"name",
				VALUE( gse::value::String, , m_name )
			},
			{
				"difficulty_level",
				VALUE( gse::value::String, , m_difficulty_level )
			},
			{
				"energy_credits",
				VALUE( gse::value::Int, , m_energy_credits )
			},
			{
				"is_ready",
				NATIVE_CALL( this ) {
					N_EXPECT_ARGS( 0 );
					return VALUE( gse::value::Bool, , m_slot->HasPlayerFlag( ::game::backend::slot::PF_READY ) );
				} )
			},
			{
				"set_ready",
				NATIVE_CALL( this, game ) {

					game->CheckRW( GSE_CALL );

					N_EXPECT_ARGS( 1 );
					N_GETVALUE( isready, 0, Bool );

					if ( isready ) {
						m_slot->SetPlayerFlag( ::game::backend::slot::PF_READY );
					}
					else {
						m_slot->UnsetPlayerFlag( ::game::backend::slot::PF_READY );
					}

					return VALUE( gse::value::Undefined );
				} )
			},
			{
				"get_faction",
				NATIVE_CALL( this ) {
					N_EXPECT_ARGS( 0 );
					return m_faction
						? m_faction->Wrap( GSE_CALL )
						: VALUE( gse::value::Undefined );
				} )
			},
			{
				"set_faction_by_id",
				NATIVE_CALL( this, game ) {

					game->CheckRW( GSE_CALL );

					N_EXPECT_ARGS( 1 );
					N_GETVALUE( faction_id, 0, String );
					if ( game->IsStarted() ) {
						GSE_ERROR( gse::EC.GAME_ERROR, "Can't change faction after game is started" );
					}
					auto* faction = game->GetFaction( faction_id );
					if ( !faction ) {
						GSE_ERROR( gse::EC.GAME_ERROR, "Faction not found: " + faction_id );
					}
					SetFaction( faction );

					return VALUE( gse::value::Undefined );
				} )
			},
			{
				"unset_faction",
				NATIVE_CALL( this, game ) {

					game->CheckRW( GSE_CALL );

					N_EXPECT_ARGS( 0 );
					ClearFaction();

					return VALUE( gse::value::Undefined );
				} )
			},
			{
				"is_master",
				VALUE( gse::value::Bool, , m_role == PR_SINGLE || m_role == PR_HOST )
			},
			{
				"get_research_state",
				NATIVE_CALL( this ) {
					N_EXPECT_ARGS( 0 );
					gse::value::array_elements_t technologies = {};
					technologies.reserve( m_technologies.size() );
					for ( const auto& id : m_technologies ) {
						technologies.push_back( VALUE( gse::value::String, , id ) );
					}
					return VALUEEXT( gse::value::Object, GSE_CALL, gse::value::object_properties_t{
						{ "technologies", VALUE( gse::value::Array, , technologies ) },
						{ "target", VALUE( gse::value::String, , m_research_target ) },
						{ "progress", VALUE( gse::value::Int, , m_research_progress ) },
					} );
				} )
			},
			{
				"set_research_state",
				NATIVE_CALL( this, game ) {
					game->CheckRW( GSE_CALL );
					N_EXPECT_ARGS( 1 );
					N_GETVALUE( state, 0, Object );
					N_GETPROP( technology_values, state, "technologies", Array );
					N_GETPROP( target, state, "target", String );
					N_GETPROP( progress, state, "progress", Int );
					technologies_t technologies = {};
					for ( size_t i = 0 ; i < technology_values.size() ; i++ ) {
						N_GETELEMENT( id, technology_values, i, String );
						if ( id.empty() || !technologies.insert( id ).second ) {
							GSE_ERROR( gse::EC.INVALID_CALL, "Research technologies must be unique, non-empty strings" );
						}
					}
					std::string error;
					if ( !ValidateResearchState( technologies, target, progress, error ) ) {
						GSE_ERROR( gse::EC.INVALID_CALL, error );
					}
					SetResearchState( technologies, target, progress );
					return VALUE( gse::value::Undefined );
				} )
			},
			{
				"has_technology",
				NATIVE_CALL( this ) {
					N_EXPECT_ARGS( 1 );
					N_GETVALUE( id, 0, String );
					return VALUE( gse::value::Bool, , HasTechnology( id ) );
				} )
			},
			{
				"set_energy_credits",
				NATIVE_CALL( this, game ) {
					game->CheckRW( GSE_CALL );
					N_EXPECT_ARGS( 1 );
					N_GETVALUE( energy_credits, 0, Int );
					if ( energy_credits < 0 || energy_credits > MAX_ENERGY_CREDITS ) {
						GSE_ERROR( gse::EC.INVALID_CALL, "Player energy credits are out of range" );
					}
					SetEnergyCredits( energy_credits );
					return VALUE( gse::value::Undefined );
				} )
			},
		};
WRAPIMPL_END_PTR()

UNWRAPIMPL_PTR( Player )

const types::Buffer Player::Serialize() const {
	types::Buffer buf;

	buf.WriteString( m_name );
	buf.WriteInt( m_role );
	buf.WriteBool( m_faction != nullptr );
	if ( m_faction ) {
		buf.WriteString( m_faction->Serialize().ToString() );
	}
	buf.WriteString( m_difficulty_level );
	buf.WriteBool( m_is_turn_completed );
	buf.WriteInt( m_technologies.size() );
	for ( const auto& id : m_technologies ) {
		buf.WriteString( id );
	}
	buf.WriteString( m_research_target );
	buf.WriteInt( m_research_progress );
	buf.WriteInt( m_energy_credits );

	return buf;
}

void Player::Deserialize( types::Buffer buf ) {

	const auto name = buf.ReadString();
	const auto serialized_role = buf.ReadInt();
	if ( serialized_role < PR_NONE || serialized_role > PR_AI ) {
		THROW( "invalid serialized player role: " + std::to_string( serialized_role ) );
	}
	std::unique_ptr< faction::Faction > faction;
	if ( buf.ReadBool() ) {
		faction = std::make_unique< faction::Faction >();
		faction->Deserialize( buf.ReadString() );
	}
	const auto difficulty_level = buf.ReadString();
	const auto is_turn_completed = buf.ReadBool();
	technologies_t technologies = {};
	const auto technology_count = buf.ReadCollectionSize( "player technology" );
	if ( technology_count > MAX_TECHNOLOGIES ) {
		THROW( "invalid serialized player technology count" );
	}
	for ( size_t i = 0 ; i < technology_count ; i++ ) {
		const auto id = buf.ReadString();
		if ( id.empty() || !technologies.insert( id ).second ) {
			THROW( "invalid or duplicate serialized player technology" );
		}
	}
	const auto research_target = buf.ReadString();
	const auto research_progress = buf.ReadInt();
	std::string research_error;
	if ( !ValidateResearchState( technologies, research_target, research_progress, research_error ) ) {
		THROW( "invalid serialized player research state: " + research_error );
	}
	const auto energy_credits = buf.GetRemaining() > 0 ? buf.ReadInt() : 0;
	if ( energy_credits < 0 || energy_credits > MAX_ENERGY_CREDITS ) {
		THROW( "invalid serialized player energy credits" );
	}
	if ( buf.GetRemaining() != 0 ) {
		THROW( "unexpected data after serialized player" );
	}

	ReleaseOwnedFaction();
	m_name = name;
	m_role = static_cast< role_t >( serialized_role );
	m_faction = faction.release();
	m_owns_faction = m_faction != nullptr;
	m_difficulty_level = difficulty_level;
	m_is_turn_completed = is_turn_completed;
	m_technologies = std::move( technologies );
	m_research_target = research_target;
	m_research_progress = research_progress;
	m_energy_credits = energy_credits;

}

void Player::ReleaseOwnedFaction() {
	if ( m_owns_faction ) {
		delete m_faction;
	}
	m_faction = nullptr;
	m_owns_faction = false;
}

bool Player::ValidateResearchState(
	const technologies_t& technologies,
	const std::string& target,
	const int64_t progress,
	std::string& error
) {
	if ( technologies.size() > MAX_TECHNOLOGIES ) {
		error = "Too many researched technologies";
		return false;
	}
	for ( const auto& id : technologies ) {
		if ( id.empty() ) {
			error = "Researched technology IDs cannot be empty";
			return false;
		}
	}
	if ( !target.empty() && technologies.find( target ) != technologies.end() ) {
		error = "Research target is already known";
		return false;
	}
	if ( progress < 0 || progress > MAX_RESEARCH_PROGRESS ) {
		error = "Research progress is out of range";
		return false;
	}
	if ( target.empty() && progress != 0 ) {
		error = "Research progress requires a target";
		return false;
	}
	return true;
}

WRAPIMPL_SERIALIZE( Player )
	buf->WriteInt( obj->m_slotnum );
}

WRAPIMPL_DESERIALIZE( Player )
	const auto slot_num = buf->ReadInt< size_t >( "player reference slot" );
	auto* const slots = game->GetState()->m_slots;
	if ( slot_num >= slots->GetCount() ) {
		THROW( "player reference slot is out of bounds: " + std::to_string( slot_num ) );
	}
	auto& player_slot = slots->GetSlot( slot_num );
	if ( player_slot.GetState() != slot::Slot::SS_PLAYER ) {
		THROW( "player reference points to an empty slot: " + std::to_string( slot_num ) );
	}
	auto* const player = player_slot.GetPlayer();
	if ( !player ) {
		THROW( "player reference points to a slot without a player: " + std::to_string( slot_num ) );
	}
	return player->Wrap( GSE_CALL );
}

}
}
