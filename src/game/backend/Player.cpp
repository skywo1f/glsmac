#include "Player.h"

#include <memory>

#include "game/backend/faction/Faction.h"
#include "game/backend/slot/Slot.h"
#include "game/backend/State.h"
#include "game/backend/slot/Slots.h"

#include "gse/value/String.h"
#include "gse/value/Bool.h"

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

const bool Player::IsTurnCompleted() const {
	return m_is_turn_completed;
}

void Player::CompleteTurn() {
	m_is_turn_completed = true;
}

void Player::UncompleteTurn() {
	m_is_turn_completed = false;
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
				VALUE( gse::value::String, , "human" )
			},
			{
				"name",
				VALUE( gse::value::String, , m_name )
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

	return buf;
}

void Player::Deserialize( types::Buffer buf ) {

	const auto name = buf.ReadString();
	const auto serialized_role = buf.ReadInt();
	if ( serialized_role < PR_NONE || serialized_role > PR_PLAYER ) {
		THROW( "invalid serialized player role: " + std::to_string( serialized_role ) );
	}
	std::unique_ptr< faction::Faction > faction;
	if ( buf.ReadBool() ) {
		faction = std::make_unique< faction::Faction >();
		faction->Deserialize( buf.ReadString() );
	}
	const auto difficulty_level = buf.ReadString();
	const auto is_turn_completed = buf.ReadBool();
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

}

void Player::ReleaseOwnedFaction() {
	if ( m_owns_faction ) {
		delete m_faction;
	}
	m_faction = nullptr;
	m_owns_faction = false;
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
