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

/* 映间 MARGIN · 收藏夹：玻璃文件夹卡片 */
(() => {
  if (window.__marginFav) return;
  window.__marginFav = true;
  const API = 'https://api.bilibili.com';
  const j = (u) => fetch(API + u, { credentials: 'include' }).then((r) => r.json());
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const https = (u) => String(u || '').replace(/^http:/, 'https:').replace(/^\/\//, 'https:');
  const BACK = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 340 272' preserveAspectRatio='none'%3E%3Cpath d='M0 52Q0 34 18 34H150C168 34 170 0 196 0H320Q340 0 340 20V272H0Z'/%3E%3C/svg%3E\")";
  const FRONT = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 340 272' preserveAspectRatio='none'%3E%3Cpath d='M0 94Q0 74 20 74H118C140 74 142 106 166 106H320Q340 106 340 126V252Q340 272 320 272H20Q0 272 0 252Z'/%3E%3C/svg%3E\")";
  const CSS = `
.m21-fav-mask{position:fixed;inset:0;z-index:50;overflow:auto;background:rgb(8 9 11 / .72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:m21-fade .2s ease;
  background-image:radial-gradient(rgb(255 255 255 / .07) 1px,transparent 1.2px);background-size:22px 22px}
.m21-fav{max-width:1180px;margin:0 auto;padding:64px 40px 80px;color:#f3f3f5}
.m21-fav-head{display:flex;align-items:baseline;gap:14px;margin-bottom:34px}
.m21-fav-head h2{margin:0;font-size:24px;font-weight:600;letter-spacing:.01em}
.m21-fav-head small{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:rgb(255 255 255 / .5)}
.m21-fav-head .sp{flex:1}
.m21-fav-x,.m21-fav-back{height:34px;padding:0 14px;border-radius:10px;border:1px solid rgb(255 255 255 / .14);background:rgb(255 255 255 / .06);color:#eee;font-size:13px;cursor:pointer}
.m21-fav-x:hover,.m21-fav-back:hover{background:rgb(255 255 255 / .12)}
.m21-fav-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:44px 40px;perspective:1100px}
.m21-folder{position:relative;aspect-ratio:340/272;cursor:pointer;transform-style:preserve-3d;transition:transform .35s cubic-bezier(.2,.8,.2,1);outline:none;animation:m21-up .45s cubic-bezier(.2,.9,.25,1) both}
.m21-folder .bk{position:absolute;inset:0;-webkit-mask:${BACK} 0 0/100% 100% no-repeat;mask:${BACK} 0 0/100% 100% no-repeat;background:#d9dbe0 center/cover no-repeat;border-radius:18px}
.m21-folder .bk::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgb(255 255 255 / .1),rgb(0 0 0 / .15))}
.m21-folder .pp{position:absolute;left:8%;right:8%;top:18%;height:44%;border-radius:10px;background:#fff center/cover no-repeat;box-shadow:0 6px 18px rgb(0 0 0 / .25);transform:translateY(16px) rotate(0);transition:transform .45s cubic-bezier(.2,.9,.25,1)}
.m21-folder .pp.p2{left:14%;right:12%;opacity:.9;transform:translateY(20px) rotate(0)}
.m21-folder .fr{position:absolute;inset:0;-webkit-mask:${FRONT} 0 0/100% 100% no-repeat;mask:${FRONT} 0 0/100% 100% no-repeat;background:linear-gradient(160deg,rgb(255 255 255 / .82),rgb(244 245 248 / .7));backdrop-filter:blur(22px) saturate(1.4);-webkit-backdrop-filter:blur(22px) saturate(1.4);box-shadow:inset 0 1px 0 rgb(255 255 255 / .8)}
.m21-folder.dark .fr{background:linear-gradient(160deg,rgb(40 40 44 / .78),rgb(18 18 20 / .72))}
.m21-folder .meta{position:absolute;left:9%;bottom:12%;right:30%;color:#16171a;transform:translateZ(30px)}
.m21-folder.dark .meta{color:#f2f2f4}
.m21-folder .meta b{display:block;font-size:19px;font-weight:500;line-height:1.3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.m21-folder .meta small{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.55}
.m21-folder .go{position:absolute;right:7%;bottom:9%;width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(180deg,#2a2b2f,#0b0b0d);color:#fff;font-size:22px;box-shadow:0 10px 24px rgb(0 0 0 / .35),inset 0 1px 0 rgb(255 255 255 / .18);transform:translateZ(40px);transition:transform .25s}
.m21-folder.dark .go{background:linear-gradient(180deg,#fff,#e6e7ea);color:#111}
.m21-folder:hover .pp{transform:translateY(-22px) rotate(-4deg)}
.m21-folder:hover .pp.p2{transform:translateY(-8px) rotate(5deg)}
.m21-folder:hover .go{transform:translateZ(40px) scale(1.06)}
.m21-folder:focus-visible{box-shadow:0 0 0 2px #00aeec;border-radius:18px}
.m21-fav-hint{margin-top:46px;text-align:center;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.24em;color:rgb(255 255 255 / .35)}
.m21-fav-empty{padding:80px 0;text-align:center;color:rgb(255 255 255 / .6);font-size:14px}
.m21-fav-empty a{color:#00aeec}
.m21-fav-vids{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:26px 22px}
.m21-fav-vid{color:#eee;text-decoration:none;animation:m21-up .35s ease both}
.m21-fav-vid .c{position:relative;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#222 center/cover no-repeat;transition:transform .25s}
.m21-fav-vid:hover .c{transform:translateY(-3px)}
.m21-fav-vid .c span{position:absolute;right:6px;bottom:6px;padding:2px 6px;border-radius:5px;font-size:11px;background:rgb(0 0 0 / .6)}
.m21-fav-vid p{margin:9px 0 2px;font-size:13.5px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.m21-fav-vid small{font-size:12px;color:rgb(255 255 255 / .5)}
.m21-fav-more{display:block;margin:34px auto 0}
@media (prefers-reduced-motion: reduce){.m21-folder,.m21-folder .pp{transition:none;animation:none}}`;

  const dur = (s) => { s = Number(s) || 0; const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  let state = null;

  function shell(root) {
    root.querySelector('.m21-fav-mask')?.remove();
    const mask = document.createElement('div');
    mask.className = 'm21-fav-mask';
    mask.tabIndex = -1;
    mask.innerHTML = '<div class="m21-fav"></div>';
    mask.addEventListener('click', (e) => { if (e.target === mask || e.target.closest('.m21-fav-x')) mask.remove(); });
    mask.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (state?.folder) showFolders(mask); else mask.remove(); } });
    root.appendChild(mask);
    mask.focus();
    return mask;
  }

  function lean(el) {
    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      el.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 12}deg) translateZ(6px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  }

  function showFolders(mask) {
    state.folder = null;
    const box = mask.querySelector('.m21-fav');
    const fs = state.folders;
    box.innerHTML = `<div class="m21-fav-head"><h2>我的收藏夹</h2><small>${fs.length} folders · ${fs.reduce((a, f) => a + (f.media_count || 0), 0)} items</small><span class="sp"></span><button class="m21-fav-x">关闭</button></div>
      <div class="m21-fav-grid">${fs.map((f, i) => `<div class="m21-folder${i % 3 === 2 ? ' dark' : ''}" tabindex="0" data-id="${f.id}" style="animation-delay:${i * 40}ms">
        <div class="bk" style="background-image:url('${esc(https(f.cover))}')"></div>
        <div class="pp p2" style="background-image:url('${esc(https(f.cover))}')"></div>
        <div class="pp" style="background-image:url('${esc(https(f.cover))}')"></div>
        <div class="fr"></div>
        <div class="meta"><b>${esc(f.title)}</b><small>${f.media_count || 0} items${f.attr & 1 ? ' · 私密' : ''}</small></div>
        <div class="go" aria-hidden="true">○○○</div></div>`).join('')}</div>
      <div class="m21-fav-hint">HOVER TO LEAN · CLICK TO OPEN · ESC TO CLOSE</div>`;
    box.querySelectorAll('.m21-folder').forEach((el) => {
      lean(el);
      const openIt = () => showFolder(mask, fs.find((f) => String(f.id) === el.dataset.id));
      el.addEventListener('click', openIt);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIt(); } });
    });
  }

  async function showFolder(mask, f) {
    state.folder = f;
    const box = mask.querySelector('.m21-fav');
    box.innerHTML = `<div class="m21-fav-head"><button class="m21-fav-back">← 收藏夹</button><h2>${esc(f.title)}</h2><small>${f.media_count || 0} items</small><span class="sp"></span><button class="m21-fav-x">关闭</button></div><div class="m21-fav-vids"></div>`;
    box.querySelector('.m21-fav-back').addEventListener('click', () => showFolders(mask));
    const grid = box.querySelector('.m21-fav-vids');
    let pn = 1;
    const load = async () => {
      box.querySelector('.m21-fav-more')?.remove();
      let r;
      try { r = await j(`/x/v3/fav/resource/list?media_id=${f.id}&pn=${pn}&ps=20&order=mtime&type=0&tid=0&platform=web`); } catch (_) { r = null; }
      if (state.folder !== f) return;
      const list = r?.data?.medias || [];
      if (!list.length && pn === 1) { grid.outerHTML = '<div class="m21-fav-empty">这个收藏夹还是空的</div>'; return; }
      grid.insertAdjacentHTML('beforeend', list.map((m, i) => {
        const gone = m.attr === 9 || m.attr === 1;
        const href = m.bvid ? `https://www.bilibili.com/video/${m.bvid}` : (m.link || '#');
        return `<a class="m21-fav-vid" href="${esc(href)}" target="_blank" rel="noopener" style="animation-delay:${i * 25}ms"><div class="c" style="background-image:url('${esc(https(m.cover))}')">${m.duration ? `<span>${dur(m.duration)}</span>` : ''}</div><p>${esc(gone ? '（已失效）' + m.title : m.title)}</p><small>${esc(m.upper?.name || '')}</small></a>`;
      }).join(''));
      if (r?.data?.has_more) {
        pn++;
        const b = document.createElement('button'); b.className = 'm21-fav-back m21-fav-more'; b.textContent = '加载更多';
        b.addEventListener('click', load); box.appendChild(b);
      }
    };
    load();
  }

  async function open(root) {
    const mask = shell(root);
    const box = mask.querySelector('.m21-fav');
    box.innerHTML = '<div class="m21-fav-empty">正在读取收藏夹…</div>';
    try {
      const nav = await j('/x/web-interface/nav');
      if (!nav?.data?.isLogin) { box.innerHTML = '<div class="m21-fav-head"><h2>我的收藏夹</h2><span class="sp"></span><button class="m21-fav-x">关闭</button></div><div class="m21-fav-empty">登录 B 站后才能看到你的收藏夹 · <a href="https://passport.bilibili.com/login" target="_blank" rel="noopener">去登录</a></div>'; return; }
      const mid = nav.data.mid;
      const folders = [];
      for (let pn = 1; pn <= 5; pn++) {
        const r = await j(`/x/v3/fav/folder/created/list?up_mid=${mid}&pn=${pn}&ps=50`);
        const l = r?.data?.list || [];
        folders.push(...l);
        if (!r?.data?.has_more) break;
      }
      state = { folders, folder: null };
      if (!folders.length) { box.innerHTML = '<div class="m21-fav-empty">还没有收藏夹</div>'; return; }
      showFolders(mask);
    } catch (_) {
      box.innerHTML = '<div class="m21-fav-head"><h2>我的收藏夹</h2><span class="sp"></span><button class="m21-fav-x">关闭</button></div><div class="m21-fav-empty">收藏夹读取失败，稍后再试</div>';
    }
  }

  const ICON = '<svg xmlns="http://www.w3.org/2000/svg" class="mi" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M3 11h18"/></svg>';
  function ensure() {
    const root = document.getElementById('margin-extension')?.shadowRoot;
    if (!root) return;
    if (!root.getElementById('margin-fav-css')) { const s = document.createElement('style'); s.id = 'margin-fav-css'; s.textContent = CSS; root.appendChild(s); }
    const rail = root.querySelector('.v2-rail');
    if (rail && !rail.querySelector('.m21-fav-btn')) {
      const b = document.createElement('button');
      b.className = 'v2-rail-button m21-fav-btn';
      b.setAttribute('aria-label', '我的收藏夹');
      b.innerHTML = ICON + '<span class="v2-rail-tooltip">我的收藏夹<kbd>B 站</kbd></span>';
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(root); });
      const foot = rail.querySelector('.m21-foot-btn') || rail.querySelector('.v2-rail-divider');
      rail.insertBefore(b, foot || null);
    }
  }
  ensure();
  setInterval(ensure, 1500);
})();

