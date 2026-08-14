#include "File.h"

#include <filesystem>

namespace logger {

File::File( const std::string& path, const std::string& previous_path ) {
	std::error_code error;
	std::filesystem::remove( previous_path, error );
	error.clear();
	if ( std::filesystem::exists( path, error ) && !error ) {
		error.clear();
		std::filesystem::rename( path, previous_path, error );
	}
	m_stream.open( path, std::ios::out | std::ios::trunc );
}

File::~File() {
	std::lock_guard guard( m_mutex );
	m_stream.flush();
}

void File::Log( const std::string& text ) {
	std::lock_guard guard( m_mutex );
	if ( m_stream ) {
		m_stream << text << std::endl;
		m_stream.flush();
	}
}

}
