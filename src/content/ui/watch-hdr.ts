/// <reference types="@webgpu/types" />
import { loadSettings, saveSettings, type Settings } from '../../shared/settings';

type Strength = Settings['hdrStrength'];
const peaks: Record<Strength, number> = { soft: 1.45, standard: 1.85, vivid: 2.30 };
const label = 'SDR 转 HDR 增强 (Alt+H)';

const shader = /* wgsl */ `
struct Params {
  box: vec4f,
  image: vec4f,
  peak: f32,
}
@group(0) @binding(0) var frame: texture_external;
@group(0) @binding(1) var frameSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

struct Vertex {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex fn vertex(@builtin(vertex_index) i: u32) -> Vertex {
  let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return Vertex(vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0), uv);
}

@fragment fn fragment(@location(0) position: vec2f) -> @location(0) vec4f {
  let uv = (position - params.image.xy) / params.image.zw;
  if (any(position < params.box.xy) || any(position > params.box.zw) ||
      any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }
  let rgb = max(textureSampleBaseClampToEdge(frame, frameSampler, uv).rgb, vec3f(0.0));
  let lin = select(rgb / 12.92, pow((rgb + 0.055) / 1.055, vec3f(2.4)), rgb > vec3f(0.04045));
  let y = dot(lin, vec3f(0.2126, 0.7152, 0.0722));
  let highlight = smoothstep(0.35, 1.0, y);
  let lift = 1.0 + (params.peak - 1.0) * highlight * highlight / max(y, 0.35);
  let enhanced = max((lin + (lin - vec3f(y)) * 0.06 * highlight) * lift, vec3f(0.0));
  let encoded = select(enhanced * 12.92, 1.055 * pow(enhanced, vec3f(1.0 / 2.4)) - 0.055,
    enhanced > vec3f(0.0031308));
  return vec4f(encoded, 1.0);
}
`;

