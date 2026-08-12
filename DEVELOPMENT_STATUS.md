# GLSMAC Development Status

This file records the currently validated state of the in-progress original
Sid Meier's Alpha Centauri implementation. It is not a release announcement.

## Current Scope

- Original SMAC gameplay is the active compatibility target.
- Alien Crossfire gameplay and content are not currently part of this effort.
- Original game assets are still required at runtime.
- Original executable, save-game, map, and network compatibility are not
  promised.

## Validated Foundations

The Windows x64 Release build has automated coverage, including asset-backed
scenarios, for:

- game setup, turn progression, research, economy, base growth, worker
  assignment, production queues, support, and persistent social engineering;
- all 16 original social models, original-faction rating modifiers and immunity,
  technology gating, the complete difficulty-scaled upheaval cost table, atomic
  energy accounting, cost-aware human selection UI, and strategy-weighted AI
  selection that stages paid category changes to avoid multi-model surcharges;
- social-policy Secret Project effects, including Cloning Vats immunity to the
  Power and Thought Control penalties, Network Backbone immunity to the
  Cybernetic penalty, and all Planned, Simple/Green, and Free Market branches
  of the Longevity Vaccine;
- the Network Backbone adds its base's live commerce receipts and every Network
  Node on Planet to that base's research output;
- Voice of Planet unlocks the Ascent to Transcendence for every faction and
  grants bred native life +1 lifecycle;
- the Hunter-Seeker Algorithm blocks all enemy probe operations against the
  owner's bases and units, and AI Probe Teams avoid immune targets;
- the Empath Guild grants persistent bilateral contact and infiltration with
  every rival on completion or capture, preserves existing contact and
  intelligence through rollback, adds the exact +50% rounded-down Planetary
  Council vote bonus, and receives rival-aware AI production value;
- the Planetary Datalinks automatically grants every technology known by three
  other factions after research, trade, probe theft, project completion, or
  project capture, with deterministic multiplayer events and rival-aware AI
  valuation;
- the Pholus Mutagen adds one faction-wide ecological mitigator, gives
  conventional units the native +50% fungus attack benefit, and grants bred
  native life +1 lifecycle;
- the Xenoempathy Dome treats land fungus as roads for every owned unit,
  doubles fungus planting and removal rates with proper Former-ability
  stacking, and grants bred native life +1 lifecycle;
- the Universal Translator grants up to two free available technologies on
  completion, preserving existing research progress with deterministic
  rollback and explicit AI production value; Alien Artifacts can also be
  studied for free technologies once per Network Node or without limit at the
  Translator base, or consumed for 50 minerals toward a Secret Project or
  unprototyped unit, with player controls, AI routing, reversible events, and
  an asset-backed frontend/backend synchronization test;
- Psi Gates teleport units and attached transport cargo between two owned,
  available gate bases without spending movement, reserve both endpoints for
  the turn, preserve state across event rollback, and expose deterministic
  player and target-aware AI controls;
- persistent faction-wide chassis, weapon, and armor prototype history across
  saves and reconnects, with the exact first-production surcharge, Skunkworks
  and Spartan waivers, and the first prototype's morale bonus;
- a player-facing Unit Workshop creates deterministic, faction-owned designs
  from researched original-SMAC chassis, weapons, armor, reactors, and
  behavior-backed special abilities, including Deep Radar, Cloaking Device,
  and Deep Pressure Hull; the server recomputes legality and cost,
  production and upgrades enforce ownership, AI production can value its own
  custom designs, prototype rules apply normally, and definitions survive a
  running-game reconnect; faction-specific obsolescence is persistent and
  reversible, removes obsolete designs from owned production queues without
  losing stored minerals, and is enforced by production and upgrade rules;
  permanent retirement hides a design and prevents reactivation or recreation
  while preserving fielded units and old saves; player-authored bulk upgrades
  atomically convert every owned unit of a design at the original per-unit price
  while preserving movement, damage, morale, orders, home bases, embarked state,
  and transport cargo;
- generated Fission, Fusion, Quantum, and Singularity unit families use the
  original integer cost formula, reactor minimum-cost rows, durability scaling,
  sea-transport capacity scaling, and reactor-aware AI production, combat, and
  upgrade valuation; advanced reactor upgrades cannot be reversed into weaker
  reactors;
- generated land and sea Former families support original water terraforming:
  Kelp Farms, Mining Platforms, Tidal Harnesses, and sea fungus; Workshop
  designs, contextual player controls, terrain-aware AI production and routing,
  save serialization, and installed-asset runtime orders share the same rules;
- original-SMAC Supply Crawlers have generated land designs across available
  chassis and all four reactors, require no mineral support, convoy improved
  off-base tile yields or one resource between owned bases with post-multiplier
  accounting, cancel their orders on movement, and contribute their full
  mineral value to Secret Projects or prototypes; player controls, bounded AI
  production/routing, event rollback, save serialization, and running-game
  reconnect restoration are covered;
