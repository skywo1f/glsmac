const credits = #include('../default/ui/parts/mainmenu/steps/credits');

let popup_data = null;
let back_count = 0;
const popup = {
	show: (data) => { popup_data = data; },
	back: () => { back_count++; },
};

credits({popup: popup});
test.assert(popup_data.title == 'Credits');
test.assert(popup_data.width == 560);
test.assert(popup_data.height == 360);
test.assert(#sizeof(popup_data.buttons) == 1);

let text_entries = [];
popup_data.generator({
	text: (properties) => { text_entries :+properties; },
});
test.assert(#sizeof(text_entries) == 11);
test.assert(text_entries[0].text == 'GLSMAC');
test.assert(text_entries[1].text == 'Open-source reimplementation created by afwbkbc');
test.assert(text_entries[2].text == 'Classic preview development by skywo1f');
test.assert(text_entries[7].text == 'Licensed under the GNU Affero General Public License v3');
test.assert(text_entries[8].text == 'Sid Meier\'s Alpha Centauri was created by Firaxis Games');
test.assert(text_entries[9].text == 'Original game assets are not distributed with GLSMAC');

test.assert(popup_data.buttons[0].onclick({}));
test.assert(back_count == 1);

const main = #include('../default/ui/parts/mainmenu/steps/main');
let sliding_data = null;
let credits_count = 0;
let notimpl_count = 0;
main({
	glsmac: {deinit: () => {}},
	sliding: {show: (data) => { sliding_data = data; }},
	steps: {
		credits: (i) => { credits_count++; },
		notimpl: (i) => { notimpl_count++; },
	},
});
test.assert(sliding_data.entries[5][0] == 'View Credits');
sliding_data.entries[5][1]();
test.assert(credits_count == 1);
test.assert(notimpl_count == 0);