async function renderHdr(video: HTMLVideoElement, wrap: HTMLElement, signal: AbortSignal,
  strength: () => Strength, ready: () => void, fail: () => void): Promise<() => void> {
  const adapter = await navigator.gpu?.requestAdapter();
  signal.throwIfAborted();
  if (!adapter) throw new Error('WebGPU adapter unavailable');
  const device = await adapter.requestDevice();
  if (signal.aborted) { device.destroy(); signal.throwIfAborted(); }
  signal.addEventListener('abort', () => device.destroy(), { once: true });
  void device.lost.then(fail);
  device.addEventListener('uncapturederror', event => { event.preventDefault(); fail(); });

  const canvas = document.createElement('canvas');
  canvas.className = 'm-hdr-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  const context = canvas.getContext('webgpu');
  if (!context) throw new Error('WebGPU canvas unavailable');
  signal.addEventListener('abort', () => context.unconfigure(), { once: true });
  const format = 'rgba16float';
  device.pushErrorScope('validation');
  try { context.configure({ device, format, alphaMode: 'opaque', toneMapping: { mode: 'extended' } }); }
  finally {
    const error = await device.popErrorScope();
    if (error) throw error;
  }
  signal.throwIfAborted();
  if (context.getConfiguration?.()?.toneMapping?.mode !== 'extended') throw new Error('Extended HDR unavailable');
  const module = device.createShaderModule({ code: shader });
  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: { module, entryPoint: 'vertex' },
    fragment: { module, entryPoint: 'fragment', targets: [{ format }] },
  });
  signal.throwIfAborted();

  const params = new Float32Array(12);
  const uniform = device.createBuffer({ size: params.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const layout = pipeline.getBindGroupLayout(0);
  const useVideoFrames = typeof video.requestVideoFrameCallback === 'function';
  let frame: number | undefined;
  const cancel = () => {
    if (frame === undefined) return;
    if (useVideoFrames) video.cancelVideoFrameCallback(frame);
    else cancelAnimationFrame(frame);
    frame = undefined;
  };
  const canDraw = () => !signal.aborted && !document.hidden && video.isConnected && wrap.contains(video)
    && !video.seeking && video.readyState >= 2;
  const draw = () => {
    if (!canDraw() || !params[6] || !params[7]) return;
    try {
      params[8] = peaks[strength()];
      device.queue.writeBuffer(uniform, 0, params);
      const source = device.importExternalTexture({ source: video, colorSpace: 'srgb' });
      const bindGroup = device.createBindGroup({
        layout,
        entries: [{ binding: 0, resource: source }, { binding: 1, resource: sampler }, { binding: 2, resource: { buffer: uniform } }],
      });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
      if (canvas.hidden) { canvas.hidden = false; ready(); }
    } catch { fail(); }
  };
  const schedule = () => {
    if (frame !== undefined || !canDraw() || video.paused || video.ended) return;
    const next = () => { frame = undefined; draw(); schedule(); };
    frame = useVideoFrames ? video.requestVideoFrameCallback(next) : requestAnimationFrame(next);
  };
  const refresh = () => {
    if (signal.aborted || document.hidden) return;
    const box = wrap.getBoundingClientRect(), rect = video.getBoundingClientRect();
    if (!box.width || !box.height || !rect.width || !rect.height || !video.videoWidth || !video.videoHeight) {
      params[6] = params[7] = 0;
      canvas.hidden = true;
      return;
    }
    const scale = Math.min(devicePixelRatio, device.limits.maxTextureDimension2D / Math.max(box.width, box.height));
    const width = Math.max(1, Math.round(box.width * scale)), height = Math.max(1, Math.round(box.height * scale));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    // Match the native video element's box and center the contained or cropped frame within it.
    const fit = getComputedStyle(video).objectFit === 'cover' ? Math.max : Math.min;
    const imageScale = fit(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const x = (rect.left - box.left) / box.width, y = (rect.top - box.top) / box.height;
    const w = rect.width / box.width, h = rect.height / box.height;
    const imageWidth = video.videoWidth * imageScale / box.width, imageHeight = video.videoHeight * imageScale / box.height;
    params.set([x, y, x + w, y + h, x + (w - imageWidth) / 2, y + (h - imageHeight) / 2, imageWidth, imageHeight]);
    draw();
    schedule();
  };
  const resize = new ResizeObserver(refresh);
  signal.addEventListener('abort', () => {
    cancel();
    resize.disconnect();
    canvas.remove();
    wrap.classList.remove('m-hdr-position');
    uniform.destroy();
  }, { once: true });
  for (const event of ['loadeddata', 'resize', 'seeked']) video.addEventListener(event, refresh, { signal });
  for (const event of ['play', 'playing']) video.addEventListener(event, schedule, { signal });
  for (const event of ['pause', 'ended', 'waiting', 'seeking']) video.addEventListener(event, cancel, { signal });
  video.addEventListener('emptied', () => { cancel(); canvas.hidden = true; }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); else refresh(); }, { signal });
  if (getComputedStyle(wrap).position === 'static') wrap.classList.add('m-hdr-position');
  wrap.append(canvas);
  resize.observe(wrap);
  resize.observe(video);
  refresh();
  return refresh;
}

export class WatchHdrController {
  private enabled: boolean;
  private strength: Strength;
  private saving = false;
  private suspended = false;
  private feedbackUntil = 0;
  private button?: HTMLButtonElement;
  private video: HTMLVideoElement | null = null;
  private wrap: HTMLElement | null = null;
  private session?: AbortController;
  private refresh?: () => void;
  private gpuActive = false;

