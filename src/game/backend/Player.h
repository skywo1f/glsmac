#pragma once

#include <cstdint>
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

	const technologies_t& GetTechnologies() const;
	bool HasTechnology( const std::string& id ) const;
	const std::string& GetResearchTarget() const;
	int64_t GetResearchProgress() const;
	void SetResearchState(
		const technologies_t& technologies,
		const std::string& target,
		const int64_t progress
	);

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

	void ReleaseOwnedFaction();
	static bool ValidateResearchState(
		const technologies_t& technologies,
		const std::string& target,
		const int64_t progress,
		std::string& error
	);
};

}
}
