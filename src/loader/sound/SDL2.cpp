#define SDL_MAIN_HANDLED 1
#include <SDL.h>

#include "SDL2.h"

#include <limits>

#include "audio/sdl2/SDL2.h"
#include "util/FS.h"
#include "types/Sound.h"

namespace loader {
namespace sound {

SDL2::~SDL2() {
	for ( auto& sound : m_sounds ) {
		DELETE( sound.second );
	}
}

types::Sound* SDL2::LoadSoundImpl( const std::string& filename ) {

	sound_map_t::iterator it = m_sounds.find( filename );
	if ( it != m_sounds.end() ) {
		return it->second;
	}
	else {

		Log( "Loading sound \"" + filename + "\"" );

		Uint8* wav_buffer = nullptr; // buffer containing our audio file
		Uint32 wav_length = 0; // length of our sample
		SDL_AudioSpec wav_spec; // the specs of our piece of music

		SDL_AudioSpec* ret = nullptr;

		/* Load the WAV */
		// the specs, length and buffer of our wav are filled
		ret = SDL_LoadWAV( filename.c_str(), &wav_spec, &wav_buffer, &wav_length );
		if ( !ret ) {
			Log( "Could not load sound \"" + filename + "\": " + SDL_GetError() );
			return nullptr;
		}

		SDL_AudioCVT converter = {};
		if ( SDL_BuildAudioCVT(
			&converter,
			wav_spec.format,
			wav_spec.channels,
			wav_spec.freq,
			AUDIO_FORMAT,
			AUDIO_CHANNELS,
			AUDIO_FREQUENCY
		) < 0 ) {
			Log( "Could not prepare sound conversion for \"" + filename + "\": " + SDL_GetError() );
			SDL_FreeWAV( wav_buffer );
			return nullptr;
		}

		Uint8* playback_buffer = wav_buffer;
		Uint32 playback_length = wav_length;
		if ( converter.needed ) {
			if (
				wav_length > static_cast< Uint32 >( std::numeric_limits< int >::max() ) ||
				converter.len_mult <= 0 ||
				static_cast< size_t >( wav_length ) >
					std::numeric_limits< size_t >::max() / static_cast< size_t >( converter.len_mult )
			) {
				Log( "Sound is too large to convert: \"" + filename + "\"" );
				SDL_FreeWAV( wav_buffer );
				return nullptr;
			}
			converter.len = static_cast< int >( wav_length );
			converter.buf = static_cast< Uint8* >(
				SDL_malloc( static_cast< size_t >( converter.len ) * converter.len_mult )
			);
			if ( !converter.buf ) {
				Log( "Could not allocate converted sound buffer for \"" + filename + "\"" );
				SDL_FreeWAV( wav_buffer );
				return nullptr;
			}
			memcpy( converter.buf, wav_buffer, wav_length );
			if ( SDL_ConvertAudio( &converter ) < 0 ) {
				Log( "Could not convert sound \"" + filename + "\": " + SDL_GetError() );
				SDL_free( converter.buf );
				SDL_FreeWAV( wav_buffer );
				return nullptr;
			}
			playback_buffer = converter.buf;
			playback_length = static_cast< Uint32 >( converter.len_cvt );
		}

		NEWV( sound, types::Sound );
		sound->m_name = filename;

		sound->m_buffer_size = playback_length;
		sound->m_buffer = (unsigned char*)malloc( sound->m_buffer_size );
		if ( !sound->m_buffer ) {
			DELETE( sound );
			if ( converter.needed ) {
				SDL_free( converter.buf );
			}
			SDL_FreeWAV( wav_buffer );
			return nullptr;
		}
		memcpy( ptr( sound->m_buffer, 0, playback_length ), playback_buffer, playback_length );

		sound->m_spec.channels = AUDIO_CHANNELS;
		sound->m_spec.format = AUDIO_FORMAT;
		sound->m_spec.freq = AUDIO_FREQUENCY;
		sound->m_spec.padding = 0;
		sound->m_spec.samples = AUDIO_SAMPLES;
		sound->m_spec.silence = 0;
		sound->m_spec.size = playback_length;

		if ( converter.needed ) {
			SDL_free( converter.buf );
		}
		SDL_FreeWAV( wav_buffer );

		m_sounds[ filename ] = sound;

		return sound;
	}
}

}
}
