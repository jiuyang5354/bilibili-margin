/**
 * 液态玻璃透镜：把背景着色器先画进一张纹理，再整屏回画，并在指定圆角矩形里做
 * 「边缘折射 + 内部模糊 + 顶光高光 + 乳白/墨色染色」。
 * 思路来自 bubbbly「GitHub Glass Card」（Shadertoy 式超椭圆透镜），这里改写成圆角矩形 SDF，
 * 宽卡片的圆角不会被拉伸；纯原生 WebGL1，和背景共用同一个上下文与三角形。
 */
const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec4 u_rect;   // x, y (左下角), w, h —— 画布像素，y 向上
uniform float u_rad;
uniform vec3 u_tint;
uniform float u_milk;  // 底色 alpha（clear 款很低）
uniform float u_rim;   // 高光强度
uniform float u_bezel; // 弧边宽度（像素，恒定，不随卡片尺寸缩放）
uniform float u_px;    // 1 个 CSS 像素 = 多少画布像素
uniform vec3 u_canvas; // 页面底色
uniform float u_o;     // 背景强度（原来是 CSS opacity）
uniform float u_lift;  // 亮度提升（暗色抬一点，亮色不抬，否则发白）

// 用户实际看到的背景 = 着色器按强度叠在页面底色上，再盖一层自上而下的底色渐隐（原 .bg-scrim）。
// 这一步挪进 GL 里做，玻璃才能以满强度画在最上层，不被 opacity 和遮罩冲淡。
vec3 seen(vec2 px) {
  vec3 c = mix(u_canvas, texture2D(u_tex, px / u_res).rgb, u_o);
  float t = 1.0 - px.y / u_res.y;
  float a = t < 0.55 ? t : mix(0.55, 0.88, (t - 0.55) / 0.45);
  return mix(c, u_canvas, a);
}

float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }

// 凸 squircle 弧边 f(x) = (1-(1-x)^4)^(1/4) 的斜率
float slope(float x) { float u = 1.0 - x; return u * u * u * pow(max(1.0 - u * u * u * u, 1e-4), -0.75); }

// 竖直视线穿过弧边：Snell 折射 + 厚度 → 背景平面上的横向位移（单位：弧边宽度），乘菲涅尔透射率
float shift(float x, float n) {
  float ts = atan(slope(x));
  float tr = asin(sin(ts) / n);
  float t = 0.12 + (1.0 - pow(1.0 - x, 4.0)) ;          // 底座 + 弧面高度（f^4 足够近似）
  float c = cos(ts);
  float R = 0.04 + 0.96 * pow(1.0 - c, 5.0);           // Schlick
  return t * tan(ts - tr) * (1.0 - R);
}

vec3 grade(vec3 c) {                                    // clear 款：saturate 1.8 / brightness 1.06 / contrast 1.04
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 1.8);
  c = (c - 0.5) * 1.04 + 0.5;
  return c * u_lift;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  vec3 bg = seen(fc);
  vec2 hb = u_rect.zw * 0.5;
  vec2 c = u_rect.xy + hb;
  vec2 p = fc - c;
  float sd = sdRound(p, hb, u_rad);
  float inside = clamp(0.5 - sd, 0.0, 1.0);
  if (inside <= 0.0) { gl_FragColor = vec4(bg, 1.0); return; }

  vec2 e = vec2(1.0, 0.0);
  vec2 n = normalize(vec2(sdRound(p + e.xy, hb, u_rad) - sdRound(p - e.xy, hb, u_rad),
                          sdRound(p + e.yx, hb, u_rad) - sdRound(p - e.yx, hb, u_rad)) + 1e-5);
  float x = clamp(-sd / u_bezel, 0.004, 1.0);          // 0 = 外沿，1 = 进入平坦区
  // 中心完全不位移（透明）；位移只在弧边，峰值贴着外沿，指向圆心（凸透镜放大）
  float k = x < 1.0 ? u_bezel : 0.0;
  float dR = shift(x, 1.5143), dG = shift(x, 1.5168), dB = shift(x, 1.5224);
  float disp = 6.0;                                     // 色散夸张系数（≈ 2px 色边）
  vec2 inward = -n * k * 1.6;                          // UI 尺度上把折射放大一点，平滑背景下才看得出弧边
  vec3 col;
  vec2 blur = vec2(u_px * 1.0);                // clear 款只有 ~2px 的轻模糊
  vec3 acc = vec3(0.0);
  for (float i = -1.0; i <= 1.0; i++) {
    for (float j = -1.0; j <= 1.0; j++) {
      vec2 o = vec2(i, j) * blur;
      acc.r += seen(fc + inward * dG * (1.0 - (1.0 - 0.99516) * disp) + o).r;
      acc.g += seen(fc + inward * dG + o).g;
      acc.b += seen(fc + inward * dG * (1.0 + (1.01084 - 1.0) * disp) + o).b;
    }
  }
  col = grade(acc / 9.0);
  col = mix(col, u_tint, u_milk);                       // 中性底色（亮色白 / 暗色近黑）

  // 高光：实测 Control Center —— 上下沿亮细线、左右沿暗细线；外加菲涅尔内侧羽化
  float core = smoothstep(max(1.6 * u_px, 1.3), 0.0, -sd);
  float vert = smoothstep(0.45, 0.85, abs(n.y));
  float flank = smoothstep(0.55, 0.92, abs(n.x));
  float topBias = n.y > 0.0 ? 1.0 : 0.8;
  col += core * vert * 0.6 * topBias * u_rim;
  col -= core * flank * 0.1 * u_rim;
  col += core * 0.12 * u_rim;                           // 一圈极细的整体亮边，保证在纯色背景上也读得出轮廓
  float cosT = cos(atan(slope(x)));
  float fres = (0.04 + 0.96 * pow(1.0 - cosT, 5.0)) * step(x, 0.999);
  col += fres * (n.y > 0.0 ? 0.18 : 0.25) * 0.6 * u_rim;
  gl_FragColor = vec4(mix(bg, clamp(col, 0.0, 1.0), inside), 1.0);
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
    for (const n of ['u_tex', 'u_res', 'u_rect', 'u_rad', 'u_tint', 'u_milk', 'u_rim', 'u_bezel', 'u_px', 'u_canvas', 'u_o', 'u_lift']) this.loc[n] = gl.getUniformLocation(this.prog, n);
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
  present(w: number, h: number, r: { x: number; y: number; w: number; h: number; r: number; px: number }, theme: 'light' | 'dark', o = 0.6): void {
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
    gl.uniform3fv(L.u_tint, dark ? [0.11, 0.11, 0.125] : [1, 1, 1]);
    gl.uniform1f(L.u_milk, dark ? 0.2 : 0.05);
    gl.uniform1f(L.u_lift, dark ? 1.06 : 0.99);
    gl.uniform1f(L.u_rim, dark ? 0.85 : 1.0);
    gl.uniform1f(L.u_bezel, Math.min(30 * r.px, r.h * 0.3));
    gl.uniform1f(L.u_px, r.px);
    gl.uniform3fv(L.u_canvas, dark ? [0x11 / 255, 0x11 / 255, 0x12 / 255] : [0xf5 / 255, 0xf4 / 255, 0xf1 / 255]);
    gl.uniform1f(L.u_o, o);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
