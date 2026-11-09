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

## Hazard language

Red and black means it can kill you. Amber means hit this. A bright cream edge means you can ride on it. Keep to that.

## Checkpoints

A checkpoint stores an authored spawn and the state each mechanism should be in, not a snapshot:

```ts
checkpoint: { x: 78, y: 0, h: 5, spawn: { x: 80, y: 0.8 }, restore: { latch: { released: true }, bridge: { released: true } } }
```

## Developer tools

On the dev server, press backtick for collision and trigger overlays, live handling sliders, and the five sandbox courses with named spawn points. `#/sandbox/1` to `#/sandbox/5` open a sandbox course directly. Editing level data reloads the page. A performance readout runs in the corner.
