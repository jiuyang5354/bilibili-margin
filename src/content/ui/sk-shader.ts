/**
 * 加载骨架的着色器底纹（用户 2026-10-29：「加载动画也加个 shader」）。
 * 用 Live Orb 同款 fbm 域扭曲「wash」：低对比的墨色/纸色雾在封面占位里缓慢流动，
 * 偶尔透一点粉→橙（足迹/太阳同款强调色），再叠一道和文字行流光同节拍（1.5s）的斜向高光。
 *
 * 性能：全站只有一个 WebGL 上下文，画一张 384×216 的小图；每个骨架封面是 2D canvas，
 * 每帧从这张图里按自己的偏移裁一块 drawImage 过去（12 张骨架也只占一个 GL 上下文）。
 * 约 30fps；没有可见骨架就停；减少动态效果时只画一帧。没有 WebGL 就保持原 CSS 流光。
 */
const W = 384, H = 216, SW = 256, SH = 144;

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_t;
uniform vec3 u_ink;
uniform float u_dark;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1., 0.)), c = hash(i + vec2(0., 1.)), d = hash(i + vec2(1., 1.));
  vec2 u = f * f * (3. - 2. * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1. - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p){
  float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= .5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 q = uv * vec2(2.2, 1.24);
  float t = u_t;
  vec2 w1 = vec2(fbm(q * 1.4 + vec2(t * .22, t * .18)), fbm(q * 1.4 + vec2(-t * .16, t * .24) + 4.1));
  q += (w1 - .5) * .9;
  float f = fbm(q * 2.1 + vec2(0., t * .12));
  float g = fbm(q * 4.6 - vec2(t * .2, 0.));
  // 墨雾：底色上的明暗起伏
  float fog = smoothstep(.25, .8, f);
  // 强调色：只在 g 的高峰透出一点粉→橙
  float hot = pow(smoothstep(.45, .9, g), 1.5);
  vec3 accent = mix(vec3(.984, .447, .6), vec3(1., .624, .353), smoothstep(.3, .7, uv.x + (f - .5)));
  // 1.5s 一次的斜向高光，和文字行流光同节拍
  float ph = fract(u_t / 1.5 * .55);
  float sweep = exp(-pow((uv.x + uv.y * .35 - (ph * 2.2 - .5)) * 5.5, 2.));
  float base = mix(.03, .1, fog);
  vec3 col = mix(u_ink, accent, hot * .8);
  float alpha = base + hot * (u_dark > .5 ? .1 : .13) + sweep * (u_dark > .5 ? .08 : .32);
  // 高光在亮色是白光，暗色是淡墨光
  col = mix(col, vec3(1.), sweep * (u_dark > .5 ? .6 : .9));
  gl_FragColor = vec4(col, clamp(alpha, 0., 1.));
}`;

type Slot = { c: HTMLCanvasElement; x: CanvasRenderingContext2D; ox: number; oy: number };

let gl: WebGLRenderingContext | null | undefined;
let glCanvas: HTMLCanvasElement;
let uT: WebGLUniformLocation | null, uInk: WebGLUniformLocation | null, uDark: WebGLUniformLocation | null;
const slots = new Set<Slot>();
let raf = 0, last = 0, t0 = 0, n = 0;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function init(): boolean {
  if (gl !== undefined) return !!gl;
  glCanvas = document.createElement('canvas');
  glCanvas.width = W; glCanvas.height = H;
  gl = glCanvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return false;
  const g = gl;
  const sh = (t: number, s: string) => { const x = g.createShader(t)!; g.shaderSource(x, s); g.compileShader(x); return g.getShaderParameter(x, g.COMPILE_STATUS) ? x : null; };
  const vs = sh(g.VERTEX_SHADER, VERT), fs = sh(g.FRAGMENT_SHADER, FRAG);
  const p = g.createProgram()!;
  if (!vs || !fs) { gl = null; return false; }
  g.attachShader(p, vs); g.attachShader(p, fs); g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) { gl = null; return false; }
  g.useProgram(p);
  g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), g.STATIC_DRAW);
  const loc = g.getAttribLocation(p, 'a');
  g.enableVertexAttribArray(loc);
  g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  g.uniform2f(g.getUniformLocation(p, 'u_res'), W, H);
  uT = g.getUniformLocation(p, 'u_t'); uInk = g.getUniformLocation(p, 'u_ink'); uDark = g.getUniformLocation(p, 'u_dark');
  g.viewport(0, 0, W, H);
  glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gl = null; slots.forEach((s) => { s.c.remove(); s.c.parentElement?.classList.remove('sk-gl'); }); slots.clear(); });
  t0 = performance.now();
  return true;
}

function frame(now: number) {
  raf = 0;
  if (!gl) return;
  for (const s of slots) if (!s.c.isConnected) slots.delete(s);
  if (!slots.size || document.hidden) return;
  const still = reduce.matches;
  if (now - last >= 32 || still) {
    last = now;
    const first = slots.values().next().value as Slot;
    const dark = first.c.closest('[data-theme]')?.getAttribute('data-theme') === 'dark';
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uT, still ? 3 : (now - t0) / 1000);
    gl.uniform3f(uInk, dark ? 1 : .09, dark ? 1 : .094, dark ? 1 : .102);
    gl.uniform1f(uDark, dark ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    for (const s of slots) {
      const r = s.c.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      s.x.clearRect(0, 0, s.c.width, s.c.height);
      s.x.drawImage(glCanvas, s.ox, s.oy, SW, SH, 0, 0, s.c.width, s.c.height);
    }
  }
  if (!still) raf = requestAnimationFrame(frame);
}

/** 给一个骨架封面占位加上着色器底纹；没有 WebGL 时什么也不做（保留 CSS 流光） */
export function skShader(cover: HTMLElement): void {
  if (!init()) return;
  const c = document.createElement('canvas');
  c.className = 'sk-canvas';
  c.width = 192; c.height = 108;
  const x = c.getContext('2d');
  if (!x) return;
  const i = n++;
  slots.add({ c, x, ox: (i * 53) % (W - SW), oy: (i * 29) % (H - SH) });
  cover.classList.add('sk-gl');
  cover.append(c);
  if (!raf) raf = requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => { if (!document.hidden && slots.size && !raf) raf = requestAnimationFrame(frame); });
