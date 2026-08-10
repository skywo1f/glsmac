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

The Windows x64 Release build has asset-backed automated coverage for:

- game setup, turn progression, research, economy, base growth, worker
  assignment, production queues, support, and persistent social engineering;
- all 16 original social models, original-faction rating modifiers and immunity,
  technology gating, human selection UI, and strategy-weighted AI selection;
- social ECONOMY, SUPPORT, TALENT, MORALE, GROWTH, INDUSTRY, and RESEARCH
  effects across base yields, psych, unit support and combat, production, and
  research, including SUPPORT-based starting minerals for new bases and
  low-MORALE halving of conventional unit training bonuses;
- original-SMAC distance-based energy inefficiency, including EFFIC modifiers,
  Children's Creche bonuses, no-headquarters fallback, and starting capitals;
- Headquarters relocation by production, faction-wide runtime uniqueness,
  destruction on enemy capture, and reversible restoration;
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
- buildable Probe Teams, persistent faction infiltration, Hunter-Seeker
  immunity, infiltration, technology theft, production/facility sabotage,
  energy drain, drone riots, researcher assassination, genetic plague, unit
  subversion, base mind control, resident Probe Team defense, player controls,
  and a relationship-, value-, affordability-, and distance-aware AI policy;
- land and sea colonization, terraforming, conventional and psi combat,
  conquest, and transcendence victory;
- air-unit range and refueling, naval and air combat access, transports and
  cargo, field repair, facility repair, and unit morale;
- AI expansion, research, production, terraforming, economy, opponent-aware
  combat, retreat and repair, reinforcement, air units, and hurry production;
- seven-player startup, multiplayer turn/event synchronization, and reconnect
  restoration of a running game.

The base-game content validator currently reports:

- 77 technologies;
- 31 of 38 base facilities represented: 17 complete and 14 partial;
- all 33 Secret Projects represented: 18 complete and 15 partial;
- 246 runtime unit definitions, 14 source-manifest predefined units, and 68
  unit components.

These counts describe implemented definitions and automated coverage. They do
not mean that the game is feature-complete or balanced.

## Release Blockers

The following original-SMAC systems remain absent or materially incomplete:

- deeper diplomacy including map and commlink exchanges, surrender, council
  elections, diplomatic victory, Global Trade Pact/Governor commerce
  modifiers, and richer bundled or counteroffers;
- remaining probe-team parity: captured faction leader rescue,
  counterespionage, probe interrogation, exact original cost/outcome and
  probe-combat tuning, richer intelligence displays, and full global
  vendetta/council consequences for major atrocities;
- remaining social effects: adoption costs and full police and away-unit
  behavior;
- paid emergency Headquarters evacuation before capture and explicit
  player-facing inefficiency diagnostics;
- native-life outbreaks from fungal blooms, an independent wild Planet faction,
  global warming, sea-level changes, volcanoes, several ecology-related Secret
  Project effects, and the original engine's
  undocumented post-bloom clean-mineral facility bonus;
- orbital facilities, orbital limits, Planet Busters, and orbital defense;
- several remaining facility effects, including submersion, Psi Gates,
  prototype-cost handling, and disease protection;
- several remaining Secret Project effects and victory-adjacent rules;
- complete UI workflows, player-facing diagnostics, accessibility review,
  packaging, upgrade migration, and release documentation;
- long campaign balance, adversarial multiplayer soak testing, and broad
  manual playtesting across supported operating systems.

Until those blockers are resolved, GLSMAC should be treated as a playable
development build rather than a finished replacement for the original game.

## Test Status

The Release CTest matrix contains 85 cases: 67 isolated native/script GSE tests
and 18 asset-backed runtime scenarios. The previous 74-case matrix completed
all cases in one uninterrupted invocation on the tested Windows machine, but
long runtime timing and process-lifecycle cases remain intermittently unstable.
The current 67-case Release GSE matrix passed in one bounded invocation in
117.48 seconds. Before the loan, sanction, and integrity milestones, all 18
asset-backed runtime scenarios also passed against an installed Planetary Pack
in three bounded invocations: the live probe scenario in 7.46 seconds, six
gameplay and snapshot scenarios in 92.70 seconds, and the remaining eleven
content and AI scenarios in 544.16 seconds. The
previous 58-case GSE set also passes in the MSVC AddressSanitizer configuration.
Script isolation keeps allocator lifetime bounded and reports the exact script
that fails.

