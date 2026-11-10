# Bad Commute

A side-view motorbike game about getting your body to work. Any amount of it counts. Ride short courses through machinery, mines, wrecking balls and office furniture. Use the bike's weight to raise ramps and drop bridges, or fire the ejector seat and crawl the rest. A torso over the finish line is an arrival, with or without the bike, a pulse, or the other limbs.

*Attendance is mandatory. Arriving in one piece is not.*

Controls: W/S throttle and brake, A/D lean, Space ejects, R restarts.

Mature content: graphic violence and dismemberment, of the rider and of bystanders, with Reduced and Off settings. "Bad Commute" is a working title and has not been cleared as a brand.

## Run it

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, with the tuning panel on backtick |
| `npm run build` | Type-checks, then builds static files to `dist/` |
| `npm test` | Unit and simulation tests |
| `npm run verify` | Replays a proven route through every course and tag, and checks the campaign rules |
| `npm run solve` | Finds or refreshes those routes. `TRIES=500 npm run solve -- rc-03` for one course |
| `npm run test:embed` | Runs the production build in a sandboxed iframe on the arcade origin, with real input. Needs a build and installed Chrome |

If you change physics or a course, run `npm run solve`, then `npm run verify`.

## Deploying

The build is static and has no backend. By default it uses relative paths, so `dist/` can be served from any folder. To hard-code a subpath instead:

```bash
BASE=/arcade/bad-commute/ npm run build
```

Levels link as `#/level/rc-03`, so they work on static hosting with no rewrite rules. First load is about 250 KB compressed.

## Where things live

| Path | What |
| --- | --- |
| `src/config/tuning.ts` | Global tuning and `PHYSICS_VERSION` |
| `src/vehicles/` | The `VehicleDefinition` and controller contract, and the motorbike |
| `src/sim/` | The fixed-step simulation, damage model and route autopilot. No DOM |
| `src/mechanisms/` | Counterweights, latches, lifts, presses and the rest. `toys.ts` has props, mines, pads, fans, wrecking balls, spikes and bystanders |
| `src/levels/` | Level schema, validator and the 24 courses as data. `dressing.ts` adds the shared scenery |
| `src/render/` | Canvas art, camera, gore and effects. Reads the simulation, never changes it |
| `src/ui/` | HTML menus, HUD and touch controls |
| `src/store/` | Local saves and personal-best ghosts |
| `src/dev/` | Sandbox courses and developer tools. Absent from production builds |
| `scripts/routes/` | Route templates and the solved routes that `verify` replays |

## Docs

- [Decision log](docs/decision-log.md): choices made, and where the build departs from the PRD
- [Level authoring](docs/level-authoring.md): prefab reference, adding a course, the sandbox
- [Physics tuning and versioning](docs/physics-tuning.md)
- [Adding a vehicle](docs/vehicle-extension.md)
- [Test report](docs/test-report.md): what has been verified, and what has not
- [Asset and license manifest](docs/asset-manifest.md)
- [PCKT Games integration](docs/pckt-integration.md)