- individual unit upgrades preserve identity, morale, health, and home base,
  enforce original chassis/equipment/component rules, consume the unit's turn,
  use the original energy-cost formula, receive the Nano Factory discount, and
  expose player controls plus a reserve-aware AI policy;
- social ECONOMY, SUPPORT, TALENT, MORALE, POLICE, GROWTH, INDUSTRY, and RESEARCH
  effects across base yields, psych, unit support and combat, production, and
  research, including SUPPORT-based starting minerals for new bases and
  low-MORALE halving of conventional unit training bonuses; POLICE includes
  original garrison limits, +3 doubled control, Non-Lethal Methods, Ascetic
  Virtues, Self-Aware Colony, AI worker stability, and base-screen diagnostics;
- Bioenhancement Centers grant +2 training morale only to conventional military
  units and +1 lifecycle to bred native life, excluding civilian units from the
  general training bonus;
- Punishment Spheres eliminate drones and talents, halve base labs, and double
  enemy mind-control cost;
- Genejack Factories add 50% minerals and one drone while halving enemy
  mind-control cost;
- Centauri Preserves and Temples of Planet cumulatively divide mineral-driven
  ecological damage and each grant bred native life +1 lifecycle;
- Tree Farms and Hybrid Forests apply their cumulative forest resource,
  ECONOMY, PSYCH, and exact terraforming-damage reductions;
- original-SMAC distance-based energy inefficiency, including EFFIC modifiers,
  the Children's Creche exact +2 local EFFIC bonus, no-headquarters fallback,
  starting capitals, and base-screen loss, distance, and EFFIC diagnostics;
- Stockpile Energy is a repeatable base-production mode that preserves stored
  minerals and converts each turn's mineral surplus directly to reserves at
  the original two-to-one rate, with player UI and conservative AI fallback;
- Sky Hydroponics Labs, Nessus Mining Stations, and Orbital Power Transmitters
  are repeatable faction-wide launches with persistent counts, population-capped
  base yields, the original halved output without an Aerospace Complex, and
  marginal-yield-aware AI production; the Space Elevator waives Aerospace
  restrictions and doubles orbital production, with save/reconnect coverage;
- generated Planet Buster designs, reactor-scaled blast radii, destruction of
  affected bases, units, and cargo, surviving-unit rehoming, terrain
  deformation and crater formation, persistent major-atrocity consequences,
  Charter-controlled Council sanctions, permanent Council expulsion, Governor
  removal, and global vendettas, reversible network application, and
  conservative opponent-aware AI production and targeting; Orbital Defense
  Pods make one 50% interception attempt per
  undeployed pod each turn and can sacrifice an already deployed pod for a
  guaranteed interception; undeployed Pods can also directly attack rival
  satellites with the original 50% success-or-self-destruction outcome,
  vendetta and integrity consequences, reversible network state, player UI,
  and reserve- and marginal-yield-aware AI targeting;
- land and sea Unity Pods resolve during ordinary movement with reversible,
  deterministic events; supported rewards cover energy, rivers, earthquakes,
  production completion, Alien Artifacts, fungus, monoliths, Unity vehicles,
  technologies, random-faction commlinks, terraforming, unit cloning,
  same-domain dimensional-gate or tidal-wave relocation with restored movement,
  and resource bonuses; monoliths fully repair visiting units and grant one
  morale or lifecycle level once per military unit, while cartographic and sonar
  pods reveal a four-tile-radius map region and AI units route toward reachable
  pods;
- the Children's Creche exact +2 local GROWTH and conventional-defender
  social-MORALE floor of +1, without affecting native units or enemy occupiers;
- Headquarters grant +1 base-square energy, eliminate local inefficiency, and
  prevent enemy mind control, with relocation by production, faction-wide
  runtime uniqueness, player-controlled abandon or 1,000-credit emergency
  evacuation after enemy capture, active Energy Market bid transfer, persistent
  reconnect-safe choices, and reversible restoration; AI factions evacuate
  automatically when eligible;
- original-SMAC ecological damage based on local terraforming, worked squares,
  mineral production, ecology facilities, difficulty, discovered technology,
  PLANET rating, native-life setting, and perihelion;
- persistent faction-wide fungal-bloom counts, host-authored reversible fungus
  eruptions, independent Planet-controlled native-life outbreaks, persistent
  major-atrocity counts and ecological penalties, and live Eco Damage values
  on the base screen;
- independent native life takes deterministic turns, pursues nearby human
  factions, attacks legally across land and sea, and can be captured through
  PLANET affinity, with reversible combat and installed-asset coverage;
- serialized planetary climate pressure and pending sea-level change, with
  ecological disasters driving the original escalating 1/3/5 warming bands,
  gradual 20-turn altitude steps, deterministic flooding and exposure,
  Pressure Dome protection and emergency construction, population losses,
  unit and transport-cargo destruction, surviving-unit rehoming, live terrain
  rendering, save state, versioned network snapshots that preserve sea level
  and climate while accepting legacy raw map payloads, and complete event
  rollback;
