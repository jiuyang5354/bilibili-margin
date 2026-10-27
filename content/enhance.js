/* 映间 MARGIN · 交互增强（改写自 21st.dev 组件：HoverPlayCard、Beam Search Bar、Theme Toggle、Command Search）
 * 不依赖构建，直接作用在 #margin-extension 的 shadow DOM 上。 */
(() => {
  if (window.__margin21) return;
  window.__margin21 = true;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const SHADOW_CSS = `
/* ---------- HoverPlayCard：悬停静音预览 ---------- */
.v2-cover .m21-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2;opacity:0;transition:opacity .35s ease;background:#000;pointer-events:none}
.v2-cover .m21-preview.on{opacity:1}
.v2-cover .m21-bar{position:absolute;left:0;bottom:0;height:3px;width:0;z-index:4;background:linear-gradient(90deg,#00aeec,#fb7299);border-radius:0 2px 2px 0;transition:width .25s linear;pointer-events:none}
.v2-cover .m21-sound{position:absolute;left:8px;bottom:8px;z-index:5;display:flex;align-items:center;gap:5px;padding:4px 9px 4px 7px;border-radius:999px;font-size:11px;line-height:1;color:#fff;background:rgb(0 0 0 / .45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;transform:translateY(4px);transition:opacity .25s,transform .25s,background .2s;cursor:pointer}
.v2-cover .m21-sound.on{opacity:1;transform:none}
.v2-cover .m21-sound:hover{background:rgb(0 0 0 / .65)}
.v2-cover .m21-sound svg{width:13px;height:13px}
.v2-cover.m21-playing .v2-cover-play,.v2-cover.m21-playing .v2-cover-duration{opacity:0!important;transition:opacity .25s}
.v2-cover .m21-spin{position:absolute;right:9px;top:9px;z-index:5;width:14px;height:14px;border-radius:50%;border:2px solid rgb(255 255 255 / .35);border-top-color:#fff;animation:m21-rot .7s linear infinite;pointer-events:none}
@keyframes m21-rot{to{transform:rotate(360deg)}}

/* ---------- Beam Search Bar：聚焦光束 ---------- */
.search-input-row{position:relative}
.search-input-row::after,.search-input-row::before{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;pointer-events:none;opacity:0;transition:opacity .35s ease;
  background:linear-gradient(90deg,transparent 0,#00aeec 30%,#fb7299 55%,#8b6cff 75%,transparent 100%);background-size:45% 100%;background-repeat:no-repeat;animation:m21-beam 2.6s cubic-bezier(.45,.05,.35,1) infinite}
.search-input-row::before{height:14px;bottom:-8px;filter:blur(10px)}
.search-input-row:focus-within::after{opacity:1}
.search-input-row:focus-within::before{opacity:.55}
.v4-search{position:relative}
.v4-search::after{content:"";position:absolute;left:14px;right:14px;bottom:0;height:1.5px;pointer-events:none;opacity:0;transition:opacity .3s;
  background:linear-gradient(90deg,transparent,#00aeec,#fb7299,transparent);background-size:50% 100%;background-repeat:no-repeat;animation:m21-beam 2.2s linear infinite}
.v4-search:hover::after,.v4-search:focus-visible::after{opacity:1}
@keyframes m21-beam{from{background-position:-60% 0}to{background-position:160% 0}}

/* ---------- Command Search：滑动高亮 + 打字机提示 ---------- */
.command-list{position:relative}
.command-list .m21-pill{position:absolute;left:10px;right:10px;top:0;height:0;border-radius:8px;background:var(--subtle);z-index:0;pointer-events:none;opacity:0;
  transition:transform .26s cubic-bezier(.34,1.25,.64,1),height .2s ease,opacity .15s}
.command-list .command-option{position:relative;z-index:1}
.command-list.m21-has-pill .command-option.active{background:transparent!important}
.command-list.m21-has-pill .command-option.active::before{content:"";position:absolute;left:0;top:50%;width:3px;height:16px;margin-top:-8px;border-radius:2px;background:#00aeec}

/* ---------- Theme Toggle：日月变形 ---------- */
.v2-theme-button svg{animation:m21-morph .55s cubic-bezier(.34,1.4,.64,1)}
.v2-theme-button:hover svg{transform:rotate(-18deg);transition:transform .3s}
@keyframes m21-morph{from{transform:rotate(-120deg) scale(.4);opacity:0}to{transform:none;opacity:1}}

@media (prefers-reduced-motion: reduce){
  .search-input-row::after,.search-input-row::before,.v4-search::after{animation:none;background-size:100% 100%}
  .v2-theme-button svg{animation:none}
  .command-list .m21-pill{transition:none}
}`;

  const DOC_CSS = `
::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}
html.m21-reveal::view-transition-new(root){animation:m21-reveal .68s cubic-bezier(.22,.9,.24,1) both}
@keyframes m21-reveal{from{clip-path:circle(0 at var(--m21-x,50%) var(--m21-y,50%))}to{clip-path:circle(var(--m21-r,150vmax) at var(--m21-x,50%) var(--m21-y,50%))}}`;

  const docStyle = document.createElement('style');
  docStyle.id = 'margin-21st-doc';
  docStyle.textContent = DOC_CSS;
  (document.head || document.documentElement).appendChild(docStyle);

  let root = null;
  let previewOn = true;
  try {
    chrome.storage?.local.get('margin-hover-preview', (v) => { previewOn = v?.['margin-hover-preview'] !== false; });
    chrome.storage?.onChanged.addListener((c) => { if (c['margin-hover-preview']) previewOn = c['margin-hover-preview'].newValue !== false; });
  } catch (_) {}

  /* ---------------- 悬停预览 ---------------- */
  const urlCache = new Map();
  async function getPlayUrl(bvid, cid) {
    const key = bvid;
    if (urlCache.has(key)) return urlCache.get(key);
    const job = (async () => {
      if (!cid) {
        const r = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { credentials: 'include' }).then((x) => x.json());
        cid = r?.data?.cid;
        if (!cid) throw new Error('no cid');
      }
      const q = `bvid=${bvid}&cid=${cid}&qn=16&fnval=1&fnver=0&fourk=0&platform=html5&high_quality=1`;
      let r = await fetch(`https://api.bilibili.com/x/player/playurl?${q}`, { credentials: 'include' }).then((x) => x.json());
      let u = r?.data?.durl?.[0]?.url;
      if (!u) throw new Error('no url ' + r?.code);
      return u.replace(/^http:/, 'https:');
    })();
    urlCache.set(key, job);
    job.catch(() => urlCache.delete(key));
    return job;
  }

  const ICON_MUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
  let soundWanted = false; // 用户点过“开声音”后，后续预览也带声音
  let active = null;

  function stopPreview() {
    if (!active) return;
    const { cover, timer, video, extras } = active;
    clearTimeout(timer);
    if (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch (_) {} video.remove(); }
    extras.forEach((n) => n.remove());
    cover.classList.remove('m21-playing');
    active = null;
  }

  function startPreview(cover) {
    if (active?.cover === cover) return;
    stopPreview();
    const art = cover.closest('article[data-bvid]');
    if (!art || !previewOn) return;
    const bvid = art.dataset.bvid;
    const cid = Number(art.dataset.cid) || 0;
    const state = { cover, extras: [], video: null, timer: 0 };
    active = state;
    state.timer = setTimeout(async () => {
      const spin = document.createElement('span');
      spin.className = 'm21-spin';
      cover.appendChild(spin);
      state.extras.push(spin);
      let url;
      try { url = await getPlayUrl(bvid, cid); } catch (_) { if (active === state) spin.remove(); return; }
      if (active !== state) return;
      const v = document.createElement('video');
      v.className = 'm21-preview';
      v.muted = !soundWanted;
      v.playsInline = true;
      v.loop = true;
      v.preload = 'auto';
      v.src = url;
      state.video = v;
      const bar = document.createElement('span');
      bar.className = 'm21-bar';
      const snd = document.createElement('span');
      snd.className = 'm21-sound';
      snd.setAttribute('role', 'button');
      snd.setAttribute('aria-label', '切换预览声音');
      const paint = () => { snd.innerHTML = (v.muted ? ICON_MUTE : ICON_SOUND) + `<span>${v.muted ? '静音预览' : '声音已开'}</span>`; };
      paint();
      snd.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        v.muted = !v.muted; soundWanted = !v.muted; paint();
        if (v.paused) v.play().catch(() => {});
      }, true);
      snd.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
      state.extras.push(bar, snd);
      v.addEventListener('playing', () => {
        if (active !== state) return;
        spin.remove();
        v.classList.add('on'); snd.classList.add('on'); cover.classList.add('m21-playing');
      });
      v.addEventListener('timeupdate', () => { if (v.duration) bar.style.width = (v.currentTime / v.duration * 100).toFixed(2) + '%'; });
      v.addEventListener('error', () => { if (active === state) stopPreview(); });
      cover.append(v, bar, snd);
      v.play().catch(() => { v.muted = true; paint(); v.play().catch(() => {}); });
    }, 450);
  }

  function bindHover(r) {
    r.addEventListener('pointerover', (e) => {
      const cover = e.target.closest?.('.v2-cover');
      if (cover) startPreview(cover);
    });
    r.addEventListener('pointerout', (e) => {
      if (!active) return;
      const wrap = active.cover.closest('.v2-cover-wrap') || active.cover;
      if (!e.relatedTarget || !wrap.contains(e.relatedTarget)) stopPreview();
    });
    r.addEventListener('click', (e) => { if (e.target.closest?.('.v2-cover')) stopPreview(); }, true);
    window.addEventListener('blur', stopPreview);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreview(); });
  }

  /* ---------------- 主题圆形揭幕 ---------------- */
  function bindTheme(r) {
    r.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.v2-theme-button');
      if (!btn || !e.isTrusted || reduce.matches || typeof document.startViewTransition !== 'function') return;
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
      const b = btn.getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const h = document.documentElement;
      h.style.setProperty('--m21-x', x + 'px');
      h.style.setProperty('--m21-y', y + 'px');
      h.style.setProperty('--m21-r', rad + 'px');
      h.classList.add('m21-reveal');
      const t = document.startViewTransition(() => new Promise((res) => {
        btn.click();
        requestAnimationFrame(() => requestAnimationFrame(res));
      }));
      t.finished.finally(() => h.classList.remove('m21-reveal'));
    }, true);
  }

  /* ---------------- 命令面板：高亮 pill + 打字机 ---------------- */
  const SAMPLES = ['影视飓风', 'LPL 赛事集锦', '罗翔说刑法', '4K 城市漫步', '原神 新版本', '何同学'];
  let typer = null;
  function runTyper(input) {
    if (typer?.input === input) return;
    stopTyper();
    const base = input.getAttribute('placeholder') || '';
    const st = { input, base, i: 0, ch: 0, dir: 1, t: 0 };
    typer = st;
    const tick = () => {
      if (typer !== st) return;
      if (input.value) { input.placeholder = base; st.t = setTimeout(tick, 600); return; }
      const word = SAMPLES[st.i % SAMPLES.length];
      st.ch += st.dir;
      input.placeholder = '试试搜索：' + word.slice(0, st.ch) + '▍';
      let wait = st.dir > 0 ? 140 : 60;
      if (st.ch >= word.length) { st.dir = -1; wait = 2200; }
      else if (st.ch <= 0) { st.dir = 1; st.i++; wait = 500; }
      st.t = setTimeout(tick, wait);
    };
    st.t = setTimeout(tick, 700);
  }
  function stopTyper() {
    if (!typer) return;
    clearTimeout(typer.t);
    typer.input.placeholder = typer.base;
    typer = null;
  }

  const pilled = new WeakSet();
  function bindPill(list) {
    if (pilled.has(list)) return;
    pilled.add(list);
    const pill = document.createElement('div');
    pill.className = 'm21-pill';
    list.prepend(pill);
    list.classList.add('m21-has-pill');
    const place = () => {
      if (!pill.isConnected) list.prepend(pill);
      const a = list.querySelector('.command-option.active');
      if (!a) { pill.style.opacity = '0'; return; }
      pill.style.opacity = '1';
      pill.style.transform = `translateY(${a.offsetTop}px)`;
      pill.style.height = a.offsetHeight + 'px';
    };
    list.__m21place = place;
    new MutationObserver(place).observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    place();
  }

  function scan() {
    if (!root) return;
    const dlg = root.querySelector('.search-dialog');
    const input = dlg?.querySelector('input');
    if (dlg && dlg.open && input && !reduce.matches) runTyper(input); else stopTyper();
    root.querySelectorAll('.command-list').forEach((l) => { bindPill(l); if (dlg?.open) requestAnimationFrame(() => l.__m21place?.()); });
  }

  function attach() {
    const host = document.getElementById('margin-extension');
    const r = host?.shadowRoot;
    if (!r || r === root) return;
    root = r;
    if (!r.getElementById('margin-21st')) {
      const st = document.createElement('style');
      st.id = 'margin-21st';
      st.textContent = SHADOW_CSS;
      r.appendChild(st);
    }
    bindHover(r);
    bindTheme(r);
    new MutationObserver(scan).observe(r, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    scan();
  }

  attach();
  setInterval(attach, 1500);
  document.addEventListener('DOMContentLoaded', attach);
})();

