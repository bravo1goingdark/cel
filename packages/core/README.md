# cel-core

Zero-dependency TypeScript engine for ASCII character-grid animations. 3.9KB gzipped. Works in Node, Deno, Bun, and any browser.

## Install

```bash
npm install cel-core
```

## Usage

### Sample a scene at any timestamp

```typescript
import { sampleScene } from 'cel-core';

const sprites = sampleScene(scene, 1500); // sprites at t=1500ms
sprites.forEach(s => {
  console.log(s.id, s.x, s.y, s.text);
});
```

### Play an animation in the browser

```typescript
import { createPlayer } from 'cel-core';

const player = createPlayer(scene, {
  render(sprites, t) {
    for (const s of sprites) {
      const el = document.getElementById(s.id);
      if (el) el.style.transform = `translate(${s.x * 10.2}px, ${s.y * 22}px)`;
    }
  },
});

player.play();
// player.pause()
// player.seek(2000)
// player.setSpeed(0.5)
// player.setLooping(true)
// player.destroy()
```

### Validate a scene

```typescript
import { validate } from 'cel-core';

const { valid, errors } = validate(input);
if (!valid) {
  errors.forEach(e => console.error(e.path, e.message));
}
```

### Serialize / deserialize

```typescript
import { serialize, deserialize } from 'cel-core';

const json = serialize(scene);       // deterministic JSON string
const back = deserialize(json);      // parse back to Scene
```

## Scene format

```json
{
  "version": 1,
  "duration": 4000,
  "sprites": [{
    "id": "face",
    "text": "( -_- )",
    "keyframes": [
      { "t": 0,    "x": 5.5, "y": 5,   "easing": "inout" },
      { "t": 2000, "y": 5.6, "rotation": -1 },
      { "t": 4000, "y": 5,   "rotation": 0 }
    ]
  }]
}
```

Keyframe properties: `t` (ms), `x`, `y`, `opacity`, `fontSize`, `rotation`, `color`, `easing`, `text`.

Easing values: `"linear"`, `"in"`, `"out"`, `"inout"`, or `{ cubic: [x1, y1, x2, y2] }`.

## API

| Export | Description |
|--------|-------------|
| `sampleScene(scene, t)` | Sample all sprites at time `t` |
| `sampleSprite(sprite, t)` | Sample a single sprite |
| `createPlayer(scene, target)` | Create a 60fps playback engine |
| `validate(input)` | Validate raw input, returns `{ valid, errors }` |
| `serialize(scene)` | Deterministic JSON serialization |
| `deserialize(json)` | Parse JSON back to `Scene` |
| `evaluateEasing(t, easing)` | Apply easing to a `[0,1]` progress value |
| `migrate(scene)` | Migrate old scene versions to current |

## License

MIT
