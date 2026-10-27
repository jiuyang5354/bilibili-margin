import type { ShaderId } from '../../shared/settings';
import { BUILDER } from './builder';
import { fragment, isBuilder, PALETTES } from './shaders';

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);

/** 一个编译好的背景着色器：原创款用 u_c1..u_c3，21st Builder 款用打包的 vec4 uniform */
export class ShaderProgram {
  readonly prog: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  constructor(private gl: WebGLRenderingContext, readonly id: ShaderId) {
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('[MARGIN] shader', id, gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fragment(id)));
    gl.linkProgram(prog);
    this.prog = prog;
    const names = isBuilder(id) ? ['u_colors', 'u_scene', 'u_shape', 'u_surface', 'u_finish', 'u_transform', 'u_space', 'u_cursor'] : ['u_res', 'u_t', 'u_c1', 'u_c2', 'u_c3', 'u_bg'];
    for (const n of names) this.loc[n] = gl.getUniformLocation(prog, n);
  }

  bind(): void {
    const gl = this.gl;
    gl.useProgram(this.prog);
    const a = gl.getAttribLocation(this.prog, 'p');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  }

  /** t 是秒 */
  draw(w: number, h: number, t: number, theme: 'light' | 'dark'): void {
    const gl = this.gl, L = this.loc;
    if (isBuilder(this.id)) {
      const pr = BUILDER[this.id], u = pr.u;
      const cols = pr[theme].map(hex);
      while (cols.length < 8) cols.push(cols[cols.length - 1]);
      gl.uniform3fv(L.u_colors, new Float32Array(cols.flat()));
      gl.uniform4f(L.u_scene, w, h, t * u.timeScale, pr[theme].length);
      gl.uniform4f(L.u_shape, u.scale, u.intensity, u.paramA, u.warp);
      gl.uniform4f(L.u_surface, u.detail, u.contrast, u.brightness, u.saturation);
      gl.uniform4f(L.u_finish, u.hue, u.vignette, u.blur, u.grain);
      gl.uniform4f(L.u_transform, u.seed, u.rotate, u.drift, u.oklab);
      gl.uniform4f(L.u_space, u.offsetX, u.offsetY, 0, 0);
      gl.uniform4f(L.u_cursor, 0, 0, 0, 0);
    } else {
      const pal = PALETTES[theme][this.id]!;
      gl.uniform2f(L.u_res, w, h);
      gl.uniform1f(L.u_t, t);
      gl.uniform3fv(L.u_bg, pal.bg);
      gl.uniform3fv(L.u_c1, pal.c[0]);
      gl.uniform3fv(L.u_c2, pal.c[1]);
      gl.uniform3fv(L.u_c3, pal.c[2]);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

export function setupQuad(gl: WebGLRenderingContext): void {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
}

/** 设置面板里的色块：用一张离屏画布把每款着色器真实渲染成缩略图 */
const thumbCache = new Map<string, string>();
let thumbGl: WebGLRenderingContext | null = null;
let thumbCanvas: HTMLCanvasElement | null = null;
export function shaderThumb(id: ShaderId, theme: 'light' | 'dark'): string | null {
  const key = `${id}:${theme}`;
  if (thumbCache.has(key)) return thumbCache.get(key)!;
  if (!thumbGl) {
    thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 160; thumbCanvas.height = 120;
    thumbGl = thumbCanvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
    if (!thumbGl) return null;
    setupQuad(thumbGl);
  }
  const p = new ShaderProgram(thumbGl, id);
  p.bind();
  thumbGl.viewport(0, 0, 160, 120);
  p.draw(160, 120, 14, theme);
  const url = thumbCanvas!.toDataURL('image/jpeg', 0.85);
  thumbGl.deleteProgram(p.prog);
  thumbCache.set(key, url);
  return url;
}
