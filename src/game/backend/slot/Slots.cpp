#include "Slots.h"

namespace game {
namespace backend {
namespace slot {

Slots::Slots( State* state )
	: m_state( state ) {}

const size_t Slots::GetCount() const {
	return m_slots.size();
}

void Slots::Resize( const size_t size ) {
	if ( m_slots.size() > size ) {
		m_slots.erase( m_slots.begin() + size, m_slots.end() );
	}
	for ( size_t i = m_slots.size() ; i < size ; i++ ) {
		m_slots.push_back(
			{
				i,
				m_state
			}
		);
	}
}

Slot& Slots::GetSlot( const size_t index ) {
	ASSERT( index < m_slots.size(), "slot index out of bounds" );
	return m_slots.at( index );
}

std::vector< Slot >& Slots::GetSlots() {
	return m_slots;
}

void Slots::Clear() {
	m_slots.clear();
}

const types::Buffer Slots::Serialize() const {
	types::Buffer buf;

	buf.WriteInt( m_slots.size() );

	for ( auto& slot : m_slots ) {
		buf.WriteString( slot.Serialize().ToString() );
	}

	return buf;
}

void Slots::Deserialize( types::Buffer buf ) {
	ASSERT( m_slots.empty(), "deserialize on non-empty slots" );
	const auto count = buf.ReadInt();
	if ( count < 0 || count > MAX_SERIALIZED_SLOTS ) {
		THROW( "invalid serialized slot count: " + std::to_string( count ) );
	}
	Resize( static_cast< size_t >( count ) );

	for ( auto& slot : m_slots ) {
		slot.Deserialize( buf.ReadString() );
	}
}

void Slots::DeserializeUpdate( types::Buffer buf ) {
	const auto count = buf.ReadInt();
	if ( count < 0 || static_cast< size_t >( count ) != m_slots.size() ) {
		THROW( "serialized slot update count mismatch" );
	}

	for ( auto& slot : m_slots ) {
		const auto serialized_slot = buf.ReadString();
		types::Buffer state_buffer( serialized_slot );
		const auto state = state_buffer.ReadInt();
		if ( state != slot.GetState() ) {
			THROW( "serialized slot update state mismatch" );
		}
		slot.Deserialize( types::Buffer( serialized_slot ) );
	}
}

}
}
}
