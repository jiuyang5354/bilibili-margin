/**
 * 液态玻璃透镜：把背景着色器先画进一张纹理，再整屏回画，并在指定圆角矩形里做
 * 「边缘折射 + 内部模糊 + 顶光高光 + 乳白/墨色染色」。
 * 思路来自 bubbbly「GitHub Glass Card」（Shadertoy 式超椭圆透镜），这里改写成圆角矩形 SDF，
 * 宽卡片的圆角不会被拉伸；纯原生 WebGL1，和背景共用同一个上下文与三角形。
 */
const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `precision mediump float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec4 u_rect;   // x, y (左下角), w, h —— 画布像素，y 向上
uniform float u_rad;
uniform vec3 u_tint;
uniform float u_milk;  // 染色强度
uniform float u_rim;   // 高光强度
uniform float u_bezel; // 折射带宽（像素）

float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  vec3 bg = texture2D(u_tex, uv).rgb;
  vec2 hb = u_rect.zw * 0.5;
  vec2 c = u_rect.xy + hb;
  vec2 p = fc - c;
  float sd = sdRound(p, hb, u_rad);
  float inside = clamp(0.5 - sd, 0.0, 1.0);
  if (inside <= 0.0) { gl_FragColor = vec4(bg, 1.0); return; }

  // SDF 梯度 = 朝外法线
  vec2 e = vec2(1.0, 0.0);
  vec2 n = normalize(vec2(sdRound(p + e.xy, hb, u_rad) - sdRound(p - e.xy, hb, u_rad),
                          sdRound(p + e.yx, hb, u_rad) - sdRound(p - e.yx, hb, u_rad)) + 1e-5);
  float depth = clamp(-sd / u_bezel, 0.0, 1.0);        // 0 = 边缘，1 = 进入平坦区
  float bend = pow(1.0 - depth, 2.2);
  // 通透：中间几乎不模糊、不染色，只微微放大；折射集中在边缘一圈，把外面的画面往里压
  vec2 base = c + p * 0.965 - n * bend * u_bezel * 1.35;
  vec2 ca = n * bend * 2.2;                              // 边缘色散
  vec3 acc = vec3(0.0);
  for (float x = -1.0; x <= 1.0; x++) {
    for (float y = -1.0; y <= 1.0; y++) {
      vec2 o = vec2(x, y) * (0.6 + bend * 2.4);
      acc.r += texture2D(u_tex, (base + o - ca) / u_res).r;
      acc.g += texture2D(u_tex, (base + o) / u_res).g;
      acc.b += texture2D(u_tex, (base + o + ca) / u_res).b;
    }
  }
  acc /= 9.0;

  float edge = smoothstep(2.0, 0.0, -sd);                // 最外 2px 的细边
  vec2 L = normalize(vec2(-0.5, 1.0));
  float key = clamp(dot(n, L), 0.0, 1.0);                // 左上主光
  float back = clamp(dot(n, -L), 0.0, 1.0);              // 右下回光
  vec3 col = mix(acc, u_tint, u_milk);
  col *= 1.0 + 0.06 * u_rim;                             // 玻璃比背景略亮一点
  col += edge * (0.25 + 0.75 * key + 0.35 * back) * u_rim;
  col += bend * (key * 0.18 + back * 0.08) * u_rim;      // 边缘内侧的菲涅尔亮带
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(mix(bg, col, inside), 1.0);
}`;

export class GlassLens {
  private prog: WebGLProgram;
  private fbo: WebGLFramebuffer;
  private tex: WebGLTexture;
  private w = 0;
  private h = 0;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  constructor(private gl: WebGLRenderingContext) {
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('[MARGIN] lens', gl.getShaderInfoLog(s)); return s; };
    this.prog = gl.createProgram()!;
    gl.attachShader(this.prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(this.prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(this.prog);
    for (const n of ['u_tex', 'u_res', 'u_rect', 'u_rad', 'u_tint', 'u_milk', 'u_rim', 'u_bezel']) this.loc[n] = gl.getUniformLocation(this.prog, n);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer()!;
  }

  /** 之后的绘制先进纹理 */
  target(w: number, h: number): void {
    const gl = this.gl;
    if (w !== this.w || h !== this.h) {
      this.w = w; this.h = h;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, w, h);
  }

  /** 纹理整屏回画到画布，矩形内做玻璃 */
  present(w: number, h: number, r: { x: number; y: number; w: number; h: number; r: number }, theme: 'light' | 'dark'): void {
    const gl = this.gl, L = this.loc;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.prog);
    const a = gl.getAttribLocation(this.prog, 'p');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(L.u_tex, 0);
    gl.uniform2f(L.u_res, w, h);
    gl.uniform4f(L.u_rect, r.x, r.y, r.w, r.h);
    gl.uniform1f(L.u_rad, Math.min(r.r, r.h / 2, r.w / 2));
    const dark = theme === 'dark';
    gl.uniform3fv(L.u_tint, dark ? [0.05, 0.05, 0.06] : [1, 1, 1]);
    gl.uniform1f(L.u_milk, dark ? 0.12 : 0.1);
    gl.uniform1f(L.u_rim, dark ? 0.8 : 1.0);
    gl.uniform1f(L.u_bezel, Math.max(12, r.h * 0.2));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
