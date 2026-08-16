return (i) => {
	i.popup.show({
		title: 'Credits',
		width: 560,
		height: 360,
		generator: (body) => {
			body.text({
				class: 'popup-text',
				text: 'GLSMAC',
				align: 'top center',
				top: 8,
			});
			body.text({
				class: 'popup-text',
				text: 'Open-source reimplementation created by afwbkbc',
				align: 'top center',
				top: 38,
			});
			body.text({
				class: 'popup-text',
				text: 'Classic preview development by skywo1f',
				align: 'top center',
				top: 62,
			});
			body.text({
				class: 'popup-text',
				text: 'Contributors',
				align: 'top center',
				top: 100,
			});
			body.text({
				class: 'popup-text',
				text: 'coderguy57, Oleksandr Kalko, MetaBarj0, Voker57',
				align: 'top center',
				top: 126,
			});
			body.text({
				class: 'popup-text',
				text: 'Markus Hartung, Sergey Alirzaev, e-rook',
				align: 'top center',
				top: 150,
			});
			body.text({
				class: 'popup-text',
				text: 'Haelwenn Monnier',
				align: 'top center',
				top: 174,
			});
			body.text({
				class: 'popup-text',
				text: 'Licensed under the GNU Affero General Public License v3',
				align: 'top center',
				top: 206,
			});
			body.text({
				class: 'popup-text',
				text: 'Sid Meier\'s Alpha Centauri was created by Firaxis Games',
				align: 'top center',
				top: 242,
			});
			body.text({
				class: 'popup-text',
				text: 'Original game assets are not distributed with GLSMAC',
				align: 'top center',
				top: 270,
			});
			body.text({
				class: 'popup-text',
				text: 'They remain the property of their respective owners',
				align: 'top center',
				top: 294,
			});
		},
		buttons: [
			{
				style: {
					text: 'OK',
					align: 'center',
					is_ok: true,
					is_cancel: true,
				},
				onclick: (e) => {
					i.popup.back();
					return true;
				},
			},
		],
	});
};
