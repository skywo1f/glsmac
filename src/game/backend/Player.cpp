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
	m_ecological_damage_events = other->m_ecological_damage_events;
	m_social_engineering = other->m_social_engineering;
	m_diplomatic_relations = other->m_diplomatic_relations;
	m_diplomatic_offers = other->m_diplomatic_offers;
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

int64_t Player::GetEcologicalDamageEvents() const {
	return m_ecological_damage_events;
}

void Player::SetEcologicalDamageEvents( const int64_t ecological_damage_events ) {
	if ( ecological_damage_events < 0 || ecological_damage_events > MAX_ECOLOGICAL_DAMAGE_EVENTS ) {
		THROW( "player ecological damage event count is out of range" );
	}
	m_ecological_damage_events = ecological_damage_events;
}

const Player::social_engineering_t& Player::GetSocialEngineering() const {
	return m_social_engineering;
}

void Player::SetSocialEngineering( const social_engineering_t& social_engineering ) {
	std::string error;
	if ( !ValidateSocialEngineering( social_engineering, error ) ) {
		THROW( error );
	}
	m_social_engineering = social_engineering;
}

const Player::diplomatic_relations_t& Player::GetDiplomaticRelations() const {
	return m_diplomatic_relations;
}

Player::diplomatic_relation_t Player::GetDiplomaticRelation( const size_t player_id ) const {
	const auto it = m_diplomatic_relations.find( player_id );
	return it == m_diplomatic_relations.end() ? DR_NEUTRAL : it->second;
}

void Player::SetDiplomaticRelation( const size_t player_id, const diplomatic_relation_t relation ) {
	if ( player_id >= MAX_DIPLOMATIC_RELATIONS ) {
		THROW( "diplomatic relation player ID is out of range" );
	}
	if ( relation < DR_NEUTRAL || relation > DR_VENDETTA ) {
		THROW( "diplomatic relation is invalid" );
	}
	if ( relation == DR_NEUTRAL ) {
		m_diplomatic_relations.erase( player_id );
	}
	else {
		m_diplomatic_relations[ player_id ] = relation;
	}
}

const Player::diplomatic_relations_t& Player::GetDiplomaticOffers() const {
	return m_diplomatic_offers;
}

Player::diplomatic_relation_t Player::GetDiplomaticOffer( const size_t player_id ) const {
	const auto it = m_diplomatic_offers.find( player_id );
	return it == m_diplomatic_offers.end() ? DR_NEUTRAL : it->second;
}

void Player::SetDiplomaticOffer( const size_t player_id, const diplomatic_relation_t relation ) {
	if ( player_id >= MAX_DIPLOMATIC_RELATIONS ) {
		THROW( "diplomatic offer player ID is out of range" );
	}
	if ( relation == DR_NEUTRAL ) {
		m_diplomatic_offers.erase( player_id );
		return;
	}
	if ( relation != DR_TREATY && relation != DR_PACT ) {
		THROW( "diplomatic offer must be a treaty or pact" );
	}
	m_diplomatic_offers[ player_id ] = relation;
}

const std::string Player::GetDiplomaticRelationName( const diplomatic_relation_t relation ) {
	switch ( relation ) {
		case DR_NEUTRAL: return "neutral";
		case DR_TREATY: return "treaty";
		case DR_PACT: return "pact";
		case DR_VENDETTA: return "vendetta";
	}
	THROW( "diplomatic relation is invalid" );
}

