# PCKT Games integration

The game is ready for the arcade but has **not** been added to it. `public/pckt-bridge.js` is the hub's adapter, version 1. The game declares `pause`, `mute` and `restart`, sends `playStarted()` on the first riding input, and sends `roundEnded({ score, level, outcome, seconds })` on a finish or a crash. `score` is the number of completed courses.

`npm run test:embed` proves all of this from a sandboxed iframe on `https://pckt.up.railway.app`.

## To publish

1. **Decide whether this content belongs in the arcade.** Everything else there is lighter, and this game has graphic dismemberment by default. The first-launch notice applies inside the iframe too, but the hub has no age gate.
2. Deploy `dist/` somewhere public. GitHub Pages or Cloudflare both work. Keep `allowedParents` in `src/main.ts` in step with the hub origin.
3. Make a cover with `npm run art` in the hub. A good object: a flattened bike under a red-and-black press, or the crooked headlight.
4. Add the entry to `content/games.ts`, starting as a draft:

```ts
{
  id: 'bad-commute',
  slug: 'bad-commute',
  title: 'Bad Commute',
  shortDescription: 'Move the city’s machinery to build your own route across it. Try not to be part of it.',
  instructions: [
    'W or Up to ride. S or Down to brake, and hold at rest to reverse. A and D, or Left and Right, to lean.',
    'On a phone, use the on-screen buttons in landscape.',
    'Stop on plates to raise ramps. Hit amber latches to drop bridges. Time the moving platforms.',
    'Red and black will kill you. R restarts instantly.',
  ],
  category: 'action',
  tags: ['motorbike', 'physics', 'stunts', 'gore', 'puzzle', 'trials'],
  coverUrl: '/covers/bad-commute.webp',
  coverAlt: 'A battered motorbike under a descending red-and-black industrial press.',
  launchUrl: 'https://YOUR-HOST/bad-commute/',
  allowedOrigin: 'https://YOUR-HOST',
  version: '1.0.0',
  status: 'draft',
  publishedAt: '2026-11-08',
  editorialOrder: 9,
  devices: ['touch', 'keyboard'],
  orientation: 'landscape',
  aspectRatio: 1.7778,
  estimatedRoundSeconds: 60,
  contentNotes: ['Mature: graphic violence and dismemberment. Reduced and Off settings are available.'],
  adapterVersion: 1,
  capabilities: { pause: true, mute: true, restart: true, roundEvents: true, localSave: true },
  allowExternalOpen: true,
},
```

5. Test from the real hub origin on a real iPhone and a real Android phone. Then set `status: 'published'`.
