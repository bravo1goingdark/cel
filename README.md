# cel.

ASCII animation studio. Design character-grid animations visually, export to any format.

---

## What it does

Cel is a desktop app for creating ASCII animations — the kind that appear in CLI spinners, terminal UIs, documentation banners, and retro web interfaces. You work with characters on a grid, not pixels. Keyframe-based timeline, real-time preview, one-click export.

## Stack

| Layer | Technology |
|-------|-----------|
| Engine | `@cel/core` — zero-dep TypeScript, 3.9KB gzipped |
| Desktop | Tauri 2 + Rust + Vite |
| Frontend | Vanilla JS (SolidJS migration planned) |
| CLI | Rust + clap, 1.3MB binary |
| Exports | HTML, React, CSS, ANSI, ES module, .aanim, GIF (planned) |

## Quick start

```bash
# run the desktop app
pnpm install
cd apps/desktop && pnpm run tauri dev

# or use the CLI
cd apps/cli && cargo run -- validate ../presets/*.aanim
cd apps/cli && cargo run -- play ../presets/sleeping.aanim --loop
cd apps/cli && cargo run -- info ../presets/heartbeat.aanim
```

First Rust build takes ~2 minutes. Subsequent rebuilds are seconds.

## Project structure

```
cel/
├── packages/
│   ├── core/          @cel/core — engine (sampling, easing, validation, serialization)
│   ├── exporters/     @cel/export — 7 format exporters
│   ├── player/        @cel/player — tiny playback runtime
│   └── react/         @cel/react — React wrapper (planned)
├── apps/
│   ├── desktop/       Tauri app (editor UI + Rust shell)
│   └── cli/           Rust CLI binary
├── presets/           31 bundled .aanim scenes
└── docs/public/       Landing page + JSON Schema
```

## The engine

Zero dependencies. Works in Node, Deno, Bun, any browser.

```bash
npm install @cel/core
```

```typescript
import { sampleScene, serialize, validate } from '@cel/core';

// Sample all sprites at 1500ms
const frame = sampleScene(scene, 1500);

// Deterministic serialization (git-friendly)
const json = serialize(scene);

// Full schema validation with error paths
const result = validate(input);
```

## File format

`.aanim` — UTF-8 JSON with strict conventions. Deterministic output: alphabetical keys, fixed numeric precision, trailing newline. Every save produces a clean git diff.

```json
{
  "$schema": "https://cel.dev/schema/v1.json",
  "version": 1,
  "duration": 4000,
  "sprites": [
    {
      "id": "face",
      "keyframes": [
        { "t": 0, "x": 5.5, "y": 5, "fontSize": 22, "opacity": 1 },
        { "t": 2000, "x": 5.5, "y": 5.6, "rotation": -1, "easing": "inout" }
      ],
      "text": "( -_- )"
    }
  ]
}
```

## Export targets

| Format | Output | Status |
|--------|--------|--------|
| HTML | Self-contained page with embedded player | Done |
| React | Typed `.tsx` component with props | Done |
| CSS | `@keyframes` rules per sprite | Done |
| ANSI | Node.js terminal playback script | Done |
| JS Module | ESM/CJS with `mount()` | Done |
| JSON | Deterministic `.aanim` | Done |
| GIF | Animated GIF via Rust rasterizer | Planned |

## Desktop app features

- Visual timeline with draggable keyframes
- Real-time preview with playback controls
- Sprite list with add/delete/rename/duplicate
- Properties panel for all keyframe values
- Undo/redo (30-entry stack)
- Native OS menu bar (File, Edit, View, Help)
- Native open/save dialogs with atomic writes (crash-safe)
- Autosave every 400ms to Tauri store
- Light/dark theme with system detection
- 31 bundled presets

## CLI

```bash
cel validate scenes/*.aanim        # schema check
cel info scene.aanim               # metadata + stats
cel play scene.aanim --loop        # ANSI terminal playback
cel render scene.aanim -o out.json # export
```

## Tests

```bash
pnpm run test    # 210 tests (186 core + 24 exporter)
```

- 100% line coverage on the core engine
- Golden-file tests with 5 fixture scenes
- Property tests via fast-check
- Performance benchmark: 0.6ms per frame (100 sprites x 10 keyframes)
- Exporter contract tests for all 7 formats

## Prerequisites

- **Node.js 20+** and **pnpm**
- **Rust stable** — [rustup.rs](https://rustup.rs)
- **Platform deps** — [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## License

MIT
