#include "UnitDef.h"

#include "game/backend/unit/StaticDef.h"
#include "game/backend/unit/CVRRender.h"
#include "game/backend/unit/SpriteRender.h"
#include "engine/Engine.h"
#include "loader/texture/TextureLoader.h"
#include "types/texture/Texture.h"
#include "util/LogHelper.h"
#include "util/String.h"
#include "game/frontend/sprite/InstancedSprite.h"
#include "game/frontend/sprite/InstancedSpriteManager.h"
#include "game/backend/map/Consts.h"
#include "CVRRenderer.h"

namespace game {
namespace frontend {
namespace unit {

UnitDef::UnitDef( sprite::InstancedSpriteManager* ism, const backend::unit::Def* unitdef )
	: m_ism( ism )
	, m_id( unitdef->m_id )
	, m_name( unitdef->m_name )
	, m_type( unitdef->m_type )
	, m_offense( unitdef->m_offense )
	, m_defense( unitdef->m_defense ) {

	switch ( unitdef->m_type ) {
		case backend::unit::DT_STATIC: {
			const auto* def = (backend::unit::StaticDef*)unitdef;
			m_is_artillery = def->IsArtillery();
			m_is_planet_buster = def->m_is_missile && def->m_weapon_id == "PlanetBuster";
			m_has_deep_radar = def->HasAbility( "DeepRadar" );
			m_is_concealed =
				def->HasAbility( "CloakingDevice" ) ||
				def->HasAbility( "DeepPressureHull" );
			m_can_hide_in_fungus =
				def->GetMovementType() == backend::unit::MT_LAND ||
				def->GetMovementType() == backend::unit::MT_WATER;

			switch ( def->m_render->m_type ) {

				case backend::unit::Render::RT_SPRITE: {
					m_render = ( (backend::unit::SpriteRender*)def->m_render )->m_render;

					static_.movement_type = def->m_movement_type;
					static_.movement_per_turn = def->m_movement_per_turn;
					static_.render.is_sprite = true;

					break;
				}
				case backend::unit::Render::RT_CVR: {
					const auto* render = (backend::unit::CVRRender*)def->m_render;
					m_cvr_files = render->m_files;
					m_cvr_fallback = render->m_fallback;
					m_is_cvr = true;
					m_render = {
						"",
						0,
						0,
						render->m_w,
						render->m_h,
						render->m_cx,
						render->m_cy,
						0,
					};

					static_.movement_type = def->m_movement_type;
					static_.movement_per_turn = def->m_movement_per_turn;
					static_.render.is_sprite = true;

					break;
				}
				default:
					THROW( "unknown unit render type: " + std::to_string( def->m_render->m_type ) );
			}
			break;
		}
		default:
			THROW( "unknown unit def type: " + std::to_string( unitdef->m_type ) );
	}
}

UnitDef::~UnitDef() {
	if ( m_type == backend::unit::DT_STATIC ) {
		if ( m_render.morale_based_xshift ) {
			if ( static_.render.morale_based_sprites ) {
				DELETE( static_.render.morale_based_sprites );
			}
		}
		if ( m_owns_texture && static_.render.texture ) {
			if ( static_.render.sprite.instanced_sprite ) {
				m_ism->RemoveInstancedSpriteByKey( static_.render.sprite.instanced_sprite->key );
				static_.render.sprite.instanced_sprite = nullptr;
			}
			DELETE( static_.render.texture );
		}
	}
}

const bool UnitDef::IsArtillery() const {
	return m_is_artillery;
}

const bool UnitDef::IsPlanetBuster() const {
	return m_is_planet_buster;
}

const bool UnitDef::HasDeepRadar() const {
	return m_has_deep_radar;
}

const bool UnitDef::IsConcealed() const {
	return m_is_concealed;
}

const bool UnitDef::CanHideInFungus() const {
	return m_can_hide_in_fungus;
}

sprite::Sprite* UnitDef::GetSprite( const backend::unit::morale_t morale ) {
	ASSERT( m_type == backend::unit::DT_STATIC, "only static units are supported for now" );
	ASSERT( static_.render.is_sprite, "only sprite unitdefs are supported for now" );
	auto* texture = GetSpriteTexture();

	if ( m_render.morale_based_xshift ) {
		if ( !static_.render.morale_based_sprites ) {
			NEW( static_.render.morale_based_sprites, morale_based_sprites_t );
		}
		auto it = static_.render.morale_based_sprites->find( morale );
		if ( it == static_.render.morale_based_sprites->end() ) {
			const uint32_t xshift = m_render.morale_based_xshift * ( morale - backend::unit::MORALE_MIN );
			it = static_.render.morale_based_sprites->insert(
				{
					morale,
					{
						m_ism->GetInstancedSprite(
							"Unit_" + m_id + "_" + std::to_string( morale ), texture, {
								m_render.x + xshift,
								m_render.y,
							},
							{
								m_render.w,
								m_render.h,
							},
							{
								m_render.cx + xshift,
								m_render.cy,
							},
							{
								backend::map::s_consts.tile.scale.x,
								backend::map::s_consts.tile.scale.y * backend::map::s_consts.sprite.y_scale
							},
							ZL_UNITS
						),
					}
				}
			).first;
		}
		return &it->second;
	}
	else {
		if ( !static_.render.sprite.instanced_sprite ) {
			static_.render.sprite = {
				m_ism->GetInstancedSprite(
					"Unit_" + m_id, texture, {
						m_render.x,
						m_render.y,
					},
					{
						m_render.w,
						m_render.h,
					},
					{
						m_render.cx,
						m_render.cy,
					},
					{
						backend::map::s_consts.tile.scale.x,
						backend::map::s_consts.tile.scale.y * backend::map::s_consts.sprite.y_scale
					},
					ZL_UNITS
				),
				1
			};
		}
		return &static_.render.sprite;
	}
}

const bool UnitDef::IsImmovable() const {
	return static_.movement_type == backend::unit::MT_IMMOVABLE;
}

const std::string UnitDef::GetNameString() const {
	return m_name;
}

const std::string UnitDef::GetStatsString() const {
	std::string offense = std::to_string( m_offense );
	if ( m_is_artillery ) {
		offense = "(" + offense + ")";
	}
	return offense + " - " + std::to_string( m_defense ) + " - " + util::String::ApproximateFloat( static_.movement_per_turn );

}

types::texture::Texture* UnitDef::GetSpriteTexture() {
	if ( !static_.render.texture ) {
		if ( m_is_cvr ) {
			try {
				static_.render.texture = CVRRenderer::Render( m_cvr_files, m_render.w, m_render.h );
				m_owns_texture = true;
			}
			catch ( const std::exception& error ) {
				g_engine->Log( "CVR render failed for unit '" + m_id + "': " + error.what() );
				util::LogHelper::Println( "CVR_RENDER_FALLBACK: unit=" + m_id + " error=" + error.what() );
				m_is_cvr = false;
				m_render = m_cvr_fallback;
			}
		}
		if ( !static_.render.texture ) {
			static_.render.texture = g_engine->GetTextureLoader()->LoadCustomTexture(
				m_render.file,
				types::texture::TF_MIPMAPS
			);
		}
	}
	return static_.render.texture;
}

}
}
}