- deterministic physical territory claims use the original eight-tile maximum,
  nearest reachable base on the same landmass or sea without crossing the other
  terrain type, oldest-base tie resolution, and two-tile coastal water claims;
  supported combat units outside friendly territory now apply the original
  POLICE -3, -4, and -5 pacifism-drone rules, including the air superiority
  exception and base-screen diagnostics;
- generated maps place separated, deterministic regions for all 12
  original-release natural landmarks after terrain normalization: Garland
  Crater, Mount Planet, Monsoon Jungle, Uranium Flats, New Sargasso, The Ruins,
  Great Dunes, Freshwater Sea, Sunny Mesa, Nessus Canyon, Geothermal Shallows,
  and Pholus Ridge; persistent landmark metadata, physical terrain, tile
  information, and old feature-only snapshots are covered, while all eight
  landmarks with intrinsic resource effects apply their original bonuses;
- the original one-time ecological volcano creation after ten fungal blooms:
  the host selects a clear ocean region, raises a rocky nine-tile unnamed
  volcano, clears its surface improvements, and synchronizes the reversible
  terrain snapshot; volcanic farms and forests plus all volcano-center
  terraforming are rejected;
- the original base-game major Mount Planet eruption from Mission Year 2175:
  an eligible eight-base faction near explored Mount Planet can suffer the
  original radius-four improvement and fungus destruction, rocky terrain,
  Mount Planet unit deaths, half damage elsewhere, ring-scaled population
  losses, base destruction and unit rehoming, plus a synchronized ten-year
  global one-energy-per-tile dust-cloud penalty with exact event rollback;
  original ranking, PBEM, and objective-base scenario exceptions remain
  unavailable because GLSMAC does not yet expose those underlying models;
- persistent bilateral faction contact discovered through adjacent units and
  bases, movement, air drops, Psi Gates, direct attacks, commlink trades, Unity
  Pods, and the Empath Guild; unknown factions are excluded from diplomacy and
  AI negotiations, legacy saves preserve their prior unrestricted diplomacy,
  and contact survives a running-game reconnect;
- persistent bilateral neutral, treaty, pact, and vendetta relations, including
  saved pending proposals, reversible network events, attack-triggered
  vendettas, and a player diplomacy screen;
- persistent eight-level diplomatic integrity, with treaty and pact betrayal
  consequences shared by declarations of war, direct attacks, and detected
  covert operations, plus rollback, player diagnostics, and trust-aware AI;
- persistent structured energy, technology, and commlink trade offers, atomic
  reversible settlement, human negotiation controls, and relation-, strength-,
  opponent-, and value-aware AI proposals and responses;
- persistent faction-specific explored-tile state discovered around units and
  bases, through movement, air drops, combat advances, and Psi Gates; unexplored
  terrain is covered, previously explored terrain is dimmed, currently visible
  terrain remains clear, and out-of-vision enemy bases and units are concealed
  from rendering, selection, and previews; the minimap includes the same fog;
  Deep Radar extends exploration and live sight to two squares; ground and sea
  units in xenofungus are concealed, while adjacent Deep Radar detects fungal
  concealment without revealing Cloaking Device or Deep Pressure Hull units;
  ability-concealed units remain hidden unless directly encountered or detected
  by an owned Sensor Array; Sensor Arrays provide live two-square coverage,
  reveal all concealed enemies, record terrain when construction completes, and
  grant the original 25% defense bonus to units on covered land squares;
  bilateral pacts immediately exchange existing maps and continuously share later
  exploration; old saves preserve their formerly unrestricted map view, while
  map trades and automatic pact sharing have reversible settlement and network
  synchronization;
- persistent energy loans with player-authored lending and borrowing terms,
  atomic principal transfer, yearly repayment, partial-payment handling,
  wartime balance growth, human controls, and relationship-, reserve-, risk-,
  and liquidity-aware AI valuation;
- persistent ten-year economic sanctions under the U.N. Charter for successful
  genetic-warfare atrocities, including extension for repeated offenses,
  bilateral commerce cutoff, ordinary trade and new-loan embargoes,
  existing-loan suspension, yearly expiry, player diagnostics, and
  commerce-aware AI atrocity valuation;
- original-SMAC base-paired commerce income for reciprocal treaties and pacts,
  including imported economic-technology flags, ECONOMY and Morgan bonuses,
  deterministic per-partner base diagnostics, the Global Trade Pact's exact
  pre-scaling planetwide doubling, and AI research valuation;
- persistent Planetary Council sessions with original population voting,
  Peacekeeper and Secret Project vote modifiers, Progenitor exclusion,
  deterministic candidates, human and strategy-aware AI ballots, Governor and
  Supreme Leader thresholds, Global Trade Pact enactment and repeal, one-time
  Unity Fusion Core salvage with 500 energy credits for every faction, U.N.
  Charter repeal and reinstatement with live atrocity and AI behavior,
  repeatable Solar Shade and Melt Polar Caps climate motions with exposure- and
  relationship-aware AI voting, technology gating, a 20-turn cooldown,
  save/reconnect restoration, and reversible election and policy results;
