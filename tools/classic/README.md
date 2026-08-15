# GLSMAC Classic

GLSMAC Classic is a companion launch path for the four-day rescue release. It
uses the user's installed Alpha Centauri executable with Thinker v5.4 while the
native GLSMAC engine remains available separately as a development preview.
Classic mode is not evidence that the GLSMAC reimplementation is complete.

## Runtime Safety

- The original installation must contain the supported GOG `terranx.exe` with
  SHA-1 `4B19C1FE3266B5EBC4305CD182ED6E864E3A1C4A`.
- The installer verifies the official Thinker v5.4 archive with SHA-256
  `07B610C83E8DE2B3D805E7D33BB12406149E056AFBDEB22FFA2F210B1AEEB507`.
- The complete game directory is copied to
  `%LOCALAPPDATA%\GLSMAC\Classic\5.4` before Thinker is overlaid.
- Saves, configuration, and logs are written to that staged copy. The original
  game directory is not modified.
- An existing nonempty destination without the GLSMAC runtime marker is never
  overwritten.

## Base-Game Profile

The launcher always passes `-smac`. It also removes entries from Thinker's
`#NEWFACTIONS` catalog, excludes faction slots 8-14 from random selection, and
disables expansion-only native spawns. Thinker's improved AI remains enabled,
while the included `thinker_user.ini` restores original reactor combat, hurry
costs, unit limits, map generation, repair rates, and other major rule defaults.

## Distribution

The release package may contain the unmodified official Thinker v5.4 archive
and its MIT license. It must not contain Firaxis executables, artwork, audio,
movies, text, or other proprietary game assets. Each user supplies an installed
copy of Sid Meier's Alpha Centauri Planetary Pack.
