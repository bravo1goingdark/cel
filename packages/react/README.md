# cel-react

React component and hook for playing Cel ASCII animations. Drop-in, typed, tree-shakeable.

## Install

```bash
npm install cel-react cel-core
```

## `CelAnimation` component

The easiest way to embed an animation:

```tsx
import { CelAnimation } from 'cel-react';
import scene from './sleeping.aanim';

export default function App() {
  return (
    <CelAnimation
      scene={scene}
      autoplay
      loop
      speed={1}
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `scene` | `Scene` | required | The scene to play |
| `autoplay` | `boolean` | `true` | Start playing immediately |
| `loop` | `boolean` | `true` | Loop playback |
| `speed` | `number` | `1` | Playback speed multiplier |
| `width` | `number` | computed | Container width in px |
| `height` | `number` | computed | Container height in px |
| `className` | `string` | — | CSS class for the container |
| `style` | `CSSProperties` | — | Inline styles for the container |
| `onFrame` | `(sprites, t) => void` | — | Called each frame |

Width and height default to `scene.grid.cols × 10.2` and `scene.grid.rows × 22`.

## `useCelPlayer` hook

For advanced use cases where you need direct player access:

```tsx
import { useRef } from 'react';
import { useCelPlayer } from 'cel-react';
import type { RenderTarget } from 'cel-react';

function CustomAnimation({ scene }) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const target: RenderTarget = {
    render(sprites, t) {
      // custom render logic
    },
  };

  const player = useCelPlayer(scene, target);

  return (
    <div>
      <div ref={canvasRef} />
      <button onClick={() => player?.play()}>Play</button>
      <button onClick={() => player?.pause()}>Pause</button>
    </div>
  );
}
```

## Re-exported types

`cel-react` re-exports `Scene`, `Player`, `RenderTarget`, `SampledSprite`, and `ColorResolver` from `cel-core` so you don't need to import from two packages.

## License

MIT
