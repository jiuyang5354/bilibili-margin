import type { Background, Palette, ShaderId } from '../../shared/settings';
import { BG_IMAGE_KEY } from '../../shared/settings';
import { SHADER_IDS } from './shaders';
import { setupQuad, ShaderProgram } from './program';
import { h } from '../ui/dom';
import { GlassLens } from './lens';

const LAST_KEY = 'margin:last-shader';

/** 首页背景层：WebGL 着色器（半分辨率、约 30fps、隐藏时暂停）或自定义图片 */
export class BackgroundLayer {
  readonly el = h('div', { class: 'bg', 'aria-hidden': 'true' });
  private canvas = h('canvas', {});
  private img = h('div', { class: 'bg-img' });
  private gl: WebGLRenderingContext | null = null;
  private prog: ShaderProgram | null = null;
  private raf = 0;
  private last = 0;
  private start = performance.now();
  private current: ShaderId | null = null;
  private theme: 'light' | 'dark' = 'dark';
  private palette: Palette = 'classic';
  private cfg!: Background;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private lens: GlassLens | null = null;
  private lensEl: HTMLElement | null = null;
  private pending = 0;

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
    if (cfg.mode === 'off') { this.stop(); this.syncLens(); return; }
    if (cfg.mode === 'image') {
      this.stop(); this.syncLens();
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
    this.syncLens();
    this.draw(performance.now());
    this.loop();
  }

  get shader(): ShaderId | null { return this.current; }

  /** 让某个元素成为「液态玻璃」：背景着色器在它的位置做透镜折射（bubbbly GitHub Glass Card 的做法） */
  setLens(el: HTMLElement | null): void {
    this.lensEl?.removeAttribute('data-lens');
    this.lensEl = el;
    this.syncLens();
  }

  /** 滚动等让透镜位置变化时调用：下一帧立刻重画，不等 30fps 节拍 */
  redraw(): void {
    if (this.pending || !this.lensEl) return;
    this.pending = requestAnimationFrame(() => { this.pending = 0; this.draw(performance.now()); });
  }

  private syncLens(): void {
    const on = !!this.lensEl && !!this.prog && (this.cfg?.mode === 'random' || this.cfg?.mode === 'fixed');
    this.lensEl?.toggleAttribute('data-lens', on);
  }

  private use(id: ShaderId): void {
    if (!this.gl) {
      this.gl = this.canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
      if (!this.gl) { this.el.dataset.mode = 'off'; return; }
      setupQuad(this.gl);
    }
    if (id === this.current && this.prog) return;
    if (this.prog) this.gl.deleteProgram(this.prog.prog);
    this.prog = new ShaderProgram(this.gl, id);
    this.prog.bind();
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
    if (!this.gl || !this.prog) return;
    const gl = this.gl, w = this.canvas.width, hh = this.canvas.height;
    const t = this.reduced.matches ? 12 : (now - this.start) / 1000;
    const rect = this.lensRect();
    if (!rect) { this.prog.bind(); this.prog.draw(w, hh, t, this.theme); return; }
    this.lens ??= new GlassLens(gl);
    this.lens.target(w, hh);
    this.prog.bind();
    this.prog.draw(w, hh, t, this.theme);
    this.lens.present(w, hh, rect, this.theme);
  }

  /** 透镜元素在画布上的矩形（画布像素，y 向上）；不可见时返回 null */
  private lensRect(): { x: number; y: number; w: number; h: number; r: number; px: number } | null {
    const el = this.lensEl;
    if (!el || !el.hasAttribute('data-lens')) return null;
    const b = this.el.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.bottom < b.top || r.top > b.bottom || r.width < 2) return null;
    const k = this.canvas.width / Math.max(1, b.width);
    const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 18;
    return { x: (r.left - b.left) * k, y: (b.bottom - r.bottom) * k, w: r.width * k, h: r.height * k, r: rad * k, px: k };
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
