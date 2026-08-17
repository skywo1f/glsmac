#pragma once

#include <unordered_map>

#include "TXTLoader.h"

namespace loader {
namespace txt {

CLASS( TechnologyTXTLoader, TXTLoader )

public:

	struct technology_text_t {
		std::string short_description;
		std::string long_description;
		std::string quote;
		std::vector< std::string > description_lines;
		std::vector< std::string > quote_lines;
	};

	const technology_text_t& GetTechnologyText( const size_t index );

private:

	std::unordered_map< size_t, technology_text_t > m_technology_text = {};
	std::string m_short_descriptions_path = "";
	std::string m_long_descriptions_path = "";
	std::string m_quotes_path = "";

	const std::vector< std::string >& GetSection(
		const txt_data_t& data,
		const std::string& name
	) const;
	static std::vector< std::string > NormalizeLines(
		const std::vector< std::string >& lines,
		const bool strip_carets,
		const bool preserve_empty
	);
	static std::string NormalizeLine( const std::string& line, const bool strip_carets );
	static std::string JoinLines( const std::vector< std::string >& lines );

};

}
}
