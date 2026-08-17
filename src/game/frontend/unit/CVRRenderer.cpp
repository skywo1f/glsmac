#include "CVRRenderer.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <limits>

#include "engine/Engine.h"
#include "resource/ResourceManager.h"
#include "types/Color.h"
#include "types/texture/Texture.h"
#include "util/FS.h"
#include "util/LogHelper.h"

namespace game {
namespace frontend {
namespace unit {

namespace {

static constexpr size_t MAX_PARTS = 2048;
static constexpr size_t MAX_VOXELS = 4000000;
static constexpr size_t MAX_FRAMES = 65536;
static constexpr size_t SHADE_LEVEL_COUNT = 24;
static constexpr float TRANSLATION_TO_VOXELS = 0.25f;
static constexpr uint8_t VEHICLE_COLOR_INDEX = 246;
static constexpr float VEHICLE_NEUTRAL_LUMINANCE = 237.0f;

#if defined( GLSMAC_TESTING )
static void AppendU16( std::string& data, const uint16_t value ) {
	data.push_back( (char)( value & 0xff ) );
	data.push_back( (char)( value >> 8 ) );
}

static void AppendU32( std::string& data, const uint32_t value ) {
	data.push_back( (char)( value & 0xff ) );
	data.push_back( (char)( value >> 8 & 0xff ) );
	data.push_back( (char)( value >> 16 & 0xff ) );
	data.push_back( (char)( value >> 24 ) );
}

static void DumpTextureForTesting( const types::texture::Texture* texture ) {
	static bool dumped = false;
	const auto* path = std::getenv( "GLSMAC_CVR_DUMP" );
	if ( dumped || !path || !*path ) {
		return;
	}
	dumped = true;

	const auto width = texture->GetWidth();
	const auto height = texture->GetHeight();
	const auto pixel_bytes = width * height * 4;
	if (
		width > std::numeric_limits< uint32_t >::max() || height > std::numeric_limits< uint32_t >::max() || pixel_bytes > std::numeric_limits< uint32_t >::max() - 54 ) {
		THROW( "Invalid CVR: test texture dump is too large" );
	}

	std::string bitmap;
	bitmap.reserve( 54 + pixel_bytes );
	bitmap += "BM";
	AppendU32( bitmap, (uint32_t)( 54 + pixel_bytes ) );
	AppendU32( bitmap, 0 );
	AppendU32( bitmap, 54 );
	AppendU32( bitmap, 40 );
	AppendU32( bitmap, (uint32_t)width );
	AppendU32( bitmap, (uint32_t)height );
	AppendU16( bitmap, 1 );
	AppendU16( bitmap, 32 );
	AppendU32( bitmap, 0 );
	AppendU32( bitmap, (uint32_t)pixel_bytes );
	AppendU32( bitmap, 2835 );
	AppendU32( bitmap, 2835 );
	AppendU32( bitmap, 0 );
	AppendU32( bitmap, 0 );
	for ( size_t y = height; y-- > 0; ) {
		for ( size_t x = 0; x < width; x++ ) {
			const auto rgba = texture->GetPixel( x, y );
			const auto alpha = (uint8_t)( rgba >> 24 );
			if ( alpha == 0 ) {
				const uint8_t background = ( ( x / 5 + y / 5 ) & 1 ) ? 24 : 12;
				bitmap.push_back( (char)background );
				bitmap.push_back( (char)background );
				bitmap.push_back( (char)background );
			}
			else {
				bitmap.push_back( (char)( rgba >> 16 & 0xff ) );
				bitmap.push_back( (char)( rgba >> 8 & 0xff ) );
				bitmap.push_back( (char)( rgba & 0xff ) );
			}
			bitmap.push_back( (char)255 );
		}
	}
	util::FS::WriteFile( path, bitmap );
	util::LogHelper::Println( "CVR_TEXTURE_DUMP: " + std::string( path ) );
}
#endif

struct color_t {
	uint8_t red;
	uint8_t green;
	uint8_t blue;
};

struct voxel_t {
	float x;
	float y;
	float z;
	float normal_x;
	float normal_y;
	float normal_z;
	uint8_t color_index;
	color_t color;
};

using shade_palette_t = std::array< std::array< color_t, 256 >, SHADE_LEVEL_COUNT >;

struct projected_voxel_t {
	float x;
	float y;
	float depth;
	color_t color;
};

static const std::array< std::array< int8_t, 3 >, 26 > DIRECTIONS = {
	std::array< int8_t, 3 >{ -1, -1, -1 },
	{ -1, 0, -1 },
	{ -1, 1, -1 },
	{ 0, -1, -1 },
	{ 0, 0, -1 },
	{ 0, 1, -1 },
	{ 1, -1, -1 },
	{ 1, 0, -1 },
	{ 1, 1, -1 },
	{ -1, -1, 0 },
	{ -1, 0, 0 },
	{ -1, 1, 0 },
	{ 0, -1, 0 },
	{ 0, 1, 0 },
	{ 1, -1, 0 },
	{ 1, 0, 0 },
	{ 1, 1, 0 },
	{ -1, -1, 1 },
	{ -1, 0, 1 },
	{ -1, 1, 1 },
	{ 0, -1, 1 },
	{ 0, 0, 1 },
	{ 0, 1, 1 },
	{ 1, -1, 1 },
	{ 1, 0, 1 },
	{ 1, 1, 1 },
};

static void Require( const bool condition, const std::string& message ) {
	if ( !condition ) {
		THROW( "Invalid CVR: " + message );
	}
}

static void RequireBytes( const std::vector< unsigned char >& data, const size_t pos, const size_t count ) {
	Require( pos <= data.size() && count <= data.size() - pos, "unexpected end of file" );
}

static uint32_t ReadU32( const std::vector< unsigned char >& data, const size_t pos ) {
	RequireBytes( data, pos, 4 );
	return (uint32_t)data[ pos ] | (uint32_t)data[ pos + 1 ] << 8 | (uint32_t)data[ pos + 2 ] << 16 | (uint32_t)data[ pos + 3 ] << 24;
}

static int16_t ReadI16( const std::vector< unsigned char >& data, const size_t pos ) {
	RequireBytes( data, pos, 2 );
	return (int16_t)( (uint16_t)data[ pos ] | (uint16_t)data[ pos + 1 ] << 8 );
}

static float ReadF32( const std::vector< unsigned char >& data, const size_t pos ) {
	const uint32_t bits = ReadU32( data, pos );
	float value = 0.0f;
	static_assert( sizeof( value ) == sizeof( bits ), "unexpected float size" );
	std::memcpy( &value, &bits, sizeof( value ) );
	Require( std::isfinite( value ), "non-finite transform value" );
	return value;
}

static std::array< float, 3 > DecodeNormal( const uint8_t direction, const uint8_t normal ) {
	const uint32_t packed = ( (uint32_t)( direction & 7 ) << 8 | normal ) + 88;
	const uint32_t angle_1 = 88 - packed % 89;
	const uint32_t angle_2 = packed / 89;
	Require( angle_2 <= 23, "voxel normal is out of range" );
	static constexpr float PI = 3.14159265358979323846f;
	const float radians_1 = (float)angle_1 / 88.0f * 2.0f * PI;
	const float radians_2 = (float)angle_2 / 23.0f * PI * 0.5f;
	const float horizontal = std::sin( radians_2 );
	return {
		std::cos( radians_1 ) * horizontal,
		std::cos( radians_2 ),
		std::sin( radians_1 ) * horizontal,
	};
}

static size_t GetShadeLevel( const float x, const float y, const float z ) {
#if defined( GLSMAC_TESTING )
	static const long forced_level = []() {
		if ( const auto* value = std::getenv( "GLSMAC_CVR_LIGHT" ) ) {
			const auto parsed = std::strtol( value, nullptr, 10 );
			if ( parsed >= 0 && parsed < (long)SHADE_LEVEL_COUNT ) {
				return parsed;
			}
		}
		return -1L;
	}();
	if ( forced_level >= 0 ) {
		return (size_t)forced_level;
	}
#endif
	// The map camera views models from the south-east and above. Keep a small
	// ambient floor so back-facing voxels remain legible at map-icon scale.
	static constexpr std::array< float, 3 > LIGHT = { 0.36f, 0.86f, 0.36f };
	const float dot = std::clamp( x * LIGHT[ 0 ] + y * LIGHT[ 1 ] + z * LIGHT[ 2 ], -1.0f, 1.0f );
	return (size_t)std::clamp( std::lround( 11.5f + dot * 9.5f ), 2L, 21L );
}

static color_t RecolorVehicle( const color_t& shaded, const types::Color& vehicle_color ) {
	const float luminance =
		shaded.red * 0.2126f +
		shaded.green * 0.7152f +
		shaded.blue * 0.0722f;
	const float shade = luminance / VEHICLE_NEUTRAL_LUMINANCE;
	const auto channel = [ shade ]( const float value ) {
		return (uint8_t)std::clamp( std::lround( value * 255.0f * shade ), 0L, 255L );
	};
	return {
		channel( vehicle_color.value.red ),
		channel( vehicle_color.value.green ),
		channel( vehicle_color.value.blue ),
	};
}

static void RequireMarker(
	const std::vector< unsigned char >& data,
	const size_t pos,
	const std::array< uint8_t, 4 >& marker,
	const std::string& name ) {
	RequireBytes( data, pos, marker.size() );
	Require(
		data[ pos ] == marker[ 0 ] && data[ pos + 1 ] == marker[ 1 ] && data[ pos + 2 ] == marker[ 2 ] && data[ pos + 3 ] == marker[ 3 ],
		name + " marker mismatch" );
}

static size_t FindAfter(
	const std::vector< unsigned char >& data,
	const size_t start,
	const std::array< uint8_t, 4 >& marker ) {
	if ( start > data.size() || data.size() < marker.size() ) {
		THROW( "Invalid CVR: marker search outside file" );
	}
	for ( size_t pos = start; pos <= data.size() - marker.size(); pos++ ) {
		if (
			data[ pos ] == marker[ 0 ] && data[ pos + 1 ] == marker[ 1 ] && data[ pos + 2 ] == marker[ 2 ] && data[ pos + 3 ] == marker[ 3 ] ) {
			return pos + marker.size();
		}
	}
	THROW( "Invalid CVR: required marker not found" );
}

static shade_palette_t ParsePalette(
	const std::vector< unsigned char >& data,
	const size_t start ) {
	const auto palette_chunk = FindAfter( data, start, { 0x00, 0x00, 0x02, 0x01 } );
	const size_t chunk_size = ReadU32( data, palette_chunk );
	static constexpr size_t HEADER_SIZE = 8;
	static constexpr size_t RANGE_SIZE = 2;
	static constexpr size_t PHYSICAL_PALETTE_SIZE = 256 * 3;
	static constexpr size_t SHADE_TABLE_SIZE = 24 * 256;
	Require(
		chunk_size >= HEADER_SIZE + RANGE_SIZE + PHYSICAL_PALETTE_SIZE + SHADE_TABLE_SIZE,
		"palette data chunk is too small" );
	RequireBytes( data, palette_chunk - 4, chunk_size );
	const size_t palette_start = palette_chunk + 4 + RANGE_SIZE;
	const size_t shade_table_start = palette_start + PHYSICAL_PALETTE_SIZE;
	shade_palette_t palette = {};
	for ( size_t shade = 0; shade < palette.size(); shade++ ) {
		for ( size_t color = 0; color < palette[ shade ].size(); color++ ) {
			const size_t physical_index = data[ shade_table_start + shade * 256 + color ];
			palette[ shade ][ color ] = {
				data[ palette_start + physical_index * 3 ],
				data[ palette_start + physical_index * 3 + 1 ],
				data[ palette_start + physical_index * 3 + 2 ],
			};
		}
	}
	return palette;
}

static void ParseFile(
	const std::string& path,
	std::vector< voxel_t >& voxels,
	const types::Color& vehicle_color ) {
	std::vector< unsigned char > data;
	util::FS::ReadFile( data, path );
	RequireBytes( data, 0, 8 );
	Require( data[ 0 ] == 'C' && data[ 1 ] == 'V' && data[ 2 ] == 'R', "bad signature in " + path );
	Require( ReadU32( data, 4 ) == data.size(), "file size mismatch in " + path );

	size_t pos = FindAfter( data, 0, { 0x00, 0x00, 0x00, 0x02 } );
	Require( ReadU32( data, pos ) >= 8, "invalid model name length" );
	const size_t model_name_length = ReadU32( data, pos ) - 8;
	pos += 4;
	RequireBytes( data, pos, model_name_length );
	pos += model_name_length;

	pos = FindAfter( data, pos, { 0x00, 0x00, 0x00, 0x03 } );
	const size_t model_data_pos = (size_t)ReadU32( data, pos ) + pos - 1;
	Require( model_data_pos < data.size(), "invalid model data offset" );
	const auto palette = ParsePalette( data, pos );

	pos = model_data_pos;
	Require( data[ pos ] == 0x04, "model data marker mismatch" );
	pos = FindAfter( data, pos, { 0x00, 0x00, 0x01, 0x04 } );
	Require( ReadU32( data, pos ) >= 8, "invalid internal model name length" );
	const size_t internal_name_length = ReadU32( data, pos ) - 8;
	pos += 4;
	RequireBytes( data, pos, internal_name_length );
	pos += internal_name_length;

	pos = FindAfter( data, pos, { 0x00, 0x02, 0x04, 0x0C } );
	const size_t part_count = ReadU32( data, pos + 3 );
	Require( part_count <= MAX_PARTS, "part count is too large" );
	pos = FindAfter( data, pos, { 0x00, 0x03, 0x04, 0x0C } );
	const size_t frame_count = ReadU32( data, pos + 3 );
	Require( frame_count > 0 && frame_count <= MAX_FRAMES, "invalid frame count" );

	for ( size_t part = 0; part < part_count; part++ ) {
		const size_t first_part_voxel = voxels.size();
		pos = FindAfter( data, pos, { 0x00, 0x01, 0x04, 0x04 } );
		RequireBytes( data, pos, 4 );
		Require( data[ pos ] >= 8, "invalid part name length" );
		const size_t part_name_length = data[ pos ] - 8;
		pos += 4;
		RequireBytes( data, pos, part_name_length );
		pos += part_name_length;

		pos = FindAfter( data, pos, { 0x01, 0x02, 0x04, 0x04 } );
		RequireBytes( data, pos, 46 );
		const int32_t z0 = ReadI16( data, pos + 30 );
		const int32_t x0 = ReadI16( data, pos + 32 );
		const int32_t y0 = ReadI16( data, pos + 34 );
		pos += 42;
		const size_t total_voxels = ReadU32( data, pos );
		Require( total_voxels <= MAX_VOXELS - voxels.size(), "voxel count is too large" );
		pos += 4;
		RequireBytes( data, pos, 32 );
		const bool is_multimesh =
			data[ pos + 28 ] == 0 && data[ pos + 29 ] == 0 && data[ pos + 30 ] == 0 && data[ pos + 31 ] == 0;

		size_t consumed = 0;
		size_t mesh_count = 0;
		float x = (float)x0;
		float y = (float)y0;
		float z = (float)z0;
		while ( consumed < total_voxels ) {
			mesh_count++;
			size_t section_voxels = total_voxels - consumed;
			if ( is_multimesh ) {
				RequireBytes( data, pos, 32 );
				const int32_t z1 = ReadI16( data, pos );
				const int32_t x1 = ReadI16( data, pos + 2 );
				const int32_t y1 = ReadI16( data, pos + 4 );
				pos += 18;
				const int32_t z2 = ReadI16( data, pos );
				const int32_t x2 = ReadI16( data, pos + 2 );
				const int32_t y2 = ReadI16( data, pos + 4 );
				pos += 6;
				section_voxels = ReadU32( data, pos );
				pos += 8;
				Require(
					section_voxels > 0 && section_voxels <= MAX_VOXELS - consumed,
					"invalid multimesh voxel count in part " + std::to_string( part ) + " (section=" + std::to_string( section_voxels ) + ", consumed=" + std::to_string( consumed ) + ", total=" + std::to_string( total_voxels ) + ")" );
				x = (float)( x1 + x2 );
				y = (float)( y1 + y2 );
				z = (float)( z1 + z2 );
			}

			RequireBytes( data, pos, section_voxels * 3 );
			for ( size_t i = 0; i < section_voxels; i++ ) {
				const uint8_t direction = data[ pos ] >> 3;
				if ( direction < DIRECTIONS.size() ) {
					const auto normal = DecodeNormal( data[ pos ], data[ pos + 1 ] );
					x += DIRECTIONS[ direction ][ 0 ];
					y += DIRECTIONS[ direction ][ 1 ];
					z += DIRECTIONS[ direction ][ 2 ];
					voxels.push_back( {
						x,
						y,
						z,
						normal[ 0 ],
						normal[ 1 ],
						normal[ 2 ],
						data[ pos + 2 ],
						{},
					} );
				}
				else {
					Require( direction == 26, "unknown voxel direction" );
				}
				pos += 3;
			}
			consumed += section_voxels;
			Require(
				consumed <= total_voxels + mesh_count,
				"multimesh contains more than one terminal record per section" );
		}

		const size_t transform_data_pos = FindAfter( data, pos, { 0x00, 0x03, 0x04, 0x04 } );
		const size_t transform_pos = transform_data_pos - 4;
		const size_t transform_length = ReadU32( data, transform_data_pos );
		Require( transform_length >= 8, "invalid transform block length" );
		RequireBytes( data, transform_pos, transform_length );
		const size_t transform_end = transform_pos + transform_length;

		const size_t visibility_pos = transform_pos + 8;
		RequireMarker( data, visibility_pos, { 0x01, 0x03, 0x04, 0x04 }, "visibility" );
		const size_t visibility_length = ReadU32( data, visibility_pos + 4 );
		Require( visibility_length == 8 + frame_count, "visibility frame count mismatch" );
		RequireBytes( data, visibility_pos, visibility_length );
		const bool is_visible = data[ visibility_pos + 8 ] == 0;

		const size_t translation_pos = visibility_pos + visibility_length;
		RequireMarker( data, translation_pos, { 0x02, 0x03, 0x04, 0x04 }, "translation" );
		const size_t translation_length = ReadU32( data, translation_pos + 4 );
		Require( translation_length == 8 + frame_count * 12, "translation frame count mismatch" );
		RequireBytes( data, translation_pos, translation_length );
		const std::array< float, 3 > translation = {
			ReadF32( data, translation_pos + 8 ),
			ReadF32( data, translation_pos + 12 ),
			ReadF32( data, translation_pos + 16 ),
		};

		const size_t matrix_pos = translation_pos + translation_length;
		RequireMarker( data, matrix_pos, { 0x03, 0x03, 0x04, 0x04 }, "matrix" );
		const size_t matrix_length = ReadU32( data, matrix_pos + 4 );
		Require( matrix_length == 8 + frame_count * 36, "matrix frame count mismatch" );
		RequireBytes( data, matrix_pos, matrix_length );
		std::array< float, 9 > matrix = {};
		for ( size_t i = 0; i < matrix.size(); i++ ) {
			matrix[ i ] = ReadF32( data, matrix_pos + 8 + i * 4 );
		}
		Require( matrix_pos + matrix_length == transform_end, "transform block length mismatch" );
		pos = transform_end;

		if ( !is_visible ) {
			voxels.resize( first_part_voxel );
			continue;
		}
		for ( size_t i = first_part_voxel; i < voxels.size(); i++ ) {
			auto& voxel = voxels[ i ];
			// Caviar stores vectors in z/x/y order and uses four transform units per voxel.
			const std::array< float, 3 > source = { voxel.z, voxel.x, voxel.y };
			const std::array< float, 3 > source_normal = {
				voxel.normal_z,
				voxel.normal_x,
				voxel.normal_y,
			};
			std::array< float, 3 > transformed = {};
			std::array< float, 3 > transformed_normal = {};
			for ( size_t row = 0; row < transformed.size(); row++ ) {
				transformed[ row ] = translation[ row ] * TRANSLATION_TO_VOXELS;
				for ( size_t column = 0; column < source.size(); column++ ) {
					transformed[ row ] += matrix[ row * 3 + column ] * source[ column ];
					transformed_normal[ row ] += matrix[ row * 3 + column ] * source_normal[ column ];
				}
			}
			voxel.x = transformed[ 1 ];
			voxel.y = transformed[ 2 ];
			voxel.z = transformed[ 0 ];
			const float normal_length = std::sqrt(
				transformed_normal[ 0 ] * transformed_normal[ 0 ] + transformed_normal[ 1 ] * transformed_normal[ 1 ] + transformed_normal[ 2 ] * transformed_normal[ 2 ] );
			Require( normal_length > 0.0f && std::isfinite( normal_length ), "invalid transformed voxel normal" );
			voxel.normal_x = transformed_normal[ 1 ] / normal_length;
			voxel.normal_y = transformed_normal[ 2 ] / normal_length;
			voxel.normal_z = transformed_normal[ 0 ] / normal_length;
			voxel.color = palette[ GetShadeLevel( voxel.normal_x, voxel.normal_y, voxel.normal_z ) ][ voxel.color_index ];
			if ( voxel.color_index == VEHICLE_COLOR_INDEX ) {
				voxel.color = RecolorVehicle( voxel.color, vehicle_color );
			}
		}
	}
}

}// namespace

types::texture::Texture* CVRRenderer::Render(
	const std::vector< std::string >& files,
	const size_t width,
	const size_t height,
	const types::Color& vehicle_color ) {
	Require( !files.empty(), "no component files" );
	Require( width >= 8 && height >= 8, "output is too small" );

	std::vector< voxel_t > voxels;
	for ( const auto& file : files ) {
		ParseFile( g_engine->GetResourceManager()->GetCustomPath( file ), voxels, vehicle_color );
	}
	Require( !voxels.empty(), "model contains no voxels" );

	std::vector< projected_voxel_t > projected;
	projected.reserve( voxels.size() );
	float min_x = std::numeric_limits< float >::max();
	float max_x = std::numeric_limits< float >::lowest();
	float min_y = std::numeric_limits< float >::max();
	float max_y = std::numeric_limits< float >::lowest();
	for ( const auto& voxel : voxels ) {
		const float x = (float)voxel.x - voxel.z;
		const float y = ( (float)voxel.x + voxel.z ) * 0.52f - voxel.y;
		projected.push_back( { x, y, voxel.x + voxel.y + voxel.z, voxel.color } );
		min_x = std::min( min_x, x );
		max_x = std::max( max_x, x );
		min_y = std::min( min_y, y );
		max_y = std::max( max_y, y );
	}
	std::sort(
		projected.begin(), projected.end(),
		[]( const projected_voxel_t& left, const projected_voxel_t& right ) {
			return left.depth < right.depth;
		} );

	static constexpr size_t PADDING = 3;
	const float usable_width = (float)( width - PADDING * 2 );
	const float usable_height = (float)( height - PADDING * 2 );
	const float scale = std::min(
		usable_width / std::max( max_x - min_x, 1.0f ),
		usable_height / std::max( max_y - min_y, 1.0f ) );
	const size_t point_size = std::max< size_t >( 1, std::min< size_t >( 3, (size_t)std::ceil( scale ) ) );
	auto* texture = new types::texture::Texture( "CVR", width, height, types::texture::TF_MIPMAPS );
	for ( const auto& voxel : projected ) {
		const size_t px = PADDING + (size_t)std::round( ( voxel.x - min_x ) * scale );
		const size_t py = PADDING + (size_t)std::round( ( voxel.y - min_y ) * scale );
		const auto color = types::Color::RGBA(
			voxel.color.red,
			voxel.color.green,
			voxel.color.blue,
			255 );
		for ( size_t y = py; y < std::min( height, py + point_size ); y++ ) {
			for ( size_t x = px; x < std::min( width, px + point_size ); x++ ) {
				texture->SetPixel( x, y, color );
			}
		}
	}
	texture->FullUpdate();
#if defined( GLSMAC_TESTING )
	DumpTextureForTesting( texture );
#endif
	g_engine->Log(
		"Rendered " + std::to_string( voxels.size() ) + " CVR voxels from " + std::to_string( files.size() ) + " component file(s)" );
	return texture;
}

}
}
}// namespace game::frontend::unit
