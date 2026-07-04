# 💎 Crystal Cascade — Project Story

> *How a 3D match-three puzzle game found its home inside Reddit.*

## Inspiration

There were two threads that came together to make Crystal Cascade happen.

The first was a personal one. As a software engineer, I spend most of my day thinking in abstractions — system design, data flows, debugging logic. But coding is a slow, deliberate kind of thinking. I wanted something that trained a different side of my brain: **faster decision-making, sharper pattern recognition, and quicker reactions under pressure**. I started playing games like Candy Crush Saga during breaks — not casually, but intentionally, using them as a daily exercise to sharpen the kind of split-second spatial reasoning and critical thinking that makes you a better engineer over time. Match-three games turned out to be surprisingly effective at this. The constant need to scan the board, anticipate chain reactions three moves ahead, and act quickly before the window closes is a genuine cognitive workout.

That experience gave me deep respect for what great match-three design actually achieves. It's not just entertainment — it's a focused mental training loop disguised as play.

The second thread was a frustration with Reddit. Reddit is where millions of people go to share ideas, debate topics, and build communities around the things they love — including games. Yet when you visit a gaming subreddit, the most interactive thing you can do is upvote a screenshot or leave a comment.

I kept asking: *what if the post itself was the game?*

Match-three games sit at an elegant intersection of accessibility and depth. The rules are immediately understood by anyone — align three gems, watch them disappear — but the underlying strategy around chain reactions, combo multipliers, and special power-up interactions creates a surprisingly rich decision space.

The launch of Reddit's **Devvit platform** changed the equation. Suddenly, it was possible to embed a fully interactive experience directly inside a Reddit post — the same post your friends are commenting on, the same feed you scroll every morning. That proximity to community felt like a design constraint worth building around, not escaping from.

The name *Crystal Cascade* captures the feeling I was chasing: the satisfying visual and audio cascade of chain reactions, the sense that each move could set off something much larger than itself — and the same feeling of mental clarity that comes from locking in on a pattern and executing it fast.

## What it does

Crystal Cascade is a **premium 3D match-three puzzle game** that lives natively inside Reddit posts via Devvit's custom post webview.

Players look down at a glowing 8×8 grid of coloured gems rendered in real-time 3D using WebGL and Three.js. The goal on each level is to **clear all the stone blocks** hidden beneath the gem layer within a fixed number of moves.

Matching gems causes them to shatter and fall, damaging any blocks underneath. But the real depth comes from the **special crystal system**:

| Match Pattern | Crystal Created | Effect |
|---|---|---|
| 4 in a row/column | Striped Crystal | Clears entire row or column |
| L-shape or T-shape | Wrapped Crystal | Blasts a 3×3 area |
| 5 in a line | Rainbow Crystal | Removes every gem of one colour |
| 2×2 square | Square Blast | Area explosion around the match |

When two specials are swapped together, they combine into escalating super-combos — a Rainbow + Striped clears every gem of a colour in a full row, a double Rainbow wipes the entire board.

The game ships with **5 hand-tuned levels** of increasing difficulty, followed by an **infinite procedural mode** where levels are generated on the fly. An **AI Auto-Play mode** demonstrates optimal play patterns and provides an accessibility path for players who want to watch rather than play.

All sound is synthesised live using the **Web Audio API** — no audio files, no bandwidth cost, just pure procedurally generated feedback tuned to match game events.

## How we built it

The project went through two distinct phases:

### Phase 1 — Standalone prototype

The first version was a standard Vite + React application. It established the core game architecture:

- **`GameEngine.tsx`** — a 1 500-line Three.js rendering loop managing the board state, gem meshes, tween animations, raycasting for touch/click input, particle effects, and the match resolution pipeline.
- **`HUD.tsx`** — a React overlay tracking moves, objectives, and level progress.
- **`Overlay.tsx`** — animated modal cards for level start, win, and lose states.
- **`audio.ts`** — a Web Audio API synthesiser class that generates pentatonic-scale tones, pitched higher with each combo multiplier.

