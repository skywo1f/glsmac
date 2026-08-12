const preview = #include('../default/ui/parts/game/bottom_bar/tile_preview');

test.assert(preview.get_terraforming_name('forest') == 'Forest');
test.assert(preview.get_terraforming_name('farm') == 'Farm');
test.assert(preview.get_terraforming_name('mine') == 'Mine');
test.assert(preview.get_terraforming_name('solar') == 'Solar Collector');
test.assert(preview.get_terraforming_name('road') == 'Road');
test.assert(!#is_defined(preview.get_terraforming_name('unknown')));

test.assert(preview.get_landmark_name('mount_planet') == 'Mount Planet');
test.assert(preview.get_landmark_name('freshwater_sea') == 'Freshwater Sea');
test.assert(preview.get_landmark_name('pholus_ridge') == 'Pholus Ridge');
test.assert(!#is_defined(preview.get_landmark_name('unknown')));

const legacy_land_tile = {
	is_water: false,
	landmarks: {
		mount_planet: false,
		sunny_mesa: false,
		garland_crater: false,
	},
};
test.assert(preview.get_feature_name(legacy_land_tile, 'volcano') == 'Mount Planet');
test.assert(preview.get_feature_name(legacy_land_tile, 'sunny_mesa') == 'Sunny Mesa');
test.assert(preview.get_feature_name(legacy_land_tile, 'garland_crater') == 'Garland Crater');
legacy_land_tile.landmarks.mount_planet = true;
test.assert(!#is_defined(preview.get_feature_name(legacy_land_tile, 'volcano')));