/* 映间 MARGIN · Shader 背景：6 个 21st.dev 着色器的原生 WebGL 移植 + 自定义图片 */
(() => {
  if (window.__marginBg) return;
  window.__marginBg = true;
  const KEY = 'margin-bg-v1', IMG = 'margin-bg-image';
  const store = chrome?.storage?.local;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const HEAD = `precision highp float;uniform vec2 R;uniform float T;uniform vec2 M;uniform float D;
float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float nz(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),u.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,-.6,.6,.8);for(int i=0;i<4;i++){v+=a*nz(p);p=r*p*2.03+11.7;a*=.5;}return v;}
vec3 hx(float r,float g,float b){return vec3(r,g,b)/255.;}
float grain(){return h12(floor(gl_FragCoord.xy)+fract(T*7.)*97.)-.5;}
`;
  const SHADERS = [
    { id: 'leak', name: 'Light Leak', frag: `
float lobe(vec2 q,vec2 c,vec2 s){vec2 d=(q-c)/s;return exp(-dot(d,d));}
void main(){vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;float t=T;vec2 asp=vec2(R.x/R.y,1.);vec2 q=uv;
vec2 lamp=vec2(M.x,1.-M.y);vec2 dm=(q-lamp)*asp;float fall=exp(-dot(dm,dm)/.09);q+=(lamp-q)*fall*.08;
float ts=t*.06;vec2 w=vec2(fbm(q*1.4+vec2(0.,ts)),fbm(q*1.4+vec2(5.2,1.3-ts*.8)))-.5;q+=w*.2;
float sway=sin(q.x*3.3+t*.21)*.025+sin(q.x*7.1-t*.13)*.01;
float edge=.4+.2*smoothstep(.02,.5,q.x)-.1*smoothstep(.45,1.,q.x)+sway;float soft=mix(.03,.12,smoothstep(0.,.8,q.x))+.004;
float folded=smoothstep(edge+soft,edge-soft,q.y);vec2 lc=vec2(.32,.28);
float silver=(min(lobe(q,lc,vec2(.75,.52))*1.18,1.)*folded+lobe(q,lc+vec2(.1,.36),vec2(.24,.1))*.34)*.9;
vec3 ink=hx(6.,6.,9.),sil=hx(206.,206.,220.),lav=hx(170.,156.,220.),vio=hx(104.,74.,196.),emb=hx(196.,110.,80.);
vec3 col=mix(ink,mix(sil,lav,lobe(q,vec2(.5,.02),vec2(.3,.24))*.8),clamp(silver,0.,1.));
col=mix(col,vio,clamp(lobe(q,vec2(.7,0.),vec2(.27,.24))*.85,0.,1.)*.72);
col=mix(col,emb,clamp(lobe(q,vec2(.66,.28),vec2(.18,.09))*.35,0.,1.)*.75);
float sd=dot(q-vec2(.6,.37),vec2(.874,.486))+sway*.8;col=mix(col,vec3(0.),clamp(smoothstep(-.14,.26,sd)*.85*(1.-fall*.5),0.,1.)*.97);
col=mix(col,ink,smoothstep(.62,.92,uv.y)*.8);col+=sil*fall*.05;col+=grain()*.06;gl_FragColor=vec4(col,1.);}` },
    { id: 'wash', name: 'Shader Gradient', frag: `
float stp(float v,float at){float d=abs(v-at);d=min(d,1.-d);return smoothstep(0.,1.,1.-clamp(d*4.,0.,1.));}
void main(){vec2 uv=gl_FragCoord.xy/R;float a=R.x/R.y;vec2 p=vec2(uv.x*a,uv.y)*1.3;float t=T;
vec2 d=p-vec2(M.x*a,M.y)*1.3;p+=vec2(-d.y,d.x)*exp(-dot(d,d)*1.4)*.25;
vec2 q=vec2(fbm(p+vec2(0.,.12*t)),fbm(p+vec2(5.2,1.3)-.1*t));vec2 r=vec2(fbm(p+2.2*q+vec2(1.7,9.2)+.07*t),fbm(p+2.2*q+vec2(8.3,2.8)-.06*t));
float f=fbm(p+2.*r);float v=fract(f*2.4+.35*r.x+.02*t);
vec3 c=hx(247.,164.,139.)*stp(v,0.)+hx(249.,215.,142.)*stp(v,.25)+hx(159.,203.,240.)*stp(v,.5)+hx(187.,169.,238.)*stp(v,.75);
float air=smoothstep(.28,.72,fbm(p*.6-q+13.+.03*t));vec3 base=mix(hx(250.,248.,245.),hx(14.,14.,16.),D);
vec3 col=mix(base,c,mix(D>.5?.45:.82,1.,air)*(D>.5?.55:1.));col+=grain()*.035;gl_FragColor=vec4(col,1.);}` },
    { id: 'grain', name: 'Grain Gradient', loud: .2, frag: `
vec3 pal(float x){vec3 c0=hx(10.,10.,10.),c1=hx(63.,60.,187.),c2=hx(219.,75.,143.),c3=hx(255.,214.,107.);float f=clamp(x,0.,1.)*3.;
vec3 c=mix(c0,c1,smoothstep(0.,1.,clamp(f,0.,1.)));c=mix(c,c2,smoothstep(0.,1.,clamp(f-1.,0.,1.)));return mix(c,c3,smoothstep(0.,1.,clamp(f-2.,0.,1.)));}
void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=(gl_FragCoord.xy-.5*R)/min(R.x,R.y)*1.4;float t=T;
p+=.35*(vec2(fbm(p*1.2),fbm(p*1.2+vec2(5.2,1.3)))-.5);vec2 q=p;
q.x+=sin(q.y*2.1+t*.2)*.24;q.y+=cos(q.x*2.7-t*.17)*.19;float wave=.5+.5*sin(q.x*2.8+q.y*1.9+fbm(q*2.)*3.);
float g=(h12(floor((uv+t*.002)*220.))-.5)*.5*.42;vec3 col=pal(clamp(wave+g,0.,1.));col+=grain()*.12;gl_FragColor=vec4(col,1.);}` },
    { id: 'mesh', name: 'Mesh Gradient', loud: .08, frag: `
void main(){vec2 p=(gl_FragCoord.xy-.5*R)/min(R.x,R.y)*1.2;float t=T;p+=(M-.5)*.12;
p+=.3*(vec2(fbm(p*1.1),fbm(p*1.1+vec2(5.2,1.3)))-.5);
vec3 C[4];C[0]=hx(18.,13.,49.);C[1]=hx(108.,76.,241.);C[2]=hx(239.,93.,168.);C[3]=hx(255.,209.,102.);
vec3 col=C[0]*.16;float w=.16;for(int i=0;i<4;i++){float fi=float(i);vec2 c=vec2(sin(fi*2.17+t*.13+3.),cos(fi*1.63-t*.11))*.6;
float inf=exp(-dot(p-c,p-c)*4.5);col+=C[i]*inf;w+=inf;}col/=w;col+=grain()*.04;gl_FragColor=vec4(col,1.);}` },
    { id: 'silk', name: 'Silk', loud: .18, frag: `
vec3 pal(float x){vec3 c0=hx(0.,0.,0.),c1=hx(31.,81.,255.),c2=hx(0.,229.,255.),c3=hx(234.,253.,255.);float f=clamp(x,0.,1.)*3.;
vec3 c=mix(c0,c1,smoothstep(0.,1.,clamp(f,0.,1.)));c=mix(c,c2,smoothstep(0.,1.,clamp(f-1.,0.,1.)));return mix(c,c3,smoothstep(0.,1.,clamp(f-2.,0.,1.)));}
void main(){vec2 p=(gl_FragCoord.xy-.5*R)/min(R.x,R.y);float t=T*.5;p+=(M-.5)*.1;vec2 q=p*1.6;float amp=.62;
for(float i=1.;i<5.;i+=1.){q.x+=amp/i*cos(i*2.4*q.y+t*.8+2.);q.y+=amp/i*cos(i*1.7*q.x+t*.6);}
vec3 col=pal(pow(.5+.5*sin(q.x+q.y),1.6));col+=grain()*.035;gl_FragColor=vec4(col,1.);}` },
    { id: 'aurora', name: 'Aurora', frag: `
vec3 au(vec2 uv,float sp,float k,vec3 c,float a){float tm=T*.35*sp;vec2 pt=vec2(uv.x*a,uv.y)*2.2+tm*vec2(-.12,.04);
float n=nz(pt+nz(c.xy+pt+tm));return c*max(n-uv.y*1.1,0.)*k;}
void main(){vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;float a=R.x/R.y;vec3 col=vec3(0.);
col+=au(uv,1.,1.1,hx(64.,224.,170.),a);col+=au(uv,.8,.9,hx(80.,120.,255.),a);col+=au(uv,1.3,.7,hx(170.,90.,255.),a);col+=au(uv,.6,.5,hx(255.,120.,190.),a);
col=col*1.25+hx(6.,8.,20.)+hx(14.,20.,52.)*(1.-smoothstep(0.,.9,uv.y));col+=grain()*.03;gl_FragColor=vec4(col,1.);}` },
  ];
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  function makeGL(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
    if (!gl) return null;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const progs = {};
    const prog = (s) => {
      if (progs[s.id]) return progs[s.id];
      const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(s.id + ': ' + gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, HEAD + s.frag));
      gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(s.id + ': ' + gl.getProgramInfoLog(p));
      return (progs[s.id] = { p, R: gl.getUniformLocation(p, 'R'), T: gl.getUniformLocation(p, 'T'), M: gl.getUniformLocation(p, 'M'), D: gl.getUniformLocation(p, 'D') });
    };
    const draw = (s, t, m, dark) => {
      const P = prog(s);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(P.p);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(P.R, canvas.width, canvas.height); gl.uniform1f(P.T, t); gl.uniform2f(P.M, m[0], m[1]); gl.uniform1f(P.D, dark ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    return { gl, draw };
  }

  let cfg = { mode: 'random', shader: 'leak', strength: 0.6 };
  let img = '';
  let current = null; // shader object in use
  let layer = null, renderer = null, raf = 0, last = 0, t0 = performance.now() - Math.random() * 60000;
  const mouse = [0.5, 0.5], mTarget = [0.5, 0.5];
  addEventListener('pointermove', (e) => { mTarget[0] = e.clientX / innerWidth; mTarget[1] = 1 - e.clientY / innerHeight; }, { passive: true });

  const CSS = `
.m21-bg-on{isolation:isolate}
.m21-bg{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden;transition:opacity .6s ease}
.m21-bg canvas,.m21-bg .img{position:absolute;inset:0;width:100%;height:100%;display:block}
.m21-bg .img{background:center/cover no-repeat}
.m21-bg .veil{position:absolute;inset:0;background:var(--canvas);opacity:var(--m21-veil,.5)}
.m21-bg-on .v2-header,.m21-bg-on .v2-controls{background:color-mix(in srgb,var(--canvas) 58%,transparent)!important;backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2)}
.m21-bg-panel{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgb(0 0 0 / .45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:m21-fade .2s ease}
.m21-bg-card{width:min(640px,92vw);max-height:88vh;overflow:auto;padding:26px 26px 22px;border-radius:20px;background:var(--canvas);color:var(--ink);border:1px solid var(--line);box-shadow:0 30px 80px rgb(0 0 0 / .35)}
.m21-bg-card h3{margin:0 0 4px;font-size:18px;font-weight:600}
.m21-bg-card .sub{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.5;letter-spacing:.08em}
.m21-bg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0 18px}
.m21-bg-opt{position:relative;aspect-ratio:16/10;border-radius:12px;overflow:hidden;cursor:pointer;background:#1b1b1d center/cover no-repeat;border:1px solid var(--line);transition:transform .2s,box-shadow .2s;display:flex;align-items:flex-end;padding:0;color:#fff;font-size:11.5px}
.m21-bg-opt span{width:100%;padding:16px 8px 6px;text-align:left;background:linear-gradient(transparent,rgb(0 0 0 / .55))}
.m21-bg-opt:hover{transform:translateY(-2px)}
.m21-bg-opt.on{box-shadow:0 0 0 2px var(--canvas),0 0 0 4px #00aeec}
.m21-bg-opt.txt{align-items:center;justify-content:center;background:color-mix(in srgb,var(--ink) 6%,transparent);color:var(--ink);font-size:13px}
.m21-bg-opt.txt span{background:none;padding:0;text-align:center}
.m21-bg-row{display:flex;align-items:center;gap:12px;font-size:13px}
.m21-bg-row input[type=range]{flex:1;accent-color:#00aeec}
.m21-bg-foot{display:flex;justify-content:space-between;align-items:center;margin-top:18px;gap:10px}
.m21-bg-btn{height:34px;padding:0 14px;border-radius:10px;border:1px solid var(--line)!important;background:color-mix(in srgb,var(--ink) 5%,transparent)!important;font-size:13px}
.m21-bg-btn:hover{background:color-mix(in srgb,var(--ink) 10%,transparent)!important}`;

  const app = () => document.getElementById('margin-extension')?.shadowRoot?.querySelector('.margin-app');
  const isDark = (el) => { const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g); if (!m) return true; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) < 128; };
  const pick = () => {
    if (cfg.mode === 'shader') return SHADERS.find((s) => s.id === cfg.shader) || SHADERS[0];
    let prev = ''; try { prev = sessionStorage.getItem('margin-bg-last') || ''; } catch (_) {}
    const pool = SHADERS.filter((s) => s.id !== prev);
    const s = pool[Math.floor(Math.random() * pool.length)];
    try { sessionStorage.setItem('margin-bg-last', s.id); } catch (_) {}
    return s;
  };

  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function teardown() { stop(); renderer = null; layer?.remove(); layer = null; app()?.classList.remove('m21-bg-on'); }

  function size() {
    if (!layer) return;
    const c = layer.querySelector('canvas'); if (!c) return;
    const s = 0.5; // 半分辨率：柔和背景足够清晰，GPU 开销降为 1/4
    const w = Math.max(2, Math.round(layer.clientWidth * s)), h = Math.max(2, Math.round(layer.clientHeight * s));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; frame(performance.now(), true); }
  }

  function frame(now, force) {
    if (!renderer || !layer) return;
    if (!force && now - last < 33) return; // ≈30fps
    last = now;
    mouse[0] += (mTarget[0] - mouse[0]) * 0.06; mouse[1] += (mTarget[1] - mouse[1]) * 0.06;
    try { renderer.draw(current, (now - t0) / 1000, mouse, layer.dataset.dark === '1'); } catch (e) { console.warn('[MARGIN bg]', e); teardown(); }
  }
  function loop(now) { raf = requestAnimationFrame(loop); frame(now); }
  function play() {
    stop();
    if (!renderer) return;
    if (reduce.matches || document.hidden) { frame(performance.now(), true); return; }
    raf = requestAnimationFrame(loop);
  }

  function veil(dark) {
    // strength 1 = 最鲜明；veil 是覆盖在背景上的底色比例
    const base = (dark ? 0.18 : 0.42) + (layer?.dataset.kind === 'shader' ? (current?.loud || 0) : 0);
    return Math.min(0.95, base + (1 - cfg.strength) * 0.6);
  }

  function mount() {
    const a = app(); if (!a) return;
    const root = a.getRootNode();
    if (!root.getElementById('margin-bg-css')) { const s = document.createElement('style'); s.id = 'margin-bg-css'; s.textContent = CSS; root.appendChild(s); }
    const want = cfg.mode === 'off' ? 'off' : (cfg.mode === 'image' && img ? 'image' : 'shader');
    if (want === 'off') { teardown(); return; }
    if (layer && layer.isConnected && layer.parentNode === a && layer.dataset.kind === want && (want === 'image' || layer.dataset.shader === current?.id)) {
      const d = isDark(a); layer.dataset.dark = d ? '1' : '0'; layer.style.setProperty('--m21-veil', veil(d)); return;
    }
    teardown();
    layer = document.createElement('div');
    layer.className = 'm21-bg'; layer.dataset.kind = want;
    const d = isDark(a); layer.dataset.dark = d ? '1' : '0';
    layer.style.setProperty('--m21-veil', veil(d));
    if (want === 'image') {
      layer.innerHTML = '<div class="img"></div><div class="veil"></div>';
      layer.querySelector('.img').style.backgroundImage = `url("${img}")`;
    } else {
      if (!current) current = pick();
      layer.dataset.shader = current.id;
      layer.innerHTML = '<canvas></canvas><div class="veil"></div>';
      renderer = makeGL(layer.querySelector('canvas'));
      if (!renderer) { layer.remove(); layer = null; return; }
    }
    layer.style.setProperty('--m21-veil', veil(d));
    a.prepend(layer);
    a.classList.add('m21-bg-on');
    size(); play();
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));
  reduce.addEventListener?.('change', play);
  addEventListener('resize', size);

  async function thumbs() {
    const c = document.createElement('canvas'); c.width = 240; c.height = 150;
    const r = makeGL(c); const out = {};
    if (!r) return out;
    for (const s of SHADERS) { try { r.draw(s, 24, [0.5, 0.5], true); out[s.id] = c.toDataURL('image/jpeg', 0.8); } catch (_) {} }
    r.gl.getExtension('WEBGL_lose_context')?.loseContext();
    return out;
  }
  let thumbCache = null;

  function save() { store?.set({ [KEY]: cfg }); }

  async function compress(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.86);
  }

  async function panel(root) {
    root.querySelector('.m21-bg-panel')?.remove();
    const wrap = document.createElement('div'); wrap.className = 'm21-bg-panel';
    thumbCache = thumbCache || await thumbs();
    const opt = (key, label, bg, cls = '') => `<button class="m21-bg-opt ${cls}" data-k="${key}" style="${bg ? `background-image:url('${bg}')` : ''}"><span>${label}</span></button>`;
    const render = () => {
      const sel = cfg.mode === 'shader' ? 's:' + cfg.shader : cfg.mode;
      wrap.innerHTML = `<div class="m21-bg-card" role="dialog" aria-label="背景">
        <h3>背景</h3><div class="sub">SHADER · RANDOM · IMAGE</div>
        <div class="m21-bg-grid">
          ${opt('random', '每次随机', '', 'txt')}
          ${SHADERS.map((s) => opt('s:' + s.id, s.name, thumbCache[s.id])).join('')}
          ${opt('image', img ? '自定义图片' : '上传图片…', img, img ? '' : 'txt')}
        </div>
        <div class="m21-bg-row"><span>强度</span><input type="range" min="0" max="1" step="0.05" value="${cfg.strength}"><span class="v">${Math.round(cfg.strength * 100)}%</span></div>
        <div class="m21-bg-foot"><div style="display:flex;gap:8px"><button class="m21-bg-btn" data-a="upload">${img ? '更换图片' : '上传图片'}</button>${img ? '<button class="m21-bg-btn" data-a="clear">删除图片</button>' : ''}<button class="m21-bg-btn" data-a="off">${cfg.mode === 'off' ? '已关闭' : '关闭背景'}</button></div><button class="m21-bg-btn" data-a="close">完成</button></div>
        <input type="file" accept="image/*" hidden></div>`;
      wrap.querySelectorAll('.m21-bg-opt').forEach((b) => b.classList.toggle('on', b.dataset.k === sel));
    };
    render();
    wrap.addEventListener('click', async (e) => {
      if (e.target === wrap) return wrap.remove();
      const o = e.target.closest('.m21-bg-opt'), a = e.target.closest('[data-a]')?.dataset.a;
      if (o) {
        const k = o.dataset.k;
        if (k === 'random') { cfg.mode = 'random'; current = pick(); }
        else if (k === 'image') { if (!img) return wrap.querySelector('input[type=file]').click(); cfg.mode = 'image'; }
        else { cfg.mode = 'shader'; cfg.shader = k.slice(2); current = pick(); }
        save(); mount(); render();
      } else if (a === 'upload') wrap.querySelector('input[type=file]').click();
      else if (a === 'clear') { img = ''; store?.remove(IMG); if (cfg.mode === 'image') { cfg.mode = 'random'; current = pick(); } save(); mount(); render(); }
      else if (a === 'off') { cfg.mode = 'off'; save(); mount(); render(); }
      else if (a === 'close') wrap.remove();
    });
    wrap.addEventListener('change', async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      try { img = await compress(f); await store?.set({ [IMG]: img }); cfg.mode = 'image'; save(); mount(); render(); }
      catch (_) { alert('图片读取失败，换一张试试'); }
    });
    wrap.addEventListener('input', (e) => {
      if (e.target.type !== 'range') return;
      cfg.strength = Number(e.target.value); wrap.querySelector('.v').textContent = Math.round(cfg.strength * 100) + '%';
      if (layer) layer.style.setProperty('--m21-veil', veil(layer.dataset.dark === '1'));
      save();
    });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') wrap.remove(); });
    (app() || root).appendChild(wrap);
  }

  const ICON = '<svg xmlns="http://www.w3.org/2000/svg" class="mi" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 15c3-3 5.5-3.5 8-1.5S16 16 21 11"/><circle cx="8.5" cy="9" r="1.5"/></svg>';
  function ensure() {
    mount();
    const a = app(); const root = a?.getRootNode(); if (!root) return;
    const rail = root.querySelector('.v2-rail');
    if (rail && !rail.querySelector('.m21-bg-btn-rail')) {
      const b = document.createElement('button');
      b.className = 'v2-rail-button m21-bg-btn-rail';
      b.setAttribute('aria-label', '背景');
      b.innerHTML = ICON + '<span class="v2-rail-tooltip">背景<kbd>Shader</kbd></span>';
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); panel(root); });
      rail.insertBefore(b, rail.querySelector('.m21-fav-btn') || rail.querySelector('.m21-foot-btn') || rail.querySelector('.v2-rail-divider') || null);
    }
  }
  const boot = () => { ensure(); setInterval(ensure, 1500); };
  if (store) store.get([KEY, IMG], (r) => { if (r?.[KEY]) cfg = { ...cfg, ...r[KEY] }; img = r?.[IMG] || ''; boot(); });
  else boot();
})();