The board state is modelled as a flat typed array of `GemCell | BlockCell | null`, making match detection and cascade resolution straightforward to reason about. Match-finding runs in $O(n^2)$ time over the board:

$$
\text{matches} = \bigcup_{r=0}^{N-1} \text{rowRuns}(r) \;\cup\; \bigcup_{c=0}^{N-1} \text{colRuns}(c) \;\cup\; \text{squares}_{2\times2}
$$

where $N = 8$ is the board dimension and each run is a maximal contiguous sequence of identical gem types of length $\geq 3$.

Special crystal spawning position is determined by:

$$
\text{spawnIndex} = \begin{cases} \text{lastSwap position} & \text{if lastSwap} \in \text{run} \\ \lfloor \frac{\text{runStart} + \text{runEnd}}{2} \rfloor & \text{otherwise} \end{cases}
$$

### Phase 2 — Devvit migration

Once the game logic was solid, we migrated the entire codebase into the **Devvit scaffold** under `crystal-cascade/src/client/`. This required:

1. **Replacing Phaser** — the default Devvit template ships with Phaser; we removed all Phaser scenes and replaced `game.ts` with `game.tsx`, mounting our React application into the webview root.
2. **CSS consolidation** — Vite's separate `index.css` and `App.css` had to merge into a single `game.css` that the Devvit bundler could resolve.
3. **TypeScript strictness** — Devvit's `tsconfig.base.json` enables `exactOptionalPropertyTypes`, which caught several subtle typing errors in our toast notification system where `icon?: T` could not be spread alongside `undefined` values without explicit conditional handling.
4. **JSX support** — the client `tsconfig` needed `"jsx": "react-jsx"` added, which the Phaser template doesn't include.

### Icon system

To eliminate emojis from all game UI (which render inconsistently across platforms and operating systems), we built a lightweight **`Icon.tsx`** component:

```tsx
// 11 named SVG icons, zero external dependencies
<Icon name="zap" size={16} />  // renders inline SVG
```

Every `showToast()` call now carries a named icon alongside the text, rendered as a crisp inline SVG that looks identical across every device.

### Level design & winnability

Each level was verified against a custom `check_levels.mjs` script that runs Monte Carlo simulations of random play, confirming that every level has a positive expected win rate before shipping:

$$
P(\text{win}) = \frac{\text{simulated wins}}{N_{\text{trials}}} > 0 \quad \forall \text{ levels}
$$

## Challenges we ran into

### 1. The dead-board problem

The most stubborn bug: after a cascade of matches, the board could reach a state where **no valid swap produced a match**. The naive fix (shuffle immediately) caused jarring visual jumps. The real fix required implementing `checkMatchesOnly()` — a fast pass that detects valid moves without triggering effects — and ensuring the shuffle preserved all existing special crystals in place while only rearranging normal gems.

A subtler version of the same problem appeared in the shuffle validator itself: the original `checkMatchesOnly()` didn't detect **2×2 square matches**, so after shuffling it would sometimes declare the board dead even though a square match was sitting right there. Fixing this required unifying the match detection logic between `findMatches()` (gameplay) and `checkMatchesOnly()` (shuffle validation).

### 2. Special crystal near-miss seeding

Early playtesting revealed that Striped and Rainbow crystals rarely appeared naturally, because the random board initialiser almost never seeds the near-miss patterns (4 gems of one colour with one gap) that make them easy to earn in the first few moves. We implemented `plantNearMisses()` — a post-initialisation pass that deliberately inserts `A A _ A` row/column patterns into the board without creating immediate matches. This significantly improved the frequency of special crystal creation in normal play.

### 3. Devvit's `exactOptionalPropertyTypes`

When migrating to Devvit's strict TypeScript config, the pattern `{ id, text, icon }` where `icon` could be `undefined` caused the type error:

```
Type 'undefined' is not assignable to type 'IconName'
```

Because `exactOptionalPropertyTypes` treats `prop?: T` as strictly `T`, not `T | undefined`. The fix was to conditionally spread the property:

```ts
const item: ToastItem = icon !== undefined
  ? { id, text, icon }
  : { id, text };
```

