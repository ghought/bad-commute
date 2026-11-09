# Bad Commute

Read `docs/decision-log.md` before changing core input, violence, platform support or the signature mechanic. Surface those changes rather than quietly simplifying.

- Physics or course change: run `npm run solve`, then `npm run verify`. Bump `PHYSICS_VERSION` once a build has shipped.
- The simulation (`src/sim`, `src/mechanisms`, `src/vehicles`) must stay free of DOM, rendering and storage. A test enforces it.
- Gore settings change only how things look and sound. Never let them reach the simulation.
- Detached limbs and debris must never touch machinery, triggers or the bike.

## PCKT Games compatibility

Must work on its own URL and in a sandboxed cross-origin iframe (`allow-scripts allow-same-origin`). Static files, relative paths, hashed assets, self-hosted fonts. No `alert`, `confirm`, `prompt`, popups or top-window navigation. Audio starts after a user gesture, through one master gain. One pause path freezes the simulation and suspends audio. All storage is wrapped so the game runs if it is denied. `public/pckt-bridge.js` is copied from `ghought/pckt-games` and does nothing when the game runs alone.
