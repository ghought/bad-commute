# Decision log

## Stack

| Decision | Why |
| --- | --- |
| **Planck 1.5.1** for physics (MIT) | Mature Box2D port with the joints, filtering and continuous collision the PRD asks for. Pure JavaScript, so it adds about 60 KB compressed, needs no WASM, and runs headless in Node. The headless run is what makes the route verifier possible. |
| **TypeScript and Vite**, exact versions pinned | Matches the other PCKT games. |
| **Canvas 2D**, not WebGL | The art is flat illustrated shapes with pattern fills, a few dozen paths per frame. Canvas keeps it simple. Move to WebGL only if real-device profiling asks for it. |
| **Fixed 60 Hz simulation** with interpolation | As specified. Catch-up is limited to 4 steps per frame. Sustained overload pauses the game rather than changing physics. |
| **Procedural art and synthesized audio** | Original by construction, nothing to license, and first load stays near 250 KB. |

## How things work, where the PRD left it open

- **Mechanisms are kinematic and driven by logic**, not free rigid bodies. A plate's position comes from a phase value that the bike's contact advances. This makes machinery repeatable, trivially resettable and impossible for debris to push. Momentum still counts: hitting a plate fast buys extra travel at once.
- **The rider is a real articulated rig**: torso, head and two-segment limbs, jointed to the bike. Limbs are light, and limb mass that comes off moves to the torso, so handling stays the same.
- **WheelJoint has no travel limits** in Planck, so bump stops are applied in the controller.
- **Brake is split front and rear** so holding it at speed cannot pitch the bike over the front wheel. Found by a test, not by design.
- **Restart builds a new physics world.** Nothing survives from the last attempt by construction.
- **Cutters use continuous collision** with bullet bodies and disabled contact response, so a limb registers the cut and passes through.
- **Crushes** use an authored zone under the press, plus a press-contact rule. Flattening is drawn by the renderer, and the press then passes through what is left.
- **Conveyors** use contact tangent speed. Coasting drag lets a belt carry a parked bike.

## Departures from the PRD, to review

| PRD | What was built | Why, and what to decide |
| --- | --- | --- |
| Milestone A gate: owner plays before full level production | All 20 courses were built without waiting | You asked for the whole game. The risk is that a handling change invalidates courses. `npm run solve` and `verify` make re-validation cheap, but it needs your feel check. |
| Runs of 30–90 seconds, intro 15–30 | The route bot finishes courses in about 6–30 seconds | Courses are shorter than specified. A first human run takes longer, but expert times will be short. Decide after playing whether to lengthen them. |
| Medal thresholds authored after playtesting | Derived from bot times (gold about 3% over its best run) | Provisional. Needs human playtests. |
| Lazy-load districts and audio | Everything is in one bundle | The entire game is about 250 KB compressed, under the 5 MB budget, so lazy loading would add complexity for nothing. |
| Reduced/Off gore: limbs | Off hides a detached limb rather than drawing it attached | A small simplification of how Off looks. Outcomes are unchanged. |
| Opt-in playtest logs | Not built | Marked optional for launch. |
| Gamepad | Not built | Post-v1 in the PRD. |

## Second pass, 2026-11-09: making it funnier

The first build was judged decent but not fun or absurd enough for people who like ragdoll crash games. This pass changed core input and the violence, so it is recorded here.

| Change | What and why |
| --- | --- |
| **Any torso over the line counts** | A finish is recorded as `riding`, `loose` (alive, off the bike) or `dead`. All three complete the course and can earn a medal. The results screen says which, and what percentage of the rider arrived. This is now the game's joke: attendance is attendance. |
| **A fifth input: the ejector seat** | Space or X, and a BAIL button on touch. The PRD specified four inputs. It does not start the clock. Off the bike, throttle and brake heave the rider along the ground and the lean keys roll them. |
| **Death no longer ends the attempt at once** | The world keeps running. A dead body still loses limbs to saws and hard hits. The report appears when the body has lain still for 1.5 s, after 7 s, or at once for a pit or the edge of the map. A living rider lying still with no input for 5 s has given up. |
| **Knocked off before killed** | Head hits from 5.2 m/s and torso hits from 6.4 m/s unseat a rider. Lethal moved up to 7.4 and 9.4. |
| **Bystanders can be hit and decapitated** | Inspectors, managers and interns stand on courses and past every finish line. This is more violence than the first build, against people other than the rider. Gore settings apply to them. Decide whether this suits the hub. |
| **Loose props and explosives** | Boxes, crates, coolers, cones, carts, chairs, bins, balls and barrels are dynamic bodies. Mines and red barrels explode and chain. |
| **Props and bystanders retire** | 1.5 s after its first knock a prop or bystander stops touching anything but the ground. Without this they piled up at ramp bases and jammed courses. It also keeps the old rule: debris never ends up deciding a route. |
| **Bystanders are punted just before contact** | A bike faster than 3 m/s throws them clear a fraction early. Without it a front wheel rode up a body and flipped the bike. |
| **Props never use up a bounce pad** | A cone pushed ahead of the bike was spending the pad's cooldown, and the bike fell in the pit. |
| **New machines** | Punch pads, fans, wrecking balls and spikes. Fans accelerate every body equally so the bike lifts level. |
| **A fourth district, Overtime** | Four courses built on the new toys, open from the start so new players reach them at once. The campaign is now 24 courses. `ot-24` can only be finished on foot, and is flagged `onFoot` for the verifier. |
| **Scenery is added by `dress()`** | Flat stretches get a set piece, and every finish gets a welcome party. It is deterministic and the result is plain data. `lz-11` is left bare because the boxes broke its tag route. |
| **`PHYSICS_VERSION` is 2** | Old times and ghosts retire from comparison. Completion is kept. |
| **Camera is closer** | View height 10.4 m, was 11.5, so the rider's face reads. |

Still true: gore settings never reach the simulation, and detached limbs touch only the ground.

Not done in this pass: courses are still short, medals still come from bot times, and none of it has been played by a person.
