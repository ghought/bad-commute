# PCKT Games integration

The game is ready for the arcade but has **not** been added to it. `public/pckt-bridge.js` is the hub's adapter, version 1. The game declares `pause`, `mute` and `restart`, sends `playStarted()` on the first riding input, and sends `roundEnded({ score, level, outcome, seconds })` on a finish, or when the attempt is over (the body has stopped, or the rider has given up). `score` is the number of completed courses.

`npm run test:embed` proves all of this from a sandboxed iframe on `https://pckt.up.railway.app`.

## To publish

1. **Decide whether this content belongs in the arcade.** Everything else there is lighter, and this game has graphic dismemberment by default, of the rider and of bystanders who can be run over and decapitated. The first-launch notice applies inside the iframe too, but the hub has no age gate.
2. Deploy `dist/` somewhere public. GitHub Pages or Cloudflare both work. Keep `allowedParents` in `src/main.ts` in step with the hub origin.
3. Make a cover with `npm run art` in the hub. A good object: the rider mid-eject with his tie flying, or the red barrel with the warning diamond.
4. Add the entry to `content/games.ts`, starting as a draft:

```ts
{
  id: 'bad-commute',
  slug: 'bad-commute',
  title: 'Bad Commute',
  shortDescription: 'Get your body to work. Any amount of it counts.',
  instructions: [
    'W or Up to ride. S or Down to brake, and hold at rest to reverse. A and D, or Left and Right, to lean.',
    'Space fires the ejector seat. Off the bike, throttle heaves you along and the lean keys roll you.',
    'On a phone, use the on-screen buttons in landscape.',
    'Any part of you over the finish line counts. R restarts instantly.',
  ],
  category: 'action',
  tags: ['motorbike', 'physics', 'ragdoll', 'stunts', 'gore', 'explosions', 'trials'],
  coverUrl: '/covers/bad-commute.webp',
  coverAlt: 'An office worker in a hard hat and tie, thrown from a motorbike, paperwork in the air.',
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
  contentNotes: ['Mature: graphic violence and dismemberment, including of bystanders. Reduced and Off settings are available.'],
  adapterVersion: 1,
  capabilities: { pause: true, mute: true, restart: true, roundEvents: true, localSave: true },
  allowExternalOpen: true,
},
```

5. Test from the real hub origin on a real iPhone and a real Android phone. Then set `status: 'published'`.
