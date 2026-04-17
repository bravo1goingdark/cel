import type { Scene } from 'cel-core';
import type { Exporter } from './types';
import {
  RUNTIME_DEFAULTS,
  RUNTIME_METRICS,
  RUNTIME_EASE,
  RUNTIME_LERP,
  RUNTIME_SAMPLE_FULL,
  RUNTIME_TEXT_AT,
} from './runtime';

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
    const isESM = (opts.format ?? 'esm') === 'esm';

    const playerCode = `
${RUNTIME_DEFAULTS}
${RUNTIME_METRICS}
${RUNTIME_EASE}
${RUNTIME_LERP}
${RUNTIME_SAMPLE_FULL}
${RUNTIME_TEXT_AT}

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
return{play(){playing=true;last=null;raf=requestAnimationFrame(tick)},pause(){playing=false;cancelAnimationFrame(raf)},seek(ms){t=Math.max(0,Math.min(scene.duration,ms))},destroy(){playing=false;cancelAnimationFrame(raf);container.innerHTML=""}}}`;

    const sceneJson = JSON.stringify(scene, null, 2);

    let content: string;
    if (isESM) {
      content = `// Cel — ES Module\n${playerCode}\n\nexport const scene = ${sceneJson};\n\nexport function mount(container, opts) {\n  return createPlayer(container, scene, opts);\n}\n`;
    } else {
      content = `// Cel — CommonJS Module\n${playerCode}\n\nconst scene = ${sceneJson};\n\nfunction mount(container, opts) {\n  return createPlayer(container, scene, opts);\n}\n\nmodule.exports = { scene, mount };\n`;
    }

    return {
      content,
      warnings: [],
      meta: { sizeBytes: content.length, elapsed: 0 },
    };
  },
};