- the Planetary Governor receives +1 energy per commerce transaction and
  effective infiltration against every rival; election as Supreme Leader asks
  each surviving human and AI faction to accede or defy, unites loyal factions
  in a pact, forces vendetta against every holdout, and awards diplomatic
  victory only after all factions accede or every defiant faction is defeated;
  the persistent decision state, player controls, AI responses, coalition
  combat and diplomacy enforcement, save compatibility, and reversible
  nonterminal events are covered;
- buildable Probe Teams, persistent faction infiltration, Hunter-Seeker
  immunity, infiltration, technology theft, production/facility sabotage,
  energy drain, drone riots, researcher assassination, genetic plague, unit
  subversion, base mind control, resident Probe Team defense, neutral/treaty
  Probe Team interception with leave/interrogate/eliminate player controls and
  domain-compatible repatriation, infiltration- or Planetary Governor-gated
  intelligence reports for rival research, economy, bases, social model, and
  force composition, and relationship-, value-, affordability-, and
  distance-aware AI policies;
- land and sea colonization, terraforming, conventional and psi combat, and
  conquest, economic, diplomatic, and transcendence victory;
- air-unit range and refueling, naval and air combat access, transports and
  cargo, field repair, facility repair, and unit morale; Amphibious Pods permit
  transport assaults and sea-base crossings, while Air Superiority provides
  cross-triad targeting and the original interceptor combat modifiers; Carrier
  Deck sea transports accept, move, deploy, and refuel aircraft while ordinary
  troop transports reject them; Nerve Gas Pods are available to legal
  conventional land and air designs, grant +50% offense against non-native
  units, count as a major atrocity, impose U.N. Charter sanctions, and halve a
  defeated base's population, destroying size-one bases and rehoming their
  surviving supported units; Drop Pods provide eight-square insertion from
  owned bases and friendly airbases, Graviton Theory and the Space Elevator
  provide global orbital insertion, Air Superiority patrols can deny landing
  zones, reactor-scaled landing damage and the same-turn attack penalty apply,
  transport cargo moves and rolls back with its carrier, and player and
  target-aware AI controls use the same authoritative rules;
- AI expansion, research, production, terraforming, economy, opponent-aware
  combat, retreat and repair, reinforcement, air units, and hurry production;
  AI and native-life controllers retry animation-blocked turn completion and
  stop cleanly when the turn advances;
- seven-player startup, multiplayer turn/event synchronization, and reconnect
  restoration of a running game; clients consume synchronized content definitions
  without redundantly submitting host-only initialization events.

The base-game content validator currently reports:

- 77 technologies;
- all 38 base facilities represented: 38 complete and 0 partial;
- all 33 Secret Projects represented: 33 complete and 0 partial;
- 533 runtime unit definitions, 14 source-manifest predefined units, and 68
  unit components.

These counts describe implemented definitions and automated coverage. They do
not mean that the game is feature-complete or balanced.

## Release Blockers

The following original-SMAC systems remain absent or materially incomplete:

- deeper diplomacy including surrender and richer bundled or counteroffers
  beyond the implemented energy, technology, commlink, and world-map terms;
- remaining probe-team parity: exact original cost/outcome and probe-combat
  tuning;
- remaining territory presentation: rendered faction border overlays and
  treaty-aware foreign-border visibility;
- post-release SMAC patch landmark parity for Borehole Cluster and Manifold
  Nexus;
- remaining multiplayer visibility hardening: authoritative per-client filtering
  of hidden-unit snapshots and subsequent entity events so concealed information
  is not present client-side;
- complete UI workflows, accessibility review, packaging, upgrade migration,
  and release documentation;
- long campaign balance, adversarial multiplayer soak testing, and broad
  manual playtesting across supported operating systems.

Until those blockers are resolved, GLSMAC should be treated as a playable
development build rather than a finished replacement for the original game.

## Test Status

The Release CTest matrix contains 139 cases: 108 isolated native/script GSE tests
and 31 asset-backed runtime scenarios. Script isolation keeps allocator
lifetime bounded and reports the exact script that fails.

After persistent exploration and world-map exchange were added, the Windows
x64 Release build succeeded and all 100 isolated tests passed in 217.28
seconds. The installed-asset diplomacy scenario passed in 29.59 seconds with a
reciprocal map exchange. Running reconnect initially exposed an access violation
while colony founding notified exploration about a partially constructed base;
removing that unsafe spawn callback and relying on completed movement plus
start/turn entity scans fixed the defect. Focused exploration, movement, and
rollback tests passed in 3.66 seconds, and the full installed-asset running
reconnect then passed in 49.52 seconds with explored-map state restored.

