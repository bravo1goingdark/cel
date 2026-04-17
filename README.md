<div align="center">

```
                ___     ___     ___
               / __|   / _ \   | |
              | (__   |  __/   | |
               \___|   \___|   |_|

        a s c i i   a n i m a t i o n
              s  t  u  d  i  o
```

[![CI](https://github.com/bravo1goingdark/cel/actions/workflows/ci.yml/badge.svg)](https://github.com/bravo1goingdark/cel/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/bravo1goingdark/cel?label=download&color=c8ff3e)](https://github.com/bravo1goingdark/cel/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Design ASCII animations visually. Export to any format. Ship in seconds.**

[Website](https://bravo1goingdark.github.io/cel/) &middot; [Download](https://github.com/bravo1goingdark/cel/releases/latest) &middot; [Documentation](#the-engine)

</div>

---

## What is Cel?

A desktop app for creating ASCII character-grid animations — CLI spinners, terminal UIs, documentation banners, retro web interfaces. You work with characters on a grid, not pixels.

Keyframe-based timeline. Real-time preview. One-click export to 7 formats.

## Quick start

```bash
# desktop app
pnpm install && cd apps/desktop && pnpm run tauri dev

# cli
cd apps/cli && cargo run -- play ../presets/sleeping.aanim --loop
```

## Desktop

<table>
<tr><td>

**Editor**
- Visual timeline with draggable keyframes
- Real-time 60fps preview
- Sprite layers with drag-and-drop z-ordering
- Visual cubic bezier easing editor
- Properties panel (position, opacity, size, rotation, color, easing)

</td><td>

**Workflow**
- Undo/redo (30 steps)
- Native open/save with atomic crash-safe writes
- Autosave every 400ms
- Light/dark theme
- 10 built-in presets
- Keyboard-driven

</td></tr>
</table>

> Built with Tauri 2 + Rust. Sub-second launch, native menus, under 10MB.

## Engine

Zero dependencies. 3.9KB gzipped. Works everywhere.

```bash
npm install @cel/core
```

```typescript
import { sampleScene, serialize, validate } from '@cel/core';

const frame = sampleScene(scene, 1500);     // sample at any time
const json  = serialize(scene);              // deterministic output
const check = validate(input);              // full error paths
```

## React

```bash
npm install @cel/react @cel/core
```

```tsx
import { CelAnimation } from '@cel/react';

<CelAnimation scene={scene} autoplay loop speed={1} />
```

Also exports `useCelPlayer` hook for custom render targets.

## Export

| Format | Output |
|--------|--------|
| `.html` | Self-contained page with embedded player |
| `.tsx` | Typed React component |
| `.css` | `@keyframes` per sprite with cubic-bezier easing |
| `.js` ansi | Terminal playback script |
| `.js` esm | ES module with `mount()` |
| `.aanim` | Deterministic JSON |
| `.gif` | Animated GIF *(planned)* |

## CLI

```
$ cel validate scenes/*.aanim
  ✓ 31 files validated, 0 errors

$ cel info presets/sleeping.aanim
  duration: 4000ms (4.0s)
  sprites:  4
  keyframes: 17 total

$ cel play presets/sleeping.aanim --loop
```

1.4MB static Rust binary.

## File format

`.aanim` — UTF-8 JSON. Alphabetical keys, fixed precision, trailing newline. Every save = clean git diff.

```json
{
  "$schema": "https://cel.dev/schema/v1.json",
  "version": 1,
  "duration": 4000,
  "sprites": [{
    "id": "face",
    "text": "( -_- )",
    "keyframes": [
      { "t": 0, "x": 5.5, "y": 5, "easing": "inout" },
      { "t": 2000, "y": 5.6, "rotation": -1 },
      { "t": 4000, "y": 5, "rotation": 0 }
    ]
  }]
}
```

## Project structure

```
cel/
├── packages/
│   ├── core/        @cel/core     3.9KB engine
│   ├── exporters/   @cel/export   7 format exporters
│   ├── player/      @cel/player   playback runtime
│   └── react/       @cel/react    React component + hook
├── apps/
│   ├── desktop/     Tauri 2 editor
│   └── cli/         Rust CLI
├── presets/          31 bundled .aanim scenes
└── docs/             Landing page + JSON Schema
```

## Numbers

| | |
|---|---|
| **3.9KB** gzipped engine | **0** dependencies |
| **212** tests passing | **100%** line coverage |
| **0.6ms** per frame render | **1.4MB** CLI binary |
| **7** export formats | **31** bundled presets |

## Development

```bash
pnpm install                  # install deps
pnpm run test                 # 212 tests
pnpm run typecheck            # full type check
pnpm run build                # build all packages
```

**Prerequisites:** Node.js 20+, pnpm, Rust stable, [Tauri deps](https://v2.tauri.app/start/prerequisites/)

## License

[MIT](LICENSE)
