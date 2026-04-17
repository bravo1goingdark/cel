# cel-player

Tiny runtime for playing Cel ASCII animations. Convenience re-export of `createPlayer` from `cel-core`.

## Install

```bash
npm install cel-player cel-core
```

## Usage

```typescript
import { createPlayer } from 'cel-player';

const player = createPlayer(scene, {
  render(sprites, t) {
    for (const sprite of sprites) {
      const el = document.getElementById(sprite.id);
      if (!el) continue;
      el.textContent = sprite.text;
      el.style.transform = `translate(${sprite.x * 10.2}px, ${sprite.y * 22}px)`;
      el.style.opacity = String(sprite.opacity);
    }
  },
});

player.play();
```

## Player API

| Method | Description |
|--------|-------------|
| `play()` | Start or resume playback |
| `pause()` | Pause playback |
| `seek(ms)` | Jump to a specific time in ms |
| `setSpeed(n)` | Set playback speed (e.g. `0.5`, `2`) |
| `setLooping(bool)` | Enable or disable looping |
| `destroy()` | Stop and clean up |
| `playing` | `boolean` — current playback state |

## RenderTarget

```typescript
interface RenderTarget {
  render(sprites: SampledSprite[], t: number): void;
}
```

Each `SampledSprite` has: `id`, `text`, `x`, `y`, `opacity`, `fontSize`, `rotation`, `color`.

Coordinates are in character-grid units. Multiply `x` by `10.2` and `y` by `22` to get CSS pixels.

## Note

`cel-player` is a thin wrapper around `cel-core`. If you're already using `cel-core` directly, `createPlayer` is available there too — no need to install both.

## License

MIT
