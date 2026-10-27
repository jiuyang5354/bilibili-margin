import { backfill, dayKey, firstOf, loadActivity, secondsOf, type Activity } from '../footprint/store';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const fmt = (sec: number) => {
  const s = Math.round(sec || 0), hr = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return hr ? `${hr} 小时 ${m} 分` : `${m} 分钟`;
};
const level = (s: number) => (s <= 0 ? 0 : s < 900 ? 1 : s < 2700 ? 2 : s < 5400 ? 3 : 4);

/** 「B 站足迹」：近一年每天首次打开时间与停留时长的热力图 */
export function createFootprint(): Sheet {
  let filled = false;
  const sheet = createSheet({
    title: 'B 站足迹', eyebrow: 'FOOTPRINT', width: 920,
    onOpen: async () => {
      paint(await loadActivity(), '时长按页面可见且有操作或在播放时计算');
      if (filled) return;
      const r = await backfill();
      filled = r === 'ok';
      if (!sheet.isOpen()) return;
      paint(await loadActivity(), r === 'ok'
        ? '已用 B 站观看历史补全过去的天数 · 时长取本地记录与观看历史的较大值'
        : r === 'nologin' ? '登录 B 站后可以用观看历史补全过去的天数' : '观看历史暂时读取失败，只显示本地记录');
    },
  });
  const tip = h('div', { class: 'fp-tip', hidden: '' });
  sheet.el.append(tip);

  function paint(data: Activity, note: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - 364 - today.getDay());
    const cells: HTMLElement[] = [];
    const months: [number, number][] = [];
    let active = 0, total = 0, best = 0, run = 0, lastMonth = -1;
    const n = Math.round((+today - +start) / 864e5) + 1 + (6 - today.getDay());
    for (let i = 0; i < n; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = dayKey(d), rec = data[k], s = secondsOf(rec), future = d > today;
      const on = !future && (s > 0 || !!firstOf(rec));
      if (!future) { if (on) { active++; total += s; run++; best = Math.max(best, run); } else run = 0; }
      if (d.getDate() <= 7 && d.getDay() === 0 && d.getMonth() !== lastMonth) { months.push([Math.floor(i / 7), d.getMonth() + 1]); lastMonth = d.getMonth(); }
      const c = h('i', { class: `fp-cell${future ? ' future' : ''}${+d === +today ? ' today' : ''}` });
      c.dataset.k = k;
      c.dataset.l = String(future ? 0 : level(s) || (on ? 1 : 0));
      cells.push(c);
    }
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const r = data[dayKey(d)];
      if (secondsOf(r) > 0 || firstOf(r)) streak++;
      else if (i > 0) break;
    }
    const t = data[dayKey(today)];
    const weeks = Math.ceil(cells.length / 7);
    const stat = (v: string, label: string) => h('div', { class: 'fp-stat' }, h('b', {}, v), h('small', {}, label));
    const legend = h('span', { class: 'fp-legend' }, '少', ...[0, 1, 2, 3, 4].map((l) => { const c = h('i', { class: 'fp-cell' }); c.dataset.l = String(l); return c; }), '多');
    const graph = h('div', { class: 'fp-graph' },
      h('div', { class: 'fp-months', style: `width:calc(${weeks} * (var(--c) + var(--gp)))` },
        ...months.map(([w, m]) => h('span', { style: `left:calc(${w} * (var(--c) + var(--gp)))` }, `${m}月`))),
      h('div', { class: 'fp-days' }, ...['', '一', '', '三', '', '五', ''].map((x) => h('span', {}, x))),
      h('div', { class: 'fp-cells' }, ...cells),
    );
    sheet.body.replaceChildren(h('div', { class: 'fp' },
      h('h3', { class: 'fp-head' }, `${active} 天打开过 B 站`, h('span', {}, ' · 近一年')),
      h('div', { class: 'fp-stats' },
        stat(firstOf(t) ?? '—', '今日首次打开'),
        stat(fmt(secondsOf(t)), '今日时长'),
        stat(fmt(total), '近一年累计'),
        stat(`${streak} 天`, `当前连续 · 最长 ${best} 天`)),
      graph,
      h('div', { class: 'fp-foot' }, h('span', {}, note), legend),
    ));
    requestAnimationFrame(() => {
      const cs = Math.max(9, Math.min(15, Math.floor((graph.clientWidth - 34) / weeks) - 3));
      graph.style.setProperty('--c', `${cs}px`);
      graph.scrollLeft = graph.scrollWidth;
    });
    graph.onpointerover = (e) => {
      const c = (e.target as HTMLElement).closest<HTMLElement>('.fp-cells .fp-cell');
      if (!c || c.classList.contains('future')) { tip.hidden = true; return; }
      const r = data[c.dataset.k!], d = new Date(`${c.dataset.k}T00:00:00`), s = secondsOf(r), f = firstOf(r);
      tip.replaceChildren(h('b', {}, `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`), h('br'),
        s || f ? `首次打开 ${f ?? '—'} · 时长 ${fmt(s)}` : h('small', {}, '没有打开 B 站'));
      const b = c.getBoundingClientRect();
      tip.style.left = `${b.left + b.width / 2}px`;
      tip.style.top = `${b.top}px`;
      tip.hidden = false;
    };
    graph.onpointerleave = () => { tip.hidden = true; };
  }
  return sheet;
}
