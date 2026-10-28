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
    // 省电/防卡：滚动时、页面上有视频在播放时，背景暂停在当前帧（每帧重绘会让上层所有毛玻璃一起重新合成）
    const busy = () => { this.quietUntil = performance.now() + 220; };
    addEventListener('scroll', busy, { capture: true, passive: true });
    addEventListener('wheel', busy, { capture: true, passive: true });
    const vid = () => { this.videoPlaying = [...document.querySelectorAll('video')].some((v) => !v.paused && !v.ended && v.readyState > 2 && v.getBoundingClientRect().width > 320); };
    for (const ev of ['play', 'playing', 'pause', 'ended', 'emptied']) document.addEventListener(ev, vid, true);
  }
  private quietUntil = 0;
  /** 昼夜切换的调色板插值，时长/缓动和日月按钮一致（1740ms，cubic-bezier(.65,0,.35,1)） */
  fadeMs = 1740;
  private kFrom = 0; private kTo = 0; private kT0 = 0;
  private kNow(now: number): number {
    if (!this.kT0) return this.kTo;
    const x = Math.min(1, (now - this.kT0) / this.fadeMs);
    if (x >= 1) { this.kT0 = 0; return this.kTo; }
    const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    return this.kFrom + (this.kTo - this.kFrom) * e;
  }
  private videoPlaying = false;

  async apply(cfg: Background, theme: 'light' | 'dark', palette: Palette = 'classic'): Promise<void> {
    this.palette = palette;
    const first = !this.cfg;
    const prevMode = this.cfg?.mode;
    this.cfg = cfg;
    const target = theme === 'dark' ? 1 : 0;
    if (!first && theme !== this.theme && !this.reduced.matches && !this.soft) { this.kFrom = this.kNow(performance.now()); this.kTo = target; this.kT0 = performance.now(); }
    else { this.kFrom = this.kTo = target; this.kT0 = 0; }
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
    this.pending = requestAnimationFrame(() => { this.pending = 0; this.draw(performance.now(), true); });
  }

  /** 没有显卡加速（SwiftShader / llvmpipe 等软件渲染）时：背景只画静止的一帧，不做玻璃透镜。
   *  软件合成下画布每变一次都要整张回读，动画和滚动时的透镜会把主线程拖到个位数帧率 */
  private soft = false;

  private syncLens(): void {
    const on = !this.soft && !!this.lensEl && !!this.prog && (this.cfg?.mode === 'random' || this.cfg?.mode === 'fixed');
    this.lensEl?.toggleAttribute('data-lens', on);
  }

  private use(id: ShaderId): void {
    if (!this.gl) {
      this.gl = this.canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
      if (!this.gl) { this.el.dataset.mode = 'off'; return; }
      setupQuad(this.gl);
      this.soft = isSoftwareGl(this.gl);
      if (this.soft) this.el.dataset.soft = '';
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
    // 背景本身很柔和：缓冲区最宽 640px，再由 CSS 放大，肉眼看不出差别，GPU 负担小很多
    const scale = Math.min(0.5, 640 / Math.max(1, r.width));
    this.canvas.width = Math.max(1, Math.round(r.width * scale));
    this.canvas.height = Math.max(1, Math.round(r.height * scale));
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.draw(performance.now());
  }

  /** 上一帧画进纹理的着色器状态；滚动时着色器本身不动，只需要把纹理按新位置重新做一次透镜 */
  private texKey = '';
  private hadRect = false;

  private draw(now: number, moveOnly = false): void {
    if (!this.gl || !this.prog) return;
    const gl = this.gl, w = this.canvas.width, hh = this.canvas.height;
    const t = this.reduced.matches ? 12 : (now - this.start) / 1000;
    const rect = this.lensRect();
    // 滚动触发、而玻璃一直在屏幕外：画面没有变化，什么都不用画
    if (moveOnly && !rect && !this.hadRect) return;
    this.hadRect = !!rect;
    // 有玻璃时由 GL 自己合成强度和遮罩（canvas 满不透明），没有时走原来的 CSS opacity + scrim
    this.el.toggleAttribute('data-composite', !!rect);
    const k = this.kNow(now);
    if (!rect) { this.texKey = ''; this.prog.bind(); this.prog.draw(w, hh, t, k); return; }
    this.lens ??= new GlassLens(gl);
    const key = `${this.current}|${w}x${hh}|${k}`;
    if (!moveOnly || this.texKey !== key) {
      this.lens.target(w, hh);
      this.prog.bind();
      this.prog.draw(w, hh, t, k);
      this.texKey = key;
    }
    this.lens.present(w, hh, rect, k, this.cfg.intensity);
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
    if (this.soft) return;
    if (this.raf || !this.cfg || (this.cfg.mode !== 'random' && this.cfg.mode !== 'fixed') || document.hidden) return;
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      const fading = !!this.kT0;
      if (!fading && now - this.last < 42) return;
      if (!fading && (this.videoPlaying || now < this.quietUntil)) return;
      this.last = now;
      this.draw(now);
      if (this.reduced.matches && !this.kT0) this.stop();
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

function isSoftwareGl(gl: WebGLRenderingContext): boolean {
  try { if (localStorage.getItem('margin:force-gl')) return false; } catch { /* ignore */ }
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(r);
}
