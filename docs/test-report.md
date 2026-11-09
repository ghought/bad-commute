# Test report

Date: 2026-11-08. Node 22.13. Chrome (installed, headless) through Playwright 1.65.

## Verified by automation

| Check | Result |
| --- | --- |
| Unit and simulation tests (`npm test`) | 95 passed |
| Campaign validation, 20 levels, 16 route-changing | Passed |
| Mandatory route on all 20 courses, ridden by a bot pressing only the four actions | Passed |
| Optional tag reached on all 20 courses | Passed |
| Checkpoint routes on levels 7, 14 and 20 | Passed |
| Same route replays to the same result | Passed |
| Sandboxed cross-origin iframe, subpath, whole bridge protocol (`npm run test:embed`) | Passed |
| Level 1 finished with real keyboard input and real frames, in the production build | Passed |
| Storage denied, refresh keeps progress, locked deep link, portrait prompt, touch target size | Passed |
| 100 crash-and-restart cycles in Chrome | Bodies constant (20), audio loops constant (4), effects cleared, restart about 1.2 ms |
| Production bundle | About 250 KB compressed in total. JavaScript 90 KB |
| Dev tools absent from the production build | Confirmed |

## Acceptance criteria

| ID | State | Notes |
| --- | --- | --- |
| AC-01 | Automated | In-context, input-aware prompts. Comprehension needs people |
| AC-02 | Automated | Four pointers, cancellation and blur covered |
| AC-03 | Automated, **needs human feel check** | |
| AC-04 | Automated | |
| AC-05 | Passed | 16 of 20 |
| AC-06 | Automated | Equivalence is structural: the simulation cannot see gore settings, and a test enforces it |
| AC-07 | Automated | |
| AC-08 | Partly | About 1.2 ms in desktop Chrome. Not measured on phones |
| AC-09 | Automated | "No impossible touch-only maneuvers" holds because the bot uses the same four actions. Real thumbs are untested |
| AC-10 to AC-16 | Automated | |

## Not verified

- **No real-device testing.** No real iPhone or Android, so touch feel, audio, thermals, browser chrome and frame rate on phones are unknown. Phone layout was only checked in emulation at 667×375.
- **Desktop Safari and Firefox have not been run.** Only Chrome.
- **Frame rate is not profiled.** The 60 fps target is unmeasured on the agreed test devices.
- **No human playtests.** Handling feel, hazard readability, difficulty, medal times and the "four of five testers" target are all open.
- **Audio has been written but not listened to.** Nothing in this environment can hear it. Expect to adjust the mix.
- **The ghost has only partial coverage.** Recording, compatibility and playback maths are unit tested. It has not been seen on screen during a real run.

## Known limitations

- Courses run shorter than the PRD's 30–90 seconds.
- Bot routes prove a course is possible. They do not prove it is fun or fair.
- Blood lands on static surfaces only, not on moving machinery.
- With gore Off, a detached limb disappears rather than staying drawn on the rider.
