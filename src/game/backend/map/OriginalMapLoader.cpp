#include "OriginalMapLoader.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include "game/backend/map/tile/Tiles.h"
#include "game/backend/settings/Types.h"
#include "types/Buffer.h"

namespace game {
namespace backend {
namespace map {

namespace {

static constexpr size_t HEADER_SIZE = 2739;
static constexpr size_t TILE_RECORD_SIZE = 44;
static constexpr size_t LABEL_COUNT_OFFSET = 47;
static constexpr size_t FLAT_MAP_OFFSET = 43;
static constexpr size_t WIDTH_OFFSET = 15;
static constexpr size_t HEIGHT_OFFSET = 19;
static constexpr uint16_t EXPANSION_LANDMARK_MASK = 0x00F0;
static constexpr std::array< uint8_t, 10 > MAGIC = {
	'T', 'E', 'R', 'R', 'A', 'N', 'M', 'A', 'P', 0
};

struct original_tile_t {
	tile::Tile* tile = nullptr;
	tile::elevation_t elevation = 0;
	bool is_water = false;
	std::array< size_t, 4 > vertices = {};
};

struct original_map_info_t {
	uint32_t width = 0;
	uint32_t height = 0;
	uint64_t tile_count = 0;
};

static size_t GetUniqueVertices(
	const std::array< size_t, 4 >& vertices,
	std::array< std::pair< size_t, size_t >, 4 >& unique
) {
	size_t unique_count = 0;
	for ( const auto vertex : vertices ) {
		size_t i = 0;
		while ( i < unique_count && unique[ i ].first != vertex ) { i++; }
		if ( i == unique_count ) {
			unique[ unique_count++ ] = { vertex, 1 };
		}
		else {
			unique[ i ].second++;
		}
	}
	return unique_count;
}

static uint32_t ReadUInt32( const uint8_t* const data, const size_t size, const size_t offset ) {
	if ( offset > size || size - offset < sizeof( uint32_t ) ) {
		throw std::runtime_error( "original map ends while reading an integer" );
	}
	return
		static_cast< uint32_t >( data[ offset ] ) |
		static_cast< uint32_t >( data[ offset + 1 ] ) << 8 |
		static_cast< uint32_t >( data[ offset + 2 ] ) << 16 |
		static_cast< uint32_t >( data[ offset + 3 ] ) << 24;
}

static tile::landmark_t GetLandmarks( const uint16_t flags, const bool is_water ) {
	tile::landmark_t landmarks = tile::LANDMARK_NONE;
	if ( flags & 0x0001 ) { landmarks |= tile::LANDMARK_SUNNY_MESA; }
	if ( flags & 0x0004 ) { landmarks |= tile::LANDMARK_GEOTHERMAL_SHALLOWS; }
	if ( flags & 0x0008 ) { landmarks |= tile::LANDMARK_PHOLUS_RIDGE; }
	if ( flags & 0x0100 ) { landmarks |= tile::LANDMARK_GARLAND_CRATER; }
	if ( flags & 0x0200 ) { landmarks |= tile::LANDMARK_MOUNT_PLANET; }
	if ( flags & 0x0400 ) { landmarks |= tile::LANDMARK_MONSOON_JUNGLE; }
	if ( flags & 0x0800 ) { landmarks |= tile::LANDMARK_URANIUM_FLATS; }
	if ( flags & 0x1000 ) { landmarks |= tile::LANDMARK_NEW_SARGASSO; }
	if ( flags & 0x2000 ) { landmarks |= tile::LANDMARK_THE_RUINS; }
	if ( flags & 0x4000 ) { landmarks |= tile::LANDMARK_GREAT_DUNES; }
	// The high bit has a different meaning on land in the huge base-game map.
	if ( is_water && ( flags & 0x8000 ) ) { landmarks |= tile::LANDMARK_FRESHWATER_SEA; }
	return landmarks;
}

static void ApplyRecord( tile::Tile* const map_tile, const uint8_t* const record, const bool is_water ) {
	map_tile->moisture = record[ 0 ] & 0x10
		? tile::MOISTURE_RAINY
		: ( record[ 0 ] & 0x08 ? tile::MOISTURE_MOIST : tile::MOISTURE_ARID );
	map_tile->rockiness = record[ 5 ] & 0x80
		? tile::ROCKINESS_ROCKY
		: ( record[ 5 ] & 0x40 ? tile::ROCKINESS_ROLLING : tile::ROCKINESS_FLAT );
	map_tile->bonus = tile::BONUS_NONE;
	if ( ( record[ 9 ] & 0x04 ) && ( record[ 11 ] & 0x20 ) ) {
		switch ( record[ 10 ] & 0x03 ) {
			case 0: map_tile->bonus = tile::BONUS_NUTRIENT; break;
			case 1: map_tile->bonus = tile::BONUS_ENERGY; break;
			case 2: map_tile->bonus = tile::BONUS_MINERALS; break;
			default: break;
		}
	}

	map_tile->features = tile::FEATURE_NONE;
	if ( record[ 8 ] & 0x80 ) { map_tile->features |= tile::FEATURE_RIVER; }
	if ( record[ 9 ] & 0x20 ) { map_tile->features |= tile::FEATURE_MONOLITH; }
	if ( record[ 8 ] & 0x20 ) { map_tile->features |= tile::FEATURE_XENOFUNGUS; }
	if ( record[ 11 ] & 0x02 ) { map_tile->features |= tile::FEATURE_UNITY_POD; }

	map_tile->terraforming = tile::TERRAFORMING_NONE;
	if ( record[ 11 ] & 0x01 ) { map_tile->terraforming |= tile::TERRAFORMING_BOREHOLE; }
	if ( record[ 11 ] & 0x80 ) { map_tile->terraforming |= tile::TERRAFORMING_SENSOR; }
	if ( record[ 10 ] & 0x04 ) { map_tile->terraforming |= tile::TERRAFORMING_AIRBASE; }
	if ( record[ 10 ] & 0x20 ) { map_tile->terraforming |= tile::TERRAFORMING_FOREST; }
	if ( record[ 10 ] & 0x40 ) { map_tile->terraforming |= tile::TERRAFORMING_CONDENSER; }
	if ( record[ 10 ] & 0x80 ) { map_tile->terraforming |= tile::TERRAFORMING_MIRROR; }
	if ( record[ 9 ] & 0x08 ) { map_tile->terraforming |= tile::TERRAFORMING_BUNKER; }
	if ( record[ 9 ] & 0x80 ) { map_tile->terraforming |= tile::TERRAFORMING_FARM; }
	if ( record[ 10 ] & 0x08 ) { map_tile->terraforming |= tile::TERRAFORMING_SOIL_ENRICHER; }
	if ( record[ 8 ] & 0x04 ) { map_tile->terraforming |= tile::TERRAFORMING_ROAD; }
	if ( ( record[ 8 ] & 0x0C ) == 0x0C ) { map_tile->terraforming |= tile::TERRAFORMING_MAG_TUBE; }
	if ( record[ 8 ] & 0x10 ) { map_tile->terraforming |= tile::TERRAFORMING_MINE; }
	if ( record[ 8 ] & 0x40 ) { map_tile->terraforming |= tile::TERRAFORMING_SOLAR; }

	const auto landmark_flags = static_cast< uint16_t >( record[ 12 ] ) << 8 | record[ 13 ];
	if ( landmark_flags & EXPANSION_LANDMARK_MASK ) {
		throw std::runtime_error( "Alien Crossfire map landmarks are not supported" );
	}
	map_tile->landmarks = GetLandmarks( landmark_flags, is_water );
	if ( map_tile->landmarks & tile::LANDMARK_MOUNT_PLANET ) {
		map_tile->features |= tile::FEATURE_VOLCANO;
	}
	if ( map_tile->landmarks & tile::LANDMARK_NEW_SARGASSO ) {
		map_tile->features |= tile::FEATURE_XENOFUNGUS;
	}
	if ( map_tile->landmarks & tile::LANDMARK_GARLAND_CRATER ) {
		map_tile->features |= tile::FEATURE_GARLAND_CRATER;
	}
	if ( map_tile->landmarks & tile::LANDMARK_GEOTHERMAL_SHALLOWS ) {
		map_tile->features |= tile::FEATURE_GEOTHERMAL;
	}
	if ( map_tile->landmarks & tile::LANDMARK_MONSOON_JUNGLE ) {
		map_tile->features |= tile::FEATURE_JUNGLE;
	}
	if ( map_tile->landmarks & tile::LANDMARK_URANIUM_FLATS ) {
		map_tile->features |= tile::FEATURE_URANIUM;
	}
	if ( map_tile->landmarks & tile::LANDMARK_GREAT_DUNES ) {
		map_tile->features |= tile::FEATURE_DUNES;
	}
	if ( map_tile->landmarks & tile::LANDMARK_SUNNY_MESA ) {
		map_tile->features |= tile::FEATURE_SUNNY_MESA;
	}
}

static original_map_info_t ValidateOriginalMap( const types::Buffer& buffer ) {
	if ( !OriginalMapLoader::IsOriginalMap( buffer ) || buffer.lenw < HEADER_SIZE ) {
		throw std::runtime_error( "invalid original map header" );
	}
	const auto* const data = buffer.data;
	const size_t size = buffer.lenw;
	if (
		data[ 10 ] != 0x1A || data[ 11 ] != 0x05 || data[ 12 ] != 0 ||
		data[ 13 ] != 0 || data[ 14 ] != 0
	) {
		throw std::runtime_error( "unsupported original map version" );
	}
	if ( data[ FLAT_MAP_OFFSET ] != 0 ) {
		throw std::runtime_error( "flat original maps are not supported" );
	}
	const auto width = ReadUInt32( data, size, WIDTH_OFFSET );
	const auto height = ReadUInt32( data, size, HEIGHT_OFFSET );
	const auto area = static_cast< uint64_t >( width ) * height;
	if (
		width < settings::MAP_MIN_DIMENSION || height < settings::MAP_MIN_DIMENSION ||
		( width & 1 ) || ( height & 1 ) || area > settings::MAP_MAX_AREA
	) {
		throw std::runtime_error( "invalid original map dimensions" );
	}
	if ( ReadUInt32( data, size, LABEL_COUNT_OFFSET ) > 64 ) {
		throw std::runtime_error( "invalid original map label count" );
	}
	const auto tile_count = area / 2;
	if ( tile_count > ( size - HEADER_SIZE ) / TILE_RECORD_SIZE ) {
		throw std::runtime_error( "original map tile data is truncated" );
	}
	for ( size_t tile_index = 0 ; tile_index < tile_count ; tile_index++ ) {
		const auto* const record = data + HEADER_SIZE + tile_index * TILE_RECORD_SIZE;
		const auto landmark_flags = static_cast< uint16_t >( record[ 12 ] ) << 8 | record[ 13 ];
		if ( landmark_flags & EXPANSION_LANDMARK_MASK ) {
			throw std::runtime_error( "Alien Crossfire map landmarks are not supported" );
		}
	}
	return { width, height, tile_count };
}

}

bool OriginalMapLoader::IsOriginalMap( const types::Buffer& buffer ) {
	return
		buffer.lenw >= MAGIC.size() &&
		buffer.data &&
		std::memcmp( buffer.data, MAGIC.data(), MAGIC.size() ) == 0;
}

void OriginalMapLoader::Validate( const types::Buffer& buffer ) {
	ValidateOriginalMap( buffer );
}

void OriginalMapLoader::Load( tile::Tiles* const tiles, const types::Buffer& buffer ) {
	if ( !tiles ) {
		throw std::runtime_error( "original map has no tile storage" );
	}
	const auto map_info = ValidateOriginalMap( buffer );
	const auto* const data = buffer.data;
	const auto width = map_info.width;
	const auto height = map_info.height;
	const auto tile_count = map_info.tile_count;

	tiles->Resize( width, height );
	tiles->SetUseCenterWaterClassification( true );
	std::unordered_map< tile::elevation_t*, size_t > vertex_indices = {};
	std::vector< double > vertex_values = {};
	std::vector< double > vertex_sums = {};
	std::vector< size_t > vertex_samples = {};
	std::vector< original_tile_t > original_tiles = {};
	original_tiles.reserve( static_cast< size_t >( tile_count ) );

	const auto get_vertex_index = [ & ]( tile::elevation_t* const vertex ) {
		const auto it = vertex_indices.find( vertex );
		if ( it != vertex_indices.end() ) {
			return it->second;
		}
		const auto index = vertex_values.size();
		vertex_indices.emplace( vertex, index );
		vertex_values.push_back( 0.0 );
		vertex_sums.push_back( 0.0 );
		vertex_samples.push_back( 0 );
		return index;
	};

	for ( size_t y = 0 ; y < height ; y++ ) {
		for ( size_t x = y & 1 ; x < width ; x += 2 ) {
			const auto tile_index = y * ( width / 2 ) + x / 2;
			const auto* const record = data + HEADER_SIZE + tile_index * TILE_RECORD_SIZE;
			const bool is_water = record[ 1 ] < 60;
			auto* const map_tile = &tiles->At( x, y );
			ApplyRecord( map_tile, record, is_water );

			// SMAC stores tile-center altitude in 50 m increments around sea level.
			const auto elevation = static_cast< tile::elevation_t >(
				static_cast< int >( record[ 1 ] ) * 50 - 2975
			);
			original_tile_t original = {
				map_tile,
				elevation,
				is_water,
				{
					get_vertex_index( map_tile->elevation.left ),
					get_vertex_index( map_tile->elevation.top ),
					get_vertex_index( map_tile->elevation.right ),
					get_vertex_index( map_tile->elevation.bottom ),
				}
			};
			for ( const auto vertex : original.vertices ) {
				vertex_sums[ vertex ] += elevation;
				vertex_samples[ vertex ]++;
			}
			original_tiles.push_back( original );
		}
	}
	for ( size_t i = 0 ; i < vertex_values.size() ; i++ ) {
		vertex_values[ i ] = vertex_sums[ i ] / vertex_samples[ i ];
	}

	// Project shared vertices onto every original center altitude. The source
	// format stores centers while GLSMAC stores a continuous corner mesh.
	for ( size_t iteration = 0 ; iteration < 128 ; iteration++ ) {
		for ( const auto& original : original_tiles ) {
			std::array< std::pair< size_t, size_t >, 4 > unique = {};
			const auto unique_count = GetUniqueVertices( original.vertices, unique );
			double sum = 0.0;
			double denominator = 0.0;
			for ( size_t i = 0 ; i < unique_count ; i++ ) {
				const auto coefficient = static_cast< double >( unique[ i ].second );
				sum += vertex_values[ unique[ i ].first ] * coefficient;
				denominator += coefficient * coefficient;
			}
			const auto adjustment =
				( static_cast< double >( original.elevation ) * 4.0 - sum ) /
				denominator * 0.75;
			for ( size_t i = 0 ; i < unique_count ; i++ ) {
				auto& value = vertex_values[ unique[ i ].first ];
				value = std::clamp(
					value + adjustment * unique[ i ].second,
					static_cast< double >( tile::ELEVATION_MIN ),
					static_cast< double >( tile::ELEVATION_MAX )
				);
			}
		}
	}

	// The bounded shared mesh cannot reproduce every independent source center
	// exactly. Project only the remaining sign violations onto a small margin so
	// SMAC's center-altitude land/water classification is preserved.
	static constexpr double CLASSIFICATION_MARGIN = 100.0;
	for ( size_t iteration = 0 ; iteration < 4096 ; iteration++ ) {
		size_t violations = 0;
		for ( const auto& original : original_tiles ) {
			std::array< std::pair< size_t, size_t >, 4 > unique = {};
			const auto unique_count = GetUniqueVertices( original.vertices, unique );
			double sum = 0.0;
			double denominator = 0.0;
			for ( size_t i = 0 ; i < unique_count ; i++ ) {
				const auto coefficient = static_cast< double >( unique[ i ].second );
				sum += vertex_values[ unique[ i ].first ] * coefficient;
				denominator += coefficient * coefficient;
			}
			const auto target = original.is_water
				? -CLASSIFICATION_MARGIN
				: CLASSIFICATION_MARGIN;
			if ( ( original.is_water && sum <= target ) || ( !original.is_water && sum >= target ) ) {
				continue;
			}
			violations++;
			const auto adjustment = ( target - sum ) / denominator;
			for ( size_t i = 0 ; i < unique_count ; i++ ) {
				auto& value = vertex_values[ unique[ i ].first ];
				value = std::clamp(
					value + adjustment * unique[ i ].second,
					static_cast< double >( tile::ELEVATION_MIN ),
					static_cast< double >( tile::ELEVATION_MAX )
				);
			}
		}
		if ( violations == 0 ) {
			break;
		}
	}
	for ( const auto& vertex : vertex_indices ) {
		*vertex.first = static_cast< tile::elevation_t >(
			std::llround( vertex_values[ vertex.second ] )
		);
	}

	size_t water_mismatches = 0;
	for ( const auto& original : original_tiles ) {
		original.tile->Update();
		if ( original.tile->is_water_tile != original.is_water ) {
			water_mismatches++;
		}
	}
	if ( water_mismatches != 0 ) {
		throw std::runtime_error(
			"original map terrain reconstruction changed " +
			std::to_string( water_mismatches ) + " land/water tiles"
		);
	}
}

}
}
}
