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
- the Empath Guild grants persistent infiltration of every rival on completion
  or capture, preserves existing intelligence through rollback, adds the exact
  +50% rounded-down Planetary Council vote bonus, and receives rival-aware AI
  production value; unrestricted diplomacy already permits contact with every
  faction;
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
  behavior-backed special abilities; the server recomputes legality and cost,
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
  and starting capitals;
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
  Charter-controlled Council sanctions and global vendettas, reversible
  network application, and conservative opponent-aware AI production and
  targeting; Orbital Defense Pods make one 50% interception attempt per
  undeployed pod each turn and can sacrifice an already deployed pod for a
  guaranteed interception;
- land and sea Unity Pods resolve during ordinary movement with reversible,
  deterministic events; supported rewards cover energy, rivers, earthquakes,
  production completion, Alien Artifacts, fungus, monoliths, Unity vehicles,
  technologies, terraforming, unit cloning, and resource bonuses, while AI
  explorers and combat units route toward reachable pods;
- the Children's Creche exact +2 local GROWTH and conventional-defender
  social-MORALE floor of +1, without affecting native units or enemy occupiers;
- Headquarters grant +1 base-square energy, eliminate local inefficiency, and
  prevent enemy mind control, with relocation by production, faction-wide
  runtime uniqueness, destruction on enemy capture, and reversible restoration;
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
  rendering, save/reconnect state, and complete event rollback;
- deterministic physical territory claims use the original eight-tile maximum,
  nearest-base ownership, oldest-base tie resolution, and coastal workable
  water claims; supported combat units outside friendly territory now apply
  the original POLICE -3, -4, and -5 pacifism-drone rules, including the air
  superiority exception and base-screen diagnostics;
- persistent bilateral neutral, treaty, pact, and vendetta relations, including
  saved pending proposals, reversible network events, attack-triggered
  vendettas, and a player diplomacy screen;
- persistent eight-level diplomatic integrity, with treaty and pact betrayal
  consequences shared by declarations of war, direct attacks, and detected
  covert operations, plus rollback, player diagnostics, and trust-aware AI;
- persistent structured energy and technology trade offers, atomic reversible
  settlement, human negotiation controls, and relation-, strength-, and
  value-aware AI proposals and responses;
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
  effective infiltration against every rival; election as Supreme Leader ends
  the game with a diplomatic victory;
- buildable Probe Teams, persistent faction infiltration, Hunter-Seeker
  immunity, infiltration, technology theft, production/facility sabotage,
  energy drain, drone riots, researcher assassination, genetic plague, unit
  subversion, base mind control, resident Probe Team defense, player controls,
  and a relationship-, value-, affordability-, and distance-aware AI policy;
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
  restoration of a running game.

The base-game content validator currently reports:

- 77 technologies;
- all 38 base facilities represented: 37 complete and 1 partial;
- all 33 Secret Projects represented: 33 complete and 0 partial;
- 488 runtime unit definitions, 14 source-manifest predefined units, and 68
  unit components.

These counts describe implemented definitions and automated coverage. They do
not mean that the game is feature-complete or balanced.

## Release Blockers

The following original-SMAC systems remain absent or materially incomplete:

- deeper diplomacy including map and commlink exchanges, surrender, the
  Council defiance path, and richer bundled or counteroffers;
- remaining probe-team parity: captured faction leader rescue,
  counterespionage, probe interrogation, exact original cost/outcome and
  probe-combat tuning, richer intelligence displays, and full global
  Council expulsion consequences for major atrocities;
- remaining territory parity: connected-region claim boundaries, rendered
  faction border overlays, and treaty-aware foreign-border visibility;
- paid emergency Headquarters evacuation before capture and explicit
  player-facing inefficiency diagnostics;
- volcanoes and the original engine's undocumented post-bloom clean-mineral
  facility bonus;
- remaining Unity Pod parity: map-survey and commlink rewards,
  dimensional-gate teleportation, and once-per-unit monolith visit tracking;
- Orbital Defense Pod remains partial because direct attacks against rival
  satellites are not available;
- remaining Unit Workshop parity: original behaviors for currently unavailable
  abilities such as Cloaking and Deep Pressure Hull;
- complete UI workflows, player-facing diagnostics, accessibility review,
  packaging, upgrade migration, and release documentation;
- long campaign balance, adversarial multiplayer soak testing, and broad
  manual playtesting across supported operating systems.

Until those blockers are resolved, GLSMAC should be treated as a playable
development build rather than a finished replacement for the original game.

## Test Status

The Release CTest matrix contains 129 cases: 99 isolated native/script GSE tests
and 30 asset-backed runtime scenarios. Script isolation keeps allocator
lifetime bounded and reports the exact script that fails.

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

All 30 runtime scenarios have green runs against an installed Planetary Pack,
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

Cross-platform release readiness must be confirmed by clean CI builds and the
same relevant tests on every supported toolchain before shipping.
