#include "CVRRenderer.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
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
static constexpr float TRANSLATION_TO_VOXELS = 0.5f;

struct color_t {
	uint8_t red;
	uint8_t green;
	uint8_t blue;
};

struct voxel_t {
	float x;
	float y;
	float z;
	color_t color;
};

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
	return
		(uint32_t)data[ pos ] |
		(uint32_t)data[ pos + 1 ] << 8 |
		(uint32_t)data[ pos + 2 ] << 16 |
		(uint32_t)data[ pos + 3 ] << 24;
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

static void RequireMarker(
	const std::vector< unsigned char >& data,
	const size_t pos,
	const std::array< uint8_t, 4 >& marker,
	const std::string& name
) {
	RequireBytes( data, pos, marker.size() );
	Require(
		data[ pos ] == marker[ 0 ] && data[ pos + 1 ] == marker[ 1 ] &&
		data[ pos + 2 ] == marker[ 2 ] && data[ pos + 3 ] == marker[ 3 ],
		name + " marker mismatch"
	);
}

static size_t FindAfter(
	const std::vector< unsigned char >& data,
	const size_t start,
	const std::array< uint8_t, 4 >& marker
) {
	if ( start > data.size() || data.size() < marker.size() ) {
		THROW( "Invalid CVR: marker search outside file" );
	}
	for ( size_t pos = start ; pos <= data.size() - marker.size() ; pos++ ) {
		if (
			data[ pos ] == marker[ 0 ] && data[ pos + 1 ] == marker[ 1 ] &&
			data[ pos + 2 ] == marker[ 2 ] && data[ pos + 3 ] == marker[ 3 ]
		) {
			return pos + marker.size();
		}
	}
	THROW( "Invalid CVR: required marker not found" );
}

static std::array< color_t, 256 > ParsePalette(
	const std::vector< unsigned char >& data,
	const size_t start
) {
	std::array< color_t, 256 > palette = {};
	for ( size_t i = 0 ; i < palette.size() ; i++ ) {
		const auto value = (uint8_t)( 48 + i % 5 * 24 );
		palette[ i ] = { value, value, value };
	}

	const auto palette_marker = FindAfter( data, start, { 0x00, 0x00, 0x01, 0x01 } );
	RequireBytes( data, palette_marker, 4 );
	Require( data[ palette_marker ] >= 8, "invalid palette name length" );
	const size_t palette_name_length = data[ palette_marker ] - 8;
	size_t pos = palette_marker + 4;
	RequireBytes( data, pos, palette_name_length + 16 );
	pos += palette_name_length + 16;

	RequireBytes( data, pos, 1 );
	const size_t first_block_count = data[ pos - 1 ];
	Require( first_block_count <= ( data.size() - pos - 1 ) / 3, "invalid palette block" );
	pos += 1 + first_block_count * 3;
	Require( pos > 0, "invalid palette offset" );
	const size_t palette_offset = data[ pos - 1 ];
	Require( palette_offset <= 245, "invalid palette offset" );
	const size_t color_count = 245 - palette_offset;
	RequireBytes( data, pos, color_count * 3 );
	for ( size_t i = 0 ; i < color_count ; i++ ) {
		palette[ i ] = {
			data[ pos + i * 3 ],
			data[ pos + i * 3 + 1 ],
			data[ pos + i * 3 + 2 ],
		};
	}

	palette[ 245 ] = { 81, 150, 80 };
	palette[ 246 ] = { 38, 91, 49 };
	palette[ 247 ] = { 142, 196, 116 };
	palette[ 248 ] = { 23, 53, 32 };
	return palette;
}

