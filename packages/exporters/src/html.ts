import type { Scene } from 'cel-core';
import { serialize, DEFAULT_TRANSFORM } from 'cel-core';
import type { Exporter } from './types';
import {
  RUNTIME_DEFAULTS,
  RUNTIME_METRICS,
  RUNTIME_EASE,
  RUNTIME_LERP,
  RUNTIME_SAMPLE_FULL,
  RUNTIME_TEXT_AT,
} from './runtime';

export interface HtmlOpts {
  title?: string;
  embedPlayer?: boolean;
  standalone?: boolean;
}

export const htmlExporter: Exporter<HtmlOpts> = {
  id: 'html',
  name: 'Standalone HTML',
  description: 'Single-file HTML page that plays the animation.',
  extension: '.html',
  mimeType: 'text/html',
  defaultOpts: { embedPlayer: true, standalone: true },

  async run(scene, opts) {
    const sceneJson = serialize(scene);
    const title = esc(opts.title ?? 'Cel Animation');

    const content = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f4f0;font-family:ui-monospace,monospace}
#stage{position:relative;width:600px;height:240px;background:#eeebe5;border-radius:12px;overflow:hidden}
.sp{position:absolute;top:0;left:0;white-space:pre;line-height:1.375}
</style>
</head>
<body>
<div id="stage"></div>
<script>
const S=${sceneJson};
${RUNTIME_DEFAULTS}
${RUNTIME_METRICS}
${RUNTIME_EASE}
${RUNTIME_LERP}
${RUNTIME_SAMPLE_FULL}
${RUNTIME_TEXT_AT}
const stage=document.getElementById("stage");
const els=S.sprites.filter(s=>!s.hidden).map(sp=>{const e=document.createElement("span");e.className="sp";e.style.color="var(--c,#5f5e5a)";stage.appendChild(e);return{sp,el:e}});
let t=0,last=null;
function tick(now){
if(last===null)last=now;
t+=Math.min(now-last,100);last=now;
if(t>=S.duration)t%=S.duration;
for(const{sp,el}of els){const p=sample(sp.keyframes,t);el.textContent=textAt(sp,t);el.style.transform="translate("+(p.x*CW).toFixed(1)+"px,"+(p.y*LH).toFixed(1)+"px) rotate("+p.rot.toFixed(1)+"deg)";el.style.opacity=p.op.toFixed(2);el.style.fontSize=Math.round(p.fs)+"px"}
requestAnimationFrame(tick)}
requestAnimationFrame(tick);
<\/script>
</body>
</html>`;

    return {
      content,
      warnings: [],
      meta: { sizeBytes: content.length, elapsed: 0 },
    };
  },
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
