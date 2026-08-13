#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <unordered_set>

#include "SimplePerlin.h"

#include "util/random/Random.h"
#include "util/Perlin.h"
#include "util/Clamper.h"

#include "game/backend/map/tile/Tiles.h"

// higher values generate more interesting maps, at cost of longer map generation (isn't noticeable before 200 or so)
#define PERLIN_PASSES 128

#define RIVER_SPAWN_CHANCE_DIFFICULTY 12
#define RIVER_STARTING_LENGTH_MIN 8
#define RIVER_STARTING_LENGTH_MAX 16
#define RIVER_DIRECTION_CHANGE_CHANCE_DIFFICULTY 2
#define RIVER_SPLIT_CHANCE_DIFFICULTY 6
#define RIVER_JOIN_CHANCE_DIFFICULTY 12

#define RIVER_RANDOM_DIRECTION ( m_random->GetUInt( 0, ( tile->neighbours.size() - 1 ) ) )
#define RIVER_RANDOM_DIRECTION_DIAGONAL ( m_random->GetUInt( 0, 1 ) * 2 - 1 )

#define RESOURCE_SPAWN_CHANCE_DIFFICULTY 24

namespace game {
namespace backend {
namespace map {
namespace generator {

namespace {

enum class landmark_shape_t {
	CRATER,
	VOLCANO,
	JUNGLE,
	URANIUM,
	SARGASSO,
	RUINS,
	DUNES,
	FRESHWATER,
	MESA,
	CANYON,
	GEOTHERMAL,
	RIDGE,
	BOREHOLE_CLUSTER,
	MANIFOLD_NEXUS,
};

struct landmark_spec_t {
	const char* name;
	tile::landmark_t landmark;
	landmark_shape_t shape;
	bool is_water;
	size_t radius;
	size_t minimum_tiles;
};

static const size_t GetTileDistance( const tile::Tile* const first, const tile::Tile* const second, const size_t width ) {
	const auto dx = std::abs(
		static_cast< ptrdiff_t >( first->coord.x ) - static_cast< ptrdiff_t >( second->coord.x )
	);
	const auto dy = std::abs(
		static_cast< ptrdiff_t >( first->coord.y ) - static_cast< ptrdiff_t >( second->coord.y )
	);
	return static_cast< size_t >( std::min(
		( dx + dy ) / 2,
		std::min(
			( std::abs( dx - static_cast< ptrdiff_t >( width ) ) + dy ) / 2,
			( dx + static_cast< ptrdiff_t >( width ) + dy ) / 2
		)
	) );
}

static const std::vector< tile::Tile* > GetLandmarkTiles(
	tile::Tile* const center,
	const size_t radius,
	const bool is_water
) {
	std::vector< std::pair< tile::Tile*, size_t > > pending = { { center, 0 } };
	std::unordered_set< tile::Tile* > seen = { center };
	std::vector< tile::Tile* > result = {};
	for ( size_t i = 0 ; i < pending.size() ; i++ ) {
		auto* const current = pending[ i ].first;
		const auto distance = pending[ i ].second;
		if ( current->is_water_tile == is_water ) {
			result.push_back( current );
		}
		if ( distance >= radius ) {
			continue;
		}
		for ( auto* const neighbour : current->neighbours ) {
			if ( neighbour->is_water_tile == is_water && seen.insert( neighbour ).second ) {
				pending.push_back( { neighbour, distance + 1 } );
			}
		}
	}
	return result;
}

static const int64_t GetLandmarkScore(
	const landmark_spec_t& spec,
	const tile::Tile* const candidate,
	const size_t map_height,
	const size_t cluster_size
) {
	const auto elevation = static_cast< int64_t >( *candidate->elevation.center );
	const auto latitude = std::abs(
		static_cast< int64_t >( candidate->coord.y ) - static_cast< int64_t >( map_height / 2 )
	);
	const auto support = static_cast< int64_t >( cluster_size ) * 10000;
	switch ( spec.shape ) {
		case landmark_shape_t::VOLCANO:
		case landmark_shape_t::MESA:
			return support + elevation;
		case landmark_shape_t::JUNGLE:
			return support + static_cast< int64_t >( candidate->moisture ) * 2000 - latitude * 100;
		case landmark_shape_t::DUNES:
			return support + static_cast< int64_t >( tile::MOISTURE_RAINY - candidate->moisture ) * 2000 - latitude * 50;
		case landmark_shape_t::CRATER:
		case landmark_shape_t::CANYON:
			return support - elevation;
		case landmark_shape_t::RIDGE:
			return support + elevation + static_cast< int64_t >( candidate->rockiness ) * 1000;
		case landmark_shape_t::GEOTHERMAL:
		case landmark_shape_t::FRESHWATER:
			return support + elevation;
		case landmark_shape_t::SARGASSO:
			return support - elevation;
		case landmark_shape_t::URANIUM:
		case landmark_shape_t::RUINS:
		case landmark_shape_t::BOREHOLE_CLUSTER:
		case landmark_shape_t::MANIFOLD_NEXUS:
			return support - latitude * 50;
	}
	return support;
}

static void ClearLandmarkConflicts( tile::Tile* const landmark_tile ) {
	static constexpr tile::feature_t CONFLICTING_FEATURES =
		tile::FEATURE_RIVER |
		tile::FEATURE_MONOLITH |
		tile::FEATURE_XENOFUNGUS |
		tile::FEATURE_JUNGLE |
		tile::FEATURE_URANIUM |
		tile::FEATURE_GEOTHERMAL |
		tile::FEATURE_UNITY_POD |
		tile::FEATURE_VOLCANO |
		tile::FEATURE_SUNNY_MESA |
		tile::FEATURE_GARLAND_CRATER |
		tile::FEATURE_DUNES;
	landmark_tile->features &= static_cast< tile::feature_t >( ~CONFLICTING_FEATURES );
}

static void ApplyLandmark(
	const landmark_spec_t& spec,
	tile::Tile* const center,
	const std::vector< tile::Tile* >& landmark_tiles
) {
	std::unordered_set< tile::Tile* > borehole_tiles = {};
	if ( spec.shape == landmark_shape_t::BOREHOLE_CLUSTER ) {
		static constexpr size_t BOREHOLE_OFFSETS[] = { 1, 4, 7 };
		for ( const auto offset : BOREHOLE_OFFSETS ) {
			if ( offset < landmark_tiles.size() ) {
				borehole_tiles.insert( landmark_tiles[ offset ] );
			}
		}
		if ( borehole_tiles.empty() ) {
			borehole_tiles.insert( center );
		}
	}
	for ( auto* const landmark_tile : landmark_tiles ) {
		ClearLandmarkConflicts( landmark_tile );
		const bool is_borehole = borehole_tiles.find( landmark_tile ) != borehole_tiles.end();
		if (
			spec.shape != landmark_shape_t::BOREHOLE_CLUSTER ||
			landmark_tile == center || is_borehole
		) {
			landmark_tile->landmarks |= spec.landmark;
		}
		if (
			spec.shape == landmark_shape_t::BOREHOLE_CLUSTER ||
			spec.shape == landmark_shape_t::MANIFOLD_NEXUS
		) {
			landmark_tile->terraforming = tile::TERRAFORMING_NONE;
		}
		switch ( spec.shape ) {
			case landmark_shape_t::CRATER:
				landmark_tile->features |= tile::FEATURE_GARLAND_CRATER;
				landmark_tile->rockiness = tile::ROCKINESS_ROLLING;
				break;
			case landmark_shape_t::VOLCANO:
				landmark_tile->features |= tile::FEATURE_VOLCANO;
				landmark_tile->rockiness = landmark_tile == center
					? tile::ROCKINESS_ROCKY
					: std::max( landmark_tile->rockiness, tile::ROCKINESS_ROLLING );
				break;
			case landmark_shape_t::JUNGLE:
				landmark_tile->features |= tile::FEATURE_JUNGLE;
				landmark_tile->moisture = tile::MOISTURE_RAINY;
				break;
			case landmark_shape_t::URANIUM:
				landmark_tile->features |= tile::FEATURE_URANIUM;
				landmark_tile->rockiness = tile::ROCKINESS_FLAT;
				break;
			case landmark_shape_t::SARGASSO:
				landmark_tile->features |= tile::FEATURE_XENOFUNGUS;
				break;
			case landmark_shape_t::RUINS:
				if ( landmark_tile != center ) {
					landmark_tile->features |= tile::FEATURE_MONOLITH;
				}
				else {
					landmark_tile->rockiness = tile::ROCKINESS_FLAT;
				}
				break;
			case landmark_shape_t::DUNES:
				landmark_tile->features |= tile::FEATURE_DUNES;
				landmark_tile->moisture = tile::MOISTURE_ARID;
				landmark_tile->rockiness = tile::ROCKINESS_FLAT;
				break;
			case landmark_shape_t::FRESHWATER:
				break;
			case landmark_shape_t::MESA:
				landmark_tile->features |= tile::FEATURE_SUNNY_MESA;
				landmark_tile->rockiness = std::max( landmark_tile->rockiness, tile::ROCKINESS_ROLLING );
				break;
			case landmark_shape_t::CANYON:
				landmark_tile->rockiness = tile::ROCKINESS_ROLLING;
				break;
			case landmark_shape_t::GEOTHERMAL:
				landmark_tile->features |= tile::FEATURE_GEOTHERMAL;
				break;
			case landmark_shape_t::RIDGE:
				landmark_tile->rockiness = std::max( landmark_tile->rockiness, tile::ROCKINESS_ROLLING );
				break;
			case landmark_shape_t::BOREHOLE_CLUSTER:
				if ( is_borehole ) {
					landmark_tile->terraforming = tile::TERRAFORMING_BOREHOLE;
				}
				break;
			case landmark_shape_t::MANIFOLD_NEXUS:
				break;
		}
	}
}

}

void SimplePerlin::GenerateElevations( tile::Tiles* tiles, const backend::settings::MapSettings* map_settings, MT_CANCELABLE ) {
	tile::Tile* tile;

	const auto w = tiles->GetWidth();
	const auto h = tiles->GetHeight();

	Log( "Generating elevations ( " + std::to_string( w ) + " x " + std::to_string( h ) + " )" );

	const auto seed = m_random->GetUInt();

	const float land_bias = 1.3f; // increase amount of land generated
	util::Clamper< float > perlin_to_elevation(
		{
			{ -1.0f - land_bias,    1.0f },
			{ MAPGEN_ELEVATION_MIN, MAPGEN_ELEVATION_MAX }
		}
	);

	util::Clamper< float > perlin_to_value(
		{ // to moisture or rockiness
			{ -1.0f, 1.0f },
			{ 1.0f,  3.0f }
		}
	);

	util::Perlin perlin( seed );

	MT_RETIF();

	// process in random order
	std::vector< tile::Tile* > randomtiles = GetTilesInRandomOrder( tiles, MT_C );
	MT_RETIF();

	for ( auto& tile : randomtiles ) {

#define PERLIN_S( _x, _y, _z, _scale ) perlin.Noise( (float) ( (float)_x ) * _scale, (float) ( (float)_y ) * _scale, _z * _scale, PERLIN_PASSES )
#define PERLIN( _x, _y, _z ) PERLIN_S( _x, _y, _z, 1.0f )

		*tile->elevation.left = *tile->elevation.top = *tile->elevation.right = *tile->elevation.bottom = *tile->elevation.center = 0;

		const float z_elevation = 0;

		*tile->elevation.left = perlin_to_elevation.Clamp( PERLIN( tile->coord.x, tile->coord.y + 0.5f, z_elevation ) );
		*tile->elevation.top = perlin_to_elevation.Clamp( PERLIN( tile->coord.x + 0.5f, tile->coord.y, z_elevation ) );
		*tile->elevation.right = perlin_to_elevation.Clamp( PERLIN( tile->coord.x + 1.0f, tile->coord.y + 0.5f, z_elevation ) );
		*tile->elevation.bottom = perlin_to_elevation.Clamp( PERLIN( tile->coord.x + 0.5f, tile->coord.y + 1.0f, z_elevation ) );

		tile->Update();

		MT_RETIF();
	}

	for ( auto y = 0 ; y < h ; y++ ) {
		for ( auto x = y & 1 ; x < w ; x += 2 ) {
			tile = &tiles->At( x, y );

			const float z_rocks = m_random->GetFloat( 0.0f, 1.0f );
			const float z_moisture = m_random->GetFloat( 0.0f, 1.0f );
			const float z_xenofungus = m_random->GetFloat( 0.0f, 1.0f );

			// moisture
			tile->moisture = perlin_to_value.Clamp( ceil( PERLIN_S( x + 0.5f, y + 0.5f, z_moisture, 0.6f ) ) );

			// rockiness
			tile->rockiness = perlin_to_value.Clamp( round( PERLIN_S( x + 0.5f, y + 0.5f, z_rocks, 1.0f ) ) );
			if ( tile->rockiness == tile::ROCKINESS_ROCKY ) {
				if ( m_random->IsLucky( 3 ) ) {
					tile->rockiness = tile::ROCKINESS_ROLLING;
				}
			}
			// extra rockiness spots
			if ( m_random->IsLucky( 30 ) ) {
				tile->rockiness = tile::ROCKINESS_ROCKY;
				for ( auto& t : tile->neighbours ) {
					if ( m_random->IsLucky( 3 ) ) {
						if ( t->rockiness != tile::ROCKINESS_ROCKY ) {
							t->rockiness = tile::ROCKINESS_ROLLING;
						}
					}
				}
			}

			// fungus
			if ( PERLIN_S( x + 0.5f, y + 0.5f, z_xenofungus, 0.6f ) > 0.4 ) {
				tile->features |= tile::FEATURE_XENOFUNGUS;
			}

			MT_RETIF();
		}
	}

	for ( size_t i = 0 ; i < 8 ; i++ ) {
		// smooth land 2 times, water 8 times
		SmoothTerrain( tiles, MT_C, ( i < 2 ), true );
		MT_RETIF();
	}
}

void SimplePerlin::GenerateDetails( tile::Tiles* tiles, const backend::settings::MapSettings* map_settings, MT_CANCELABLE ) {
	tile::Tile* tile;

	Log( "Generating details ( " + std::to_string( tiles->GetWidth() ) + " x " + std::to_string( tiles->GetHeight() ) + " )" );

	// terrain-dependent features need to go after Finalize to make sure terrain elevations and properties won't change after
	// TODO: split generation into 2 methods
	for ( auto y = 0 ; y < tiles->GetHeight() ; y++ ) {
		for ( auto x = y & 1 ; x < tiles->GetWidth() ; x += 2 ) {
			tile = &tiles->At( x, y );

			// add some rivers
			if ( m_random->IsLucky( RIVER_SPAWN_CHANCE_DIFFICULTY ) ) {
				GenerateRiver(
					tiles,
					tile,
					m_random->GetUInt( RIVER_STARTING_LENGTH_MIN, RIVER_STARTING_LENGTH_MAX ),
					RIVER_RANDOM_DIRECTION,
					RIVER_RANDOM_DIRECTION_DIAGONAL,
					MT_C
				);
			}

			// bonus resources
			if ( m_random->IsLucky( RESOURCE_SPAWN_CHANCE_DIFFICULTY ) ) {
				tile->bonus = m_random->GetUInt( tile::BONUS_NUTRIENT, tile::BONUS_MINERALS );
			}

			MT_RETIF();
		}
	}
}

void SimplePerlin::GenerateLandmarks( tile::Tiles* tiles, const backend::settings::MapSettings* map_settings, MT_CANCELABLE ) {
	const auto map_tile_count = static_cast< size_t >( tiles->GetWidth() ) * tiles->GetHeight() / 2;
	const auto landmark_limit = map_tile_count >= 196
		? size_t( 14 )
		: std::max< size_t >( 1, map_tile_count / 16 );
	const auto minimum_center_distance = std::min( tiles->GetWidth(), tiles->GetHeight() ) >= 24 ? 6 : 2;
	const size_t broad_radius = map_tile_count >= 400 ? 2 : 1;
	const size_t broad_minimum_tiles = map_tile_count >= 400 ? 9 : 5;
	std::vector< landmark_spec_t > specs = {
		{ "Mount Planet", tile::LANDMARK_MOUNT_PLANET, landmark_shape_t::VOLCANO, false, 1, 5 },
		{ "New Sargasso", tile::LANDMARK_NEW_SARGASSO, landmark_shape_t::SARGASSO, true, broad_radius, broad_minimum_tiles },
		{ "Garland Crater", tile::LANDMARK_GARLAND_CRATER, landmark_shape_t::CRATER, false, broad_radius, broad_minimum_tiles },
		{ "Geothermal Shallows", tile::LANDMARK_GEOTHERMAL_SHALLOWS, landmark_shape_t::GEOTHERMAL, true, 1, 5 },
		{ "Monsoon Jungle", tile::LANDMARK_MONSOON_JUNGLE, landmark_shape_t::JUNGLE, false, broad_radius, broad_minimum_tiles },
		{ "Freshwater Sea", tile::LANDMARK_FRESHWATER_SEA, landmark_shape_t::FRESHWATER, true, 1, 5 },
		{ "Uranium Flats", tile::LANDMARK_URANIUM_FLATS, landmark_shape_t::URANIUM, false, 1, 5 },
		{ "The Ruins", tile::LANDMARK_THE_RUINS, landmark_shape_t::RUINS, false, 1, 5 },
		{ "Great Dunes", tile::LANDMARK_GREAT_DUNES, landmark_shape_t::DUNES, false, 1, 5 },
		{ "Sunny Mesa", tile::LANDMARK_SUNNY_MESA, landmark_shape_t::MESA, false, 1, 5 },
		{ "Nessus Canyon", tile::LANDMARK_NESSUS_CANYON, landmark_shape_t::CANYON, false, 1, 5 },
		{ "Pholus Ridge", tile::LANDMARK_PHOLUS_RIDGE, landmark_shape_t::RIDGE, false, 1, 5 },
		{ "Borehole Cluster", tile::LANDMARK_BOREHOLE_CLUSTER, landmark_shape_t::BOREHOLE_CLUSTER, false, 1, 9 },
		{ "Manifold Nexus", tile::LANDMARK_MANIFOLD_NEXUS, landmark_shape_t::MANIFOLD_NEXUS, false, 1, 9 },
	};
	if ( landmark_limit == specs.size() ) {
		const auto needs_full_cluster = []( const landmark_spec_t& spec ) {
			return
				spec.shape == landmark_shape_t::VOLCANO ||
				spec.shape == landmark_shape_t::RUINS ||
				spec.shape == landmark_shape_t::BOREHOLE_CLUSTER ||
				spec.shape == landmark_shape_t::MANIFOLD_NEXUS;
		};
		std::stable_partition( specs.begin(), specs.end(), needs_full_cluster );
	}
	const auto candidates = GetTilesInRandomOrder( tiles, MT_C );
	MT_RETIF();
	std::vector< tile::Tile* > centers = {};

	for ( const auto& spec : specs ) {
		if ( centers.size() >= landmark_limit ) {
			break;
		}
		tile::Tile* best = nullptr;
		std::vector< tile::Tile* > best_tiles = {};
		int64_t best_score = std::numeric_limits< int64_t >::min();
		bool is_compact_fallback = false;
		for ( auto* const candidate : candidates ) {
			if ( candidate->is_water_tile != spec.is_water || candidate->landmarks != tile::LANDMARK_NONE ) {
				continue;
			}
			if (
				tiles->GetHeight() > spec.radius * 2 + 2 &&
				(
					candidate->coord.y <= spec.radius ||
					candidate->coord.y + spec.radius + 1 >= tiles->GetHeight()
				)
			) {
				continue;
			}
			bool too_close = false;
			for ( const auto* const center : centers ) {
				if ( GetTileDistance( candidate, center, tiles->GetWidth() ) < minimum_center_distance ) {
					too_close = true;
					break;
				}
			}
			if ( too_close ) {
				continue;
			}
			const auto cluster = GetLandmarkTiles( candidate, spec.radius, spec.is_water );
			if ( cluster.size() < spec.minimum_tiles ) {
				continue;
			}
			if ( std::any_of( cluster.begin(), cluster.end(), []( const auto* const cluster_tile ) {
				return cluster_tile->landmarks != tile::LANDMARK_NONE;
			} ) ) {
				continue;
			}
			const auto score = GetLandmarkScore( spec, candidate, tiles->GetHeight(), cluster.size() );
			if ( !best || score > best_score ) {
				best = candidate;
				best_tiles = cluster;
				best_score = score;
			}
			MT_RETIF();
		}
		if ( !best && map_tile_count < 400 ) {
			for ( auto* const candidate : candidates ) {
				if ( candidate->is_water_tile != spec.is_water || candidate->landmarks != tile::LANDMARK_NONE ) {
					continue;
				}
				bool too_close = false;
				for ( const auto* const center : centers ) {
					if ( GetTileDistance( candidate, center, tiles->GetWidth() ) < minimum_center_distance ) {
						too_close = true;
						break;
					}
				}
				if ( too_close ) {
					continue;
				}
				const auto score = GetLandmarkScore( spec, candidate, tiles->GetHeight(), 1 );
				if ( !best || score > best_score ) {
					best = candidate;
					best_tiles = { candidate };
					best_score = score;
					is_compact_fallback = true;
				}
				MT_RETIF();
			}
		}
		if ( !best ) {
			Log( "Skipping " + std::string( spec.name ) + ": no suitable separated terrain" );
			continue;
		}
		ApplyLandmark( spec, best, best_tiles );
		centers.push_back( best );
		Log(
			"Generated " + std::string( spec.name ) + " around [ " +
			std::to_string( best->coord.x ) + " " + std::to_string( best->coord.y ) +
			" ] using " + std::to_string( best_tiles.size() ) + " " +
			( spec.is_water ? "water" : "land" ) + " tiles" +
			( is_compact_fallback ? " (compact-map fallback)" : "" )
		);
		MT_RETIF();
	}
	Log( "Generated " + std::to_string( centers.size() ) + " natural landmarks" );
}

void SimplePerlin::GenerateRiver( tile::Tiles* tiles, tile::Tile* tile, uint8_t length, uint8_t direction, int8_t direction_diagonal, MT_CANCELABLE ) {

	if ( tile->features & tile::FEATURE_RIVER ) {
		// joined existing river
		return;
	}
	if ( tile->is_water_tile ) {
		// reached water
		return;
	}

	MT_RETIF();

	tile->features |= tile::FEATURE_RIVER;

	length--;
	if ( length > 0 ) {

		if ( m_random->IsLucky( RIVER_DIRECTION_CHANGE_CHANCE_DIFFICULTY ) ) {
			if ( m_random->IsLucky() ) {
				if ( direction < tile->neighbours.size() - 1 ) {
					direction++;
				}
				else {
					direction = 0;
				}
			}
			else {
				if ( direction > 0 ) {
					direction--;
				}
				else {
					direction = tile->neighbours.size() - 1;
				}
			}
		}

		int8_t real_direction;
		if ( direction % 2 ) {
			real_direction = direction;
		}
		else {
			real_direction = (int8_t)direction + direction_diagonal;
			if ( real_direction < 0 ) {
				real_direction = tile->neighbours.size() - 1;
			}
			else if ( real_direction > tile->neighbours.size() - 1 ) {
				real_direction = 0;
			}
			direction_diagonal *= -1;
		}
		auto* selected_tile = tile->neighbours.at( real_direction );
		if ( !HasRiversNearby( tile, selected_tile ) || m_random->IsLucky( RIVER_JOIN_CHANCE_DIFFICULTY ) ) {
			GenerateRiver( tiles, selected_tile, length, real_direction, direction_diagonal, MT_C );
		}

		MT_RETIF();

		while ( m_random->IsLucky( RIVER_SPLIT_CHANCE_DIFFICULTY ) ) {
			// split at 90 degrees angle
			uint8_t child_direction = direction;
			if ( m_random->IsLucky() ) { // clockwise
				if ( child_direction < tile->neighbours.size() - 2 ) {
					child_direction += 2;
				}
				else {
					child_direction = child_direction + 2 - tile->neighbours.size();
				}
			}
			else { // counter-clockwise
				if ( child_direction >= 2 ) {
					child_direction -= 2;
				}
				else {
					child_direction = tile->neighbours.size() - child_direction - 1;
				}
			}

			selected_tile = tile->neighbours.at( child_direction );
			if ( !HasRiversNearby( tile, selected_tile ) || m_random->IsLucky( RIVER_JOIN_CHANCE_DIFFICULTY ) ) {
				GenerateRiver( tiles, selected_tile, length, child_direction, direction_diagonal * -1, MT_C );
			}

			MT_RETIF();
		}
	}
}

bool SimplePerlin::HasRiversNearby( tile::Tile* current_tile, tile::Tile* tile ) {
	for ( auto& t : tile->neighbours ) {
		if ( t != current_tile && t->features & tile::FEATURE_RIVER ) {
			return true;
		}
	}
	return false;
}

}
}
}
}