After persistent faction contact and commlink exchange were added, the Windows
x64 Release build succeeded. In the broad isolated run, 98 unaffected cases
passed in 214.82 seconds; the sole movement-fixture mismatch was corrected and
its rollback case then passed in 1.20 seconds together with focused movement,
capture, diplomacy, AI, Empath Guild, Unity Pod, loan, probe, and native
serialization coverage. The installed-asset diplomacy runtime passed in 26.32
seconds with contact-gated treaty commerce, reciprocal technology trade, loan
repayment, betrayal integrity, and wartime debt. Running reconnect passed in
49.22 seconds and now verifies bilateral contact alongside the existing loan,
sanction, orbital, Workshop, unit, base, and terraforming snapshot state.
A later loaded-debug run held the reconnecting client in snapshot download long
enough to expose a server crash: locally controlled AI and native events were
mistaken for remote-client events because they use nonzero player slots. Event
responses are now sent only for events whose source is an actual network client.
With realistic cold-start deadlines, the exact installed-asset CTest commands
passed again: diplomacy in 195.19 seconds and running reconnect in 201.34
seconds.

After Drop Pods were completed, the Windows x64 Release build succeeded and all
99 isolated tests passed in 213.14 seconds. Focused installed-asset Workshop,
combat-access, and running-reconnect scenarios passed together in 80.46 seconds;
the multiplayer synchronization harness passed in 52.17 seconds. Across bounded
batches, all 30 asset-backed scenarios now have green runs. Coverage verifies 488-definition
generation, Workshop legality, eight-square and orbital insertion, interceptor
denial, reactor-scaled landing damage, the same-turn attack penalty, cargo and
rollback behavior, AI production and destination choice, native persistence,
turn reset, and reconnect restoration. The long AI economy soak now retries a
transiently animation-blocked human turn completion and passed at turn 20 in
287.69 seconds. The research runtime now waits for normal turn-start economy
settlement before seeding its social-engineering budget, runs headlessly, and
passed in 26.11 seconds. The air logic scenario runs headlessly and passed in
16.02 seconds; the AI hurry scenario passed in 60.16 seconds after its
post-success shutdown delay and CTest teardown allowance were corrected.

After Nerve Gas Pods were completed, the Windows x64 Release build succeeded
and all 97 isolated tests passed in 209.66 seconds. The installed-asset Unit
Workshop, combat-access, multiplayer, and running-reconnect scenarios passed in
130.62 seconds. Coverage verifies Workshop legality, 476-definition generation,
offensive AI valuation, the live faction-adjusted +50% combat bonus, major
atrocities and sanctions, rounded-up population loss, size-one base destruction,
support rehoming, and complete event rollback. Full global Council expulsion
consequences for major atrocities remain a release blocker.

After permanent Unit Workshop retirement was added, all 97 isolated tests passed
in 202.92 seconds. The focused Workshop runtime passed in 19.53 seconds and now
verifies trimmed names, server-authored stats, faction-private build access,
production selection, queued-design cleanup, reversible obsolescence,
movement-preserving bulk upgrades, permanent retirement, hidden retired entries,
and valid field units after retirement. Running reconnect passed in 45.18 seconds
and restores the dynamic definition, owner metadata, upgraded field units,
obsolete state, and retired state while keeping the design unavailable and
hidden. A preceding reconnect attempt exhausted its 60-second cold-start phase
while generating the unit catalog and emitted no gameplay failure; the immediate
rerun passed. The Windows x64 Release build completed successfully. The 28 local
asset-backed scenarios previously passed in two bounded batches after an
animation-timing failure led to a real AI completion retry fix; the native-life
case then passed five consecutive runs. The general multiplayer stress harness
passed four consecutive runs after one earlier intermittent Windows heap
corruption exit. That isolated crash remains a soak-testing risk rather than a
resolved defect. The Workshop shutdown path also completed under AddressSanitizer
with no diagnostic output.

After original-SMAC Supply Crawlers were added, the Windows x64 Release build
completed successfully and the complete matrix passed in bounded batches: all
94 GSE tests in 196.13 seconds, all 27 local asset-backed runtime scenarios in
1,026.12 seconds, and both multiplayer harnesses in 92.93 seconds. The crawler
runtime verifies generated definitions, delegated orders, movement use, live
base intake, and cancellation; running reconnect verifies serialized convoy,
home-base, and turn state before and after movement refresh.

After four-tier reactor generation, original unit-cost calculation, reactor
durability and transport scaling, and functional Carrier Deck aircraft cargo
were added, all 93 isolated tests passed in 196.61 seconds. Ten high-value
installed-asset scenarios covering standard startup, Planet Busters, air,
transports, combat access, reactors, AI, opponent strategy, multiplayer, and
running-game reconnect passed in 292.34 seconds. The Windows x64 Release build
completed successfully before those runtime checks.

