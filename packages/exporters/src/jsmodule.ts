import type { Scene } from '@ascii-anim/core';
import { DEFAULT_TRANSFORM } from '@ascii-anim/core';
import type { Exporter } from './types';

export interface JsModuleOpts {
  format?: 'esm' | 'cjs';
}

export const jsModuleExporter: Exporter<JsModuleOpts> = {
  id: 'jsmodule',
  name: 'JavaScript Module',
  description: 'Tree-shakeable ES module with embedded scene and player.',
  extension: '.js',
  mimeType: 'application/javascript',
  defaultOpts: { format: 'esm' },

  async run(scene, opts) {
    const D = DEFAULT_TRANSFORM;
    const isESM = (opts.format ?? 'esm') === 'esm';

    const playerCode = `
const D={x:${D.x},y:${D.y},op:${D.opacity},fs:${D.fontSize},rot:${D.rotation}};
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

function createPlayer(container,scene,opts={}){
const{autoplay=true,loop=true,speed=1}=opts;
container.style.position="relative";container.style.overflow="hidden";container.style.fontFamily="ui-monospace,monospace";
const sprites=scene.sprites.filter(s=>!s.hidden);
const els=sprites.map(sp=>{const el=document.createElement("span");el.style.cssText="position:absolute;top:0;left:0;white-space:pre;line-height:1.375";container.appendChild(el);return{sp,el}});
let t=0,last=null,raf=0,playing=autoplay;
function tick(now){if(!playing)return;if(last===null)last=now;t+=Math.min(now-last,100)*speed;last=now;
if(t>=scene.duration){if(loop)t%=scene.duration;else{t=scene.duration;playing=false}}
for(const{sp,el}of els){const p=sample(sp.keyframes,t);el.textContent=textAt(sp,t);el.style.transform="translate("+(p.x*CW).toFixed(1)+"px,"+(p.y*LH).toFixed(1)+"px) rotate("+p.rot.toFixed(1)+"deg)";el.style.opacity=p.op.toFixed(2);el.style.fontSize=Math.round(p.fs)+"px"}
if(playing)raf=requestAnimationFrame(tick)}
if(autoplay)raf=requestAnimationFrame(tick);
return{play(){playing=true;last=null;raf=requestAnimationFrame(tick)},pause(){playing=false;cancelAnimationFrame(raf)},seek(ms){t=Math.max(0,Math.min(scene.duration,ms))},destroy(){playing=false;cancelAnimationFrame(raf);container.innerHTML=""}}
}`;

    const sceneJson = JSON.stringify(scene, null, 2);

    let content: string;
    if (isESM) {
      content = `// ASCII Anim — ES Module\n${playerCode}\n\nexport const scene = ${sceneJson};\n\nexport function mount(container, opts) {\n  return createPlayer(container, scene, opts);\n}\n`;
    } else {
      content = `// ASCII Anim — CommonJS Module\n${playerCode}\n\nconst scene = ${sceneJson};\n\nfunction mount(container, opts) {\n  return createPlayer(container, scene, opts);\n}\n\nmodule.exports = { scene, mount };\n`;
    }

    return {
      content,
      warnings: [],
      meta: { sizeBytes: content.length, elapsed: 0 },
    };
  },
};