bool Player::ParseDiplomaticRelation( const std::string& name, diplomatic_relation_t& relation ) {
	if ( name == "neutral" ) {
		relation = DR_NEUTRAL;
		return true;
	}
	if ( name == "treaty" ) {
		relation = DR_TREATY;
		return true;
	}
	if ( name == "pact" ) {
		relation = DR_PACT;
		return true;
	}
	if ( name == "vendetta" ) {
		relation = DR_VENDETTA;
		return true;
	}
	return false;
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
			{
				"get_ecological_damage_events",
				NATIVE_CALL( this ) {
					N_EXPECT_ARGS( 0 );
					return VALUE( gse::value::Int, , m_ecological_damage_events );
				} )
			},
			{
				"set_ecological_damage_events",
				NATIVE_CALL( this, game ) {
					game->CheckRW( GSE_CALL );
					N_EXPECT_ARGS( 1 );
					N_GETVALUE( ecological_damage_events, 0, Int );
					if (
						ecological_damage_events < 0 ||
						ecological_damage_events > MAX_ECOLOGICAL_DAMAGE_EVENTS
					) {
						GSE_ERROR( gse::EC.INVALID_CALL, "Player ecological damage event count is out of range" );
					}
					SetEcologicalDamageEvents( ecological_damage_events );
					return VALUE( gse::value::Undefined );
				} )
			},
			{
				"get_social_engineering",
				NATIVE_CALL( this ) {
					N_EXPECT_ARGS( 0 );
					return VALUEEXT( gse::value::Object, GSE_CALL, gse::value::object_properties_t{
						{ "politics", VALUE( gse::value::String, , m_social_engineering.at( 0 ) ) },
						{ "economics", VALUE( gse::value::String, , m_social_engineering.at( 1 ) ) },
						{ "values", VALUE( gse::value::String, , m_social_engineering.at( 2 ) ) },
						{ "future_society", VALUE( gse::value::String, , m_social_engineering.at( 3 ) ) },
					} );
				} )
			},
			{
				"set_social_engineering",
				NATIVE_CALL( this, game ) {
					game->CheckRW( GSE_CALL );
					N_EXPECT_ARGS( 1 );
					N_GETVALUE( choices, 0, Object );
					N_GETPROP( politics, choices, "politics", String );
					N_GETPROP( economics, choices, "economics", String );
					N_GETPROP( values, choices, "values", String );
					N_GETPROP( future_society, choices, "future_society", String );
					social_engineering_t social_engineering = {{
						politics, economics, values, future_society
					}};
					std::string error;
					if ( !ValidateSocialEngineering( social_engineering, error ) ) {
						GSE_ERROR( gse::EC.INVALID_CALL, error );
					}
					SetSocialEngineering( social_engineering );
					return VALUE( gse::value::Undefined );
				} )
			},
			{
				"get_diplomatic_relation",
				NATIVE_CALL( this ) {
					N_EXPECT_ARGS( 1 );
					N_GETVALUE_UNWRAP( other, 0, Player );
					if ( other == this ) {
						GSE_ERROR( gse::EC.INVALID_CALL, "A player cannot have a diplomatic relation with itself" );
					}
					return VALUE(
						gse::value::String,
						,
						GetDiplomaticRelationName( GetDiplomaticRelation( other->m_slotnum ) )
					);
				} )
			},
			{
				"set_diplomatic_relation",
				NATIVE_CALL( this, game ) {
					game->CheckRW( GSE_CALL );
					N_EXPECT_ARGS( 2 );
					N_GETVALUE_UNWRAP( other, 0, Player );
					N_GETVALUE( relation_name, 1, String );
					if ( other == this ) {
						GSE_ERROR( gse::EC.INVALID_CALL, "A player cannot have a diplomatic relation with itself" );
					}
					diplomatic_relation_t relation;
					if ( !ParseDiplomaticRelation( relation_name, relation ) ) {
						GSE_ERROR( gse::EC.INVALID_CALL, "Unknown diplomatic relation: " + relation_name );
					}
					SetDiplomaticRelation( other->m_slotnum, relation );
					return VALUE( gse::value::Undefined );
				} )
			},
			{
				"get_diplomatic_offer",
				NATIVE_CALL( this ) {
					N_EXPECT_ARGS( 1 );
					N_GETVALUE_UNWRAP( other, 0, Player );
					if ( other == this ) {
						GSE_ERROR( gse::EC.INVALID_CALL, "A player cannot make a diplomatic offer to itself" );
					}
					const auto offer = GetDiplomaticOffer( other->m_slotnum );
					return VALUE(
						gse::value::String,
						,
						offer == DR_NEUTRAL ? "" : GetDiplomaticRelationName( offer )
					);
				} )
			},
			{
				"set_diplomatic_offer",
				NATIVE_CALL( this, game ) {
					game->CheckRW( GSE_CALL );
					N_EXPECT_ARGS( 2 );
					N_GETVALUE_UNWRAP( other, 0, Player );
					N_GETVALUE( offer_name, 1, String );
					if ( other == this ) {
						GSE_ERROR( gse::EC.INVALID_CALL, "A player cannot make a diplomatic offer to itself" );
					}
					diplomatic_relation_t offer = DR_NEUTRAL;
					if ( !offer_name.empty() && !ParseDiplomaticRelation( offer_name, offer ) ) {
						GSE_ERROR( gse::EC.INVALID_CALL, "Unknown diplomatic offer: " + offer_name );
					}
					if ( offer != DR_NEUTRAL && offer != DR_TREATY && offer != DR_PACT ) {
						GSE_ERROR( gse::EC.INVALID_CALL, "Diplomatic offer must be a treaty or pact" );
					}
					SetDiplomaticOffer( other->m_slotnum, offer );
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
	buf.WriteInt( m_social_engineering.size() );
	for ( const auto& id : m_social_engineering ) {
		buf.WriteString( id );
	}
	buf.WriteInt( m_ecological_damage_events );
	buf.WriteInt( m_diplomatic_relations.size() );
	for ( const auto& [ player_id, relation ] : m_diplomatic_relations ) {
		buf.WriteInt( player_id );
		buf.WriteInt( relation );
	}
	buf.WriteInt( m_diplomatic_offers.size() );
	for ( const auto& [ player_id, relation ] : m_diplomatic_offers ) {
		buf.WriteInt( player_id );
		buf.WriteInt( relation );
	}

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
	social_engineering_t social_engineering = {{ "Frontier", "Simple", "Survival", "None" }};
	if ( buf.GetRemaining() > 0 ) {
		const auto choice_count = buf.ReadCollectionSize( "player social engineering choice" );
		if ( choice_count != SOCIAL_ENGINEERING_CATEGORY_COUNT ) {
			THROW( "invalid serialized player social engineering choice count" );
		}
		for ( size_t i = 0 ; i < choice_count ; i++ ) {
			social_engineering.at( i ) = buf.ReadString();
		}
		std::string social_error;
		if ( !ValidateSocialEngineering( social_engineering, social_error ) ) {
			THROW( "invalid serialized player social engineering state: " + social_error );
		}
	}
	const auto ecological_damage_events = buf.GetRemaining() > 0 ? buf.ReadInt() : 0;
	if ( ecological_damage_events < 0 || ecological_damage_events > MAX_ECOLOGICAL_DAMAGE_EVENTS ) {
		THROW( "invalid serialized player ecological damage event count" );
	}
	diplomatic_relations_t diplomatic_relations = {};
	if ( buf.GetRemaining() > 0 ) {
		const auto relation_count = buf.ReadCollectionSize( "player diplomatic relation" );
		if ( relation_count > MAX_DIPLOMATIC_RELATIONS ) {
			THROW( "invalid serialized player diplomatic relation count" );
		}
		for ( size_t i = 0 ; i < relation_count ; i++ ) {
			const auto player_id = buf.ReadInt< size_t >( "diplomatic relation player ID" );
			const auto serialized_relation = buf.ReadInt();
			if ( player_id >= MAX_DIPLOMATIC_RELATIONS ) {
				THROW( "invalid serialized diplomatic relation player ID" );
			}
			if ( serialized_relation <= DR_NEUTRAL || serialized_relation > DR_VENDETTA ) {
				THROW( "invalid serialized diplomatic relation" );
			}
			if ( !diplomatic_relations.emplace(
				player_id,
				static_cast< diplomatic_relation_t >( serialized_relation )
			).second ) {
				THROW( "duplicate serialized diplomatic relation player ID" );
			}
		}
	}
	diplomatic_relations_t diplomatic_offers = {};
	if ( buf.GetRemaining() > 0 ) {
		const auto offer_count = buf.ReadCollectionSize( "player diplomatic offer" );
		if ( offer_count > MAX_DIPLOMATIC_RELATIONS ) {
			THROW( "invalid serialized player diplomatic offer count" );
		}
		for ( size_t i = 0 ; i < offer_count ; i++ ) {
			const auto player_id = buf.ReadInt< size_t >( "diplomatic offer player ID" );
			const auto serialized_offer = buf.ReadInt();
			if ( player_id >= MAX_DIPLOMATIC_RELATIONS ) {
				THROW( "invalid serialized diplomatic offer player ID" );
			}
			if ( serialized_offer != DR_TREATY && serialized_offer != DR_PACT ) {
				THROW( "invalid serialized diplomatic offer" );
			}
			if ( !diplomatic_offers.emplace(
				player_id,
				static_cast< diplomatic_relation_t >( serialized_offer )
			).second ) {
				THROW( "duplicate serialized diplomatic offer player ID" );
			}
		}
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
	m_ecological_damage_events = ecological_damage_events;
	m_social_engineering = std::move( social_engineering );
	m_diplomatic_relations = std::move( diplomatic_relations );
	m_diplomatic_offers = std::move( diplomatic_offers );

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

bool Player::ValidateSocialEngineering(
	const social_engineering_t& social_engineering,
	std::string& error
) {
	for ( const auto& id : social_engineering ) {
		if ( id.empty() ) {
			error = "Social engineering choice IDs cannot be empty";
			return false;
		}
		if ( id.size() > MAX_SOCIAL_ENGINEERING_ID_LENGTH ) {
			error = "Social engineering choice ID is too long";
			return false;
		}
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
