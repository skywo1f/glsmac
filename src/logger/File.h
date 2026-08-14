#pragma once

#include <fstream>
#include <mutex>
#include <string>

#include "Logger.h"

namespace logger {

CLASS( File, Logger )

	File( const std::string& path, const std::string& previous_path );
	~File() override;

	void Log( const std::string& text ) override;

private:
	std::ofstream m_stream;
	std::mutex m_mutex;

};

}
