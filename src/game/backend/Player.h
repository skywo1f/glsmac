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
	static constexpr int64_t MAX_MAJOR_ATROCITIES = 1000000;

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
	int64_t GetMajorAtrocities() const;
	void SetMajorAtrocities( const int64_t major_atrocities );

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

	struct diplomatic_trade_t {
		int64_t offer_energy = 0;
		std::string offer_technology = "";
		int64_t request_energy = 0;
		std::string request_technology = "";

		bool operator==( const diplomatic_trade_t& other ) const {
			return
				offer_energy == other.offer_energy &&
				offer_technology == other.offer_technology &&
				request_energy == other.request_energy &&
				request_technology == other.request_technology;
		}
	};
	using diplomatic_trades_t = std::map< size_t, diplomatic_trade_t >;
	static constexpr size_t MAX_DIPLOMATIC_TRADES = 64;
	static constexpr size_t MAX_DIPLOMATIC_TRADE_TECHNOLOGY_ID_LENGTH = 128;
	const diplomatic_trades_t& GetDiplomaticTrades() const;
	const diplomatic_trade_t* GetDiplomaticTrade( const size_t player_id ) const;
	void SetDiplomaticTrade( const size_t player_id, const diplomatic_trade_t& trade );
	void ClearDiplomaticTrade( const size_t player_id );

	struct diplomatic_loan_offer_t {
		bool proposer_is_lender = true;
		int64_t principal = 0;
		int64_t payment = 0;
		int64_t turns = 0;

		bool operator==( const diplomatic_loan_offer_t& other ) const {
			return
				proposer_is_lender == other.proposer_is_lender &&
				principal == other.principal &&
				payment == other.payment &&
				turns == other.turns;
		}
	};
	using diplomatic_loan_offers_t = std::map< size_t, diplomatic_loan_offer_t >;
	static constexpr size_t MAX_DIPLOMATIC_LOAN_OFFERS = 64;
	static constexpr int64_t MAX_DIPLOMATIC_LOAN_TURNS = 1000;
	const diplomatic_loan_offers_t& GetDiplomaticLoanOffers() const;
	const diplomatic_loan_offer_t* GetDiplomaticLoanOffer( const size_t player_id ) const;
	void SetDiplomaticLoanOffer( const size_t player_id, const diplomatic_loan_offer_t& offer );
	void ClearDiplomaticLoanOffer( const size_t player_id );

	struct diplomatic_loan_t {
		int64_t balance = 0;
		int64_t payment = 0;

		bool operator==( const diplomatic_loan_t& other ) const {
			return balance == other.balance && payment == other.payment;
		}
	};
	using diplomatic_loans_t = std::map< size_t, diplomatic_loan_t >;
	static constexpr size_t MAX_DIPLOMATIC_LOANS = 64;
	const diplomatic_loans_t& GetDiplomaticLoans() const;
	const diplomatic_loan_t* GetDiplomaticLoan( const size_t player_id ) const;
	void SetDiplomaticLoan( const size_t player_id, const diplomatic_loan_t& loan );
	void ClearDiplomaticLoan( const size_t player_id );

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
	int64_t m_major_atrocities = 0;
	social_engineering_t m_social_engineering = {{ "Frontier", "Simple", "Survival", "None" }};
	diplomatic_relations_t m_diplomatic_relations = {};
	diplomatic_relations_t m_diplomatic_offers = {};
	infiltrated_players_t m_infiltrated_players = {};
	diplomatic_trades_t m_diplomatic_trades = {};
	diplomatic_loan_offers_t m_diplomatic_loan_offers = {};
	diplomatic_loans_t m_diplomatic_loans = {};

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
