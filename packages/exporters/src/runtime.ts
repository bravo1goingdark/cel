/**
 * @module runtime
 * Canonical runtime code strings for embedding in self-contained exports.
 * All exporters import from here instead of hand-duplicating sampling logic.
 * Uses binary search for O(log n) keyframe lookup, matching cel-core.
 */

import { DEFAULT_TRANSFORM, DEFAULT_CHAR_WIDTH, DEFAULT_LINE_HEIGHT } from 'cel-core';

const D = DEFAULT_TRANSFORM;

/** Defaults constant as minified JS. */
export const RUNTIME_DEFAULTS = `const D={x:${D.x},y:${D.y},op:${D.opacity},fs:${D.fontSize},rot:${D.rotation}};`;

/** Character metric constants as minified JS. */
export const RUNTIME_METRICS = `const CW=${DEFAULT_CHAR_WIDTH},LH=${DEFAULT_LINE_HEIGHT};`;

/** Easing function — matches core evaluateEasing for named easings. */
export const RUNTIME_EASE = `function ease(t,e){if(!e||e==="linear")return t;if(e==="in")return t*t;if(e==="out")return 1-(1-t)**2;if(e==="inout")return t<.5?2*t*t:1-2*(1-t)**2;return t}`;

/** Linear interpolation. */
export const RUNTIME_LERP = `function lerp(a,b,t){return a+(b-a)*t}`;

/** Text resolver — finds the active text at time t. */
export const RUNTIME_TEXT_AT = `function textAt(sp,t){let r=sp.text;for(const k of sp.keyframes){if(k.t>t)break;if(k.text!=null)r=k.text}return r}`;

/**
 * Full sample function with binary search.
 * Returns { x, y, op, fs, rot } for DOM-based exporters.
 */
export const RUNTIME_SAMPLE_FULL = `function sample(kfs,t){
if(!kfs.length)return{x:D.x,y:D.y,op:D.op,fs:D.fs,rot:D.rot};
if(t<=kfs[0].t){const k=kfs[0];return{x:k.x??D.x,y:k.y??D.y,op:k.opacity??D.op,fs:k.fontSize??D.fs,rot:k.rotation??D.rot}}
const l=kfs[kfs.length-1];if(t>=l.t)return{x:l.x??D.x,y:l.y??D.y,op:l.opacity??D.op,fs:l.fontSize??D.fs,rot:l.rotation??D.rot};
let lo=0,hi=kfs.length-2;while(lo<hi){const m=(lo+hi+1)>>>1;if(kfs[m].t<=t)lo=m;else hi=m-1}
const a=kfs[lo],b=kfs[lo+1],p=ease((t-a.t)/(b.t-a.t),b.easing);
return{x:lerp(a.x??D.x,b.x??D.x,p),y:lerp(a.y??D.y,b.y??D.y,p),op:lerp(a.opacity??D.op,b.opacity??D.op,p),fs:lerp(a.fontSize??D.fs,b.fontSize??D.fs,p),rot:lerp(a.rotation??D.rot,b.rotation??D.rot,p)}}`;

/**
 * Reduced sample function for terminal output (x, y, op only — no fontSize/rotation).
 */
export const RUNTIME_SAMPLE_TERMINAL = `function sample(kfs,t){
if(!kfs.length)return{x:D.x,y:D.y,op:D.op};
if(t<=kfs[0].t){const k=kfs[0];return{x:k.x??D.x,y:k.y??D.y,op:k.opacity??D.op}}
const l=kfs[kfs.length-1];if(t>=l.t)return{x:l.x??D.x,y:l.y??D.y,op:l.opacity??D.op};
let lo=0,hi=kfs.length-2;while(lo<hi){const m=(lo+hi+1)>>>1;if(kfs[m].t<=t)lo=m;else hi=m-1}
const a=kfs[lo],b=kfs[lo+1],p=ease((t-a.t)/(b.t-a.t),b.easing);
return{x:lerp(a.x??D.x,b.x??D.x,p),y:lerp(a.y??D.y,b.y??D.y,p),op:lerp(a.opacity??D.op,b.opacity??D.op,p)}}`;
