# Production-grade improvement checklist

- [x] Harden persisted state loading with schema guards/normalizers in `src/main.js`
- [x] Replace `prompt()` flows with minimal inline modal dialogs in `src/main.js`
- [x] Add robust user-facing success/error toast system in `src/main.js`
- [x] Improve keyboard and accessibility behavior in `src/main.js`
- [x] Refine UI aesthetics and interaction states in `src/style.css`
- [x] Add modal/overlay and accessibility-focused styles in `src/style.css`
- [x] Enhance document metadata in `index.html`
- [ ] Run `npm run build` and verify production build passes

## Security hardening (done)
- [x] Fix `escapeHtml()` to properly escape HTML entities
- [x] Escape all user-supplied data in innerHTML templates (sprite ids, scene names)
- [x] Enable Content Security Policy in `tauri.conf.json`
- [x] Replace `.expect()` with graceful error handling in `main.rs`

## Bug fixes (done)
- [x] Fix modal keydown handler (`{ once: true }` removed, cleanup on close)
- [x] Fix stale color cache on light/dark mode switch
- [x] Remove dead `_kfCache` variable

## Data integrity (done)
- [x] Validate data through `normalizeCurrent()` on autosave
- [x] Validate data through `normalizeCurrent()` on scene save

## Performance (done)
- [x] Event delegation for timeline keyframe tracks (replaces per-element listeners)

## Features added
- [x] Undo/Redo system (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y)
- [x] Timeline scrubbing (click ruler to seek)
- [x] Copy/Paste keyframes (Ctrl+C / Ctrl+V)
- [x] Duplicate sprites (Ctrl+D)
- [x] Frame-by-frame text export
- [x] JSON scene import/export for sharing
- [x] Responsive preview height
