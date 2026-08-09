const popup = #include('../default/ui/parts/game/popup/probe_operations');
const preview = #include('../default/ui/parts/game/bottom_bar/object_preview');

test.assert(#typeof(popup.init) == 'Callable');
test.assert(#typeof(popup.set) == 'Callable');
test.assert(#typeof(preview.init) == 'Callable');
