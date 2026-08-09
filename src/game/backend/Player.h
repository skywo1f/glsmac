#pragma once

#include <array>
#include <cstdint>
#include <map>
#include <set>
#include <string>

#include "types/Serializable.h"
#include "gse/Wrappable.h"

namespace game {
namespace backend {

class Game;

namespace faction {
class Faction;
}

namespace slot {
class Slot;
}

CLASS2( Player, types::Serializable, gse::Wrappable )

	enum role_t {
		PR_NONE,
		PR_SINGLE,
		PR_HOST,
		PR_PLAYER,
		PR_AI,
	};

	Player( types::Buffer buf );
	Player(
		const std::string& name,
		const role_t role,
		faction::Faction* faction,
		const std::string& difficulty_level
	);
	Player( const Player* const other );
	~Player() override;

	const std::string& GetPlayerName() const;
	const std::string GetFullName() const;

	void Connect();
	void Disconnect();
	const bool IsConnected() const;

	void SetFaction( faction::Faction* faction );
	void ClearFaction();
	faction::Faction* GetFaction();

	void SetDifficultyLevel( const std::string& difficulty_level );
	const std::string& GetDifficultyLevel() const;

	void SetSlot( slot::Slot* slot );
	slot::Slot* GetSlot() const;

	const role_t GetRole() const;
	const bool IsAI() const;

	const bool IsTurnCompleted() const;
	void CompleteTurn();
	void UncompleteTurn();

	using technologies_t = std::set< std::string >;
	static constexpr int64_t MAX_RESEARCH_PROGRESS = 1000000;
	static constexpr size_t MAX_TECHNOLOGIES = 1024;
	static constexpr int64_t MAX_ENERGY_CREDITS = 1000000000;
	static constexpr int64_t MAX_ECOLOGICAL_DAMAGE_EVENTS = 1000000;

	const technologies_t& GetTechnologies() const;
	bool HasTechnology( const std::string& id ) const;
	const std::string& GetResearchTarget() const;
	int64_t GetResearchProgress() const;
	void SetResearchState(
		const technologies_t& technologies,
		const std::string& target,
		const int64_t progress
	);
	int64_t GetEnergyCredits() const;
	void SetEnergyCredits( const int64_t energy_credits );
	int64_t GetEcologicalDamageEvents() const;
	void SetEcologicalDamageEvents( const int64_t ecological_damage_events );

	using social_engineering_t = std::array< std::string, 4 >;
	static constexpr size_t SOCIAL_ENGINEERING_CATEGORY_COUNT = 4;
	static constexpr size_t MAX_SOCIAL_ENGINEERING_ID_LENGTH = 64;
	const social_engineering_t& GetSocialEngineering() const;
	void SetSocialEngineering( const social_engineering_t& social_engineering );

	enum diplomatic_relation_t {
		DR_NEUTRAL,
		DR_TREATY,
		DR_PACT,
		DR_VENDETTA,
	};
	using diplomatic_relations_t = std::map< size_t, diplomatic_relation_t >;
	static constexpr size_t MAX_DIPLOMATIC_RELATIONS = 64;
	const diplomatic_relations_t& GetDiplomaticRelations() const;
	diplomatic_relation_t GetDiplomaticRelation( const size_t player_id ) const;
	void SetDiplomaticRelation( const size_t player_id, const diplomatic_relation_t relation );
	const diplomatic_relations_t& GetDiplomaticOffers() const;
	diplomatic_relation_t GetDiplomaticOffer( const size_t player_id ) const;
	void SetDiplomaticOffer( const size_t player_id, const diplomatic_relation_t relation );
	static const std::string GetDiplomaticRelationName( const diplomatic_relation_t relation );
	static bool ParseDiplomaticRelation( const std::string& name, diplomatic_relation_t& relation );

	using infiltrated_players_t = std::set< size_t >;
	static constexpr size_t MAX_INFILTRATED_PLAYERS = 64;
	const infiltrated_players_t& GetInfiltratedPlayers() const;
	bool HasInfiltrated( const size_t player_id ) const;
	void SetInfiltrated( const size_t player_id, const bool infiltrated );

	WRAPDEFS_PTR( Player );

	const types::Buffer Serialize() const override;
	void Deserialize( types::Buffer buf ) override;

	WRAPDEF_SERIALIZABLE;

private:

	bool m_is_connected = false;

	std::string m_name = "";
	role_t m_role = PR_NONE;

	slot::Slot* m_slot = nullptr;
	size_t m_slotnum = 0;

	faction::Faction* m_faction = {};
	bool m_owns_faction = false;
	std::string m_difficulty_level = "";

	bool m_is_turn_completed = false;
	technologies_t m_technologies = {};
	std::string m_research_target = "";
	int64_t m_research_progress = 0;
	int64_t m_energy_credits = 0;
	int64_t m_ecological_damage_events = 0;
	social_engineering_t m_social_engineering = {{ "Frontier", "Simple", "Survival", "None" }};
	diplomatic_relations_t m_diplomatic_relations = {};
	diplomatic_relations_t m_diplomatic_offers = {};
	infiltrated_players_t m_infiltrated_players = {};

	void ReleaseOwnedFaction();
	static bool ValidateResearchState(
		const technologies_t& technologies,
		const std::string& target,
		const int64_t progress,
		std::string& error
	);
	static bool ValidateSocialEngineering(
		const social_engineering_t& social_engineering,
		std::string& error
	);
};

}
}
