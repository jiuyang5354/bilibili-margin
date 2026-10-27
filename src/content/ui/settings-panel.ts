import type { BgMode, Palette, Settings, ShaderId, Theme } from '../../shared/settings';
import { BG_IMAGE_KEY, saveSettings } from '../../shared/settings';
import { compressImage } from '../bg/background';
import { SHADER_IDS, SHADER_NAMES } from '../bg/shaders';
import { block, chipInput, rangeSlider, row, segmented, stepSlider, toggle } from './controls';
import { fmtCount, h, icon, ICONS } from './dom';
import { createSheet, type Sheet } from './sheet';

export interface SettingsPanel { sheet: Sheet; sync(s: Settings): void }

export function createSettingsPanel(get: () => Settings, currentShader: () => ShaderId | null): SettingsPanel {
  const sheet = createSheet({ title: '设置', eyebrow: 'PREFERENCES', width: 420 });
  const save = (patch: Partial<Settings>) => saveSettings(patch);
  const s0 = get();

  const theme = segmented<Theme>([['auto', '跟随系统'], ['light', '亮色'], ['dark', '暗色']], s0.theme, (v) => save({ theme: v }));
  const palettes = h('div', { class: 'palettes', role: 'radiogroup', 'aria-label': '配色' });
  for (const [id, name, sub] of [['classic', '经典', '暖白 · 衬线'], ['mist', '雾蓝', '暗色时为夜蓝']] as [Palette, string, string][]) {
    const b = h('button', { type: 'button', class: 'pal-item', role: 'radio', onclick: () => save({ palette: id }) },
      h('span', { class: `pal-chip pal-${id}` }, h('i', {}), h('i', {}), h('i', {})),
      h('span', { class: 'pal-text' }, h('b', {}, name), h('small', {}, sub)));
    b.dataset.v = id;
    palettes.append(b);
  }
  const paintPalettes = (v: Palette) => palettes.querySelectorAll<HTMLElement>('.pal-item').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === v)));
  paintPalettes(s0.palette);
  const preview = toggle(s0.hoverPreview, '悬停预览', (v) => save({ hoverPreview: v }));

  const kw = chipInput(s0.filters.keywords, '输入关键词，回车添加；/正则/ 也可以', (v) => save({ filters: { ...get().filters, keywords: v } }));
  const ups = chipInput(s0.filters.ups, 'UP 主昵称或 MID', (v) => save({ filters: { ...get().filters, ups: v } }));
  const views = stepSlider([0, 1000, 10000, 50000, 100000, 1000000], s0.filters.minViews, (n) => (n ? `≥ ${fmtCount(n)}` : '不限'), (v) => save({ filters: { ...get().filters, minViews: v } }));
  const dur = segmented<string>([['0', '不限'], ['60', '1 分钟'], ['180', '3 分钟'], ['600', '10 分钟']], String(s0.filters.minDuration), (v) => save({ filters: { ...get().filters, minDuration: Number(v) } }));

  const mode = segmented<BgMode>([['random', '随机'], ['fixed', '固定'], ['image', '图片'], ['off', '关闭']], s0.bg.mode, (v) => {
    if (v === 'image') { file.click(); return; }
    save({ bg: { ...get().bg, mode: v } });
  });
  const swatches = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': '背景样式' });
  const paintSwatches = () => {
    const s = get();
    const on = s.bg.mode === 'fixed' ? s.bg.shader : s.bg.mode === 'random' ? currentShader() : null;
    swatches.querySelectorAll<HTMLElement>('.sw-item').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === on)));
  };
  for (const id of SHADER_IDS) {
    const b = h('button', { type: 'button', class: 'sw-item', role: 'radio', onclick: () => save({ bg: { ...get().bg, mode: 'fixed', shader: id } }) },
      h('span', { class: `sw-chip sw-${id}` }), h('span', {}, SHADER_NAMES[id]));
    b.dataset.v = id;
    swatches.append(b);
  }
  const intensity = rangeSlider(s0.bg.intensity, (n) => `${Math.round(n * 100)}%`, (v) => save({ bg: { ...get().bg, intensity: v } }));
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) { mode.set(get().bg.mode); return; }
    const url = await compressImage(f);
    await chrome.storage.local.set({ [BG_IMAGE_KEY]: url });
    save({ bg: { ...get().bg, mode: 'image' } });
  });
  const upload = h('button', { type: 'button', class: 'ghost small', onclick: () => file.click() }, icon(ICONS.image), h('span', {}, '上传图片'));

  sheet.body.append(
    h('section', { class: 'group' }, h('h3', {}, '外观'),
      block('配色', null, palettes),
      block('明暗', null, theme),
      row('封面悬停预览', '鼠标停留半秒后静音播放', preview)),
    h('section', { class: 'group' }, h('h3', {}, '背景'),
      block('模式', '随机：每次打开换一款，不连续重复', mode),
      block('样式', null, swatches),
      block('强度', null, intensity),
      h('div', { class: 'row' }, h('div', { class: 'row-label' }, h('span', {}, '自定义图片'), h('small', {}, '压缩后只保存在本机')), upload, file)),
    h('section', { class: 'group' }, h('h3', {}, '推荐过滤'),
      block('屏蔽关键词', '标题包含即隐藏', kw),
      block('屏蔽 UP 主', '卡片右上角也能一键屏蔽', ups),
      block('最低播放量', null, views),
      block('最短时长', null, dur)),
  );

  return {
    sheet,
    sync(s) {
      theme.set(s.theme);
      paintPalettes(s.palette);
      preview.setAttribute('aria-checked', String(s.hoverPreview));
      kw.set(s.filters.keywords);
      ups.set(s.filters.ups);
      mode.set(s.bg.mode);
      paintSwatches();
    },
  };
}
