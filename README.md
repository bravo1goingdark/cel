# Ascii Anim — minimal Tauri desktop

A small, self-contained desktop port of the ASCII frame-by-frame animation
studio, using **Tauri v2** + **@tauri-apps/plugin-store** for persistence.

## Stack

- **Tauri v2** — Rust shell, native window, ~10 MB installed
- **Vite** — dev server + bundler, no frontend framework
- **Vanilla JS** — the whole animation engine in a single `src/main.js`
- **tauri-plugin-store** — persistent JSON key-value store on disk

## Prerequisites

- **Node.js 18+** — for the Vite dev server
- **Rust (stable)** — install via [rustup](https://rustup.rs)
- **Platform deps** — see the [Tauri prereqs](https://v2.tauri.app/start/prerequisites/) for your OS (Linux needs `webkit2gtk`, macOS needs Xcode CLI tools, Windows needs WebView2 + MSVC)

## Run

```bash
npm install
npm run tauri dev
```

The first Rust build takes a few minutes. Subsequent rebuilds are seconds.

## Package

```bash
npm run tauri build
```

Produces a signed app bundle for your current platform in
`src-tauri/target/release/bundle/`.

> **Icons** — dev mode works with default icons. To bundle a release build, add
> a source PNG (at least 1024×1024, preferably transparent) and run
> `npm run tauri icon path/to/icon.png` — Tauri generates every size
> automatically into `src-tauri/icons/`.

## What the store does

The store file lives at the OS app-data dir:

| OS      | Path                                                            |
|---------|-----------------------------------------------------------------|
| Linux   | `~/.local/share/com.example.ascii-anim/ascii-anim.json`         |
| macOS   | `~/Library/Application Support/com.example.ascii-anim/ascii-anim.json` |
| Windows | `%APPDATA%\com.example.ascii-anim\ascii-anim.json`              |

Three keys live there:

- `current` — the scene you're editing, autosaved on every change (400 ms debounce)
- `settings` — `{ looping, speed, duration }`
- `scenes` — `{ [name]: { sprites, duration, saved } }` — your named library

Close the app, reopen it — you land exactly where you left off.

## How the store is wired

**Rust side** (`src-tauri/src/main.rs`) — one line to register the plugin:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())
```

**Permissions** (`src-tauri/capabilities/default.json`) — grant the main window access:

```json
{ "permissions": ["core:default", "store:default"] }
```

**JS side** (`src/main.js`) — use `LazyStore` for a file-backed key-value store:

```js
import { LazyStore } from "@tauri-apps/plugin-store";
const store = new LazyStore("ascii-anim.json");

await store.set("current", sceneData);
await store.save();                  // flush to disk
const scene = await store.get("current");
```

`LazyStore` loads the file on first access and lets both the JS side and
Rust side share the same resource.

## Project layout

```
ascii-anim-desktop/
├── package.json              npm scripts + deps
├── vite.config.js            Vite tuned for Tauri
├── index.html                entry point
├── src/
│   ├── main.js               engine + UI + store wiring
│   └── style.css             self-contained styles + dark mode
└── src-tauri/
    ├── Cargo.toml            Rust deps: tauri, plugin-store
    ├── build.rs              tauri_build::build()
    ├── tauri.conf.json       window config, dev URL, bundle info
    ├── capabilities/
    │   └── default.json      store permissions
    └── src/
        └── main.rs           register store plugin, run
```

## Extending

**Add a native menu** — in `main.rs`, wire up `tauri::menu::MenuBuilder`
before `.run(...)`.

**Add custom Rust commands** — define `#[tauri::command]` functions and
register them with `.invoke_handler(tauri::generate_handler![...])`.
Call from JS with `invoke("command_name", args)`.

**Swap the store for a real DB** — replace `plugin-store` with
`tauri-plugin-sql` and a SQLite backend. The autosave pattern stays the same,
but writes go through custom Rust commands instead.

**File export** — `@tauri-apps/plugin-fs` exposes the native filesystem; pair
it with `@tauri-apps/plugin-dialog` to show a save-file dialog.

**Auto-updater** — add `tauri-plugin-updater` for signed in-app updates.
