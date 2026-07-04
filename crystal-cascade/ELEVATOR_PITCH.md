# 💎 Crystal Cascade — Elevator Pitch

> *A premium 3D match-three puzzle game, built natively inside Reddit using Devvit.*

---

## The Problem

Reddit is one of the world's largest online communities, yet it offers almost no native, interactive gaming experiences. Users scroll endlessly, upvote, and comment — but they rarely *play together* in the same place where the conversation is happening.

---

## The Solution

**Crystal Cascade** brings a polished, fully playable 3D gem-puzzle game directly into Reddit posts — no app download, no redirect, no friction. It runs completely inside the Devvit webview, right in your feed.

---

## What It Is

Crystal Cascade is a **match-three puzzle game** with a 3D WebGL board powered by Three.js and React. Players swap adjacent gems to form matches of 3 or more, triggering chain reactions, special power-ups, and explosive combos — all while racing to clear the board within a move limit.

### Core Gameplay Features
- 🔮 **3D gem board** with real-time WebGL rendering
- ⚡ **Special crystals** — Striped, Wrapped, and Rainbow — earned by matching 4 or 5 gems in line or in L/T shapes
- 💥 **Combo chains** with escalating multipliers
- 🧱 **Block-clearing objectives** across 5 hand-tuned levels + infinite procedural mode
- 🤖 **AI Auto-Play mode** for demonstration or accessibility
- 🔊 **Procedural audio** synthesized in-browser — no audio assets needed

---

## Why Reddit + Devvit?

| Traditional Game | Crystal Cascade on Reddit |
|---|---|
| Separate app / website | Embedded directly in a Reddit post |
| Cold-start friction | One tap, instant play |
| Isolated experience | Lives in community context — share scores, challenge others |
| Requires download / login | Zero setup — uses your Reddit session |

Reddit's **Devvit platform** lets developers build interactive experiences that live natively inside posts. Crystal Cascade is one of the first games to use this to deliver a **premium graphical experience** rather than a basic quiz or poll.

---

## The Tech Stack

```
Reddit Devvit (Custom Post Webview)
├── Client: React 18 + Three.js (WebGL)
│   ├── GameEngine.tsx  — full 3D board, physics tweens, particles
│   ├── HUD.tsx         — live stats, move counter, objectives
│   ├── Overlay.tsx     — animated level start / win / lose screens
│   └── Icon.tsx        — zero-emoji SVG icon system
├── Style: Vanilla CSS — glassmorphism, dark mode, responsive (360px → 4K)
├── Audio: Web Audio API — procedural synth, no external files
└── Server: Hono (TypeScript) — post creation, Reddit API
```

**TypeScript end-to-end** — zero runtime type errors, strict mode, full lint compliance.

---

## Who It's For

- **Puzzle fans** who want a few minutes of satisfying, skill-based gameplay
- **Reddit community builders** looking for interactive content beyond text posts
- **Devvit developers** as a reference implementation for high-fidelity webview games

---

## Traction & Differentiators

- ✅ **5 balanced levels** with verified winnability — every level is mathematically solvable within its move budget
- ✅ **Infinite mode** — procedurally generated levels that scale in difficulty forever
- ✅ **Fully responsive** — designed for Reddit's mobile-first audience (iPhone SE → desktop)
- ✅ **Premium visual identity** — Snoo mascot integration, Baloo 2 typography, smooth 60fps animations
- ✅ **No external dependencies** at runtime — ships as a single self-contained bundle

---

## The Ask

We're looking to **launch Crystal Cascade on r/Devvit and r/mildlyinteresting** as our first community test. We want to prove that Devvit can host genuinely fun, beautiful, skill-based games — and that Redditors will play them.

If the engagement numbers hold, the next step is a **leaderboard**, **daily challenge mode**, and **subreddit-specific themed gem skins**.

---

> *Crystal Cascade is proof that Reddit posts don't have to be passive. Let's make them playable.*

---

**GitHub:** [EmmaTheDev01/crystal_cascade](https://github.com/EmmaTheDev01/crystal_cascade)  
**Built with:** Devvit · React · Three.js · TypeScript · Web Audio API
