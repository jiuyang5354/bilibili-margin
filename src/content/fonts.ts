/**
 * 打包进扩展的字体子集（GB2312 6763 字 + 常用标点/符号）：
 * - Geist / Geist Mono（Vercel，OFL）：西文与数字
 * - Margin Sans SC：思源黑体 Noto Sans SC 可变字重 400–700 子集（OFL）
 * - Margin Serif SC：霞鹜新致宋 LXGW Neo ZhiSong 子集（IPA 1.0）
 * Chrome 不认 shadow root 里的 @font-face，所以注册在 document 上，各处 shadow DOM 都能用。
 */
export function injectFonts(): void {
  if (document.getElementById('margin-fonts')) return;
  const u = (f: string) => chrome.runtime.getURL(`fonts/${f}`);
  const face = (family: string, file: string, weight: string) =>
    `@font-face{font-family:"${family}";src:url("${u(file)}") format("woff2");font-weight:${weight};font-style:normal;font-display:swap}`;
  const s = document.createElement('style');
  s.id = 'margin-fonts';
  s.textContent = [
    face('Geist', 'Geist.woff2', '100 900'),
    face('Geist Mono', 'GeistMono.woff2', '100 900'),
    face('Margin Sans SC', 'MarginSans-SC.woff2', '400 700'),
    face('Margin Serif SC', 'MarginSerif-SC.woff2', '400'),
  ].join('');
  (document.head ?? document.documentElement).append(s);
}
