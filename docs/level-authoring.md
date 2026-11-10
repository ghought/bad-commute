# Level authoring

Courses are plain data in `src/levels/data/`. The schema and validator are in `src/levels/schema.ts`: unknown fields, broken references, duplicate ids, bad geometry and malformed checkpoints are all rejected. You never need to touch the simulation to add a course.

Coordinates are metres, x right, y up. Road level is usually y = 0. The bike is about 2 m long and needs 2.2 m of headroom.

## Add a course

1. Add a `level({...})` entry to a district file. Copy the nearest existing one. Set `order`, a unique `levelId`, and `routeChanging`.
2. Terrain is a list of polylines. Include the vertical faces at gaps, like `[20, 0], [20, -8]`, or the bike will pass through the side.
3. Mark pits with `killRegions: [pit(x0, x1)]`.
4. Add a route to `scripts/routes/templates.ts`, with a `main` and a `tag`. Add `checkpoint` if the course has one.
5. Run `TRIES=300 npm run solve -- your-id`, then `npm run verify`.
6. Set medal times after playing it.

If a course changes after shipping, bump its `levelVersion`. Old times and ghosts retire automatically; completion is kept.

## Prefabs

| Type | What it does | Key fields |
| --- | --- | --- |
| `counterweight` | Plate sinks under the bike. Optionally raises a linked ramp and signals targets | `x y w travel`, `ramp: {x y len a0 a1}`, `down up hold`, `targets threshold` |
| `tilt` | Beam on a pivot, tips toward the bike's side | `x y left right minA maxA initial rate`, `returnRate`, `style` |
| `latch` | Amber lever. Any bike contact trips it once | `x y targets` |
| `brace` | Solid amber strut, breaks above a contact speed | `x y w h minSpeed targets` |
| `bridge` | Hinged span, falls when released. Negative `len` hinges at the right | `x y len upAngle downAngle fall` |
| `cargo` | Load following a fixed path once released. Signals targets on arrival | `w h path duration targets style` |
| `conveyor` | Surface speed. Sit it in a notch so its top is flush | `x y w speed onActivate` |
| `lift` | Platform between two stops, on a cycle or once when released | `ax ay bx by w speed waitA waitB phase mode style crushFloor` |
| `swing` | Level platform on parallel arms | `x y rod w amplitude period phase` |
| `shutter` | Roller door. Lethal while closing | `x floor height opening openTime holdTime closeTime mode` |
| `cutter` | Spinning disc. Cuts what it touches | `x y r`, optional `bx by period` travel |
| `compactor` | Press on a fixed cycle | `x w top floor rest warn slam hold rise phase` |

Set `crushFloor` on any lift that descends onto a road, otherwise it will push the bike through the floor.

`targets` link prefabs by id. Signals deliver on the next simulation step.

## Toys

These came in the second pass. All are prefabs, validated like the rest.

| Type | What it does | Notes |
| --- | --- | --- |
| `prop` | A loose object: `box`, `crate`, `cone`, `barrel`, `tnt`, `cooler`, `cart`, `chair`, `bin`, `ball` | Boxes, crates and coolers break. `tnt` explodes on a hit of 5.5 m/s or in another blast. `y` is the floor it stands on |
| `mine` | Explodes when anything solid touches it | Lethal within about 1.8 m, unseats within 4.4 m |
| `spring` | A pad that throws whatever lands on it at `power` m/s along its normal | Flush with the floor. Negative `angle` throws forward |
| `fan` | A column of air, `accel` in m/s² against a gravity of 16 | About 23 hovers the bike a metre or two up. 30 or more throws it |
| `wrecker` | A wrecking ball on a fixed swing | Route holds read its `cycle`, 0 to 1. The ball is rising towards the near side from about 0.63 |
| `spikes` | Kills the rider and stops the bike | Bodies that land on it stay there |
| `npc` | A bystander: `inspector`, `manager` or `intern` | Punted clear by a fast bike |

`src/levels/dressing.ts` has helpers: `props(kind, spots)`, `stack(kind, x, y, cols, rows, taper)` and `npc(x, y, look)`. Its `dress()` adds a set piece to long flat stretches and a welcome party past each finish. Add a level id to `PLAIN` or `NO_PARTY` there to opt out.

Things learned the hard way:

- **Do not put loose props just before a ramp, pad or mine.** They get pushed ahead of the bike. A cone will set off a mine. A barrel will travel 18 m.
- **Do not put a bystander before mines.** They are punted further than the bike jumps.
- A prop or bystander stops blocking 1.5 s after its first knock, so a jam is not possible, but a slow bike can still be held up for that long.
- Set `onFoot: true` on a course that can only be finished off the bike. The verifier then accepts an arrival on foot.
- Run `node_modules/.bin/tsx` on a throttle-only script before solving: a new player holds throttle and nothing else, and the first course must survive that.

## Hazard language

Red and black means it can kill you. Amber means hit this. A bright cream edge means you can ride on it. Keep to that.

## Checkpoints

A checkpoint stores an authored spawn and the state each mechanism should be in, not a snapshot:

```ts
checkpoint: { x: 78, y: 0, h: 5, spawn: { x: 80, y: 0.8 }, restore: { latch: { released: true }, bridge: { released: true } } }
```

## Developer tools

On the dev server, press backtick for collision and trigger overlays, live handling sliders, and the five sandbox courses with named spawn points. `#/sandbox/1` to `#/sandbox/5` open a sandbox course directly. Editing level data reloads the page. A performance readout runs in the corner.
