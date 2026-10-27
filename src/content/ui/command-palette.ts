import { forgetSearch, hotSearch, rememberSearch, searchHistory, searchUrl, suggest } from '../api/search';
import { h, icon, ICONS } from './dom';

/**
 * 命令面板：21st「Command Palette」（rafa-porto，Raycast 风格）的原生移植。
 * 保留原版结构：搜索栏 → 分类胶囊 → 分组列表（最近 / 推荐 / 全部）→ 底部键位提示；
 * 弹簧缩放入场、↑↓ 选择、↵ 执行、Esc 关闭、按使用次数排序的命令历史。
 * 内容换成 B 站：搜索联想、最近搜索、bilibili 热搜，加上 MARGIN 自己的命令。
 */
export type Cat = '搜索' | '跳转' | '操作';
export interface Command { id: string; title: string; desc?: string; cat: Exclude<Cat, '搜索'>; icon: string; keys?: string[]; shortcut?: string; run: () => void }
interface Row { id: string; title: string; titleHtml?: string; desc?: string; cat: Cat; icon: string; shortcut?: string; run: () => void; remove?: () => void }

const USE_KEY = 'margin:cmd-usage';
const usage = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(USE_KEY) || '{}'); } catch { return {}; } };
const bump = (id: string) => { const u = usage(); u[id] = (u[id] ?? 0) + 1; localStorage.setItem(USE_KEY, JSON.stringify(u)); };
const strip = (s: string) => s.replace(/<[^>]+>/g, '');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface Palette { el: HTMLElement; open: (q?: string) => void; close: () => void; isOpen: () => boolean }

