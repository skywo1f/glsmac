#include <iostream>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <filesystem>
#include <iomanip>
#include <vector>

struct EmbeddedFile {
	std::string key;
	std::string data_name;
	size_t size;
};

void Embed( std::ofstream& dst, std::vector< EmbeddedFile >& files, const std::string& srcdir, const std::string& path ) {

	const auto full_path = (std::filesystem::path)srcdir / path;

	if ( std::filesystem::is_directory( full_path ) ) {
		for ( const auto& entry : std::filesystem::directory_iterator( full_path ) ) {
			const auto relpath = entry.path().string().substr( srcdir.length() + 1 );
			Embed( dst, files, srcdir, relpath );
		}
	}
	else if ( std::filesystem::is_regular_file( full_path ) ) {

		std::string key = "";
		key.reserve( path.size() );
		for ( const auto& c : path ) {
			switch ( c ) {
				case '\\': {
					key += '/';
					break;
				}
				default:
					key += c;
			}
		}

		std::ifstream in( full_path, std::ios::binary );
		if ( !in.is_open() ) {
			std::cout << "Could not open file for reading: " << full_path << std::endl;
			exit( 1 );
		}
		std::stringstream buffer;
		buffer << in.rdbuf();
		in.close();
		const auto& str = buffer.str();

#ifdef DEBUG
		std::cout << "	Embedding " << path << " as " << key << " (" << std::to_string( str.size() ) << " bytes)" << std::endl;
#endif

		const auto data_name = "s_embedded_data_" + std::to_string( files.size() );
		dst << "static const char " << data_name << "[] =\n\t\"";
		for ( size_t i = 0 ; i < str.size() ; i++ ) {
			if ( i > 0 && i % 2048 == 0 ) {
				dst << "\"\n\t\"";
			}
			dst << '\\' << std::oct << std::setw( 3 ) << std::setfill( '0' )
				<< static_cast< unsigned int >( static_cast< unsigned char >( str[ i ] ) );
		}
		dst << "\";\n\n" << std::dec;
		files.push_back( { key, data_name, str.size() } );

	}
	else {
		std::cout << "	Skipping " << path << " because it's neither file nor directory" << std::endl;
	}
}

int main( int argc, char* argv[] ) {

	if ( argc < 3 ) {
		std::cout << "Usage: " << argv[ 0 ] << " <out_file> <src_dir> [<src_file>] [<src_file>] [...]" << std::endl;
		exit( 1 );
	}

	const std::string path = argv[ 0 ];
	std::string dir = path.substr( 0, path.length() - 8 );
	const std::string sep = dir.substr( dir.length() - 1 );

	const std::filesystem::path out_file = argv[ 1 ];
	const std::filesystem::path out_dir = out_file.parent_path();
	const std::filesystem::path srcdir = argv[ 2 ];

	std::filesystem::create_directory( out_dir );

	std::ofstream out( out_file.string() );
	if ( !out.is_open() ) {
		std::cout << "Could not open file for writing: " << out_file << std::endl;
		exit( 1 );
	}

#ifdef DEBUG
	std::cout << "Creating " << out_file << "..." << std::endl;
#endif

	out << R"(#include <unordered_map>
#include <string>
#include <vector>

)";

	std::vector< EmbeddedFile > files = {};
	for ( size_t i = 3 ; i < argc ; i++ ) {
		Embed( out, files, srcdir.string(), argv[ i ] );
	}

	out << "const std::unordered_map< std::string, std::vector< unsigned char > >& GetEmbeddedFiles() {\n"
		<< "\tstatic const std::unordered_map< std::string, std::vector< unsigned char > > files = {\n";
	for ( const auto& file : files ) {
		out << "\t\t{ \"" << file.key << "\", std::vector< unsigned char >( "
			<< file.data_name << ", " << file.data_name << " + " << file.size << " ) },\n";
	}
	out << "\t};\n\treturn files;\n}\n\n";
	out.close();
	
#ifdef DEBUG
	std::cout << argv[ 1 ] << " created successfully" << std::endl;
#endif

	return 0;
}