  constructor(settings: Settings, private tip: (text: string) => void) {
    this.enabled = settings.hdrEnhance;
    this.strength = settings.hdrStrength;
    document.addEventListener('keydown', event => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat || event.isComposing
        || event.key.toLowerCase() !== 'h') return;
      const target = event.composedPath()[0];
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) return;
      event.preventDefault();
      event.stopPropagation();
      void this.toggle();
    }, true);
    addEventListener('pagehide', () => { this.suspended = true; this.stop(); });
    addEventListener('pageshow', () => { this.suspended = false; this.sync(this.video); });
  }

  update(settings: Settings): void {
    if (!this.saving) this.enabled = settings.hdrEnhance;
    const changedStrength = this.strength !== settings.hdrStrength;
    this.strength = settings.hdrStrength;
    this.sync(this.video);
    if (changedStrength) this.refreshFrame();
  }

  async toggle(): Promise<void> {
    this.enabled = !this.enabled;
    this.feedbackUntil = performance.now() + 900;
    this.sync(this.video);
    this.showMode();
    if (this.saving) return;
    this.saving = true;
    const previous = !this.enabled;
    try {
      let value: boolean;
      do {
        value = this.enabled;
        await saveSettings({ hdrEnhance: value });
      } while (this.enabled !== value);
    } catch {
      this.enabled = (await loadSettings().catch(() => null))?.hdrEnhance ?? previous;
      this.feedbackUntil = 0;
      this.sync(this.video);
      this.tip('HDR 增强设置保存失败');
    } finally { this.saving = false; }
  }

  sync(video: HTMLVideoElement | null): void {
    const player = video?.closest('.bpx-player-container') ?? document.querySelector('.bpx-player-container');
    // Wait until Bilibili has claimed the server-rendered controls and video wrapper.
    const container = player?.closest('[data-server-rendered]') ? null : player;
    const controls = container?.querySelector('.bpx-player-control-bottom-right');
    if (controls) {
      if (!this.button) {
        const button = this.button = document.createElement('button');
        button.type = 'button';
        button.className = 'bpx-player-ctrl-btn m-hdr-btn';
        button.title = label;
        button.setAttribute('aria-label', label);
        const pill = document.createElement('span');
        pill.textContent = 'HDR';
        button.append(pill);
        button.addEventListener('click', event => { event.stopPropagation(); void this.toggle(); });
      }
      const before = controls.querySelector(':scope > .bpx-player-ctrl-wide') ?? controls.querySelector(':scope > .bpx-player-ctrl-web');
      if (this.button.parentElement !== controls || (before && this.button.nextElementSibling !== before)) controls.insertBefore(this.button, before);
      if (this.button.getAttribute('aria-pressed') !== String(this.enabled)) this.button.setAttribute('aria-pressed', String(this.enabled));
    } else this.button?.remove();

    const wrap = container ? video?.closest<HTMLElement>('.bpx-player-video-wrap') ?? null : null;
    if (this.video !== video || this.wrap !== wrap) { this.stop(); this.video = video; this.wrap = wrap; }
    if (!this.enabled || this.suspended) { this.stop(); return; }
    if (!video?.isConnected || !wrap) return;
    if (!this.gpuActive) this.setFallback(true);
    if (this.session) return;
    const session = this.session = new AbortController();
    const { signal } = session;
    const fail = () => {
      if (signal.aborted) return;
      session.abort();
      this.refresh = undefined;
      this.gpuActive = false;
      this.setFallback(true);
      if (performance.now() < this.feedbackUntil) this.showMode();
    };
    void renderHdr(video, wrap, signal, () => this.strength, () => {
      this.gpuActive = true;
      this.setFallback(false);
      if (performance.now() < this.feedbackUntil) this.showMode();
    }, fail).then(refresh => { if (!signal.aborted) this.refresh = refresh; }, fail);
  }

  refreshFrame(): void { this.refresh?.(); }

  private setFallback(on: boolean): void {
    if (!this.wrap) return;
    if (on) {
      this.wrap.classList.add('m-hdr-fallback');
      if (this.wrap.dataset.hdrStrength !== this.strength) this.wrap.dataset.hdrStrength = this.strength;
    } else if (this.wrap.classList.contains('m-hdr-fallback')) {
      this.wrap.classList.remove('m-hdr-fallback');
      delete this.wrap.dataset.hdrStrength;
    }
  }

  private stop(): void {
    this.session?.abort();
    this.session = undefined;
    this.refresh = undefined;
    this.gpuActive = false;
    this.setFallback(false);
  }

  private showMode(): void {
    this.tip(this.enabled
      ? this.gpuActive ? 'HDR 增强 · 开启 (WebGPU HDR)' : 'HDR 增强 · 开启 (兼容画质增强)'
      : 'HDR 增强 · 关闭');
  }
}
