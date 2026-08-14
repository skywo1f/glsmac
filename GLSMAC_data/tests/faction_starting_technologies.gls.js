const factions = #include('../default/factions');

let configured = {};
let configured_count = 0;
const fm = {
	add: (id, data) => {
		configured[id] = data;
		configured_count++;
	},
	import_colors: (file) => { return file; },
	import_base_names: (file) => { return [file]; },
};

factions.configure(fm);

test.assert(configured_count == 8);
test.assert(configured.GAIANS.starting_technologies == ['CentauriEcology']);
test.assert(configured.HIVE.starting_technologies == ['DoctrineLoyalty']);
test.assert(configured.UNIVERSITY.starting_technologies == ['InformationNetworks']);
test.assert(configured.MORGANITES.starting_technologies == ['IndustrialBase']);
test.assert(configured.SPARTANS.starting_technologies == ['DoctrineMobility']);
test.assert(configured.BELIEVERS.starting_technologies == ['SocialPsych']);
test.assert(configured.PEACEKEEPERS.starting_technologies == ['Biogenetics']);
test.assert(configured.PLANET.is_native);
test.assert(configured.PLANET.starting_technologies == []);