static void ParseFile( const std::string& path, std::vector< voxel_t >& voxels ) {
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

	for ( size_t part = 0 ; part < part_count ; part++ ) {
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
			data[ pos + 28 ] == 0 && data[ pos + 29 ] == 0 &&
			data[ pos + 30 ] == 0 && data[ pos + 31 ] == 0;

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
					"invalid multimesh voxel count in part " + std::to_string( part ) +
					" (section=" + std::to_string( section_voxels ) +
					", consumed=" + std::to_string( consumed ) +
					", total=" + std::to_string( total_voxels ) + ")"
				);
				x = (float)( x1 + x2 );
				y = (float)( y1 + y2 );
				z = (float)( z1 + z2 );
			}

			RequireBytes( data, pos, section_voxels * 3 );
			for ( size_t i = 0 ; i < section_voxels ; i++ ) {
				const uint8_t direction = data[ pos ] >> 3;
				if ( direction < DIRECTIONS.size() ) {
					x += DIRECTIONS[ direction ][ 0 ];
					y += DIRECTIONS[ direction ][ 1 ];
					z += DIRECTIONS[ direction ][ 2 ];
					voxels.push_back( { x, y, z, palette[ data[ pos + 2 ] ] } );
				}
				else {
					Require( direction == 26, "unknown voxel direction" );
				}
				pos += 3;
			}
			consumed += section_voxels;
			Require(
				consumed <= total_voxels + mesh_count,
				"multimesh contains more than one terminal record per section"
			);
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
		for ( size_t i = 0 ; i < matrix.size() ; i++ ) {
			matrix[ i ] = ReadF32( data, matrix_pos + 8 + i * 4 );
		}
		Require( matrix_pos + matrix_length == transform_end, "transform block length mismatch" );
		pos = transform_end;

		if ( !is_visible ) {
			voxels.resize( first_part_voxel );
			continue;
		}
		for ( size_t i = first_part_voxel ; i < voxels.size() ; i++ ) {
			auto& voxel = voxels[ i ];
			// Caviar stores vectors in z/x/y order and translations in half-voxel units.
			const std::array< float, 3 > source = { voxel.z, voxel.x, voxel.y };
			std::array< float, 3 > transformed = {};
			for ( size_t row = 0 ; row < transformed.size() ; row++ ) {
				transformed[ row ] = translation[ row ] * TRANSLATION_TO_VOXELS;
				for ( size_t column = 0 ; column < source.size() ; column++ ) {
					transformed[ row ] += matrix[ row * 3 + column ] * source[ column ];
				}
			}
			voxel.x = transformed[ 1 ];
			voxel.y = transformed[ 2 ];
			voxel.z = transformed[ 0 ];
		}
	}
}

}

types::texture::Texture* CVRRenderer::Render(
	const std::vector< std::string >& files,
	const size_t width,
	const size_t height
) {
	Require( !files.empty(), "no component files" );
	Require( width >= 8 && height >= 8, "output is too small" );

	std::vector< voxel_t > voxels;
	for ( const auto& file : files ) {
		ParseFile( g_engine->GetResourceManager()->GetCustomPath( file ), voxels );
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
		}
	);

	static constexpr size_t PADDING = 3;
	const float usable_width = (float)( width - PADDING * 2 );
	const float usable_height = (float)( height - PADDING * 2 );
	const float scale = std::min(
		usable_width / std::max( max_x - min_x, 1.0f ),
		usable_height / std::max( max_y - min_y, 1.0f )
	);
	const size_t point_size = std::max< size_t >( 1, std::min< size_t >( 3, (size_t)std::ceil( scale ) ) );
	auto* texture = new types::texture::Texture( "CVR", width, height, types::texture::TF_MIPMAPS );
	for ( const auto& voxel : projected ) {
		const size_t px = PADDING + (size_t)std::round( ( voxel.x - min_x ) * scale );
		const size_t py = PADDING + (size_t)std::round( ( voxel.y - min_y ) * scale );
		const auto color = types::Color::RGBA(
			voxel.color.red,
			voxel.color.green,
			voxel.color.blue,
			255
		);
		for ( size_t y = py ; y < std::min( height, py + point_size ) ; y++ ) {
			for ( size_t x = px ; x < std::min( width, px + point_size ) ; x++ ) {
				texture->SetPixel( x, y, color );
			}
		}
	}
	texture->FullUpdate();
	g_engine->Log(
		"Rendered " + std::to_string( voxels.size() ) + " CVR voxels from " +
		std::to_string( files.size() ) + " component file(s)"
	);
	return texture;
}

}
}
}
