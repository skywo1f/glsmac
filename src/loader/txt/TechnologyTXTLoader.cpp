#include "TechnologyTXTLoader.h"

#include <algorithm>

#include "engine/Engine.h"
#include "resource/ResourceManager.h"
#include "util/String.h"

namespace loader {
namespace txt {

const TechnologyTXTLoader::technology_text_t& TechnologyTXTLoader::GetTechnologyText( const size_t index ) {
	auto it = m_technology_text.find( index );
	if ( it == m_technology_text.end() ) {
		if ( m_short_descriptions_path.empty() ) {
			m_short_descriptions_path = g_engine->GetResourceManager()->GetCustomPath(
				"TECHSHORTS.txt"
			);
			m_long_descriptions_path = g_engine->GetResourceManager()->GetCustomPath(
				"techlongs.txt"
			);
			m_quotes_path = g_engine->GetResourceManager()->GetCustomPath( "Blurbs.txt" );
		}
		const auto section_name = "TECH" + std::to_string( index );
		const auto& short_data = GetTXTData( m_short_descriptions_path );
		const auto& long_data = GetTXTData( m_long_descriptions_path );
		const auto& quote_data = GetTXTData( m_quotes_path );
		const auto short_lines = NormalizeLines(
			GetSection( short_data, section_name ), true, false
		);
		const auto description_lines = NormalizeLines(
			GetSection( long_data, section_name ), false, false
		);
		const auto quote_lines = NormalizeLines(
			GetSection( quote_data, section_name ), true, true
		);
		it = m_technology_text.insert(
			{
				index,
				technology_text_t{
					short_lines.empty() ? "" : short_lines.front(),
					JoinLines( description_lines ),
					JoinLines( quote_lines ),
					description_lines,
					quote_lines,
				}
			}
		).first;
	}
	return it->second;
}

const std::vector< std::string >& TechnologyTXTLoader::GetSection(
	const txt_data_t& data,
	const std::string& name
) const {
	const auto it = data.sections.find( name );
	if ( it == data.sections.end() ) {
		THROW( "file does not contain section #" + name );
	}
	return it->second;
}

std::vector< std::string > TechnologyTXTLoader::NormalizeLines(
	const std::vector< std::string >& lines,
	const bool strip_carets,
	const bool preserve_empty
) {
	std::vector< std::string > result = {};
	result.reserve( lines.size() );
	for ( const auto& line : lines ) {
		auto normalized = NormalizeLine( line, strip_carets );
		if ( preserve_empty || !normalized.empty() ) {
			result.push_back( std::move( normalized ) );
		}
	}
	return result;
}

std::string TechnologyTXTLoader::NormalizeLine( const std::string& line, const bool strip_carets ) {
	auto result = util::String::TrimCopy( line );
	if ( strip_carets ) {
		while ( !result.empty() && result.front() == '^' ) {
			result.erase( result.begin() );
		}
		util::String::Trim( result );
	}
	if ( result.size() >= 2 && result.front() == '"' && result.back() == '"' ) {
		result = result.substr( 1, result.size() - 2 );
	}
	result.erase(
		std::remove_if(
			result.begin(), result.end(), []( const char c ) {
				return c == '{' || c == '}' || c == '[' || c == ']';
			}
		),
		result.end()
	);
	return result;
}

std::string TechnologyTXTLoader::JoinLines( const std::vector< std::string >& lines ) {
	std::string result = "";
	for ( const auto& line : lines ) {
		if ( line.empty() ) {
			if ( !result.empty() && result.back() != '\n' ) {
				result.push_back( '\n' );
			}
		}
		else {
			if ( !result.empty() && result.back() != '\n' ) {
				result.push_back( ' ' );
			}
			result += line;
		}
	}
	return result;
}

}
}
