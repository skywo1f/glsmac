#include <algorithm>
#include <cstring>
#include <cmath>

#include "Sound.h"
#include "types/Sound.h"

namespace scene {
namespace actor {

Sound::Sound( const std::string& name, const types::Sound* sound )
	: Actor( TYPE_SOUND, name )
	, m_sound( sound ) {
	Rewind();
}

Sound::~Sound() {

}

const types::Sound* Sound::GetSound() const {
	return m_sound;
}

void Sound::Rewind() {
	m_pos = 0;
	m_is_finished = false;
	if ( m_is_autoplay ) {
		Play();
	}
}

void Sound::GetNextBuffer( uint8_t* buffer, size_t len ) {
	if ( len == 0 ) {
		return;
	}
	if ( m_is_finished || !m_is_active || m_sound->m_buffer_size == 0 ) {
		memset( ptr( buffer, 0, len ), 0, len );
		if ( m_sound->m_buffer_size == 0 && !m_is_finished ) {
			Stop();
		}
		return;
	}

	size_t written = 0;
	while ( written < len ) {
		const size_t remaining = m_sound->m_buffer_size - m_pos;
		const size_t chunk = std::min( len - written, remaining );
		if ( m_is_muted ) {
			memset( ptr( buffer, written, chunk ), 0, chunk );
		}
		else {
			memcpy(
				ptr( buffer, written, chunk ),
				ptr( m_sound->m_buffer, m_pos, chunk ),
				chunk
			);
		}
		written += chunk;
		m_pos += chunk;

		if ( m_pos < m_sound->m_buffer_size ) {
			continue;
		}
		if ( m_is_repeatable ) {
			m_pos = 0;
		}
		else {
			Stop();
			if ( written < len ) {
				memset( ptr( buffer, written, len - written ), 0, len - written );
			}
			break;
		}
	}
}

void Sound::SetRepeatable( const bool repeatable ) {
	m_is_repeatable = repeatable;
	Rewind();
}

void Sound::SetStartDelay( const size_t start_delay ) {
	m_start_delay = start_delay;
	Rewind();
}

void Sound::SetAutoPlay( const bool autoplay ) {
	m_is_autoplay = autoplay;
	Rewind();
}

void Sound::SetVolume( const float volume ) {
	if ( !std::isfinite( volume ) || volume < 0.0f || volume > 1.0f ) {
		THROW( "invalid volume " + std::to_string( volume ) );
	}
	m_volume = volume;
}

void Sound::Play() {
	if ( !m_is_playing ) {
		ASSERT( !m_is_active, "not playing but active" );
		if ( m_is_finished ) {
			Rewind();
		}
		if ( m_start_delay > 0 ) {
			m_is_active = false;
			m_start_delay_timer.SetTimeout( m_start_delay );
		}
		else {
			m_is_active = true;
			m_is_playing = true;
		}
	}
}

void Sound::Pause() {
	if ( m_is_playing ) {
		m_is_playing = false;
		m_is_active = false;
	}
}

void Sound::Stop() {
	m_start_delay_timer.Stop();
	m_is_playing = false;
	m_is_active = false;
	if ( m_is_repeatable ) {
		Rewind();
	}
	else {
		m_is_finished = true;
	}
}

void Sound::Mute() {
	m_is_muted = true;
}

const bool Sound::IsActive() {
	if ( !m_is_active ) {
		if ( m_start_delay_timer.HasTicked() ) {
			m_is_active = true;
		}
	}
	return m_is_active;
}

const bool Sound::IsFinished() const {
	return m_is_finished;
}

const bool Sound::IsReadyToBeDeleted() const {
	return ( m_is_repeatable || !m_is_playing );
}

const size_t Sound::GetPos() const {
	return m_pos;
}

const float Sound::GetVolume() const {
	return m_volume;
}

}
}
