# Physics tuning and versioning

All handling lives in `src/vehicles/motorbike/definition.ts`. Global values, including gravity and damage thresholds, live in `src/config/tuning.ts`. On the dev server, press backtick for live sliders. Changes apply on restart.

These numbers are tuned against a bot and headless measurements. **No human has validated the handling yet.**

| Value | Current | Effect |
| --- | --- | --- |
| `SIM.gravity` | 16 | Weight of the whole game. Lower floats |
| `engine.peakTorque` | 262 | Acceleration, and wheelie reaction |
| `engine.topSpeed` | 22 m/s | About 14 bike lengths per second |
| `brake.rearTorque / frontTorque` | 210 / 105 | Raising front too far pitches the bike over |
| `lean.groundTorque` | 380 | Lean authority with both wheels down |
| `lean.wheelieTorque` | 440 | Authority balancing on one wheel |
| `lean.airTorque` | 105 | Air correction |
| `lean.maxPitchRate` | 3.4 rad/s | The cap that stops lean spinning the bike forever |
| `lean.wheelieRate` | 1.15 rad/s | How fast a wheelie can climb. Lower is more forgiving |
| `suspension.rearHz / frontHz` | 6.2 / 6.8 | Stiffness. Sag follows from these and mass |
| `suspension.damping` | 2.1 | Rebound. Below about 1 the bike bounces |
| `DAMAGE.head.lethal` | 6.2 m/s | Contact speed that kills |
| `DAMAGE.limb.sever` | 10.5 m/s | Contact speed that takes a limb |

## After any change

```bash
npm test
```

```bash
npm run solve
```

```bash
npm run verify
```

A route failing after a tuning change usually means a jump or a timing window has moved. Check the course, not only the route.

## Versioning rules

| Version | Bump when | What happens |
| --- | --- | --- |
| `PHYSICS_VERSION` | A shipped build changes how runs play out | Times and ghosts retire from comparison. Completion and banked tags stay |
| `levelVersion` | A shipped course's layout changes | Same, for that course |
| `SAVE_VERSION` | The save shape changes | Add a step to `migrate` in `src/store/progress.ts` |
| `SCHEMA_VERSION` | The level format changes | The validator rejects older data until it is updated |

Records are keyed by vehicle, level version and physics version.

## Order of a simulation step

1. Signals from last step reach mechanisms.
2. Mechanisms move, then the vehicle applies input.
3. The physics world steps.
4. Rider damage resolves. Death latches first.
5. Crush zones, kill regions and bounds.
6. Triggers, if alive.
7. Finish gate, if alive.

Death therefore always beats a finish in the same step.