After Amphibious Pods, Air Superiority, native-life capture, and shared rollback
snapshot hardening were added, all 91 isolated tests passed in 176.92 seconds.
The installed-asset combat-access, probe, Planet Buster, and native-capture
scenarios passed together in 68.60 seconds. After the final Release rebuild,
the standard runtime, combat-access runtime, multiplayer, and running reconnect
scenarios passed together in 166.21 seconds.

An earlier uninterrupted full run, before the territory test was added,
completed 108 of 109 cases in 870.61 seconds. The multiplayer runtime harness
reached its internal 90-second deadline after both peers had already passed
most gameplay stages. The same scenario passed immediately afterward in
isolation in 33.82 seconds, as it had before the full run. The current complete
matrix is green in bounded batches, including both network harnesses after all
local runtime scenarios.

After territory and pacifism support was added, all 86 isolated tests passed in
149.63 seconds. The standard runtime passed in 27.28 seconds, the long economy
soak in 134.80, multiplayer in 32.86, and running reconnect in 31.56. Territory
is derived from synchronized base state, so it requires no additional snapshot
payload and produced identical behavior after reconnect.

After Global Trade Pact enactment and repeal were added, all 86 isolated tests
passed in 161.59 seconds. Focused native serialization, Council, commerce, and
installed-asset Council runtime coverage passed together in 29.64 seconds; the
asset-backed Council scenario itself completed in 25.99 seconds.

After Unity Fusion Core salvage and U.N. Charter repeal/reinstatement were
added, all 86 isolated tests passed in 159.59 seconds. Focused native, Council,
probe, and Planet Buster tests passed in 4.82 seconds; the installed-asset
Council and Planet Buster runtime scenarios passed together in 45.84 seconds.
The corresponding five-test AddressSanitizer pass completed in 19.63 seconds.

After global warming, dynamic sea levels, Pressure Dome submersion protection,
and both climate Council motions were added, all 86 isolated tests passed in
160.98 seconds. Focused ecology, sea-level, Council, Planet Buster, and
installed-asset runtime coverage passed together in 54.92 seconds.

All 31 runtime scenarios have green runs against an installed Planetary Pack,
including diplomacy, probes, research, Planet Busters, economic victory,
Planetary Council, Datalinks, air units, transports, Supply Crawlers, the Unit
Workshop, sea colonies, and the standard AI runtime. The rendered Unity Pod scenario verifies
live land and sea sprite refresh, bonus mutation, earthquake apply/rollback
with terrain mesh synchronization, reward-unit serialization, and
movement-triggered resolution.
The rendered facility-actions scenario verifies the serialized Psi Gate and
Alien Artifact capabilities, non-buildable Artifact definition, 50-mineral
contribution, transport/cargo teleport, and per-turn endpoint limits.

The eight specialized AI scenarios are green after two asynchronous lifecycle
defects were fixed. The economy soak passed in 130.97 seconds; opponent
strategy in 15.52; conquest in 13.79; repair in 42.49; air operations in 16.81;
reinforcement in 53.40; and seven-player operation in 24.39. The hurry scenario
passed three consecutive clean Release runs in 45.87, 40.67, and 40.08 seconds.
AI movement now waits for animation locks on adjacent combat tiles, and runtime
smokes defer process exit until scheduled callbacks have drained.

The two multiplayer scenarios passed together after the local runtime matrix:
ordinary multiplayer in 49.19 seconds and running-game reconnect in 43.73
seconds. Reconnect coverage restores active Supply Crawler orders and movement
state along with Council, diplomacy, economy, project, and orbital state.

Fresh-profile startup is covered by a native filesystem regression test.
Missing write targets now use an absolute lexical fallback when platform path
canonicalization fails, preventing startup failures while creating config and
debug files in new profile directories.

Most logic-heavy runtime scenarios use the test-only `--headless` mode. It
retains the real asset loaders, UI scripts, frontend/backend game modules,
scheduler, networking, and ordinary unit-movement ordering while replacing
graphics, input, and audio with null modules and immediately acknowledging
animation requests. Transport and sea-colony scenarios remain rendered to cover
graphics-coupled paths. Headless mode does not bypass game logic or force
synchronous movement.

The long economy soak keeps engine verbosity disabled so CTest does not retain
enough diagnostic output to destabilize later GPU-backed runtime processes;
its explicit milestone and pass/fail assertions remain enabled.

The rendered Unity Pod scenario also completes under AddressSanitizer against
the installed Planetary Pack. This directly covers terrain mesh replacement,
immutable frontend tile-update snapshots, rapid sprite changes, and the
movement reward path that previously exposed a frontend access violation.