### 4. Responsive layout in Reddit's webview

Reddit embeds the webview at whatever dimensions the native app decides — which varies wildly between a Reddit desktop sidebar, a mobile app full-screen, and a tablet split view. Getting the HUD, 3D canvas, and objectives footer to coexist across all these sizes required three distinct CSS breakpoints: `≤ 720px` (grid HUD), `≤ 400px` (compact phones), and `max-height: 500px` landscape (flat row HUD with hidden secondary elements).

## Accomplishments that we're proud of

- **Zero audio files.** Every sound in the game — match tones, cascade chimes, combo escalation — is synthesised in real-time from pure Web Audio API oscillators. The pentatonic scale ensures it always sounds pleasant regardless of how fast the player triggers sounds.

- **A genuinely fair shuffle.** The board shuffle algorithm guarantees that after reshuffling, at least one valid match exists *and* the board is not in a state that would immediately auto-match. This required iterative re-shuffling with validation, capped at 200 attempts before falling back to a deterministic arrangement.

- **Type safety under extreme strictness.** Devvit's `tsconfig` is configured with every strict flag enabled — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`. We achieved zero TypeScript errors under this configuration across ~3 000 lines of game code.

- **A premium visual experience in a Reddit post.** The glassmorphism HUD cards, gradient title typography, and smooth 60fps gem animations look as polished as a native mobile app — inside a Reddit post.

## What we learned

**WebGL in a webview is fast, but you have to manage the context manually.** Three.js's `WebGLRenderer` doesn't know about React's lifecycle, so every time `playEvent` triggered a board reset we had to explicitly dispose all geometries, materials, and the renderer itself before re-creating them. Memory leaks from un-disposed Three.js resources were invisible at first but caused the game to slow down after several level restarts.

**Devvit's bundler is not Vite.** Even though the project uses Vite under the hood, Devvit wraps it with its own config that has strong opinions about code splitting, sourcemap naming, and module resolution. Several patterns that work in a normal Vite app fail silently or with opaque errors in the Devvit build pipeline — reading the actual bundler output carefully was essential.

**Match-three game design is harder than it looks.** The rules of match-three are simple, but designing levels that feel fair, satisfying, and progressively challenging without a level editor or playtest team requires a surprising amount of mathematical reasoning about board state probabilities, expected gem distributions, and combo likelihood under different move constraints.

**Emoji are not portable.** What renders as a glowing diamond on macOS is a grey box on certain Android versions and a different shape entirely on some Linux terminals. Replacing every emoji in the game UI with inline SVG icons was a net improvement in every measurable way — consistency, size, accessibility, and style control.

## What's next for Crystal Cascade

### Near-term
- **Leaderboard** — store high scores per-level in Devvit's Redis KV store, surfaced on the splash screen as a community scoreboard
- **Daily Challenge** — one shared board configuration per day, seeded from the current date, so the entire Reddit community plays the same puzzle and can compare results in the comments

### Medium-term
- **Subreddit skins** — themed gem colour palettes that automatically apply based on which subreddit the post lives in (e.g. space-themed gems for r/space, nature colours for r/EarthPorn)
- **Hints system** — a subtle glow effect on one valid swap when the player hasn't moved in 10 seconds, helping new players learn without breaking immersion
- **Accessibility mode** — shape-coded gems (circle, square, triangle, diamond, hexagon, star) as an alternative to colour-only differentiation

### Long-term
- **Cooperative mode** — two Reddit users play the same board simultaneously, each seeing the other's cursor position, racing to clear blocks together
- **Community-created levels** — a level editor embedded in a Devvit moderator panel, letting subreddit mods publish custom Crystal Cascade levels for their community

> *Every cascade starts with a single swap. So does every great project.*

**Repository:** [EmmaTheDev01/crystal_cascade](https://github.com/EmmaTheDev01/crystal_cascade)
**Platform:** Reddit Devvit
**Stack:** React 18 · Three.js · TypeScript · Web Audio API · Hono · Vanilla CSS
