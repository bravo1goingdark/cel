# cel-export

Export pipeline for Cel scenes. Convert `.aanim` scenes to HTML, React, CSS, JavaScript, ANSI terminal scripts, and more.

## Install

```bash
npm install cel-export cel-core
```

## Usage

```typescript
import { htmlExporter, reactExporter, cssExporter } from 'cel-export';

const result = await htmlExporter.run(scene, htmlExporter.defaultOpts);
console.log(result.content); // self-contained HTML string
```

### Run all exporters

```typescript
import { exporters } from 'cel-export';

for (const exporter of exporters) {
  const result = await exporter.run(scene, exporter.defaultOpts);
  await fs.writeFile(`output${exporter.extension}`, result.content);
}
```

## Exporters

| Exporter | Output | Extension |
|----------|--------|-----------|
| `htmlExporter` | Self-contained HTML page | `.html` |
| `reactExporter` | Typed React component | `.tsx` |
| `cssExporter` | `@keyframes` per sprite | `.css` |
| `ansiExporter` | Terminal playback script | `.js` |
| `jsModuleExporter` | ES/CJS module with `mount()` | `.js` |
| `jsonExporter` | Deterministic `.aanim` JSON | `.aanim` |
| `gifExporter` | Animated GIF *(requires Rust backend)* | `.gif` |

## Options

### HTML

```typescript
import { htmlExporter } from 'cel-export';

const result = await htmlExporter.run(scene, {
  title: 'My Animation',
  embedPlayer: true,
  standalone: true,
});
```

### React component

```typescript
import { reactExporter } from 'cel-export';

const result = await reactExporter.run(scene, {
  componentName: 'SleepingCat',
});
// result.content is a ready-to-use .tsx file
```

### CSS keyframes

```typescript
import { cssExporter } from 'cel-export';

const result = await cssExporter.run(scene, {
  prefix: 'my-anim',
});
// produces @keyframes my-anim-<spriteId> { ... }
```

### JavaScript module

```typescript
import { jsModuleExporter } from 'cel-export';

const result = await jsModuleExporter.run(scene, {
  format: 'esm', // or 'cjs'
});
// exports: mount(container, opts) => player
```

### Terminal script

```typescript
import { ansiExporter } from 'cel-export';

const result = await ansiExporter.run(scene, {
  clearScreen: true,
});
// node output.js — plays animation in terminal
```

## Result shape

```typescript
interface ExportResult {
  content: string | Uint8Array;
  warnings: string[];
  meta?: { sizeBytes: number; elapsed: number };
}
```

## License

MIT
