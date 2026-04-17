import type { Scene } from '@ascii-anim/core';
import { serialize, sampleSprite, DEFAULT_TRANSFORM } from '@ascii-anim/core';
import type { Exporter } from './types';

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
    const title = esc(opts.title ?? 'ASCII Animation');
    const fps = scene.fps ?? 60;
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
const D={x:${DEFAULT_TRANSFORM.x},y:${DEFAULT_TRANSFORM.y},op:${DEFAULT_TRANSFORM.opacity},fs:${DEFAULT_TRANSFORM.fontSize},rot:${DEFAULT_TRANSFORM.rotation}};
const CW=10.2,LH=22;
function ease(t,e){if(!e||e==="linear")return t;if(e==="in")return t*t;if(e==="out")return 1-(1-t)**2;if(e==="inout")return t<.5?2*t*t:1-2*(1-t)**2;return t}
function lerp(a,b,t){return a+(b-a)*t}
function sample(kfs,t){
if(!kfs.length)return{x:D.x,y:D.y,op:D.op,fs:D.fs,rot:D.rot};
if(t<=kfs[0].t){const k=kfs[0];return{x:k.x??D.x,y:k.y??D.y,op:k.opacity??D.op,fs:k.fontSize??D.fs,rot:k.rotation??D.rot}}
const l=kfs[kfs.length-1];if(t>=l.t)return{x:l.x??D.x,y:l.y??D.y,op:l.opacity??D.op,fs:l.fontSize??D.fs,rot:l.rotation??D.rot};
let i=0;while(i<kfs.length-1&&kfs[i+1].t<=t)i++;
const a=kfs[i],b=kfs[i+1],p=ease((t-a.t)/(b.t-a.t),b.easing);
return{x:lerp(a.x??D.x,b.x??D.x,p),y:lerp(a.y??D.y,b.y??D.y,p),op:lerp(a.opacity??D.op,b.opacity??D.op,p),fs:lerp(a.fontSize??D.fs,b.fontSize??D.fs,p),rot:lerp(a.rotation??D.rot,b.rotation??D.rot,p)}}
function textAt(sp,t){let r=sp.text;for(const k of sp.keyframes){if(k.t>t)break;if(k.text!=null)r=k.text}return r}
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
<\\/script>
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
