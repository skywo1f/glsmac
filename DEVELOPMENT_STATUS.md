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
  research;
- original-SMAC distance-based energy inefficiency, including EFFIC modifiers,
  Children's Creche bonuses, no-headquarters fallback, and starting capitals;
- original-SMAC ecological damage based on local terraforming, worked squares,
  mineral production, ecology facilities, difficulty, discovered technology,
  PLANET rating, native-life setting, and perihelion;
- persistent faction-wide fungal-bloom counts, host-authored reversible fungus
  eruptions, and live Eco Damage values on the base screen;
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
- 245 generated unit designs, 14 predefined units, and 68 unit components.

These counts describe implemented definitions and automated coverage. They do
not mean that the game is feature-complete or balanced.

## Release Blockers

The following original-SMAC systems remain absent or materially incomplete:

- diplomacy, treaties, pacts, vendettas, commerce, council elections, and
  diplomatic victory;
- probe-team actions, infiltration, subversion, and mind control;
- remaining social effects: adoption costs, commerce thresholds, low-MORALE
  modifier halving, SUPPORT new-base mineral penalties, full police and
  away-unit behavior, and probe integration;
- headquarters relocation, uniqueness, and capture-transfer behavior, plus
  explicit player-facing inefficiency diagnostics;
- native-life outbreaks from fungal blooms, an independent wild Planet faction,
  global warming, sea-level changes, volcanoes, atrocity modifiers, several
  ecology-related Secret Project effects, and the original engine's
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

The Release CTest matrix contains 74 cases: 58 isolated native/script GSE tests
and 16 asset-backed runtime scenarios. All current cases pass in one
uninterrupted invocation on the tested Windows machine. The same 58 GSE cases
also pass in the MSVC AddressSanitizer configuration. Script isolation keeps
allocator lifetime bounded and reports the exact script that fails.

The current Release matrix passed 74/74 in one uninterrupted 745.67-second
invocation. The current sanitizer matrix passed 58/58 in two bounded
invocations: tests 1-29 passed in 752.26 seconds and tests 30-58 passed in 58.47
seconds. The split keeps every command below the 15-minute development limit;
six asset-catalog validation cases account for most of the first half's time.

The AI conquest and AI air runtime scenarios use the test-only `--headless`
mode. It retains the real asset loaders, UI scripts, frontend/backend game
modules, scheduler, and networking while replacing graphics, input, and audio
with null modules and immediately acknowledging animation requests. Other
runtime scenarios remain rendered: applying headless mode globally slowed the
long economy soak until it timed out, so the faster path is deliberately
selective. A fixed 100 ms air-unit lifecycle assertion was also replaced by a
bounded asynchronous poll after the old check intermittently ran one callback
before the expected despawn; the corrected scenario passed five consecutive
fresh-process repeats.

The long economy soak keeps engine verbosity disabled so CTest does not retain
enough diagnostic output to destabilize later GPU-backed runtime processes;
its explicit milestone and pass/fail assertions remain enabled.

Cross-platform release readiness must be confirmed by clean CI builds and the
same relevant tests on every supported toolchain before shipping.
