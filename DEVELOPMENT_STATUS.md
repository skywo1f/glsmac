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
  Translator base, with player controls, AI routing, and serialized usage;
- persistent faction-wide chassis, weapon, and armor prototype history across
  saves and reconnects, with the exact first-production surcharge, Skunkworks
  and Spartan waivers, and the first prototype's morale bonus;
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
  affected bases, units, and cargo, surviving-unit rehoming, global vendettas,
  terrain deformation and crater formation, major-atrocity and sanction
  consequences, reversible network application, and conservative
  opponent-aware AI production and targeting; Orbital Defense Pods make one
  50% interception attempt per undeployed pod each turn and can sacrifice an
  already deployed pod for a guaranteed interception;
- the Children's Creche exact +2 local GROWTH and conventional-defender
  social-MORALE floor of +1, without affecting native units or enemy occupiers;
- Headquarters grant +1 base-square energy, eliminate local inefficiency, and
  prevent enemy mind control, with relocation by production, faction-wide
  runtime uniqueness, destruction on enemy capture, and reversible restoration;
- original-SMAC ecological damage based on local terraforming, worked squares,
  mineral production, ecology facilities, difficulty, discovered technology,
  PLANET rating, native-life setting, and perihelion;
- persistent faction-wide fungal-bloom counts, host-authored reversible fungus
  eruptions, persistent major-atrocity counts and ecological penalties, and
  live Eco Damage values on the base screen;
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
- persistent ten-year economic sanctions for successful genetic-warfare
  atrocities, including extension for repeated offenses, bilateral commerce
  cutoff, ordinary trade and new-loan embargoes, existing-loan suspension,
  yearly expiry, player diagnostics, and commerce-aware AI atrocity valuation;
- original-SMAC base-paired commerce income for reciprocal treaties and pacts,
  including imported economic-technology flags, ECONOMY and Morgan bonuses,
  deterministic per-partner base diagnostics, and AI research valuation;
- persistent Planetary Council sessions with original population voting,
  Peacekeeper and Secret Project vote modifiers, Progenitor exclusion,
  deterministic candidates, human and strategy-aware AI ballots, Governor and
  Supreme Leader thresholds, a 20-turn cooldown, save/reconnect restoration,
  and reversible election results;
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
  cargo, field repair, facility repair, and unit morale;
- AI expansion, research, production, terraforming, economy, opponent-aware
  combat, retreat and repair, reinforcement, air units, and hurry production;
- seven-player startup, multiplayer turn/event synchronization, and reconnect
  restoration of a running game.

The base-game content validator currently reports:

- 77 technologies;
- 37 of 38 base facilities represented: 33 complete and 4 partial;
- all 33 Secret Projects represented: 32 complete and 1 partial;
- 247 runtime unit definitions, 14 source-manifest predefined units, and 68
  unit components.

These counts describe implemented definitions and automated coverage. They do
not mean that the game is feature-complete or balanced.

## Release Blockers

The following original-SMAC systems remain absent or materially incomplete:

- deeper diplomacy including map and commlink exchanges, surrender, Global
  Trade Pact and other policy proposals or defiance, and richer bundled or
  counteroffers; Council sessions currently cover Governor and Supreme Leader
  elections only;
- remaining probe-team parity: captured faction leader rescue,
  counterespionage, probe interrogation, exact original cost/outcome and
  probe-combat tuning, richer intelligence displays, and full global
  vendetta/council consequences for major atrocities;
- remaining social effects: POLICE penalties for military units away from
  friendly territory; exact away-unit accounting remains dependent on the
  absent territorial-ownership/border system;
- paid emergency Headquarters evacuation before capture and explicit
  player-facing inefficiency diagnostics;
- native-life outbreaks from fungal blooms, an independent wild Planet faction,
  global warming, sea-level changes, volcanoes, several ecology-related Secret
  Project effects, and the original engine's
  undocumented post-bloom clean-mineral facility bonus;
- direct Orbital Defense Pod attacks against rival satellites are not
  available;
- several remaining facility effects, including submersion, Psi Gates, disease
  protection, and Alien Artifact production contributions to Secret Projects
  and prototypes;
- Psi Gate is the only absent base-facility definition; both hospitals remain
  partial because disease protection is absent, Pressure Dome still lacks
  submersion protection, and Orbital Defense Pod remains partial only because
  direct satellite warfare is absent;
- the Space Elevator is the only partial Secret Project; it still lacks global
  orbital insertion and its remaining Drop Pod interactions;
- complete UI workflows, player-facing diagnostics, accessibility review,
  packaging, upgrade migration, and release documentation;
- long campaign balance, adversarial multiplayer soak testing, and broad
  manual playtesting across supported operating systems.

Until those blockers are resolved, GLSMAC should be treated as a playable
development build rather than a finished replacement for the original game.

## Test Status

The Release CTest matrix contains 101 cases: 79 isolated native/script GSE tests
and 22 asset-backed runtime scenarios. The complete isolated Release matrix
passed 79/79 in 141.43 seconds. The same 79 cases passed under AddressSanitizer
in two bounded invocations: 40/40 in 717.14 seconds and 39/39 in 75.63 seconds.
Script isolation keeps allocator lifetime bounded and reports the exact script
that fails.

All 22 runtime scenarios are green in bounded groups against an installed
Planetary Pack. The 12 general gameplay scenarios passed 12/12 in 205.93
seconds, including diplomacy, probes, research, Planet Busters, economic
victory, Planetary Council, Datalinks, air units, transports, sea colonies, and
the standard AI runtime. The Council scenario completed a live Governor
election and Supreme Leader diplomatic victory in 17.63 seconds.

The eight specialized AI scenarios are green after two asynchronous lifecycle
defects were fixed. The economy soak passed in 130.97 seconds; opponent
strategy in 15.52; conquest in 13.79; repair in 42.49; air operations in 16.81;
reinforcement in 53.40; and seven-player operation in 24.39. The hurry scenario
passed three consecutive clean Release runs in 45.87, 40.67, and 40.08 seconds.
AI movement now waits for animation locks on adjacent combat tiles, and runtime
smokes defer process exit until scheduled callbacks have drained.

The two multiplayer scenarios passed independently: ordinary multiplayer in
32.92 seconds and running-game reconnect in 31.55 seconds. Reconnect coverage
restores Council state along with the previously covered diplomacy, economy,
project, and orbital state.

Fresh-profile startup is covered by a native filesystem regression test.
Missing write targets now use an absolute lexical fallback when platform path
canonicalization fails, preventing startup failures while creating config and
debug files in new profile directories.

Most logic-heavy runtime scenarios use the test-only `--headless` mode. It
retains the real asset loaders, UI scripts, frontend/backend game modules,
scheduler, networking, and ordinary unit-movement ordering while replacing
graphics, input, and audio with null modules and immediately acknowledging
animation requests. Research, air, transport, and sea-colony scenarios remain
rendered to cover the graphics-coupled paths. Headless mode does not bypass game
logic or force synchronous movement.

The long economy soak keeps engine verbosity disabled so CTest does not retain
enough diagnostic output to destabilize later GPU-backed runtime processes;
its explicit milestone and pass/fail assertions remain enabled.

Cross-platform release readiness must be confirmed by clean CI builds and the
same relevant tests on every supported toolchain before shipping.
