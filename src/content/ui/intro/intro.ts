import { createRenderer, endOf, frameAt, loadLogo, LOOKS, type Settings } from './engine';

/** B 站小电视（Simple Icons，CC0）——只取形状，颜色由主题给 */
const BILI = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z"/></svg>';

const SESSION_KEY = 'margin:intro-played';

function softwareGl(canvas: HTMLCanvasElement): boolean {
  try { if (localStorage.getItem('margin:force-gl')) return false; } catch { /* ignore */ }
  const gl = canvas.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(r);
}

/** 这次要不要放开场：每个浏览器会话一次；减少动态效果、软件渲染时不放 */
export function shouldPlayIntro(enabled: boolean): boolean {
  if (!enabled) return false;
  try { if (sessionStorage.getItem(SESSION_KEY) && !localStorage.getItem('margin:intro-always')) return false; } catch { /* ignore */ }
  return !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 首页开场：21st.dev「Glass Reveal」——一滴玻璃落下、铺成圆角方块，B 站小电视在玻璃边缘被折射出彩边，
 * 然后玻璃松开，留下图标，整层淡出露出首页。约 3.8 秒，点击 / 按键 / 滚轮立即跳过。
 */
export function playIntro(parent: HTMLElement, theme: 'light' | 'dark'): Promise<void> {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
  const dark = theme === 'dark';
  // 底色和首页画布一致，淡出时无缝接上
  const bg = dark ? '#111112' : '#f5f4f1';
  const P: Settings = {
    ...LOOKS[dark ? 'dark' : 'light'],
    background: bg,
    plateColor: dark ? '#1a1a1c' : '#ffffff',
    logoColor: dark ? '#ffffff' : '#00aeec',
    logoScale: 0.62,
    finalScale: dark ? 0.9 : 0.8,
    startZoom: 2.3,
  };
  const el = document.createElement('div');
  el.className = 'intro';
  el.style.background = bg;
  el.setAttribute('role', 'presentation');
  const canvas = document.createElement('canvas');
  el.append(canvas);
  parent.append(el);

  return new Promise<void>((resolve) => {
    let raf = 0, done = false;
    const finish = (fast = false) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      removeEventListener('keydown', skip, true);
      el.style.transition = `opacity ${fast ? 0.25 : 0.6}s cubic-bezier(.4, 0, .2, 1)`;
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      setTimeout(() => { renderer?.dispose(); el.remove(); }, fast ? 300 : 650);
      resolve();
    };
    const skip = () => finish(true);
    el.addEventListener('pointerdown', skip);
    el.addEventListener('wheel', skip, { passive: true });
    addEventListener('keydown', skip, true);

    if (softwareGl(canvas)) { finish(true); return; }
    let renderer: ReturnType<typeof createRenderer> = null;
    try { renderer = createRenderer(canvas); } catch (e) { console.info('[MARGIN] 开场动画不可用', e); }
    if (!renderer) { finish(true); return; }
    // 保险：任何意外都不让开场挡住首页超过 6 秒
    setTimeout(() => { try { if (localStorage.getItem('margin:intro-freeze')) return; } catch { /* ignore */ } finish(); }, 6000);

    loadLogo(BILI).then((logo) => {
      if (done) return;
      renderer!.setLogo(logo);
      const end = endOf(P);
      const t0 = performance.now();
      // 调试 / 截图用：localStorage margin:intro-freeze = 秒数，停在那一帧
      let freeze = NaN;
      try { freeze = parseFloat(localStorage.getItem('margin:intro-freeze') ?? ''); } catch { /* ignore */ }
      const tick = (now: number) => {
        const t = Number.isFinite(freeze) ? freeze : (now - t0) / 1000;
        const dpr = Math.min(devicePixelRatio || 1, 1.5);
        const cw = canvas.clientWidth, ch = canvas.clientHeight;
        const w = Math.max(1, Math.round(cw * dpr)), hh = Math.max(1, Math.round(ch * dpr));
        if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
        const tile = Math.min(P.tileSize, Math.min(cw, ch) / 1.75);
        renderer!.render(frameAt(Math.min(t, end), P), w, hh, tile * dpr);
        if (Number.isFinite(freeze)) return;
        if (t >= end + 0.25) { finish(); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }).catch((e) => { console.info('[MARGIN] 开场图标加载失败', e); finish(true); });
  });
}