After rendered fog of war was added, the Windows x64 Release build succeeded
and all 100 isolated native/script tests passed in 217.06 seconds. The rendered
transport scenario passed in 14.18 seconds against the installed Planetary Pack;
live diagnostics reported 25 currently visible and explored tiles out of 100,
changing coverage during movement, and a nonblank fog framebuffer with alpha
spanning 0 through 255. Running-game reconnect passed in 50.45 seconds. The
ordinary multiplayer harness then exposed a generic deserializer defect that
dropped the game context inside nested arrays and objects; propagating that
context fixed nested base, tile, pop, unit, and player references, after which
the full malformed-packet, reconnect, synchronized movement/combat, base,
terraforming, research, and victory scenario passed in 59.40 seconds with clean
host and client exits.

After Sensor Array coverage and automatic Pact map sharing were added, the
Windows x64 Release build succeeded and all 100 isolated native/script tests
passed in 222.45 seconds. A dedicated rendered Sensor Array scenario passed in
13.79 seconds against the installed Planetary Pack and required the frontend to
report one owned array after a synchronized tile update. The rendered transport
scenario passed in 13.92 seconds, multiplayer in 59.01 seconds, and running-game
reconnect in 49.32 seconds.

After dimensional-gate relocation and persistent once-per-unit monolith visits
were added, the Windows x64 Release build succeeded and all 101 isolated
native/script tests passed in 258.45 seconds. The rendered Unity Pod scenario
passed in 21.11 seconds against the installed Planetary Pack. Ordinary
multiplayer passed in 63.92 seconds, and running-game reconnect passed in 56.45
seconds while verifying that monolith upgrade state survives network
replication, snapshot serialization, process restart, reload, and turn reset.

After paid emergency Headquarters evacuation and explicit base-screen
inefficiency diagnostics were added, the Windows x64 Release build succeeded
and 15 focused capture, combat, movement, probe, native, economy, and AI tests
passed in 18.31 seconds. Full-game runtime initially exposed an invalid nested
GSE assignment in the new UI and then a pre-existing real-game capture defect:
the central capture module used manager aliases available in mocks but not the
configured runtime. Explicit UI assignment and accessor-backed manager lookup
fixed both failures. The installed-asset full-game scenario then passed in
55.95 seconds, and economic victory passed in 25.09 seconds while directly
capturing and rolling back an active-bid Headquarters, its 1,000-credit charge,
destination, facility, ownership, balances, and transferred market state. The
synchronized multiplayer capture scenario passed in 62.18 seconds.

After persistent post-bloom clean-mineral progression was added, the Windows
x64 Release build succeeded and the three focused ecology cases passed. The
installed-asset research runtime passed in 30.27 seconds, and running-game
reconnect passed in 57.06 seconds while restoring the faction-wide bloom count.

After direct Orbital Defense Pod satellite attacks were completed, the Windows
x64 Release build succeeded and all 103 isolated native/script tests passed in
267.69 seconds. Five focused orbital, AI, UI, and content cases passed together
in 10.57 seconds. The installed-asset research runtime passed in 31.14 seconds;
the seven-player runtime passed in 58.65 seconds while exercising successful
and failed native-player attacks, treaty betrayal, and full rollback through an
authoritative event; and multiplayer synchronization plus running reconnect
passed in 64.79 seconds.

After Deep Radar, concealed-unit detection, Sensor Array defense, Cloaking
Device, and Deep Pressure Hull behavior were completed, the Windows x64 Release
build succeeded and all 104 isolated native/script tests passed in 306.96
seconds. The ten-scenario installed-asset visibility, movement, combat, native,
facility, and colony group passed in 183.95 seconds, with native combat also
passing five consecutive stress runs. The long AI economy soak passed in 415.14
seconds; repair and reinforcement passed in 103.05 and 90.38 seconds; air,
hurry-production, seven-player, opponent-strategy, and conquest scenarios also
passed. Multiplayer passed in 66.38 seconds. Running reconnect exposed clients
redundantly submitting 533 host-only content definitions; restricting those
events to the authoritative host removed the rejected-event flood, and the same
reconnect scenario then passed under its original deadline in 61.60 seconds.

After original fungus concealment was completed, the Windows x64 Release build
succeeded and all 104 isolated native/script tests passed in 323.97 seconds.
The installed-asset transport, visibility, combat-access, and native-life
scenarios passed together in 69.07 seconds. The visibility runtime directly
verified one ordinary ground unit detected in fungus by adjacent Deep Radar,
one ability-concealed unit remaining hidden from Radar, both units revealed by
an owned Sensor Array, and the original split restored when the Sensor was
disabled. Embarked units no longer contribute exploration or live sight.

After connected-region territory claims were added, all eight territory,
visibility, combat, pacifism, exploration, and air-drop rule tests passed in
9.67 seconds. The standard installed-asset runtime completed in 51.29 seconds,
covering live base intake, AI evaluation, Sensor ownership, and tile previews
against the new bounded path search.

After the final landmark-generation phase and Mount Planet were added, the
Windows x64 Release build succeeded. Four focused resource, base-growth,
terraforming, and Supply Crawler tests passed in 4.86 seconds. The standard
installed-asset runtime passed in 55.36 seconds through turn 5 and directly
verified a nine-tile, land-only Mount Planet before completing its ordinary
production, expansion, and terraforming lifecycle checks.

