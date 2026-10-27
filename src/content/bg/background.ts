import type { Background, Palette, ShaderId } from '../../shared/settings';
import { BG_IMAGE_KEY } from '../../shared/settings';
import { fragment, MIST, PALETTES, SHADER_IDS } from './shaders';
import { h } from '../ui/dom';

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const LAST_KEY = 'margin:last-shader';

/** 首页背景层：WebGL 着色器（半分辨率、约 30fps、隐藏时暂停）或自定义图片 */
export class BackgroundLayer {
  readonly el = h('div', { class: 'bg', 'aria-hidden': 'true' });
  private canvas = h('canvas', {});
  private img = h('div', { class: 'bg-img' });
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private raf = 0;
  private last = 0;
  private start = performance.now();
  private current: ShaderId | null = null;
  private theme: 'light' | 'dark' = 'dark';
  private palette: Palette = 'classic';
  private cfg!: Background;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor() {
    this.el.append(this.canvas, this.img, h('div', { class: 'bg-scrim' }));
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.loop()));
    new ResizeObserver(() => this.resize()).observe(this.el);
  }

  async apply(cfg: Background, theme: 'light' | 'dark', palette: Palette = 'classic'): Promise<void> {
    this.palette = palette;
    const first = !this.cfg;
    const prevMode = this.cfg?.mode;
    this.cfg = cfg;
    this.theme = theme;
    this.el.dataset.mode = cfg.mode;
    this.el.style.setProperty('--bg-o', String(cfg.intensity));
    if (cfg.mode === 'off') { this.stop(); return; }
    if (cfg.mode === 'image') {
      this.stop();
      const r = await chrome.storage.local.get(BG_IMAGE_KEY);
      const url = r[BG_IMAGE_KEY] as string | undefined;
      this.img.style.backgroundImage = url ? `url("${url}")` : '';
      if (!url) this.el.dataset.mode = 'off';
      return;
    }
    let id: ShaderId = cfg.shader;
    if (cfg.mode === 'random') {
      if (first || prevMode !== 'random' || !this.current) {
        const prev = localStorage.getItem(LAST_KEY);
        const pool = SHADER_IDS.filter((s) => s !== prev);
        id = pool[Math.floor(Math.random() * pool.length)];
        localStorage.setItem(LAST_KEY, id);
      } else id = this.current;
    }
    this.use(id);
    this.draw(performance.now());
    this.loop();
  }

  get shader(): ShaderId | null { return this.current; }

  private use(id: ShaderId): void {
    if (!this.gl) {
      this.gl = this.canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
      if (!this.gl) { this.el.dataset.mode = 'off'; return; }
      const gl = this.gl;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    }
    if (id === this.current && this.prog) return;
    const gl = this.gl;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('[MARGIN] shader', gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fragment(id)));
    gl.linkProgram(prog);
    if (this.prog) gl.deleteProgram(this.prog);
    this.prog = prog;
    gl.useProgram(prog);
    const a = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const u of ['u_res', 'u_t', 'u_c1', 'u_c2', 'u_c3', 'u_bg']) this.loc[u] = gl.getUniformLocation(prog, u);
    this.current = id;
    this.el.dataset.shader = id;
    this.resize();
  }

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    const scale = 0.5;
    this.canvas.width = Math.max(1, Math.round(r.width * scale));
    this.canvas.height = Math.max(1, Math.round(r.height * scale));
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.draw(performance.now());
  }

  private draw(now: number): void {
    const gl = this.gl;
    if (!gl || !this.prog || !this.current) return;
    const pal = this.palette === 'mist' ? MIST[this.theme] : PALETTES[this.theme][this.current];
    gl.uniform2f(this.loc.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.loc.u_t, this.reduced.matches ? 12 : (now - this.start) / 1000);
    gl.uniform3fv(this.loc.u_bg, pal.bg);
    gl.uniform3fv(this.loc.u_c1, pal.c[0]);
    gl.uniform3fv(this.loc.u_c2, pal.c[1]);
    gl.uniform3fv(this.loc.u_c3, pal.c[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private loop = (): void => {
    if (this.raf || !this.cfg || (this.cfg.mode !== 'random' && this.cfg.mode !== 'fixed') || document.hidden) return;
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      if (now - this.last < 33) return;
      this.last = now;
      this.draw(now);
      if (this.reduced.matches) this.stop();
    };
    this.raf = requestAnimationFrame(tick);
  };

  private stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

/** 压缩上传的图片为 JPEG dataURL（最长边 2400px） */
export async function compressImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