/* 映间 MARGIN · 足迹：每日登录（首次打开）时间与停留时长热力图 */
(() => {
  if (window.__marginFoot) return;
  window.__marginFoot = true;
  const KEY = 'margin-activity-v1';      // { 'YYYY-MM-DD': { s: 秒, f: 'HH:MM', h: 历史观看秒 } }
  const TICK = 15;
  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const store = chrome.storage?.local;
  if (!store) return;
  const get = () => new Promise((r) => store.get([KEY, KEY + '-tick'], (v) => r(v || {})));

  /* ---- 记录 ---- */
  let lastInput = Date.now();
  ['pointermove', 'keydown', 'wheel', 'pointerdown', 'scroll'].forEach((t) => addEventListener(t, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
  const playing = () => [...document.querySelectorAll('video')].some((v) => !v.paused && !v.ended && v.readyState > 2);
  async function tick(first) {
    const now = new Date();
    const visible = document.visibilityState === 'visible';
    const activeNow = visible && (Date.now() - lastInput < 90000 || playing());
    const v = await get();
    const data = v[KEY] || {};
    const k = dkey(now);
    const day = data[k] || (data[k] = { s: 0 });
    let changed = false;
    if (!day.f && visible) { day.f = `${pad(now.getHours())}:${pad(now.getMinutes())}`; changed = true; }
    const lastTick = v[KEY + '-tick'] || 0;          // 多标签页共用一个计时，避免重复累计
    if (!first && activeNow && Date.now() - lastTick >= (TICK - 2) * 1000) {
      day.s = (day.s || 0) + TICK; changed = true;
      await new Promise((r) => store.set({ [KEY + '-tick']: Date.now() }, r));
    }
    if (changed) store.set({ [KEY]: data });
  }
  tick(true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(true); });
  setInterval(() => tick(false), TICK * 1000);

  /* ---- 历史记录补全（登录后） ---- */
  async function backfill() {
    const v = await get();
    const data = v[KEY] || {};
    const sums = {}; const firsts = {};
    let max = 0, view_at = 0, business = '';
    for (let page = 0; page < 20; page++) {
      let j;
      try { j = await fetch(`https://api.bilibili.com/x/web-interface/history/cursor?ps=30&max=${max}&view_at=${view_at}&business=${business}`, { credentials: 'include' }).then((x) => x.json()); } catch (_) { break; }
      if (j?.code !== 0) return j?.code === -101 ? 'nologin' : 'fail';
      const list = j.data?.list || [];
      for (const it of list) {
        const d = new Date(it.view_at * 1000);
        const k = dkey(d);
        const dur = Number(it.duration) || 0;
        const prog = Number(it.progress);
        sums[k] = (sums[k] || 0) + Math.min(dur || 600, prog < 0 ? dur : Math.max(prog, 0));
        const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        if (!firsts[k] || hm < firsts[k]) firsts[k] = hm;
      }
      const c = j.data?.cursor;
      if (!list.length || !c || !c.max) break;
      max = c.max; view_at = c.view_at; business = c.business || '';
    }
    for (const k of Object.keys(sums)) {
      const day = data[k] || (data[k] = { s: 0 });
      day.h = Math.round(sums[k]);
      if (!day.f || firsts[k] < day.f) day.hf = firsts[k];
    }
    await new Promise((r) => store.set({ [KEY]: data }, r));
    return 'ok';
  }

  /* ---- 界面 ---- */
  const CSS = `
.m21-foot-mask{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgb(0 0 0 / .45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:m21-fade .2s ease}
.m21-foot{position:relative;width:min(920px,calc(100vw - 48px));padding:26px 28px 22px;border-radius:16px;background:var(--surface,#151515);color:var(--ink,#eee);border:1px solid var(--line,#2a2a2a);box-shadow:var(--shadow,0 20px 60px rgb(0 0 0 / .4));animation:m21-up .28s cubic-bezier(.2,.9,.25,1)}
.m21-foot h3{margin:0;font-size:15px;font-weight:600;letter-spacing:.01em}
.m21-foot h3 span{color:var(--muted,#888);font-weight:400}
.m21-foot-stats{display:flex;gap:28px;margin:16px 0 20px;flex-wrap:wrap}
.m21-foot-stat b{display:block;font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.2}
.m21-foot-stat small{font-size:11px;color:var(--muted,#888)}
.m21-foot-close{position:absolute;right:14px;top:12px;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:var(--muted,#888);font-size:18px;cursor:pointer;background:none;border:0}
.m21-foot-close:hover{background:var(--hover,#222);color:var(--ink,#eee)}
.m21-graph{display:grid;grid-template-columns:30px 1fr;gap:6px 6px;overflow-x:auto}
.m21-months{grid-column:2;position:relative;height:16px;font-size:11px;color:var(--muted,#888)}
.m21-months span{position:absolute;top:0}
.m21-days{display:grid;grid-template-rows:repeat(7,var(--c));gap:var(--g);font-size:11px;color:var(--muted,#888)}
.m21-days span{line-height:var(--c)}
.m21-cells{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,var(--c));grid-auto-columns:var(--c);gap:var(--g)}
.m21-cell{border-radius:3px;background:color-mix(in srgb,var(--ink,#fff) 9%,transparent);transition:transform .12s}
.m21-cell[data-l="1"]{background:color-mix(in srgb,var(--ink,#fff) 28%,transparent)}
.m21-cell[data-l="2"]{background:color-mix(in srgb,var(--ink,#fff) 50%,transparent)}
.m21-cell[data-l="3"]{background:color-mix(in srgb,var(--ink,#fff) 74%,transparent)}
.m21-cell[data-l="4"]{background:var(--ink,#fff)}
.m21-cell.future{visibility:hidden}
.m21-cell.today{outline:1.5px solid #00aeec;outline-offset:1px}
.m21-cell:hover{transform:scale(1.35)}
.m21-foot-foot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:11px;color:var(--muted,#888);gap:12px;flex-wrap:wrap}
.m21-legend{display:flex;align-items:center;gap:4px}
.m21-legend .m21-cell{width:11px;height:11px;display:inline-block}
.m21-legend .m21-cell:hover{transform:none}
.m21-tip{position:fixed;z-index:60;pointer-events:none;padding:7px 10px;border-radius:8px;font-size:12px;line-height:1.5;white-space:nowrap;background:var(--ink,#eee);color:var(--canvas,#111);box-shadow:0 6px 20px rgb(0 0 0 / .25);transform:translate(-50%,calc(-100% - 10px))}
.m21-tip small{opacity:.7}
@keyframes m21-fade{from{opacity:0}}
@keyframes m21-up{from{opacity:0;transform:translateY(12px) scale(.98)}}`;

  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const fmt = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} 小时 ${m} 分` : `${m} 分钟`; };
  const secOf = (d) => Math.max(d?.s || 0, d?.h || 0);
  const level = (s) => (s <= 0 ? 0 : s < 900 ? 1 : s < 2700 ? 2 : s < 5400 ? 3 : 4);

  function render(root, data, note) {
    root.querySelector('.m21-foot-mask')?.remove();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - 364 - today.getDay()); // 从 53 周前的周日开始
    const cells = []; const months = [];
    let active = 0, total = 0, streak = 0, best = 0, run = 0, lastMonth = -1;
    const days = Math.round((today - start) / 864e5) + 1;
    for (let i = 0; i < days + (6 - today.getDay()); i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = dkey(d); const rec = data[k]; const s = secOf(rec);
      const future = d > today;
      if (!future) {
        const on = s > 0 || !!rec?.f;
        if (on) { active++; total += s; run++; best = Math.max(best, run); } else run = 0;
      }
      if (d.getDate() <= 7 && d.getDay() === 0 && d.getMonth() !== lastMonth) { months.push([Math.floor(i / 7), d.getMonth() + 1]); lastMonth = d.getMonth(); }
      cells.push(`<i class="m21-cell${future ? ' future' : ''}${+d === +today ? ' today' : ''}" data-k="${k}" data-l="${future ? 0 : (level(s) || (rec?.f ? 1 : 0))}"></i>`);
    }
    for (let i = 0; ; i++) { const d = new Date(today); d.setDate(d.getDate() - i); const r = data[dkey(d)]; if (secOf(r) > 0 || r?.f) streak++; else if (i > 0) break; else continue; }
    const t = data[dkey(today)] || {};
    const weeks = Math.ceil(cells.length / 7);
    const mask = document.createElement('div');
    mask.className = 'm21-foot-mask';
    mask.innerHTML = `<div class="m21-foot" role="dialog" aria-label="B 站足迹">
      <button class="m21-foot-close" aria-label="关闭">×</button>
      <h3>${active} 天打开过 B 站 <span>· 近一年</span></h3>
      <div class="m21-foot-stats">
        <div class="m21-foot-stat"><b>${t.f || t.hf || '—'}</b><small>今日首次登录</small></div>
        <div class="m21-foot-stat"><b>${fmt(secOf(t))}</b><small>今日时长</small></div>
        <div class="m21-foot-stat"><b>${fmt(total)}</b><small>近一年累计</small></div>
        <div class="m21-foot-stat"><b>${streak} 天</b><small>当前连续 · 最长 ${best} 天</small></div>
      </div>
      <div class="m21-graph" style="--c:13px;--g:3px">
        <div class="m21-months" style="width:calc(${weeks} * (var(--c) + var(--g)))">${months.map(([w, m]) => `<span style="left:calc(${w} * (var(--c) + var(--g)))">${m}月</span>`).join('')}</div>
        <div class="m21-days"><span></span><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span></div>
        <div class="m21-cells">${cells.join('')}</div>
      </div>
      <div class="m21-foot-foot"><span>${note}</span><span class="m21-legend">少 <i class="m21-cell" data-l="0"></i><i class="m21-cell" data-l="1"></i><i class="m21-cell" data-l="2"></i><i class="m21-cell" data-l="3"></i><i class="m21-cell" data-l="4"></i> 多</span></div>
    </div>`;
    const tip = document.createElement('div'); tip.className = 'm21-tip'; tip.hidden = true; mask.appendChild(tip);
    const close = () => mask.remove();
    mask.addEventListener('click', (e) => { if (e.target === mask || e.target.closest('.m21-foot-close')) close(); });
    mask.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    mask.addEventListener('pointerover', (e) => {
      const c = e.target.closest('.m21-cells .m21-cell'); if (!c) { tip.hidden = true; return; }
      const k = c.dataset.k; const r = data[k] || {}; const d = new Date(k + 'T00:00:00');
      const s = secOf(r); const f = r.f || r.hf;
      tip.innerHTML = s || f ? `<b>${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}</b><br>首次登录 ${f || '—'} · 时长 ${fmt(s)}` : `<b>${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}</b><br><small>没有打开 B 站</small>`;
      const b = c.getBoundingClientRect(); tip.style.left = b.left + b.width / 2 + 'px'; tip.style.top = b.top + 'px'; tip.hidden = false;
    });
    root.appendChild(mask);
    const graph = mask.querySelector('.m21-graph');
    const cs = Math.max(9, Math.min(18, Math.floor((graph.clientWidth - 36) / weeks) - 3));
    graph.style.setProperty('--c', cs + 'px');
    graph.scrollLeft = 9999;
    mask.querySelector('.m21-foot-close').focus();
  }

  let filled = false;
  async function open(root) {
    let v = await get();
    render(root, v[KEY] || {}, '时长按页面可见且有操作或在播放时计算');
    if (!filled) {
      const r = await backfill(); filled = r === 'ok';
      if (!root.querySelector('.m21-foot-mask')) return;
      v = await get();
      render(root, v[KEY] || {}, r === 'ok' ? '已用 B 站观看历史补全过去的天数 · 时长取本地记录与历史观看的较大值' : r === 'nologin' ? '登录 B 站后可用观看历史补全过去的天数' : '观看历史暂时读取失败，只显示本地记录');
    }
  }

  const ICON = '<svg xmlns="http://www.w3.org/2000/svg" class="mi" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="5" height="5" rx="1.2"/><rect x="10" y="3" width="5" height="5" rx="1.2" fill="currentColor"/><rect x="17" y="3" width="4" height="5" rx="1.2"/><rect x="3" y="10" width="5" height="5" rx="1.2" fill="currentColor"/><rect x="10" y="10" width="5" height="5" rx="1.2"/><rect x="17" y="10" width="4" height="5" rx="1.2" fill="currentColor"/><rect x="3" y="17" width="5" height="4" rx="1.2"/><rect x="10" y="17" width="5" height="4" rx="1.2" fill="currentColor"/><rect x="17" y="17" width="4" height="4" rx="1.2"/></svg>';
  function ensure() {
    const root = document.getElementById('margin-extension')?.shadowRoot;
    if (!root) return;
    if (!root.getElementById('margin-foot-css')) { const s = document.createElement('style'); s.id = 'margin-foot-css'; s.textContent = CSS; root.appendChild(s); }
    const rail = root.querySelector('.v2-rail');
    if (rail && !rail.querySelector('.m21-foot-btn')) {
      const b = document.createElement('button');
      b.className = 'v2-rail-button m21-foot-btn';
      b.setAttribute('aria-label', 'B 站足迹');
      b.innerHTML = ICON + '<span class="v2-rail-tooltip">B 站足迹<kbd>登录与时长</kbd></span>';
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(root); });
      const div = rail.querySelector('.v2-rail-divider');
      rail.insertBefore(b, div || null);
    }
  }
  ensure();
  setInterval(ensure, 1500);
  window.__marginOpenFoot = () => { const r = document.getElementById('margin-extension')?.shadowRoot; if (r) open(r); };
})();
