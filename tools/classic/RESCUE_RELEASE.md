# GLSMAC Classic + Preview

This rescue package provides two deliberately separate launch paths.

## Play GLSMAC Classic

`Play-GLSMAC-Classic.cmd` launches the complete original Alpha Centauri engine
with the MIT-licensed Thinker v5.4 patch and its improved AI. On first launch,
select an installed Sid Meier's Alpha Centauri Planetary Pack directory. The
bootstrapper verifies the supported executable and copies the installation to
`%LOCALAPPDATA%\GLSMAC\Classic\5.4` before applying Thinker.

Classic mode targets the seven original factions. Crossfire faction choices and
expansion-only native units are removed. Major game-rule changes in the normal
Thinker profile are disabled in favor of original SMAC behavior.

Classic mode is the dependable play path, but it is not the native GLSMAC
engine. Its multiplayer remains the original game's DirectPlay-based system.

## Play GLSMAC Preview

`Play-GLSMAC-Preview.cmd` launches the native OpenGL/SDL2 reimplementation. It
uses a package-local profile and asks for the original asset directory if one
has not been configured. This path contains the new renderer, scripting system,
network implementation, AI, and gameplay work.

The Preview is still under development. Automated coverage includes save/load,
multiplayer reconnect, six-AI economy, and the major gameplay systems, but long
campaign balance, adversarial multiplayer soak testing, remaining information
boundaries, richer diplomacy, accessibility, and broad manual operating-system
coverage are not yet release-complete. It should not yet be treated as a
finished replacement for the original engine.

## Legal And Safety Notes

- The package does not contain Firaxis executables, artwork, audio, movies,
  text, or other proprietary game assets.
- Classic mode requires the supported `terranx.exe` supplied by the user.
- The original installation is not modified. Classic saves and settings live
  in the staged Local AppData runtime.
- Thinker v5.4 is redistributed under its included MIT license.
- GLSMAC remains licensed under AGPL-3.0.
