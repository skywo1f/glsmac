#pragma once

#include <unordered_map>
#include <string>

#include "Connection.h"

namespace game {
namespace backend {

namespace slot {
class Slot;
}

namespace connection {

class Server : public Connection {
public:

	Server( gc::Space* const gc_space, settings::LocalSettings* const settings );

	std::function< void() > m_on_listen = nullptr;
	std::function< const std::string( const size_t slot_num ) > m_on_download_request = nullptr; // return serialized snapshot of world for player slot

	void SendGameEventResponse( const size_t cid, const std::string& event_id, const bool result, const gse::Value* const resolved );

	void UpdateSlot( const size_t slot_num, slot::Slot* slot, const bool only_flags = false ) override;
	void SendMessage( const std::string& message ) override;

	void ResetHandlers() override;

	void UpdateGameSettings();
	void GlobalMessage( const std::string& message );
	void KickFromSlot( const size_t slot_num, const std::string& reason = "Kicked by host" );
	void BanFromSlot( const size_t slot_num, const std::string& reason = "Banned by host" );

	void SetGameState( const game_state_t game_state );
	void SendPlayersList();

protected:
	void ProcessEvent( const network::Event& event ) override;
	void SendGameEvents( const game_events_t& game_events ) override;

private:
	friend class Connection;
	void FinalizeGameEventProjection( game_event_t& event );

	void Broadcast( std::function< void( const network::cid_t cid ) > callback );
	void Kick( const network::cid_t cid, const std::string& reason );
	void KickFromSlot( slot::Slot& slot, const std::string& reason );
	void Error( const network::cid_t cid, const std::string& reason );
	void SendGlobalSettings( const network::cid_t cid );
	void SendGameState( const network::cid_t cid );
	void SendPlayersList( const network::cid_t cid, const size_t slot_num = 0 );
	void SendSlotUpdate( const size_t slot_num, const slot::Slot* slot, network::cid_t skip_cid = 0 );
	void SendFlagsUpdate( const size_t slot_num, const slot::Slot* slot, network::cid_t skip_cid = 0 );
	const std::string FormatChatMessage( const Player* player, const std::string& message ) const;

	struct download_data_t {
		size_t next_expected_offset = 0; // for extra consistency checks
		std::string serialized_snapshot = "";
	};
	std::unordered_map< network::cid_t, download_data_t > m_download_data = {}; // cid -> serialized snapshot of world

	static constexpr size_t MAX_DEFERRED_GAME_EVENTS = 4096;
	static constexpr size_t MAX_DEFERRED_GAME_EVENT_BYTES = 16 * 1024 * 1024;
	struct deferred_game_events_t {
		game_events_t events = {};
		size_t serialized_size = 0;
	};
	std::unordered_map< network::cid_t, deferred_game_events_t > m_deferred_game_events = {};
	std::unordered_map< network::cid_t, std::unordered_set< size_t > > m_projected_unit_ids = {};
	std::unordered_map< network::cid_t, std::unordered_set< size_t > > m_delivered_unit_ids = {};
	std::unordered_map< network::cid_t, size_t > m_delivered_next_unit_ids = {};
	size_t m_unit_visibility_event_id = 1;

	void SendSerializedGameEvent( const network::cid_t cid, const game_event_t& event );
	bool QueueDeferredGameEvent( const network::cid_t cid, const game_event_t& event );
	bool DeliverSerializedGameEvent( const network::cid_t cid, const game_event_t& event, const bool deferred );
	bool DeliverUnitVisibilityUpdate(
		const network::cid_t cid,
		const std::unordered_set< size_t >& hidden_unit_ids,
		const std::map< size_t, std::string >& revealed_unit_snapshots,
		const size_t next_unit_id,
		const std::string& after_event_id,
		const bool deferred
	);
	void DeliverProjectedGameEvent( const network::cid_t cid, const game_event_t& event, const bool deferred );
	void FlushDeferredGameEvents( const network::cid_t cid );

	void ClearReadyFlags();
};

}
}
}