export function createCommandPalette(commands: Command[]): Palette {
  const input = h('input', { type: 'text', placeholder: '搜索视频、UP 主，或输入命令…', autocomplete: 'off', spellcheck: 'false', 'aria-label': '命令面板', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'cp-list' }) as HTMLInputElement;
  const list = h('div', { class: 'cp-list', id: 'cp-list', role: 'listbox' });
  const chips = h('div', { class: 'cp-chips', role: 'tablist' });
  const panel = h('div', { class: 'cp-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': '命令面板' },
    h('div', { class: 'cp-input' }, icon(ICONS.search), input, h('kbd', {}, 'Esc')),
    chips,
    list,
    h('div', { class: 'cp-foot' },
      h('span', { class: 'cp-hint' }, h('kbd', {}, 'Ctrl'), h('i', {}, '+'), h('kbd', {}, 'K'), h('span', {}, '随时唤出')),
      h('span', { class: 'cp-hint' }, h('span', {}, '选择'), h('kbd', {}, '↑'), h('kbd', {}, '↓'), h('b', {}, '|'), h('span', {}, '执行'), h('kbd', {}, '↵')),
    ),
  );
  const el = h('div', { class: 'cp', 'data-open': 'false', hidden: '' }, h('div', { class: 'cp-scrim' }), panel);

  let cat: Cat | '全部' = '全部';
  let rows: Row[] = [];
  let sel = 0;
  let sugg: Row[] = [];
  let hot: Row[] = [];
  let ctrl: AbortController | null = null;
  let timer = 0;
  let lastFocus: Element | null = null;

  for (const c of ['全部', '搜索', '跳转', '操作'] as const) {
    chips.append(h('button', { type: 'button', role: 'tab', class: 'cp-chip', 'data-c': c, onclick: () => { cat = c; render(); input.focus(); } }, c));
  }

  const go = (q: string) => { rememberSearch(q); window.open(searchUrl(q), '_blank', 'noopener'); close(); };
  const searchRow = (q: string, kind: 'history' | 'hot' | 'sugg', html?: string, n?: number): Row => ({
    id: `${kind}:${q}`, title: q, titleHtml: html, cat: '搜索',
    icon: kind === 'history' ? ICONS.history : ICONS.search,
    desc: kind === 'hot' && n ? `热搜 ${n}` : kind === 'history' ? '最近搜索' : undefined,
    run: () => go(q),
    remove: kind === 'history' ? () => { forgetSearch(q); render(); } : undefined,
  });
  const cmdRow = (c: Command): Row => ({ id: c.id, title: c.title, desc: c.desc, cat: c.cat, icon: c.icon, shortcut: c.shortcut, run: () => { bump(c.id); close(); c.run(); } });

  function sections(): [string, Row[]][] {
    const q = input.value.trim();
    const lq = q.toLowerCase();
    const want = (r: Row) => cat === '全部' || r.cat === cat;
    const out: [string, Row[]][] = [];
    if (!q) {
      const u = usage();
      const recent = commands.filter((c) => u[c.id]).sort((a, b) => u[b.id] - u[a.id]).slice(0, 3).map(cmdRow);
      const hist = searchHistory().slice(0, 5).map((s) => searchRow(s, 'history'));
      if (hist.length) out.push(['最近搜索', hist]);
      if (recent.length) out.push(['常用', recent]);
      if (hot.length) out.push(['bilibili 热搜', hot]);
      out.push(['全部命令', commands.filter((c) => !u[c.id] || !recent.some((r) => r.id === c.id)).map(cmdRow)]);
    } else {
      out.push(['搜索', [
        { id: 'go', title: `搜索「${q}」`, cat: '搜索', icon: ICONS.search, shortcut: '↵', run: () => go(q) },
        ...sugg.filter((s) => s.title !== q),
      ]]);
      const hits = commands.filter((c) => [c.title, c.desc ?? '', ...(c.keys ?? [])].some((t) => t.toLowerCase().includes(lq))).map(cmdRow);
      if (hits.length) out.push(['命令', hits]);
    }
    return out.map(([t, r]) => [t, r.filter(want)] as [string, Row[]]).filter(([, r]) => r.length);
  }

  function render(): void {
    chips.querySelectorAll<HTMLElement>('.cp-chip').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.c === cat)));
    const secs = sections();
    rows = secs.flatMap(([, r]) => r);
    sel = Math.min(sel, Math.max(0, rows.length - 1));
    let i = 0;
    list.replaceChildren(...secs.map(([title, r]) => h('div', { class: 'cp-group' },
      h('div', { class: 'cp-gt' }, h('span', {}, title), h('i', {}, String(r.length))),
      ...r.map((row) => {
        const idx = i++;
        const t = h('span', { class: 'cp-t' });
        if (row.titleHtml) t.innerHTML = row.titleHtml.replace(/<em class="suggest_high_light">/g, '<mark>').replace(/<\/em>/g, '</mark>'); else t.textContent = row.title;
        const item = h('div', { class: 'cp-item', role: 'option', id: `cp-${idx}`, 'aria-selected': String(idx === sel),
          onpointermove: () => { if (sel !== idx) { sel = idx; mark(); } },
          onclick: () => row.run(),
        },
        h('span', { class: 'cp-ic' }, icon(row.icon)), t,
        row.desc ? h('span', { class: 'cp-d' }, row.desc) : null,
        h('span', { class: 'cp-r' },
          row.cat !== '搜索' ? h('span', { class: 'cp-cat' }, row.cat) : null,
          row.shortcut ? h('kbd', {}, row.shortcut) : null,
          row.remove ? h('button', { type: 'button', class: 'cp-x', title: '删除这条记录', 'aria-label': '删除这条记录', onclick: (e: Event) => { e.stopPropagation(); row.remove!(); input.focus(); } }, icon(ICONS.close)) : null),
        );
        return item;
      }),
    )));
    if (!rows.length) list.append(h('div', { class: 'cp-empty' }, icon(ICONS.search), h('p', {}, '没有匹配的命令'), h('button', { type: 'button', class: 'cp-reset', onclick: () => { input.value = ''; cat = '全部'; render(); input.focus(); } }, '清空')));
    mark();
  }
  function mark(): void {
    list.querySelectorAll<HTMLElement>('.cp-item').forEach((n, i) => n.setAttribute('aria-selected', String(i === sel)));
    input.setAttribute('aria-activedescendant', `cp-${sel}`);
    (list.querySelector(`#cp-${sel}`) as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', () => {
    sel = 0; sugg = []; render();
    clearTimeout(timer); ctrl?.abort();
    const q = input.value.trim();
    if (!q) return;
    timer = window.setTimeout(async () => {
      ctrl = new AbortController();
      try {
        const s = await suggest(q, ctrl.signal);
        if (input.value.trim() !== q) return;
        sugg = s.map((x) => searchRow(x.term, 'sugg', x.html)); render();
      } catch { /* 联想失败不影响搜索 */ }
    }, 120);
  });
  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = rows.length ? (sel + 1) % rows.length : 0; mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = rows.length ? (sel - 1 + rows.length) % rows.length : 0; mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); rows[sel]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const cs = ['全部', '搜索', '跳转', '操作'] as const;
      cat = cs[(cs.indexOf(cat) + (e.shiftKey ? 3 : 1)) % 4]; render();
    }
  });
  el.querySelector('.cp-scrim')!.addEventListener('click', () => close());

  function open(q = ''): void {
    if (el.dataset.open === 'true') { input.focus(); return; }
    lastFocus = (el.getRootNode() as ShadowRoot).activeElement ?? document.activeElement;
    el.hidden = false;
    input.value = q; cat = '全部'; sel = 0; sugg = [];
    render();
    requestAnimationFrame(() => { el.dataset.open = 'true'; input.focus(); input.setSelectionRange(q.length, q.length); });
    if (q) input.dispatchEvent(new Event('input'));
    hotSearch().then((list2) => { hot = list2.map((x, n) => ({ ...searchRow(x.keyword, 'hot', esc(x.name), n + 1) })); if (el.dataset.open === 'true' && !input.value.trim()) render(); });
  }
  function close(): void {
    if (el.dataset.open !== 'true') return;
    el.dataset.open = 'false';
    ctrl?.abort();
    setTimeout(() => { if (el.dataset.open === 'false') el.hidden = true; }, 220);
    (lastFocus as HTMLElement | null)?.blur?.();
  }

  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); el.dataset.open === 'true' ? close() : open(); return; }
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || el.dataset.open === 'true') return;
    const typing = e.composedPath().some((n) => n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement || (n instanceof HTMLElement && n.isContentEditable));
    if (typing) return;
    e.preventDefault(); open();
  }, true);

  return { el, open, close, isOpen: () => el.dataset.open === 'true' };
}
void strip;