The diplomacy cases have passed focused Release validation: native trade and
loan clone/serialization/backward-compatibility checks; isolated atomic energy,
technology, principal, repayment, partial-payment, wartime-penalty, vendetta,
and rollback tests; stale-wrapper multi-lender accounting; and AI-policy and
UI-parser tests. The current asset-backed diplomacy quickstart passed in 8.01
seconds with a treaty, commerce, reciprocal technology trade, loan acceptance,
peaceful repayment, treaty-betrayal integrity loss, vendetta, and wartime debt
growth. The current running multiplayer reconnect passed in 25.76 seconds and
restored exact active-loan, sanction-duration, and diplomatic-integrity state.
Probe coverage includes persistent infiltration and
major-atrocity state, isolated rules, reversible operations for all implemented
missions, resident defense, AI policy, UI loading, and an asset-backed
quickstart covering the live production gate and unit subversion. The preceding
84-case matrix is green across bounded invocations, but has not been run as one
invocation.

Commerce coverage validates the original base-ranking and pairing formula,
asymmetric technology benefits, treaty/pact scaling, social and faction
bonuses, unmatched bases, reciprocal-relation requirements, Progenitor
exclusion, player-income aggregation, AI research valuation, and base-screen
loading.
The installed-asset diplomacy quickstart also verifies that treaty commerce is
created and a later vendetta removes it without erasing an outstanding debt.
Sanction coverage verifies symmetric commerce cutoff, ordinary trade and loan
embargoes, suspended peaceful repayments, atrocity imposition and rollback,
post-economy yearly expiry, AI commerce-cost awareness, UI status loading, and
network snapshot restoration. The sanction-aware asset-backed Probe Team smoke
passed in 7.03 seconds.
Integrity coverage verifies the original eight status labels, treaty and pact
penalties, aggressor-only changes, saturation, reversible declaration and
detected-probe paths, AI agreement and loan trust, UI status loading, native
serialization, and live network snapshot restoration.

After the Headquarters relocation and capture rules were added, all 64 GSE
cases passed again, and the installed-asset general gameplay and AI runtime
smokes passed in 8.27 and 109.90 seconds. The general smoke directly completes
and rolls back a Headquarters relocation between two live bases.

The last all-green Release matrix passed 74/74 in one uninterrupted
688.11-second invocation. A later full validation passed 72/74 in 768.06
seconds: the economy soak reached turn 60 before its 300-second ceiling, and
the running-reconnect client's process exited normally before its colony marker.
The current sanitizer matrix passed 58/58 in two bounded
invocations: tests 1-29 passed in 752.26 seconds and tests 30-58 passed in 58.47
seconds. The split keeps every command below the 15-minute development limit;
six asset-catalog validation cases account for most of the first half's time.

The general gameplay, AI conquest, AI air, AI hurry, and multiplayer runtime
scenarios use the test-only `--headless` mode. It retains the real asset loaders,
UI scripts, frontend/backend game modules, scheduler, and networking while
replacing graphics, input, and audio with null modules and immediately
acknowledging animation requests. Other runtime scenarios remain rendered:
applying headless mode globally slowed the long economy soak until it timed out,
so the faster path is deliberately selective. The AI hurry test now exits
immediately after its pass condition instead of allowing another AI turn to
start during delayed shutdown. AI hurry and multiplayer each passed five
consecutive fresh-process repeats after these changes.

The long economy soak keeps engine verbosity disabled so CTest does not retain
enough diagnostic output to destabilize later GPU-backed runtime processes;
its explicit milestone and pass/fail assertions remain enabled.

Cross-platform release readiness must be confirmed by clean CI builds and the
same relevant tests on every supported toolchain before shipping.
