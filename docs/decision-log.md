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
