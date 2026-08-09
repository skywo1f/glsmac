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
  assignment, production queues, and support;
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
- social engineering and the facility/project effects that depend on it;
- ecological damage, fungal blooms, and several Planet-related effects;
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

The Release CTest matrix contains 70 cases: 54 isolated native/script GSE tests
and 16 asset-backed runtime scenarios. All current cases pass in one
uninterrupted invocation on the tested Windows machine. The same 54 GSE cases
also pass in the MSVC AddressSanitizer configuration. Script isolation keeps
allocator lifetime bounded and reports the exact script that fails.

The long economy soak keeps engine verbosity disabled so CTest does not retain
enough diagnostic output to destabilize later GPU-backed runtime processes;
its explicit milestone and pass/fail assertions remain enabled.

Cross-platform release readiness must be confirmed by clean CI builds and the
same relevant tests on every supported toolchain before shipping.