After the complete original-release natural-landmark set and persistent tile
metadata were added, the Windows x64 Release build succeeded and all 104 GSE
tests passed in 232.13 seconds. The standard installed-asset runtime passed in
40.67 seconds through turn 5 while directly validating all 12 separated
landmark types, their physical terrain, and the absence of generic random
jungles. Running reconnect passed in 50.57 seconds and directly verified that
six compact-map landmark regions and their terrain survived host snapshot
transfer. Resource and tile-preview tests also cover old feature-only maps.

After ecological volcano creation and original volcanic terraforming limits
were added, the Windows x64 Release build succeeded and all 105 isolated tests
passed in 233.09 seconds. The standard installed-asset runtime passed in 41.32
seconds and directly verified live nine-tile volcanic uplift, rocky terrain,
improvement clearing, and exact terrain rollback. The same batch restored
Nessus Canyon's original +1 mineral yield.

After the major Mount Planet eruption and global dust cloud were added, the
Windows x64 Release build succeeded and all 107 isolated native/script tests
passed in 234.78 seconds. The standard installed-asset runtime passed in 42.53
seconds and directly verified radius-four rocky devastation, improvement and
fungus removal, exact unaffected terrain, rollback, and the live one-energy
dust penalty. Ordinary multiplayer passed in 55.28 seconds. Running reconnect
passed in 50.78 seconds while directly restoring the post-turn dust duration;
the versioned map payload now carries sea level and every climate field instead
of terrain tiles alone.

After neutral/treaty Probe Team interrogation and repatriation were added, the
Windows x64 Release build succeeded and all 108 isolated native/script tests
passed in 273.12 seconds. The installed-asset probe runtime passed in 29.77
seconds and directly verified normal attack dispatch, nearest owned-base return,
unchanged interceptor and probe movement, preserved diplomacy, notification,
and the subsequent subversion, promotion, pricing, and vendetta path. AI combat
units use the same authoritative event and only select visible, lone probes in
their own territory; sea probes avoid landlocked return bases.
The follow-up player workflow synchronizes a no-effect prompt before showing
Leave, Interrogate and Return, and Eliminate choices only to the controlling
player. Interrogation resubmits the authoritative repatriation action, while
elimination enters the ordinary combat and diplomacy path. The Release rebuild
succeeded, and five focused AI, probe, combat, and rollback tests plus the
installed-asset probe runtime passed together in 35.98 seconds.

After the Headquarters capture workflow gained explicit Abandon and Evacuate
choices, the complete 108-test isolated native/script suite passed in 240.69
seconds. Evacuation atomically reverses any captured Global Energy Market
proceeds, transfers the active bid, and charges the original 1,000 credits;
abandonment keeps the capture result. Both responses and the outer capture
remain reversible. The pending choice is stored in the version-tolerant native
base snapshot tail, reconstructed after reconnect, and reopened for the owning
player when the UI starts. The final Windows x64 Release rebuild succeeded;
the installed-asset economic-victory and running-game reconnect scenarios then
passed together in 73.13 seconds.

After the Probe Team intelligence report was added, the Windows x64 Release
build succeeded in 59.3 seconds and all 108 isolated native/script tests passed
in 243.36 seconds. The installed-asset probe runtime passed in 29.73 seconds and
verified live infiltration-gated research, economy, base, social-model, and
force-composition aggregation before continuing through the existing
interrogation and subversion workflow. The Intelligence menu popup also has
isolated initialization and event-refresh coverage.

After U.N. Charter Council expulsion was added for Planet Buster atrocities,
the final Windows x64 Release rebuild succeeded in 48.3 seconds and all 108
isolated native/script tests passed in 241.61 seconds. The installed-asset
Planet Buster and Planetary Council scenarios passed together in 62.72 seconds,
verifying live expulsion, Governor removal, zero Council votes, universal
vendetta, sanctions, and the unaffected diplomatic-victory path. Expulsion is
preserved by the native player save tail with backward-compatible defaults;
the same native validation fix also enables the existing Solar Shade and Polar
Caps Council motions in real games.

After the original Supreme Leader accession and defiance path was added, the
final Windows x64 Release rebuild succeeded in 62.8 seconds and all 108 isolated
native/script tests passed in 249.96 seconds. The installed-asset Planetary
Council scenario passed in a final 45.67-second run while verifying the live election,
AI ballots, persistent native accession state, AI responses, and all-factions-
accede diplomatic victory. Focused coverage additionally verifies a human
defiance decision, coalition pact and vendetta formation, event rollback,
holdout elimination before victory, and enforcement across conventional combat,
undefended-base capture, Probe Teams, orbital attacks, diplomatic proposals,
and Planet Buster blast effects.

Cross-platform release readiness must be confirmed by clean CI builds and the
same relevant tests on every supported toolchain before shipping.
